"""Tokens reach a response body only by an explicit opt-in, never in production.

Password-reset and verification tokens used to appear in API responses
whenever ``MODE`` was development or testing, and ``MODE`` defaults to
development. ``EXPOSE_TOKENS_IN_RESPONSES`` now decides that, off by default,
and the settings refuse it in production. A production image
(``FASTAPI_ENV=production``) also refuses to start in any other mode, and the
API logs a warning at startup whenever ``MODE`` is not production.
"""

import logging
from test.utils import production_kwargs

import pytest
from pydantic import ValidationError

from app.core.config import ModeEnum, Settings, log_mode_warnings, settings


@pytest.fixture
def _no_fastapi_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """validate_mode_guards reads FASTAPI_ENV from os.environ; start without it."""
    monkeypatch.delenv("FASTAPI_ENV", raising=False)


def test_the_opt_in_is_off_by_default() -> None:
    assert Settings.model_fields["EXPOSE_TOKENS_IN_RESPONSES"].default is False


def test_the_opt_in_reads_from_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EXPOSE_TOKENS_IN_RESPONSES", "true")

    assert Settings().EXPOSE_TOKENS_IN_RESPONSES is True


@pytest.mark.usefixtures("_no_fastapi_env")
def test_production_refuses_the_opt_in() -> None:
    with pytest.raises(ValidationError, match="EXPOSE_TOKENS_IN_RESPONSES must be false in production"):
        Settings(**production_kwargs(EXPOSE_TOKENS_IN_RESPONSES=True))


@pytest.mark.usefixtures("_no_fastapi_env")
def test_production_starts_with_the_opt_in_off() -> None:
    assert Settings(**production_kwargs()).EXPOSE_TOKENS_IN_RESPONSES is False


@pytest.mark.parametrize("mode", [ModeEnum.development, ModeEnum.testing])
def test_a_production_image_refuses_another_mode(monkeypatch: pytest.MonkeyPatch, mode: ModeEnum) -> None:
    monkeypatch.setenv("FASTAPI_ENV", "production")

    with pytest.raises(ValidationError, match="Set MODE=production"):
        Settings(**production_kwargs(MODE=mode))


def test_a_production_image_starts_in_production_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FASTAPI_ENV", "production")

    assert Settings(**production_kwargs()).MODE == ModeEnum.production


@pytest.mark.parametrize("mode", [ModeEnum.development, ModeEnum.testing])
def test_startup_warns_when_mode_is_not_production(caplog: pytest.LogCaptureFixture, mode: ModeEnum) -> None:
    cfg = settings.model_copy(update={"MODE": mode, "EXPOSE_TOKENS_IN_RESPONSES": False})

    with caplog.at_level(logging.WARNING):
        log_mode_warnings(cfg)

    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert any(f"MODE is {mode.value}" in r.getMessage() for r in warnings)
    assert not any("EXPOSE_TOKENS_IN_RESPONSES" in r.getMessage() for r in warnings)


def test_startup_warns_when_tokens_are_exposed(caplog: pytest.LogCaptureFixture) -> None:
    cfg = settings.model_copy(update={"MODE": ModeEnum.development, "EXPOSE_TOKENS_IN_RESPONSES": True})

    with caplog.at_level(logging.WARNING):
        log_mode_warnings(cfg)

    assert any("EXPOSE_TOKENS_IN_RESPONSES" in r.getMessage() for r in caplog.records)


def test_startup_is_quiet_in_production(caplog: pytest.LogCaptureFixture) -> None:
    cfg = settings.model_copy(update={"MODE": ModeEnum.production, "EXPOSE_TOKENS_IN_RESPONSES": False})

    with caplog.at_level(logging.WARNING):
        log_mode_warnings(cfg)

    assert not [r for r in caplog.records if r.levelno >= logging.WARNING]
