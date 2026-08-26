"""Emailed links must follow FRONTEND_URL.

PASSWORD_RESET_URL and EMAIL_VERIFICATION_URL used to be assigned in the Settings
class body as f-strings over FRONTEND_URL:

    FRONTEND_URL: str = "http://localhost:5173"
    PASSWORD_RESET_URL: str = f"{FRONTEND_URL}/reset-password"

That binds the *default* FRONTEND_URL as the class body executes, so overriding
FRONTEND_URL in the environment never reached them. .env.production does not set
PASSWORD_RESET_URL at all, so production password-reset emails carried
``http://localhost:5173/reset-password`` and nobody could reset a password.

Each test passes the derived fields as empty strings. That is deterministic
regardless of which .env files a developer happens to have -- a blank value means
"derive", so a stale local override cannot make these pass or fail spuriously.
"""

import pytest

from app.core.config import Settings

BASE = "https://app.example.test"


def settings_with(**overrides: object) -> Settings:
    """Build Settings with the derived fields blank unless a test sets them."""
    values: dict = {"EMAIL_VERIFICATION_URL": "", "PASSWORD_RESET_URL": ""}
    values.update(overrides)
    return Settings(**values)  # type: ignore[arg-type]


def test_both_links_follow_frontend_url() -> None:
    """The whole point: one setting decides where mail points."""
    settings = settings_with(FRONTEND_URL=BASE)

    assert settings.EMAIL_VERIFICATION_URL == f"{BASE}/verify-email"
    assert settings.PASSWORD_RESET_URL == f"{BASE}/reset-password"


def test_changing_frontend_url_moves_both_links() -> None:
    """The regression itself: an override that did not propagate."""
    first = settings_with(FRONTEND_URL="https://one.example.test")
    second = settings_with(FRONTEND_URL="https://two.example.test")

    assert first.EMAIL_VERIFICATION_URL != second.EMAIL_VERIFICATION_URL
    assert second.EMAIL_VERIFICATION_URL.startswith("https://two.example.test")
    assert second.PASSWORD_RESET_URL.startswith("https://two.example.test")


def test_no_link_ever_points_at_the_default_when_frontend_url_is_set() -> None:
    """A derived link must not retain the class default's host."""
    settings = settings_with(FRONTEND_URL=BASE)

    for url in (settings.EMAIL_VERIFICATION_URL, settings.PASSWORD_RESET_URL):
        assert "localhost:5173" not in url


@pytest.mark.parametrize(
    ("field", "explicit"),
    [
        ("EMAIL_VERIFICATION_URL", "https://elsewhere.example.test/verify"),
        ("PASSWORD_RESET_URL", "https://elsewhere.example.test/reset"),
    ],
)
def test_an_explicit_value_still_wins(field: str, explicit: str) -> None:
    """Deriving is a default, not a policy.

    A deployment that serves a link from a different host than FRONTEND_URL must
    still be able to say so.
    """
    settings = settings_with(FRONTEND_URL=BASE, **{field: explicit})

    assert getattr(settings, field) == explicit


def test_trailing_slash_does_not_double_up() -> None:
    """FRONTEND_URL with a trailing slash must not produce a // in the path."""
    settings = settings_with(FRONTEND_URL=f"{BASE}/")

    assert settings.EMAIL_VERIFICATION_URL == f"{BASE}/verify-email"
    assert settings.PASSWORD_RESET_URL == f"{BASE}/reset-password"


def test_login_link_in_notice_email_uses_the_same_base() -> None:
    """The notice email builds its login link from FRONTEND_URL directly.

    It is the third link that was pointing at the wrong host in production, and
    it shares the same single source as the two derived ones.
    """
    settings = settings_with(FRONTEND_URL=BASE)

    assert f"{settings.FRONTEND_URL}/login" == f"{BASE}/login"


def test_committed_env_files_do_not_pin_the_derived_links() -> None:
    """No env file in the repository may pin a derived link to a fixed value.

    Redundant copies are what drifted: .env.development set FRONTEND_URL to port
    3000 while separately pinning EMAIL_VERIFICATION_URL to port 5173, which is
    not served.

    Scoped to files git tracks. Untracked ones are a developer's own -- their
    .env.local, a backup, a scratch copy -- and are not the repository's to
    police; including them makes this fail on someone's machine for a file that
    was never committed.
    """
    import subprocess
    from pathlib import Path

    backend = Path(__file__).resolve().parents[2]
    listed = subprocess.run(
        ["git", "ls-files", ".env*"],
        cwd=backend,
        capture_output=True,
        text=True,
    )
    if listed.returncode != 0:
        pytest.skip("git is unavailable; cannot determine which env files are committed")

    tracked = [name for name in listed.stdout.splitlines() if name.strip()]
    assert tracked, "expected at least one committed env file to check"

    offenders = []
    for name in tracked:
        path = backend / name
        if not path.is_file():
            continue
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if line.startswith(("EMAIL_VERIFICATION_URL=", "PASSWORD_RESET_URL=")):
                offenders.append(f"{name}:{number} {line}")

    assert not offenders, (
        "these are derived from FRONTEND_URL; pinning them separately is what " f"drifted: {offenders}"
    )
