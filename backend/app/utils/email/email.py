import logging
import re
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Dict, List

import emails
from emails.template import JinjaTemplate
from jinja2 import Environment, FileSystemLoader

from app.core.config import settings

# Tags that should force a line break in the plain-text rendering.
_BLOCK_TAGS = {"p", "div", "br", "tr", "li", "h1", "h2", "h3", "h4", "h5", "h6", "table"}
# Tags whose contents are markup or styling, never prose.
_SKIP_TAGS = {"style", "script", "head", "title"}


class _CRLFMessageProxy:
    """Wraps a built MIME message so ``as_bytes()`` returns CRLF line endings.

    SMTP requires CRLF (RFC 5321 section 2.3.8). Bare LF is not merely untidy:
    receivers increasingly reject or mangle it, and the mismatch between how a
    relay and a client split lines is the basis of SMTP smuggling, so strictness
    is rising rather than falling.

    emails 0.6 handed smtplib a ``str``, and ``smtplib`` normalised it via
    ``_fix_eols``. emails 1.1.2 hands it ``bytes`` instead, and that path skips
    the normalisation entirely, so whatever ``as_bytes()`` produced -- LF, under
    the default compat32 policy -- went straight onto the wire.

    Everything other than ``as_bytes`` is delegated untouched. Dunder lookups
    bypass ``__getattr__``, so the mapping protocol a Message supports is
    forwarded explicitly rather than left to fail at runtime; today the backend
    calls only ``as_bytes()``, but a proxy that silently lacks half its
    subject's interface is a worse bug than the one it fixes.
    """

    def __init__(self, message: Any) -> None:
        self._message = message

    def __getattr__(self, name: str) -> Any:
        return getattr(self._message, name)

    def __getitem__(self, name: str) -> Any:
        return self._message[name]

    def __setitem__(self, name: str, value: Any) -> None:
        self._message[name] = value

    def __contains__(self, name: str) -> bool:
        return name in self._message

    def __iter__(self) -> Any:
        return iter(self._message)

    def __str__(self) -> str:
        return str(self._message)

    def as_bytes(self, *args: Any, **kwargs: Any) -> bytes:
        raw = self._message.as_bytes(*args, **kwargs)
        # Normalise CR, LF and CRLF alike, so an already-correct message is
        # not turned into CRCRLF.
        return re.sub(rb"\r\n|\r|\n", b"\r\n", raw)


class _CRLFSMTPBackend:
    """Delegates to a pooled emails SMTP backend, forcing CRLF on the way out.

    ``Message.send`` accepts "a dict or an object with method 'sendmail'", so
    this needs no monkey-patching. It wraps the backend the pool already
    returned rather than building its own, which keeps connection reuse.
    """

    def __init__(self, backend: Any) -> None:
        self._backend = backend

    def sendmail(self, from_addr: Any, to_addrs: Any, msg: Any, **kwargs: Any) -> Any:
        return self._backend.sendmail(from_addr, to_addrs, _CRLFMessageProxy(msg), **kwargs)


