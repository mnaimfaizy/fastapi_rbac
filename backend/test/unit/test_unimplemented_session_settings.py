"""Four settings advertised session controls nothing implemented.

ADR 0011 decision 4 (issue #204) deletes them rather than wiring them up.
A blacklist is the inverse of the Redis allowlist that is already the sole
revocation mechanism; session lifetime is already access and refresh expiry.
Leaving names that default to true would keep advertising controls that do
not exist -- the same condition #69 objected to.

These are tripwires. The first catches the fields coming back on Settings;
the second guards the operator path -- a stale .env that still lists the old
keys must not break a deploy; the third keeps example env files from
reproducing the original problem for the next person who copies one.
"""

from pathlib import Path

import pytest

from app.core.config import Settings

APP_DIR = Path(__file__).resolve().parents[2] / "app"
BACKEND_DIR = APP_DIR.parent

DELETED_SESSION_SETTINGS = (
    "TOKEN_BLACKLIST_ON_LOGOUT",
    "TOKEN_BLACKLIST_EXPIRY",
    "SESSION_MAX_AGE",
    "SESSION_EXTEND_ON_ACTIVITY",
)

# Values a leftover .env would still carry from the old examples.
STALE_ENV = {
    "TOKEN_BLACKLIST_ON_LOGOUT": "true",
    "TOKEN_BLACKLIST_EXPIRY": "86400",
    "SESSION_MAX_AGE": "3600",
    "SESSION_EXTEND_ON_ACTIVITY": "true",
}


def test_settings_have_none_of_the_four_unimplemented_session_controls() -> None:
    """Gone from the public Settings surface, so they cannot be read as active."""
    for name in DELETED_SESSION_SETTINGS:
        assert name not in Settings.model_fields


def test_stale_environment_keys_do_not_prevent_settings_from_loading(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An operator's leftover .env must not fail the next boot.

    extra='ignore' is already the Settings policy; this pins it to the four
    names that used to be real fields so a later extra='forbid' cannot turn a
    deletion into a deploy break.
    """
    for name, value in STALE_ENV.items():
        monkeypatch.setenv(name, value)

    settings = Settings()  # type: ignore[call-arg]

    for name in DELETED_SESSION_SETTINGS:
        assert name not in Settings.model_fields
        assert getattr(settings, name, None) is None


def test_the_four_names_appear_nowhere_in_the_app_package() -> None:
    """A name nothing reads must not be reintroduced as a later 'security' field."""
    offenders = [
        f"{path.relative_to(APP_DIR).as_posix()}:{name}"
        for path in APP_DIR.rglob("*.py")
        for name in DELETED_SESSION_SETTINGS
        if name in path.read_text(encoding="utf-8")
    ]

    assert offenders == []


def test_example_env_files_do_not_advertise_the_four_settings() -> None:
    """A stale .example that still lists a deleted setting is the original bug."""
    examples = (
        BACKEND_DIR / ".env.example",
        BACKEND_DIR / ".env.production.example",
    )
    missing = [path.name for path in examples if not path.is_file()]
    assert missing == []

    offenders: list[str] = []
    for path in examples:
        text = path.read_text(encoding="utf-8")
        for name in DELETED_SESSION_SETTINGS:
            if name in text:
                offenders.append(f"{path.name}:{name}")

    assert offenders == []
