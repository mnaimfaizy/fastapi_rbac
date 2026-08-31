"""``send_email`` against the real ``emails`` API, stubbed only at the socket.

The suite patches ``app.utils.email.email.send_email`` for every test, which is
right -- no test should send mail. The gap (#159) was that *nothing else* ran
the function body, so the entire ``emails`` integration was unexecuted: the
``Message`` construction, ``JinjaTemplate``, the ``smtp_options`` assembly, the
CRLF wrapper and the ``status_code`` handling.

That blind spot has cost four defects already. #149 bumped ``emails`` 0.6 ->
1.1.2 across a six-year gap and reported green, which meant only that ``pip
install`` had succeeded. The break it actually introduced -- the backend
switching from ``msg.as_string()`` to ``msg.as_bytes()``, skipping smtplib's
CRLF normalisation -- was found by a human reading a mail catcher (#184).
Missing plain text (#183) and localhost links in production mail (#185) were
found the same way.

So these tests cut the wire, not the function. Everything above the socket
runs for real: templates render, ``emails`` builds the MIME document, the CRLF
proxy rewrites it, and the bytes that would have gone out are asserted on.
``RecordingSMTPClient`` replaces only ``SMTPBackend.get_client`` -- the last
call before a connection is opened.
"""

import email as emaillib
import logging
from dataclasses import dataclass, field
from email.header import decode_header, make_header
from email.message import Message as MIMEMessage
from typing import Any, List, Optional

import pytest
from emails.backend.smtp.backend import SMTPBackend

from app.core.config import settings
from app.utils.email import email as email_module

VERIFY_LINK = "https://rbac.example.com/verify-email?token=abc.def-ghi_jkl"

# Not a credential. These tests assert that SMTP_USER and SMTP_PASSWORD reach
# the backend, so the values only have to be distinguishable and obviously
# inert -- anything resembling a real password trips the repository's secret
# scanner, and an exclusion for this file would weaken scanning to no purpose.
SMTP_USER_PLACEHOLDER = "smtp-user-placeholder"
SMTP_PASSWORD_PLACEHOLDER = "not-a-real-password-placeholder"  # noqa: S105


@pytest.fixture(autouse=True)
def mock_send_email() -> None:  # noqa: PT004 - the name must match what it overrides
    """Shadow the suite-wide patch so this module runs the real function.

    Defined at module scope, it overrides the autouse fixture in
    test.fixtures.fixtures_service_mocks for this file only; every other test
    keeps the patch. Cancelling it here is the whole point of the file --
    patching ``send_email`` out is what created the blind spot.
    """
    return None


def header_text(raw: Optional[str]) -> str:
    """A header as a human would read it, RFC 2047 encoding undone."""
    assert raw is not None
    return str(make_header(decode_header(raw)))


@dataclass
class SentMessage:
    """One message as it would have been handed to the socket."""

    from_addr: str
    to_addrs: List[str]
    raw: bytes
    mail_options: Any
    rcpt_options: Any

    @property
    def parsed(self) -> MIMEMessage:
        return emaillib.message_from_bytes(self.raw)

    def part(self, content_type: str) -> Optional[str]:
        """Decoded body of the first part with this content type."""
        for candidate in self.parsed.walk():
            if candidate.get_content_type() == content_type:
                payload = candidate.get_payload(decode=True)
                assert isinstance(payload, bytes)
                charset = candidate.get_content_charset() or "utf-8"
                return payload.decode(charset, "replace")
        return None

    @property
    def content_types(self) -> List[str]:
        return [p.get_content_type() for p in self.parsed.walk()]


@dataclass
class SMTPRecorder:
    """Captures what reached the transport, and dictates what it replies."""

    status_code: int = 250
    status_text: bytes = b"2.0.0 Ok: queued"
    connect_error: Optional[Exception] = None
    sent: List[SentMessage] = field(default_factory=list)
    backends: List[SMTPBackend] = field(default_factory=list)

    @property
    def only(self) -> SentMessage:
        assert len(self.sent) == 1, f"expected exactly one message, got {len(self.sent)}"
        return self.sent[0]

    @property
    def backend(self) -> SMTPBackend:
        assert len(self.backends) == 1, f"expected one backend, got {len(self.backends)}"
        return self.backends[0]