class _PlainTextExtractor(HTMLParser):
    """Render an HTML email body as readable plain text.

    Derived from the rendered HTML rather than kept as a parallel .txt
    template, so the two cannot drift apart -- and, more importantly, so a link
    added to a template can never be missing from the text part.

    Anchors emit their URL, because a plain-text reader cannot click anything:
    an <a> whose text already is the URL emits it once, otherwise the text is
    followed by the URL in angle brackets.
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._parts: List[str] = []
        self._skip_depth = 0
        self._href: str | None = None
        self._anchor_text: List[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in _SKIP_TAGS:
            self._skip_depth += 1
            return
        if tag == "a":
            self._href = dict(attrs).get("href")
            self._anchor_text = []
        elif tag in _BLOCK_TAGS:
            self._parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in _SKIP_TAGS:
            self._skip_depth = max(0, self._skip_depth - 1)
            return
        if tag == "a":
            text = "".join(self._anchor_text).strip()
            href = self._href
            if href and text and text != href:
                self._parts.append(f"{text} <{href}>")
            elif href:
                self._parts.append(href)
            elif text:
                self._parts.append(text)
            self._href = None
            self._anchor_text = []
        elif tag in _BLOCK_TAGS:
            self._parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        if self._href is not None:
            self._anchor_text.append(data)
        else:
            self._parts.append(data)

    def text(self) -> str:
        raw = "".join(self._parts)
        # Collapse runs of spaces/tabs, then runs of blank lines.
        raw = re.sub(r"[ \t]+", " ", raw)
        raw = re.sub(r" *\n *", "\n", raw)
        raw = re.sub(r"\n{3,}", "\n\n", raw)
        return raw.strip()


def html_to_plain_text(html: str) -> str:
    """Best-effort plain-text rendering of an HTML email body."""
    parser = _PlainTextExtractor()
    parser.feed(html)
    parser.close()
    return parser.text()


def send_email(
    email_to: str,
    subject_template: str = "",
    html_template: str = "",
    environment: Dict[str, Any] = {},
) -> None:
    """
    Send an email using the emails library,
    which supports both development and production environments.
    """
    if not settings.EMAILS_ENABLED:
        logging.info(f"Email sending disabled, would have sent to {email_to}")
        return

    # Build the email message. The plain-text part is not optional politeness:
    # without it the message is a single base64 text/html part, which is
    # unreadable in a mail catcher and in any text-only client, and the
    # verification link cannot be seen at all without decoding it by hand.
    message = emails.Message(
        subject=JinjaTemplate(subject_template),
        html=JinjaTemplate(html_template),
        text=JinjaTemplate(html_to_plain_text(html_template)),
        mail_from=(settings.EMAILS_FROM_NAME, settings.EMAILS_FROM_EMAIL),
    )

    # Send the email
    smtp_options = {
        "host": settings.SMTP_HOST,
        "port": settings.SMTP_PORT,
    }

    # Add TLS if enabled, regardless of environment mode
    if settings.SMTP_TLS:
        smtp_options["tls"] = True
        if settings.SMTP_USER:
            smtp_options["user"] = settings.SMTP_USER
            smtp_options["password"] = settings.SMTP_PASSWORD

    # Log connection attempt for debugging
    logging.info(f"Attempting to connect to SMTP server at {settings.SMTP_HOST}:" f"{settings.SMTP_PORT}")

    # Send through the pooled backend, wrapped so the message reaches the wire
    # with CRLF line endings. Falls back to the plain dict if the pool is not
    # available, which sends LF but is better than not sending at all.
    try:
        backend: Any = _CRLFSMTPBackend(message.smtp_pool[smtp_options])
    except Exception:  # pragma: no cover - defensive, pool is an internal API
        logging.warning("Could not wrap SMTP backend for CRLF; sending unwrapped")
        backend = smtp_options

    response = message.send(to=email_to, render=environment, smtp=backend)

    # Log the appropriate response based on success or failure
    if response.status_code not in [250, 235]:
        logging.error(f"Failed to send email to {email_to}, status code: {response.status_code}")
    else:
        logging.info(f"Email sent successfully to {email_to}")


def render_template(template_name: str, context: Dict[str, Any]) -> str:
    """
    Render a Jinja template from the email templates directory with the given context.
    """
    templates_dir = Path(settings.EMAIL_TEMPLATES_DIR)
    env = Environment(loader=FileSystemLoader(templates_dir))
    template = env.get_template(template_name)
    return template.render(**context)


def send_email_with_template(
    email_to: str,
    subject: str,
    template_name: str,
    context: Dict[str, Any],
) -> None:
    """
    Render a template and send it as an email.
    """
    html_content = render_template(template_name, context)
    send_email(email_to=email_to, subject_template=subject, html_template=html_content)
