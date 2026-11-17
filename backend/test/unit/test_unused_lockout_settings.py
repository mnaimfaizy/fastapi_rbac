"""Three lockout settings nothing read are removed (ADR 0015).

``ACCOUNT_LOCKOUT_MINUTES`` is the one lock duration (#275) and
``MAX_LOGIN_ATTEMPTS`` the one threshold. Beside them, Settings carried
``LOCKOUT_DURATION_MINUTES`` (15), ``ACCOUNT_LOCKOUT_DURATION`` (1800 seconds)
and an ``ENABLE_ACCOUNT_LOCKOUT`` switch. No code read any of them, so an
operator who set one to shorten or disable the lock changed nothing.

The same tripwires as ``test_unimplemented_session_settings``: the fields stay
off Settings, a stale environment still loads, and the example env files do not
advertise them again.
"""

from pathlib import Path

import pytest

from app.core.config import Settings

APP_DIR = Path(__file__).resolve().parents[2] / "app"
BACKEND_DIR = APP_DIR.parent

REMOVED = {
    "LOCKOUT_DURATION_MINUTES": "15",
    "ACCOUNT_LOCKOUT_DURATION": "1800",
    "ENABLE_ACCOUNT_LOCKOUT": "false",
}


def test_settings_have_none_of_the_removed_lockout_settings() -> None:
    for name in REMOVED:
        assert name not in Settings.model_fields


def test_a_stale_environment_still_loads_and_nothing_reads_the_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    for name, value in REMOVED.items():
        monkeypatch.setenv(name, value)

    settings = Settings()  # type: ignore[call-arg]

    for name in REMOVED:
        assert getattr(settings, name, None) is None


def test_the_app_package_does_not_name_them() -> None:
    offenders = [
        f"{path.relative_to(APP_DIR).as_posix()}:{name}"
        for path in APP_DIR.rglob("*.py")
        if path.name != "config.py"
        for name in REMOVED
        if name in path.read_text(encoding="utf-8")
    ]

    assert offenders == []


def test_example_env_files_do_not_advertise_them() -> None:
    offenders = [
        f"{path.name}:{name}"
        for path in (
            BACKEND_DIR / ".env.example",
            BACKEND_DIR / ".env.production.example",
            BACKEND_DIR / ".env.test.example",
        )
        for name in REMOVED
        if f"{name}=" in path.read_text(encoding="utf-8")
    ]

    assert offenders == []