class RecordingSMTPClient:
    """Stands in for the socket and nothing above it.

    ``SMTPBackend.sendmail`` still runs, so the message really is serialised
    through ``as_bytes()`` -- including the CRLF proxy -- before it lands here.
    The reply is a genuine ``SMTPResponse`` built by the backend, so
    ``status_code`` behaves as it does in production.
    """

    def __init__(self, backend: SMTPBackend, recorder: SMTPRecorder) -> None:
        self._backend = backend
        self._recorder = recorder

    def sendmail(
        self,
        from_addr: str,
        to_addrs: Any,
        msg: bytes,
        mail_options: Any = None,
        rcpt_options: Any = None,
    ) -> Any:
        self._recorder.sent.append(
            SentMessage(
                from_addr=from_addr,
                to_addrs=list(to_addrs),
                raw=msg,
                mail_options=mail_options,
                rcpt_options=rcpt_options,
            )
        )
        response = self._backend.make_response()
        response.from_addr = from_addr
        response.to_addrs = list(to_addrs)
        response.set_status("data", self._recorder.status_code, self._recorder.status_text)
        response._finished = self._recorder.status_code == 250
        return response


@pytest.fixture
def smtp(monkeypatch: pytest.MonkeyPatch) -> SMTPRecorder:
    """Cut the wire at ``get_client``, the last step before a connection."""
    recorder = SMTPRecorder()

    def get_client(backend: SMTPBackend) -> RecordingSMTPClient:
        recorder.backends.append(backend)
        if recorder.connect_error is not None:
            raise recorder.connect_error
        return RecordingSMTPClient(backend, recorder)

    monkeypatch.setattr(SMTPBackend, "get_client", get_client)
    return recorder


@pytest.fixture(autouse=True)
def _mail_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    """A known mail configuration, so assertions are about code, not .env."""
    monkeypatch.setattr(settings, "EMAILS_ENABLED", True)
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.test.invalid")
    monkeypatch.setattr(settings, "SMTP_PORT", 2525)
    monkeypatch.setattr(settings, "SMTP_TLS", False)
    monkeypatch.setattr(settings, "SMTP_USER", None)
    monkeypatch.setattr(settings, "SMTP_PASSWORD", None)
    monkeypatch.setattr(settings, "EMAILS_FROM_NAME", "FastAPI RBAC")
    monkeypatch.setattr(settings, "EMAILS_FROM_EMAIL", "noreply@example.com")


def send(**overrides: Any) -> None:
    """Call the real ``send_email`` with a plausible verification message."""
    html = '<p>Hello {{ username }},</p><p><a href="LINK">Verify your email</a></p>'
    kwargs: dict[str, Any] = {
        "email_to": "recipient@example.com",
        "subject_template": "{{ project_name }} - Verify Your Email Address",
        "html_template": html.replace("LINK", VERIFY_LINK),
        "environment": {
            "project_name": "FastAPI RBAC",
            "username": "recipient@example.com",
        },
    }
    kwargs.update(overrides)
    email_module.send_email(**kwargs)


# --------------------------------------------------------------------------
# The function body actually runs
# --------------------------------------------------------------------------


def test_the_real_function_runs_here(smtp: SMTPRecorder) -> None:
    """Guards the override above.

    If the suite-wide patch leaked back in, nothing would reach the transport
    and every other test in this file would pass vacuously.
    """
    send()

    assert len(smtp.sent) == 1
    assert not hasattr(email_module.send_email, "assert_called_once")


def test_disabled_mail_touches_no_transport(smtp: SMTPRecorder, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "EMAILS_ENABLED", False)

    send()

    assert smtp.sent == []
    assert smtp.backends == []


# --------------------------------------------------------------------------
# Message construction -- the emails / JinjaTemplate API
# --------------------------------------------------------------------------


