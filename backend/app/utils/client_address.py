"""Resolve the address a request actually came from, behind a reverse proxy.

nginx proxies to the backend and sets ``X-Real-IP`` and ``X-Forwarded-For``
correctly, but it is a separate container, so uvicorn -- which trusts forwarded
headers only from ``127.0.0.1`` -- discards them. Every request then appears to
originate from the proxy: HTTP rate limiting collapses into one global bucket,
security events record nginx's address, and origin-network detection has
nothing to compare (ADR 0011 decision 8, #203).

Two rules shape everything here.

**Forwarded headers are evidence only from a trusted peer.** A request whose
immediate peer is not a configured proxy is attributed to that peer, headers
and all ignored. Trusting them from anywhere -- a wildcard -- would let any
client forge its rate-limit bucket, its origin network, and its audit-log
identity in a single request, so ``parse_trusted_proxies`` refuses to express
one.

**There is exactly one reader.** ``ProxyHeadersMiddleware`` corrects
``scope["client"]`` once, at the edge, and everything downstream --
``get_client_ip``, the slowapi key function, the security-event log -- reads
that. A second notion of "client IP" is how the three consumers would drift
apart again.
"""

from __future__ import annotations

from ipaddress import IPv4Network, IPv6Network, ip_network
from typing import Any, Iterable, Sequence

from starlette.requests import Request
from starlette.types import ASGIApp, Receive, Scope, Send

# The same parse both modules need: an address, normalised, or None when the
# text is not one. Origin-network detection compares what this returns, so a
# second parser here would be a second answer to "which host is this".
from app.utils.origin_network import parse_client_address

TrustedProxies = tuple[IPv4Network | IPv6Network, ...]

#: Values that would trust every peer. Rejected rather than honoured.
WILDCARD_VALUES = frozenset({"*"})

FORWARDED_FOR_HEADER = b"x-forwarded-for"
REAL_IP_HEADER = b"x-real-ip"


class TrustedProxyError(ValueError):
    """The trusted-proxy configuration cannot be used as written.

    Raised at settings load rather than per request: a topology that names its
    proxies wrongly should fail to start, not quietly attribute every request
    to the proxy it meant to trust.
    """


def split_entries(values: str | Iterable[str] | None) -> list[str]:
    """The non-empty entries of a comma-separated string or a sequence.

    Shared by the settings validator and the forwarded-header walk so that
    "how a list of addresses is written" has one answer.

    >>> split_entries("10.0.0.2, ::1")
    ['10.0.0.2', '::1']
    """
    if values is None:
        return []
    if isinstance(values, str):
        values = values.split(",")
    return [entry.strip() for entry in values if entry and entry.strip()]


def parse_trusted_proxies(values: str | Iterable[str] | None) -> TrustedProxies:
    """Parse the configured trusted-proxy set.

    Accepts a comma-separated string or a sequence, of bare addresses or CIDR
    networks. A bare address becomes the single-host network containing it, so
    both forms compare the same way.

    >>> [str(n) for n in parse_trusted_proxies("10.0.0.2, 172.16.0.0/12")]
    ['10.0.0.2/32', '172.16.0.0/12']
    >>> parse_trusted_proxies(None)
    ()
    """
    networks: list[IPv4Network | IPv6Network] = []
    for entry in split_entries(values):
        if entry in WILDCARD_VALUES:
            raise TrustedProxyError(
                f"{entry!r} would trust forwarded headers from every peer, which lets any "
                "client forge its own address. Name the proxy or its network instead."
            )
        try:
            network = ip_network(entry, strict=False)
        except ValueError as exc:
            raise TrustedProxyError(f"{entry!r} is not an IP address or CIDR network: {exc}") from exc
        if network.prefixlen == 0:
            raise TrustedProxyError(
                f"{entry!r} covers every address, which lets any client forge its own address. "
                "Name the proxy or its network instead."
            )
        networks.append(network)
    return tuple(networks)


