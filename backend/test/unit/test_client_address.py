"""Unit tests for real-client-address resolution behind a reverse proxy (#203).

Seams under test:
- parse_trusted_proxies (configuration, and the wildcard it must refuse)
- resolve_client_address (whose address a request is attributed to)
- ProxyHeadersMiddleware (the single place ``request.client`` is corrected)
- get_client_ip (the one reader the rest of the app shares)
"""

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.core.rate_limit import UNKNOWN_CLIENT_KEY, client_address_key
from app.utils.client_address import (
    ProxyHeadersMiddleware,
    TrustedProxyError,
    get_client_ip,
    parse_trusted_proxies,
    resolve_client_address,
)

NGINX = "10.0.0.2"
CLIENT = "203.0.113.7"
OTHER_CLIENT = "198.51.100.9"
TRUSTED = parse_trusted_proxies([NGINX])


# --- parse_trusted_proxies -------------------------------------------------


def test_parse_trusted_proxies_accepts_addresses_and_networks() -> None:
    """A bare address is the /32 (or /128) containing it, so both forms compare alike."""
    parsed = parse_trusted_proxies(["10.0.0.2", "172.16.0.0/12", "::1"])
    assert [str(network) for network in parsed] == ["10.0.0.2/32", "172.16.0.0/12", "::1/128"]


@pytest.mark.parametrize("raw", [None, [], "", "   ", ",", ["", "  "]])
def test_parse_trusted_proxies_treats_empty_configuration_as_no_proxies(raw: object) -> None:
    """Trusting nothing is the safe end of the range, and must stay expressible."""
    assert parse_trusted_proxies(raw) == ()


def test_parse_trusted_proxies_accepts_a_comma_separated_string() -> None:
    assert [str(n) for n in parse_trusted_proxies("10.0.0.2, ::1")] == ["10.0.0.2/32", "::1/128"]


@pytest.mark.parametrize("wildcard", ["*", "0.0.0.0/0", "::/0"])
def test_parse_trusted_proxies_refuses_a_wildcard(wildcard: str) -> None:
    """Trusting everyone lets any client forge its own rate-limit bucket and audit identity."""
    with pytest.raises(TrustedProxyError):
        parse_trusted_proxies([wildcard])


@pytest.mark.parametrize("raw", ["not-an-address", "10.0.0.0/64", "10.0.0.2:8080"])
def test_parse_trusted_proxies_refuses_unparseable_entries(raw: str) -> None:
    """A typo must fail loudly at startup rather than silently trust nothing."""
    with pytest.raises(TrustedProxyError):
        parse_trusted_proxies([raw])


# --- resolve_client_address ------------------------------------------------


def test_trusted_peer_with_forwarded_header_is_attributed_to_the_client() -> None:
    assert (
        resolve_client_address(NGINX, forwarded_for=CLIENT, real_ip=CLIENT, trusted_proxies=TRUSTED) == CLIENT
    )


def test_untrusted_peer_forging_a_forwarded_header_is_attributed_to_itself() -> None:
    """The forged header is ignored entirely; the peer answers for its own requests."""
    assert (
        resolve_client_address(CLIENT, forwarded_for="1.2.3.4", real_ip="1.2.3.4", trusted_proxies=TRUSTED)
        == CLIENT
    )


def test_no_forwarded_header_is_attributed_to_the_peer() -> None:
    assert resolve_client_address(CLIENT, trusted_proxies=TRUSTED) == CLIENT
    assert resolve_client_address(NGINX, trusted_proxies=TRUSTED) == NGINX


def test_forwarded_chain_is_read_from_the_right_past_trusted_proxies() -> None:
    """nginx appends the peer it saw, so a client-supplied prefix cannot displace it."""
    forwarded = f"1.2.3.4, {CLIENT}, {NGINX}"
    assert resolve_client_address(NGINX, forwarded_for=forwarded, trusted_proxies=TRUSTED) == CLIENT


def test_forwarded_chain_of_only_trusted_proxies_falls_back_to_real_ip() -> None:
    assert (
        resolve_client_address(NGINX, forwarded_for=NGINX, real_ip=CLIENT, trusted_proxies=TRUSTED) == CLIENT
    )


def test_unparseable_forwarded_header_falls_back_rather_than_attributing_garbage() -> None:
    assert (
        resolve_client_address(NGINX, forwarded_for="<script>", real_ip=CLIENT, trusted_proxies=TRUSTED)
        == CLIENT
    )
    assert resolve_client_address(NGINX, forwarded_for="<script>", trusted_proxies=TRUSTED) == NGINX