def test_subject_is_rendered_from_the_environment(smtp: SMTPRecorder) -> None:
    """``JinjaTemplate`` really substitutes.

    A subject arriving as the literal ``{{ project_name }}`` is what a silent
    template-API break looks like.
    """
    send()

    assert header_text(smtp.only.parsed["Subject"]) == "FastAPI RBAC - Verify Your Email Address"


def test_from_header_carries_name_and_address(smtp: SMTPRecorder) -> None:
    send()

    from_header = header_text(smtp.only.parsed["From"])
    assert "noreply@example.com" in from_header
    assert "FastAPI RBAC" in from_header


def test_recipient_reaches_the_envelope_and_the_header(smtp: SMTPRecorder) -> None:
    send()

    assert smtp.only.to_addrs == ["recipient@example.com"]
    assert smtp.only.from_addr == "noreply@example.com"
    assert "recipient@example.com" in header_text(smtp.only.parsed["To"])


def test_html_body_is_rendered(smtp: SMTPRecorder) -> None:
    send()

    html = smtp.only.part("text/html")
    assert html is not None
    assert "Hello recipient@example.com," in html
    assert VERIFY_LINK in html
    assert "{{" not in html


def test_message_carries_a_plain_text_alternative(smtp: SMTPRecorder) -> None:
    """#183.

    Without this the message is a single base64 text/html part, which no
    text-only client and no mail catcher can show.
    """
    send()

    assert "text/plain" in smtp.only.content_types
    assert "text/html" in smtp.only.content_types
    assert "multipart/alternative" in smtp.only.content_types


def test_the_link_survives_into_the_plain_text_part(smtp: SMTPRecorder) -> None:
    """A reader of the text part cannot click anything, so the URL must be
    there in full. This is the assertion a human was making by hand."""
    send()

    text = smtp.only.part("text/plain")
    assert text is not None
    assert VERIFY_LINK in text
    assert "<p>" not in text


def test_wire_bytes_use_crlf_line_endings(smtp: SMTPRecorder) -> None:
    """#184, asserted on the real send path rather than on the proxy alone.

    test_email_crlf.py exercises the wrapper directly; this proves the wrapper
    is still *installed* -- that ``send_email`` routes through it and the bytes
    ``emails`` hands the socket are CRLF-terminated.
    """
    send()

    raw = smtp.only.raw
    assert isinstance(raw, bytes)
    assert b"\r\n" in raw
    stripped = raw.replace(b"\r\n", b"")
    assert b"\n" not in stripped
    assert b"\r" not in stripped


# --------------------------------------------------------------------------
# smtp_options assembly
# --------------------------------------------------------------------------


def test_host_and_port_reach_the_backend(smtp: SMTPRecorder) -> None:
    send()

    assert smtp.backend.host == "smtp.test.invalid"
    assert smtp.backend.port == 2525


def test_tls_off_sends_no_tls_flag(smtp: SMTPRecorder) -> None:
    send()

    assert smtp.backend.tls is None
    assert "tls" not in smtp.backend.smtp_cls_kwargs


def test_tls_on_without_credentials(smtp: SMTPRecorder, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "SMTP_TLS", True)

    send()

    assert smtp.backend.tls is True
    assert "user" not in smtp.backend.smtp_cls_kwargs
    assert "password" not in smtp.backend.smtp_cls_kwargs


def test_tls_on_with_credentials(smtp: SMTPRecorder, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "SMTP_TLS", True)
    monkeypatch.setattr(settings, "SMTP_USER", SMTP_USER_PLACEHOLDER)
    monkeypatch.setattr(settings, "SMTP_PASSWORD", SMTP_PASSWORD_PLACEHOLDER)

    send()

    assert smtp.backend.tls is True
    assert smtp.backend.smtp_cls_kwargs["user"] == SMTP_USER_PLACEHOLDER
    assert smtp.backend.smtp_cls_kwargs["password"] == SMTP_PASSWORD_PLACEHOLDER


