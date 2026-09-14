"""Unit tests for origin-network comparison (#69, ADR 0011 decision 5).

Seams under test:
- parse_client_address (normalisation, IPv4-mapped IPv6, unusable input)
- origin_network (the /24 or /64 an address belongs to)
- is_different_network (the anomaly verdict, and its absent-is-not-mismatched rule)
"""

import pytest

from app.utils.origin_network import (
    is_different_network,
    origin_network,
    parse_client_address,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("192.0.2.10", "192.0.2.10"),
        ("  192.0.2.10  ", "192.0.2.10"),
        ("2001:db8::1", "2001:db8::1"),
        # An IPv4 client reaching a dual-stack socket is reported mapped. It is
        # the same host as the dotted-quad form and must normalise to it.
        ("::ffff:192.0.2.10", "192.0.2.10"),
        ("::ffff:c000:20a", "192.0.2.10"),
    ],
)
def test_parse_client_address_normalises_usable_addresses(raw: str, expected: str) -> None:
    parsed = parse_client_address(raw)
    assert parsed is not None
    assert str(parsed) == expected


@pytest.mark.parametrize("raw", [None, "", "   ", "Unknown", "not-an-ip", "192.0.2.10:443", "192.0.2"])
def test_parse_client_address_returns_none_for_unusable_input(raw: str | None) -> None:
    """Anything that is not an address is absent, never a value to compare."""
    assert parse_client_address(raw) is None


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("192.0.2.10", "192.0.2.0/24"),
        ("192.0.2.255", "192.0.2.0/24"),
        ("2001:db8:1:2:3:4:5:6", "2001:db8:1:2::/64"),
        ("::ffff:192.0.2.10", "192.0.2.0/24"),
    ],
)
def test_origin_network_uses_slash_24_and_slash_64(raw: str, expected: str) -> None:
    assert origin_network(raw) == expected


def test_origin_network_is_none_for_unusable_input() -> None:
    assert origin_network("Unknown") is None


@pytest.mark.parametrize(
    ("recorded", "presented"),
    [
        ("192.0.2.10", "192.0.2.10"),
        ("192.0.2.10", "192.0.2.200"),
        ("::ffff:192.0.2.10", "192.0.2.200"),
        ("2001:db8:1:2::5", "2001:db8:1:2:aaaa::9"),
    ],
)
def test_same_network_is_not_a_mismatch(recorded: str, presented: str) -> None:
    assert is_different_network(recorded, presented) is False


@pytest.mark.parametrize(
    ("recorded", "presented"),
    [
        ("192.0.2.10", "198.51.100.10"),
        ("192.0.2.10", "192.0.3.10"),
        ("2001:db8:1:2::5", "2001:db8:1:3::5"),
        # Different families cannot be the same network.
        ("192.0.2.10", "2001:db8:1:2::5"),
    ],
)
def test_different_network_is_a_mismatch(recorded: str, presented: str) -> None:
    assert is_different_network(recorded, presented) is True


@pytest.mark.parametrize(
    ("recorded", "presented"),
    [
        (None, "198.51.100.10"),
        ("", "198.51.100.10"),
        ("192.0.2.10", None),
        ("192.0.2.10", "Unknown"),
        (None, None),
    ],
)
def test_absent_is_not_mismatched(recorded: str | None, presented: str | None) -> None:
    """A session predating this feature, or a request with no usable address,
    refreshes normally rather than being revoked (ADR 0011 decision 5)."""
    assert is_different_network(recorded, presented) is False
