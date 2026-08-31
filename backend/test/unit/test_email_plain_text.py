"""Every outgoing email carries a readable plain-text part.

Messages were sent as a single base64-encoded ``text/html`` part. That is
unreadable in a mail catcher and in any text-only client: during QA the
verification link could not be seen at all without hand-decoding the MIME
source.

The text part is derived from the rendered HTML rather than kept as a parallel
``.txt`` template, so the two cannot drift and a link added to a template can
never be missing from the text.
"""

from pathlib import Path

import pytest

from app.utils.email.email import html_to_plain_text, render_template

TEMPLATES_DIR = Path(__file__).resolve().parents[2] / "app" / "email-templates"

VERIFICATION_URL = "http://localhost:5173/verify-email?token=abc.def.ghi"


def verification_html() -> str:
    return render_template(
        "email-verification.html",
        {
            "project_name": "FastAPI RBAC",
            "username": "qa@example.com",
            "email": "qa@example.com",
            "verification_url": VERIFICATION_URL,
            "token": "abc.def.ghi",
            "valid_for": "24 hours",
        },
    )


def test_plain_text_exposes_the_link() -> None:
    """The whole point: a reader can see and copy the URL."""
    text = html_to_plain_text(verification_html())

    assert VERIFICATION_URL in text


def test_plain_text_keeps_anchor_text_beside_its_url() -> None:
    """A labelled link shows both the label and where it goes."""
    text = html_to_plain_text('<p>Please <a href="https://example.com/go">click here</a>.</p>')

    assert "click here <https://example.com/go>" in text


def test_plain_text_does_not_repeat_a_bare_url() -> None:
    """An anchor whose text already is the URL emits it once, not twice."""
    text = html_to_plain_text('<a href="https://example.com/x">https://example.com/x</a>')

    assert text.count("https://example.com/x") == 1


def test_plain_text_drops_css_and_scripts() -> None:
    """Style and script contents are markup, never prose."""
    html = "<head><style>body { color: #333; }</style></head><body><p>Hello</p></body>"

    text = html_to_plain_text(html)

    assert "Hello" in text
    assert "color" not in text
    assert "#333" not in text


def test_plain_text_has_no_markup_left() -> None:
    text = html_to_plain_text(verification_html())

    assert "<p>" not in text
    assert "</div>" not in text
    assert "font-family" not in text


def test_plain_text_collapses_blank_runs() -> None:
    """Block tags produce breaks, but not page-long gaps."""
    text = html_to_plain_text("<div><p>one</p><p></p><p></p><p>two</p></div>")

    assert "\n\n\n" not in text
    assert "one" in text
    assert "two" in text


def test_plain_text_is_not_empty_for_a_realistic_email() -> None:
    text = html_to_plain_text(verification_html())

    assert len(text.splitlines()) > 5
    assert "Verify Your Email Address" in text


@pytest.mark.parametrize(
    "template",
    sorted(p.name for p in TEMPLATES_DIR.glob("*.html")),
)
def test_every_template_yields_text_containing_its_links(template: str) -> None:
    """Guard every template, including ones added later.

    Rendered with a permissive context so this needs no per-template fixture:
    unknown Jinja variables render empty, which is fine -- what matters is that
    any href surviving into the HTML also survives into the text.
    """
    import re

    context = {
        "project_name": "FastAPI RBAC",
        "username": "qa@example.com",
        "email": "qa@example.com",
        "valid_for": "24 hours",
        "token": "tok",
        "verification_url": "https://example.com/verify?token=tok",
        "reset_url": "https://example.com/reset?token=tok",
        "reset_password_url": "https://example.com/reset?token=tok",
        "login_url": "https://example.com/login",
        "password_reset_url": "https://example.com/reset",
    }

    html = render_template(template, context)
    text = html_to_plain_text(html)

    hrefs = {href for href in re.findall(r'href="([^"]+)"', html) if href.startswith("http")}
    missing = sorted(href for href in hrefs if href not in text)

    assert not missing, f"{template} drops these links from its text part: {missing}"
