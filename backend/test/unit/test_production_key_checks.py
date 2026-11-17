"""Production refuses weak, reused, placeholder and published example keys.

Five settings sign or encrypt something: ``SECRET_KEY`` (access tokens, CSRF,
Celery message signing), ``JWT_REFRESH_SECRET_KEY``, ``JWT_RESET_SECRET_KEY``,
``JWT_VERIFICATION_SECRET_KEY`` and ``ENCRYPT_KEY``. In production each must be
set, at least 32 characters, different from the other four, not a value
published in this repository and not an obvious placeholder.

The checks raise ``ValueError``, not ``assert``, so ``python -O`` cannot strip
them. Development and testing modes do not run them.

No key value appears in this file. Example values are read from the example
files at test time; test keys are generated per run.
"""

import hashlib
import re
import secrets
from pathlib import Path
from test.utils import PRODUCTION_KEY_NAMES, production_kwargs

import pytest
from pydantic import ValidationError

import app.core.config as config_module
from app.core.config import ModeEnum, Settings

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent

# Files that assign key values operators may copy. The backend ones are always
# present; the rest exist only in a full checkout (the Docker test runner
# mounts backend/ alone).
BACKEND_EXAMPLE_FILES = (
    BACKEND_DIR / ".env.example",
    BACKEND_DIR / ".env.production.example",
    BACKEND_DIR / ".env.test.example",
    BACKEND_DIR / "README.dockerhub.md",
)
REPO_EXAMPLE_FILES = (
    REPO_ROOT / "docs/deployment/PRODUCTION_CONFIG_TEMPLATE.md",
    REPO_ROOT / "docs/deployment/production-deployment-guide.md",
    REPO_ROOT / "docs/reference/SECURITY_FEATURES.md",
    REPO_ROOT / "scripts/docker/validate-production-images.ps1",
    REPO_ROOT / ".github/workflows/backend-ci.yml",
)
HUB_RUNTIME_DIR = REPO_ROOT / "docs/deployment/hub-runtime"

# KEY=value, KEY: value, KEY = "value", -e KEY=value. Values that are template
# expressions (``{name}``, ``${VAR}``) are not literal keys and are skipped.
_ASSIGNMENT = re.compile(
    r"(?<![A-Z_])(" + "|".join(PRODUCTION_KEY_NAMES) + r")[ \t]*[:=][ \t]*[\"']?([^\s\"'#`,)]+)"
)

PLACEHOLDER_WORDS = ("change", "your-", "your_", "replace", "example", "placeholder", "generate")


def _example_files() -> list[Path]:
    files = list(BACKEND_EXAMPLE_FILES)
    if (REPO_ROOT / "docs").is_dir():
        files += list(REPO_EXAMPLE_FILES)
        files += sorted(HUB_RUNTIME_DIR.rglob("env.example"))
    return files


def _example_assignments() -> list[tuple[str, str, str]]:
    """(file, key name, value) for every literal key value in the example files."""
    found: list[tuple[str, str, str]] = []
    for path in _example_files():
        assert path.is_file(), f"missing example file {path}"
        for name, value in _ASSIGNMENT.findall(path.read_text(encoding="utf-8")):
            if value.startswith(("{", "$")):
                continue
            found.append((path.relative_to(REPO_ROOT).as_posix(), name, value))
    return found


EXAMPLE_ASSIGNMENTS = _example_assignments()


def _contains_placeholder_word(value: str) -> bool:
    return any(word in value.lower() for word in PLACEHOLDER_WORDS)


