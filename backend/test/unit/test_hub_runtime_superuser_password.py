"""The hub-runtime bootstraps generate a superuser password seeding accepts.

Seeding refuses a FIRST_SUPERUSER_PASSWORD that fails the password policy
(#272). The bootstraps used to generate it as 64 hex characters, which never
has an uppercase letter or a special character, so a freshly bootstrapped
stack stopped at seeding. ``_superuser_password.sh`` mirrors the policy in
bash; this runs it against the real ``PasswordValidator`` so the two cannot
drift apart.
"""

import secrets
import shutil
import subprocess
from pathlib import Path
from test.utils import random_strong_password

import pytest

from app.core.security import PasswordValidator

HUB_RUNTIME = Path(__file__).resolve().parents[3] / "docs/deployment/hub-runtime"
GENERATOR = HUB_RUNTIME / "_superuser_password.sh"
RUNS = 50

pytestmark = [
    pytest.mark.skipif(not HUB_RUNTIME.is_dir(), reason="docs/ is not mounted (backend-only checkout)"),
    pytest.mark.skipif(shutil.which("bash") is None, reason="bash is not installed"),
]


def _generate(count: int) -> list[str]:
    script = f'source "{GENERATOR}"; for _ in $(seq {count}); do gen_superuser_password; done'
    result = subprocess.run(["bash", "-c", script], capture_output=True, text=True, check=True, timeout=120)
    return result.stdout.splitlines()


def _policy_check(password: str) -> bool:
    script = f'source "{GENERATOR}"; hub_password_meets_policy "$1"'
    return subprocess.run(["bash", "-c", script, "_", password], check=False).returncode == 0


def test_every_generated_password_passes_the_policy() -> None:
    passwords = _generate(RUNS)

    assert len(passwords) == RUNS
    failures = [
        index for index, value in enumerate(passwords) if not PasswordValidator.validate_complexity(value)[0]
    ]
    assert failures == []
    assert len(set(passwords)) == RUNS


def test_generated_passwords_are_safe_in_an_env_file() -> None:
    """No character the .env parser or set_kv_if_empty's sed would mangle."""
    unsafe = set("#$'\"|&/\\ \t`")

    assert [index for index, value in enumerate(_generate(10)) if unsafe & set(value)] == []


def _compliant_base() -> str:
    """A random password both checks accept; no literal password is committed.

    The bash check also wants a special from its .env-safe subset, so add one.
    """
    while True:
        candidate = random_strong_password() + "@"
        if PasswordValidator.validate_complexity(candidate)[0]:
            return candidate


@pytest.mark.parametrize(
    "shape",
    ["no-upper-or-special", "sequential-letters", "sequential-digits", "descending", "repeated", "too-short"],
)
def test_the_bash_check_refuses_what_the_policy_refuses(shape: str) -> None:
    """The bash mirror must not accept a shape the validator refuses."""
    base = _compliant_base()
    candidate = {
        "no-upper-or-special": secrets.token_hex(16),
        "sequential-letters": base + "xyz",
        "sequential-digits": base + "789",
        "descending": base + "CBA",
        "repeated": base + "zzzz",
        "too-short": base[:7],
    }[shape]

    assert not PasswordValidator.validate_complexity(candidate)[0]
    assert not _policy_check(candidate)


def test_the_bash_check_accepts_a_compliant_password() -> None:
    candidate = _compliant_base()

    assert _policy_check(candidate)


@pytest.mark.parametrize("script", ["bootstrap.sh", "split/_common.sh"])
def test_the_bootstraps_use_the_policy_generator(script: str) -> None:
    text = (HUB_RUNTIME / script).read_text(encoding="utf-8")

    assert 'set_kv_if_empty FIRST_SUPERUSER_PASSWORD "$(gen_superuser_password)"' in text