def test_credentials_are_withheld_when_tls_is_off(
    smtp: SMTPRecorder, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Current behaviour, pinned deliberately.

    Credentials are nested inside the TLS branch, so a configuration with
    SMTP_USER set but SMTP_TLS false authenticates with nothing. Refusing to
    put a password on a cleartext connection is defensible; doing it silently
    is not. This test is what fails if the nesting is ever changed by accident
    rather than on purpose.
    """
    monkeypatch.setattr(settings, "SMTP_USER", SMTP_USER_PLACEHOLDER)
    monkeypatch.setattr(settings, "SMTP_PASSWORD", SMTP_PASSWORD_PLACEHOLDER)

    send()

    assert "user" not in smtp.backend.smtp_cls_kwargs
    assert "password" not in smtp.backend.smtp_cls_kwargs


# --------------------------------------------------------------------------
# status_code handling
# --------------------------------------------------------------------------


@pytest.mark.parametrize("code", [250, 235])
def test_success_codes_are_logged_as_success(
    smtp: SMTPRecorder, caplog: pytest.LogCaptureFixture, code: int
) -> None:
    smtp.status_code = code

    with caplog.at_level(logging.INFO):
        send()

    assert "Email sent successfully to recipient@example.com" in caplog.text
    assert "Failed to send email" not in caplog.text


@pytest.mark.parametrize("code", [421, 450, 535, 550])
def test_failure_codes_are_logged_as_errors(
    smtp: SMTPRecorder, caplog: pytest.LogCaptureFixture, code: int
) -> None:
    smtp.status_code = code

    with caplog.at_level(logging.INFO):
        send()

    assert f"status code: {code}" in caplog.text
    assert "Email sent successfully" not in caplog.text
    assert [r for r in caplog.records if r.levelno >= logging.ERROR]


def test_a_refused_connection_is_logged_not_raised(
    smtp: SMTPRecorder, caplog: pytest.LogCaptureFixture
) -> None:
    """``send_email`` runs inside a background task; raising here would take
    down the request that scheduled it rather than just the mail."""
    smtp.connect_error = OSError(111, "Connection refused")

    with caplog.at_level(logging.INFO):
        send()

    assert smtp.sent == []
    assert "Failed to send email to recipient@example.com" in caplog.text


# --------------------------------------------------------------------------
# The templates the application actually ships
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("template_name", "context", "link_key"),
    [
        (
            "email-verification.html",
            {
                "project_name": "FastAPI RBAC",
                "username": "recipient@example.com",
                "verification_url": VERIFY_LINK,
                "valid_for": "24 hours",
            },
            "verification_url",
        ),
        (
            "password-reset.html",
            {
                "project_name": "FastAPI RBAC",
                "email": "recipient@example.com",
                "reset_password_url": "https://rbac.example.com/reset-password?token=xyz",
                "valid_hours": 24,
            },
            "reset_password_url",
        ),
    ],
)
def test_shipped_templates_deliver_a_clickable_link_in_both_parts(
    smtp: SMTPRecorder, template_name: str, context: dict, link_key: str
) -> None:
    """End to end over a real template: render, build, serialise, capture.

    Every email defect found in this project so far was visible right here --
    an unreadable body, a missing text part, a link pointing at localhost --
    and none of them was visible to the suite. Asserting on the bytes is what
    closes that.
    """
    email_module.send_email_with_template(
        email_to="recipient@example.com",
        subject="FastAPI RBAC - Action required",
        template_name=template_name,
        context=context,
    )

    link = context[link_key]
    html = smtp.only.part("text/html")
    text = smtp.only.part("text/plain")

    assert html is not None
    assert text is not None
    assert link in html, "link missing from the HTML part"
    assert link in text, "link missing from the plain-text part"
    assert "{{" not in html, "template left unrendered"
    assert "{%" not in html, "template left unrendered"
    assert "localhost" not in text, "a hard-coded localhost link reached the message"


def test_render_template_renders_a_real_template_file() -> None:
    """``render_template`` reads from EMAIL_TEMPLATES_DIR.

    A missing or moved template directory is otherwise only discovered in
    production, where it raises inside a background task.
    """
    html = email_module.render_template(
        "registration-notice.html",
        {"project_name": "FastAPI RBAC", "email": "recipient@example.com"},
    )

    assert "FastAPI RBAC" in html
    assert "{{" not in html
