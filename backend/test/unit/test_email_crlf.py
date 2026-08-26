"""Outgoing mail must reach the wire with CRLF line endings.

SMTP requires CRLF (RFC 5321 section 2.3.8). Bare LF is not merely untidy:
receivers increasingly reject or mangle it, and the mismatch between how a relay
and a client split lines is the basis of SMTP smuggling, so strictness is rising.

This regressed when ``emails`` went 0.6 -> 1.1.2:

    0.6      backend passes msg.as_string()  -> str   -> smtplib._fix_eols runs
    1.1.2    backend passes msg.as_bytes()   -> bytes -> _fix_eols is skipped

``as_bytes()`` emits LF under the default compat32 policy, so LF went out
unaltered. It surfaced as a mail catcher failing to parse the message at all:
having prepended its own CRLF headers, it could not read the LF-only headers
that followed, so it showed the whole MIME document as an undecoded body.
"""

from typing import Any

import emails
import pytest
from emails.template import JinjaTemplate

from app.utils.email.email import _CRLFMessageProxy, _CRLFSMTPBackend


def built_message() -> Any:
    """A message shaped like the ones the app actually sends."""
    message = emails.Message(
        subject=JinjaTemplate("Verify"),
        html=JinjaTemplate('<p>Hi <a href="https://example.com/verify?token=t">verify</a></p>'),
        text=JinjaTemplate("Hi verify https://example.com/verify?token=t"),
        mail_from=("Dev", "dev@example.com"),
    )
    return message.build_message()


def test_unwrapped_message_still_emits_bare_lf() -> None:
    """Documents the upstream behaviour this wrapper exists to correct.

    If a future emails release starts emitting CRLF itself, this fails and the
    wrapper can be reconsidered rather than kept forever out of superstition.
    """
    raw = built_message().as_bytes()

    assert b"\n" in raw
    assert raw.replace(b"\r\n", b"").count(b"\n") > 0, "expected bare LF from as_bytes()"


def test_proxy_produces_crlf_only() -> None:
    """No bare LF survives: every newline is preceded by a carriage return."""
    raw = _CRLFMessageProxy(built_message()).as_bytes()

    assert b"\r\n" in raw
    # Removing every CRLF must leave no stray LF or CR behind.
    stripped = raw.replace(b"\r\n", b"")
    assert b"\n" not in stripped
    assert b"\r" not in stripped


def test_proxy_is_idempotent() -> None:
    """Running it twice must not turn CRLF into CRCRLF."""
    once = _CRLFMessageProxy(built_message()).as_bytes()

    class Already:
        def as_bytes(self, *a: Any, **k: Any) -> bytes:
            return once

    twice = _CRLFMessageProxy(Already()).as_bytes()

    assert twice == once


def test_proxy_normalises_lone_cr() -> None:
    """A stray CR becomes CRLF rather than being left as a line ending."""

    class Weird:
        def as_bytes(self, *a: Any, **k: Any) -> bytes:
            return b"a\rb\nc\r\nd"

    assert _CRLFMessageProxy(Weird()).as_bytes() == b"a\r\nb\r\nc\r\nd"


def test_proxy_delegates_everything_else() -> None:
    """Only as_bytes is intercepted; the rest of the message is untouched."""
    message = built_message()
    proxy = _CRLFMessageProxy(message)

    assert proxy["Subject"] == message["Subject"]
    assert proxy.as_string() == message.as_string()
    assert proxy.get_content_type() == message.get_content_type()


def test_backend_wraps_the_message_it_forwards() -> None:
    """The backend hands the proxy on, not the raw message."""
    seen: dict[str, Any] = {}

    class Recorder:
        def sendmail(self, from_addr: Any, to_addrs: Any, msg: Any, **kwargs: Any) -> str:
            seen["msg"] = msg
            seen["from_addr"] = from_addr
            seen["to_addrs"] = to_addrs
            seen["kwargs"] = kwargs
            return "sent"

    result = _CRLFSMTPBackend(Recorder()).sendmail(
        "dev@example.com", ["to@example.com"], built_message(), mail_options=["X"]
    )

    assert result == "sent"
    assert isinstance(seen["msg"], _CRLFMessageProxy)
    assert seen["from_addr"] == "dev@example.com"
    assert seen["to_addrs"] == ["to@example.com"]
    assert seen["kwargs"] == {"mail_options": ["X"]}


@pytest.mark.parametrize("header", [b"Content-Type:", b"Subject:", b"MIME-Version:"])
def test_headers_are_crlf_terminated(header: bytes) -> None:
    """The headers are the part that broke: a receiver could not read them."""
    raw = _CRLFMessageProxy(built_message()).as_bytes()

    index = raw.find(header)
    assert index != -1, f"{header!r} missing from message"
    line_end = raw.find(b"\n", index)
    assert raw[line_end - 1 : line_end + 1] == b"\r\n"