@pytest.fixture(autouse=True)
def _isolated_environment(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Nothing from os.environ or a local env file may reach these Settings.

    The validators read FASTAPI_ENV from os.environ, and settings sources read
    the keys from the environment and from whichever env files exist. Point
    every env file at a path that does not exist, so a "not set" test means
    not set.
    """
    for name in ("FASTAPI_ENV", "MODE", "JWT_SECRET_KEY", *PRODUCTION_KEY_NAMES):
        monkeypatch.delenv(name, raising=False)
    absent = str(tmp_path / "absent.env")
    for attr in (
        "env_development_file",
        "env_test_file",
        "env_production_file",
        "env_local_file",
        "env_file_legacy",
    ):
        monkeypatch.setattr(config_module, attr, absent)


def _refusal(**overrides: object) -> str:
    with pytest.raises(ValidationError) as excinfo:
        Settings(**production_kwargs(**overrides))
    return str(excinfo.value)


def test_the_example_files_were_found() -> None:
    """Guards the scan itself: an empty list would make the next tests pass vacuously."""
    assert EXAMPLE_ASSIGNMENTS
    assert any(file == "backend/.env.example" for file, _, _ in EXAMPLE_ASSIGNMENTS)


@pytest.mark.parametrize(
    ("name", "value"),
    [(name, value) for _, name, value in EXAMPLE_ASSIGNMENTS],
    ids=[f"{file}:{name}" for file, name, _ in EXAMPLE_ASSIGNMENTS],
)
def test_production_refuses_every_value_in_the_example_files(name: str, value: str) -> None:
    message = _refusal(**{name: value})

    assert name in message


def test_long_example_values_are_refused_as_published_values() -> None:
    """A long, random-looking example value passes length and word checks; its digest does not."""
    long_concrete = [
        (name, value)
        for _, name, value in EXAMPLE_ASSIGNMENTS
        if len(value) >= 32 and not _contains_placeholder_word(value)
    ]
    assert long_concrete, "no long concrete example value left to test the digest check with"

    for name, value in long_concrete:
        message = _refusal(**{name: value})
        assert f"{name} is a published example value" in message


def test_the_digest_set_covers_every_value_in_the_example_files() -> None:
    from app.core.production_keys import PUBLISHED_EXAMPLE_DIGESTS

    missing = [
        f"{file}:{name}"
        for file, name, value in EXAMPLE_ASSIGNMENTS
        if hashlib.sha256(value.encode("utf-8")).hexdigest() not in PUBLISHED_EXAMPLE_DIGESTS
    ]

    assert missing == []


@pytest.mark.parametrize("word", PLACEHOLDER_WORDS)
@pytest.mark.parametrize("case", [str.lower, str.upper, str.title])
def test_production_refuses_placeholder_words(word: str, case: object) -> None:
    value = secrets.token_urlsafe(16) + case(word) + secrets.token_urlsafe(16)  # type: ignore[operator]

    message = _refusal(SECRET_KEY=value)

    assert "SECRET_KEY looks like a placeholder" in message


def test_production_refuses_two_equal_keys_and_names_them() -> None:
    shared = secrets.token_urlsafe(48)

    message = _refusal(JWT_RESET_SECRET_KEY=shared, ENCRYPT_KEY=shared)

    assert "JWT_RESET_SECRET_KEY and ENCRYPT_KEY have the same value" in message
    assert shared not in message


def test_production_refuses_three_equal_keys_and_names_them() -> None:
    shared = secrets.token_urlsafe(48)

    message = _refusal(SECRET_KEY=shared, JWT_RESET_SECRET_KEY=shared, JWT_VERIFICATION_SECRET_KEY=shared)

    assert "SECRET_KEY, JWT_RESET_SECRET_KEY and JWT_VERIFICATION_SECRET_KEY have the same value" in message
    assert shared not in message


def test_production_refuses_a_missing_verification_key() -> None:
    kwargs = production_kwargs()
    del kwargs["JWT_VERIFICATION_SECRET_KEY"]

    with pytest.raises(ValidationError, match="JWT_VERIFICATION_SECRET_KEY is not set"):
        Settings(**kwargs)


def test_production_refuses_a_short_verification_key() -> None:
    message = _refusal(JWT_VERIFICATION_SECRET_KEY=secrets.token_urlsafe(48)[:31])

    assert "JWT_VERIFICATION_SECRET_KEY is shorter than 32 characters" in message


@pytest.mark.parametrize("name", PRODUCTION_KEY_NAMES)
def test_production_refuses_an_empty_key(name: str) -> None:
    message = _refusal(**{name: ""})

    assert f"{name} is not set" in message


def test_production_refuses_a_short_secret_key() -> None:
    short = secrets.token_urlsafe(48)[:31]

    message = _refusal(SECRET_KEY=short)

    assert "SECRET_KEY is shorter than 32 characters" in message
    assert short not in message


def test_the_refusal_says_how_to_generate_keys() -> None:
    message = _refusal(SECRET_KEY=secrets.token_urlsafe(48)[:31])

    assert "secrets.token_urlsafe(48)" in message


def test_production_accepts_five_distinct_random_keys() -> None:
    keys = {name: secrets.token_urlsafe(48) for name in PRODUCTION_KEY_NAMES}

    loaded = Settings(**production_kwargs(**keys))

    assert loaded.MODE == ModeEnum.production
    assert {name: getattr(loaded, name) for name in PRODUCTION_KEY_NAMES} == keys


def test_the_checks_raise_value_errors_not_assertions() -> None:
    """``python -O`` strips assert statements; a ValueError survives it."""
    with pytest.raises(ValidationError) as excinfo:
        Settings(**production_kwargs(SECRET_KEY=secrets.token_urlsafe(48)[:31]))

    assert [error["type"] for error in excinfo.value.errors()] == ["value_error"]


def test_the_other_production_checks_raise_value_errors_too() -> None:
    with pytest.raises(ValidationError) as excinfo:
        Settings(**production_kwargs(DATABASE_HOST="localhost"))

    assert [error["type"] for error in excinfo.value.errors()] == ["value_error"]
    assert "DATABASE_HOST" in str(excinfo.value)


def test_a_refusal_does_not_echo_the_configured_keys() -> None:
    """A startup error lands in logs; it must not carry the keys that were configured."""
    keys = {name: secrets.token_urlsafe(48) for name in PRODUCTION_KEY_NAMES}

    with pytest.raises(ValidationError) as excinfo:
        Settings(**production_kwargs(**keys, DATABASE_HOST="localhost"))

    message = str(excinfo.value)
    assert [value for value in keys.values() if value in message] == []


@pytest.mark.parametrize("mode", [ModeEnum.development, ModeEnum.testing])
def test_other_modes_accept_placeholders_and_shared_keys(mode: ModeEnum) -> None:
    """Dev and test setups keep working with the example placeholders."""
    shared = "change-me-" + secrets.token_urlsafe(8)
    keys = {name: shared for name in PRODUCTION_KEY_NAMES}

    loaded = Settings(**production_kwargs(MODE=mode, **keys))

    assert loaded.SECRET_KEY == shared


def test_jwt_secret_key_is_gone_and_ignored_if_still_set(monkeypatch: pytest.MonkeyPatch) -> None:
    """Nothing signed with it. Like REFRESH_TOKEN_EXPIRE_DAYS (#334), a stale value loads and is ignored."""
    monkeypatch.setenv("JWT_SECRET_KEY", secrets.token_urlsafe(48))

    loaded = Settings(**production_kwargs())

    assert "JWT_SECRET_KEY" not in Settings.model_fields
    assert getattr(loaded, "JWT_SECRET_KEY", None) is None


def test_no_example_file_still_sets_jwt_secret_key() -> None:
    pattern = re.compile(r"(?<![A-Z_])JWT_SECRET_KEY\s*[:=]")
    offenders = [
        path.relative_to(REPO_ROOT).as_posix()
        for path in _example_files()
        if pattern.search(path.read_text(encoding="utf-8"))
    ]

    assert offenders == []