def test_ipv4_mapped_forwarded_entry_normalises_to_its_dotted_quad() -> None:
    assert resolve_client_address(NGINX, forwarded_for=f"::ffff:{CLIENT}", trusted_proxies=TRUSTED) == CLIENT


def test_absent_peer_stays_absent() -> None:
    """A request with no peer (ASGI allows it) has no address to invent."""
    assert resolve_client_address(None, forwarded_for=CLIENT, trusted_proxies=TRUSTED) is None


def test_empty_trust_configuration_ignores_every_forwarded_header() -> None:
    assert resolve_client_address(NGINX, forwarded_for=CLIENT, trusted_proxies=()) == NGINX


# --- middleware and the shared reader --------------------------------------


def _app(trusted_proxies: object) -> FastAPI:
    app = FastAPI()

    @app.get("/who")
    async def who(request: Request) -> dict[str, str | None]:
        return {"client": get_client_ip(request)}

    app.add_middleware(ProxyHeadersMiddleware, trusted_proxies=trusted_proxies)
    return app


def _ask(app: FastAPI, peer: str, headers: dict[str, str] | None = None) -> str | None:
    with TestClient(app, client=(peer, 50000)) as client:
        return client.get("/who", headers=headers or {}).json()["client"]


def test_middleware_rewrites_the_client_for_a_trusted_peer() -> None:
    assert _ask(_app(TRUSTED), NGINX, {"X-Forwarded-For": CLIENT}) == CLIENT


def test_middleware_leaves_an_untrusted_peer_alone() -> None:
    assert _ask(_app(TRUSTED), CLIENT, {"X-Forwarded-For": "1.2.3.4"}) == CLIENT


def test_middleware_is_a_noop_without_forwarded_headers() -> None:
    assert _ask(_app(TRUSTED), CLIENT) == CLIENT


def test_two_clients_behind_the_proxy_are_told_apart() -> None:
    """Separate addresses are what give rate limiting separate buckets."""
    app = _app(TRUSTED)
    assert _ask(app, NGINX, {"X-Forwarded-For": CLIENT}) == CLIENT
    assert _ask(app, NGINX, {"X-Forwarded-For": OTHER_CLIENT}) == OTHER_CLIENT


# --- configuration and the consumers ---------------------------------------


def test_settings_accept_a_proxy_network() -> None:
    settings = Settings(TRUSTED_PROXIES=["172.16.0.0/12"])  # type: ignore[arg-type]
    assert settings.TRUSTED_PROXIES == ["172.16.0.0/12"]


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ('["10.0.0.2","::1"]', ["10.0.0.2", "::1"]),
        ("10.0.0.2, ::1", ["10.0.0.2", "::1"]),
        # The form an operator reaches for first. It must not fail to boot.
        ("172.16.0.0/12", ["172.16.0.0/12"]),
    ],
)
def test_settings_read_both_environment_forms(
    monkeypatch: pytest.MonkeyPatch, raw: str, expected: list[str]
) -> None:
    monkeypatch.setenv("TRUSTED_PROXIES", raw)
    assert Settings().TRUSTED_PROXIES == expected  # type: ignore[call-arg]


def test_settings_default_to_loopback_only() -> None:
    """Safe by default: a proxy elsewhere has to be named before it is believed."""
    assert Settings().TRUSTED_PROXIES == ["127.0.0.1", "::1"]  # type: ignore[call-arg]


@pytest.mark.parametrize("wildcard", ["*", "0.0.0.0/0", "::/0"])
def test_settings_refuse_a_wildcard_trusted_proxy(wildcard: str) -> None:
    """Rejected at startup, so no deployment can express "trust everyone"."""
    with pytest.raises(ValidationError):
        Settings(TRUSTED_PROXIES=[wildcard])  # type: ignore[arg-type]


def _request(client: tuple[str, int] | None) -> Request:
    return Request({"type": "http", "method": "GET", "path": "/", "headers": [], "client": client})


def test_rate_limit_keys_on_the_resolved_client_address() -> None:
    """Two clients behind one proxy get two buckets, not one global quota."""
    assert client_address_key(_request((CLIENT, 40000))) == CLIENT
    assert client_address_key(_request((OTHER_CLIENT, 40000))) == OTHER_CLIENT
    assert client_address_key(_request((CLIENT, 40000))) != client_address_key(
        _request((OTHER_CLIENT, 40000))
    )


def test_rate_limit_key_for_a_request_without_a_peer() -> None:
    assert client_address_key(_request(None)) == UNKNOWN_CLIENT_KEY
