"""Compare where a session was established against where it is being used.

``VALIDATE_TOKEN_IP`` is origin-network *anomaly detection*, not IP binding
(ADR 0011 decision 5). Binding to a single address logs out every user who
moves between wifi and mobile data, while an attacker sharing the victim's NAT
passes it unchanged; comparing at network granularity keeps the signal and
drops most of that cost.

The unit is the IPv4 /24 or the IPv6 /64. Addresses are parsed with the
standard library rather than split on dots, because an IPv4 client reaching a
dual-stack socket is reported as an IPv4-mapped IPv6 address and is the same
host as its dotted-quad form.

Absent is not mismatched. An address the caller could not determine, and a
session recorded before this shipped, both refresh normally -- a detection
signal that revokes on missing data would revoke on nothing at all.
"""

from ipaddress import IPv4Address, IPv6Address, ip_address, ip_network

IPV4_NETWORK_PREFIX = 24
IPV6_NETWORK_PREFIX = 64


def parse_client_address(raw: str | None) -> IPv4Address | IPv6Address | None:
    """Parse a client address, or return None when ``raw`` is not one.

    Input is whatever a socket or a stored allowlist entry produced, neither of
    which this module controls, so unusable input is expected rather than
    exceptional.

    >>> str(parse_client_address("::ffff:192.0.2.10"))
    '192.0.2.10'
    >>> parse_client_address("not-an-address") is None
    True
    """
    if not raw:
        return None
    try:
        parsed = ip_address(raw.strip())
    except ValueError:
        return None
    if isinstance(parsed, IPv6Address) and parsed.ipv4_mapped is not None:
        return parsed.ipv4_mapped
    return parsed


def origin_network(raw: str | None) -> str | None:
    """The network ``raw`` belongs to, or None when it is not an address.

    >>> origin_network("192.0.2.10")
    '192.0.2.0/24'
    >>> origin_network("2001:db8:1:2:3:4:5:6")
    '2001:db8:1:2::/64'
    """
    parsed = parse_client_address(raw)
    if parsed is None:
        return None
    prefix = IPV4_NETWORK_PREFIX if isinstance(parsed, IPv4Address) else IPV6_NETWORK_PREFIX
    return str(ip_network(f"{parsed}/{prefix}", strict=False))


def is_different_network(recorded: str | None, presented: str | None) -> bool:
    """Whether ``presented`` comes from a different network than ``recorded``.

    False whenever either side is missing or unparseable: that is the
    absent-is-not-mismatched rule, and it is why this returns a verdict rather
    than an equality the caller has to guard.

    A dual-stack client that established a session over IPv4 and refreshes over
    IPv6 reads as a mismatch, because the two networks genuinely differ and
    nothing here can tell that they share a wire. Passing cross-family
    comparisons instead would hand any attacker a one-line evasion -- present
    over the other family and never be looked at -- which costs more than the
    re-authentication it saves. Absent is not mismatched; *different* is.
    """
    recorded_network = origin_network(recorded)
    presented_network = origin_network(presented)
    if recorded_network is None or presented_network is None:
        return False
    return recorded_network != presented_network