def is_trusted_proxy(address: str | None, trusted_proxies: TrustedProxies) -> bool:
    """Whether ``address`` is one of the configured reverse proxies."""
    parsed = parse_client_address(address)
    if parsed is None:
        return False
    return any(parsed in network for network in trusted_proxies)


def resolve_client_address(
    peer: str | None,
    *,
    forwarded_for: str | None = None,
    real_ip: str | None = None,
    trusted_proxies: TrustedProxies = (),
) -> str | None:
    """The address to attribute a request to.

    ``peer`` is the socket's own view of who connected -- the only part a client
    cannot lie about. When it is not a trusted proxy the headers are evidence of
    nothing and the peer is the answer.

    ``X-Forwarded-For`` is read right to left, past entries that are themselves
    trusted proxies: nginx *appends* the peer it saw, so anything a client put
    in the header sits to the left of the truth and can never displace it.
    ``X-Real-IP`` is the fallback for a chain that is missing, unusable, or made
    entirely of proxies.

    >>> trusted = parse_trusted_proxies(["10.0.0.2"])
    >>> resolve_client_address("10.0.0.2", forwarded_for="1.2.3.4, 203.0.113.7",
    ...                        trusted_proxies=trusted)
    '203.0.113.7'
    >>> resolve_client_address("203.0.113.7", forwarded_for="1.2.3.4", trusted_proxies=trusted)
    '203.0.113.7'
    """
    if not is_trusted_proxy(peer, trusted_proxies):
        return peer

    for entry in reversed(split_entries(forwarded_for)):
        parsed = parse_client_address(entry)
        if parsed is None:
            # A chain the proxy did not write, or one a client corrupted. Stop
            # here rather than reach further left into attacker-controlled text.
            break
        if not is_trusted_proxy(str(parsed), trusted_proxies):
            return str(parsed)

    forwarded_real_ip = parse_client_address(real_ip)
    if forwarded_real_ip is not None and not is_trusted_proxy(str(forwarded_real_ip), trusted_proxies):
        return str(forwarded_real_ip)

    return peer


def get_client_ip(request: Request) -> str | None:
    """The client address of a request, as corrected by ``ProxyHeadersMiddleware``.

    The one reader every consumer shares. It stays a function rather than an
    inlined ``request.client.host`` so that rate limiting, the audit trail, and
    origin-network detection cannot develop separate answers.
    """
    client = getattr(request, "client", None)
    return getattr(client, "host", None) if client is not None else None


class ProxyHeadersMiddleware:
    """Correct ``scope["client"]`` once, before anything downstream reads it.

    Pure ASGI rather than ``BaseHTTPMiddleware`` because it rewrites the scope,
    and it must be the outermost layer: slowapi keys its buckets off the client
    address, so a middleware running after it would key on the proxy.
    """

    def __init__(
        self,
        app: ASGIApp,
        trusted_proxies: str | Iterable[str] | TrustedProxies | None,
    ) -> None:
        self.app = app
        self.trusted_proxies: TrustedProxies = (
            trusted_proxies if isinstance(trusted_proxies, tuple) else parse_trusted_proxies(trusted_proxies)
        )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket") or not self.trusted_proxies:
            await self.app(scope, receive, send)
            return

        client: Sequence[Any] | None = scope.get("client")
        peer = client[0] if client else None
        headers = dict(scope.get("headers", []))
        resolved = resolve_client_address(
            peer,
            forwarded_for=_decode(headers.get(FORWARDED_FOR_HEADER)),
            real_ip=_decode(headers.get(REAL_IP_HEADER)),
            trusted_proxies=self.trusted_proxies,
        )
        if resolved is not None and resolved != peer:
            # The port belongs to the proxy's connection, not the client's, and
            # nothing recovers the client's. Keep the shape, drop the claim.
            scope["client"] = (resolved, 0)

        await self.app(scope, receive, send)


def _decode(value: bytes | None) -> str | None:
    if value is None:
        return None
    return value.decode("latin-1")
