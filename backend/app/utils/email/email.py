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

    response = message.send(to=email_to, render=environment, smtp=smtp_options)

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
