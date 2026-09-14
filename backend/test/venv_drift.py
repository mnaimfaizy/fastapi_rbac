"""Detect a backend virtualenv that has drifted from ``requirements.txt``.

Nothing else notices when the local virtualenv falls behind the pinned
dependency set, and test output from a drifted environment is
indistinguishable from a real application defect: #190 was filed against a
64-package-stale venv and diagnosed as a production bug that did not exist.
Issue #200 asked for this guard in response. CI cannot catch the drift,
because CI installs into a fresh environment on every run; the damage is
purely local.

The root ``conftest.py`` calls :func:`fail_on_drift` from its module body, so a
drifted environment aborts the session before any test executes. Set
``SKIP_DEPENDENCY_DRIFT_CHECK=1`` to run deliberately off-pin, for example
while testing a dependency upgrade.
"""

from __future__ import annotations

import importlib.metadata
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, TextIO

from packaging.requirements import InvalidRequirement, Requirement
from packaging.utils import canonicalize_name
from packaging.version import InvalidVersion, Version

#: Environment variable that opts a single test session out of the guard.
SKIP_ENV_VAR = "SKIP_DEPENDENCY_DRIFT_CHECK"

#: How many offenders the report spells out before truncating.
MAX_REPORTED = 10

#: pytest's ``ExitCode.USAGE_ERROR``, hard-coded because this runs before
#: importing pytest is worthwhile.
_EXIT_USAGE_ERROR = 4

#: ``name-version.dist-info`` (or ``.egg-info``), the layout pip writes.
_DIST_DIR_RE = re.compile(r"(?P<name>.+?)-(?P<version>[^-]+)\.(?:dist-info|egg-info)$")

_NOT_INSTALLED = "(not installed)"

#: Severity ranks for _severity. Missing packages are the worst drift there is;
#: a version neither PEP 440 nor we can parse is reported last rather than
#: guessed at.
_SEVERITY_MISSING = -1
_SEVERITY_UNPARSEABLE = 99

_REQUIREMENTS_PATH = Path(__file__).resolve().parent.parent / "requirements.txt"


@dataclass(frozen=True)
class Drift:
    """One pinned package whose installed version does not match the pin."""

    name: str
    pinned: str
    installed: str | None

    @property
    def installed_label(self) -> str:
        return self.installed if self.installed is not None else _NOT_INSTALLED


def parse_pins(requirements_text: str) -> dict[str, str]:
    """Map canonical package name -> exactly pinned version.

    Only ``name==version`` requirements count. Comments, pip options, ranges,
    wildcards and requirements whose environment marker does not apply to this
    interpreter are all ignored, so anything returned here is a pin the current
    environment is genuinely expected to meet.
    """
    pins: dict[str, str] = {}
    for raw_line in requirements_text.splitlines():
        line = raw_line.split("#", 1)[0].strip()
        if not line or line.startswith("-"):
            continue
        try:
            requirement = Requirement(line)
        except InvalidRequirement:
            continue
        if requirement.url is not None:
            continue
        if requirement.marker is not None and not requirement.marker.evaluate():
            continue
        specifiers = list(requirement.specifier)
        if len(specifiers) != 1:
            continue
        specifier = specifiers[0]
        if specifier.operator not in ("==", "===") or specifier.version.endswith("*"):
            continue
        pins[canonicalize_name(requirement.name)] = specifier.version
    return pins


def _is_version(candidate: str) -> bool:
    """Is this the version half of a dist dir name, or did the split go wrong?

    Legacy ``foo-1.0-py3.10.egg-info`` splits as name ``foo-1.0`` / version
    ``py3.10``, which would hide ``foo`` and report it as uninstalled. Anything
    PEP 440 rejects means the split was wrong, so the caller reads ``METADATA``
    for that distribution instead of trusting the directory name.
    """
    try:
        Version(candidate)
    except InvalidVersion:
        return False
    return True


def installed_versions(distributions: Iterable[Any] | None = None) -> dict[str, str]:
    """Map canonical package name -> installed version for this interpreter.

    Reads distribution metadata already on disk; it never touches the network
    and never shells out to pip. The version comes from the ``*.dist-info``
    directory name where possible, which is both far cheaper than parsing every
    ``METADATA`` file and what makes the guard immune to pip's ``~``-prefixed
    rollback leftovers: those carry the original package name in their
    ``METADATA``, so a stale ``~json-5.10.0.dist-info`` left behind by an
    aborted upgrade would otherwise report ``ujson`` as drifted when it is not.
    """
    if distributions is None:
        distributions = importlib.metadata.distributions()
    versions: dict[str, str] = {}
    for distribution in distributions:
        path = getattr(distribution, "_path", None)
        name: str | None = None
        version: str | None = None
        if path is not None:
            if path.name.startswith("~"):
                continue  # pip rollback leftover, not a real installation
            match = _DIST_DIR_RE.match(path.name)
            if match is not None and _is_version(match.group("version")):
                name, version = match.group("name"), match.group("version")
        if name is None:
            metadata = distribution.metadata
            name = metadata["Name"] if metadata is not None else None
            version = distribution.version
        if not name or not version:
            continue
        # First match wins, mirroring sys.path precedence for imports.
        versions.setdefault(canonicalize_name(name), version)
    return versions


def _matches(pinned: str, installed: str | None) -> bool:
    if installed is None:
        return False
    if pinned == installed:
        return True
    try:
        return Version(pinned) == Version(installed)
    except InvalidVersion:
        return False


def _severity(drift: Drift) -> tuple[int, str]:
    """Rank drift worst-first: missing, then the earliest diverging component."""
    if drift.installed is None:
        return (_SEVERITY_MISSING, drift.name)
    try:
        pinned_release = Version(drift.pinned).release
        installed_release = Version(drift.installed).release
    except InvalidVersion:
        return (_SEVERITY_UNPARSEABLE, drift.name)
    for index, (pinned_part, installed_part) in enumerate(zip(pinned_release, installed_release)):
        if pinned_part != installed_part:
            return (index, drift.name)
    return (min(len(pinned_release), len(installed_release)), drift.name)


def find_drift(pins: dict[str, str], installed: dict[str, str]) -> list[Drift]:
    """Return the pinned packages the environment does not satisfy, worst first.

    Packages present in the environment but absent from the pins are not drift
    and are never reported.
    """
    drifted = [
        Drift(name=name, pinned=pinned, installed=installed.get(name))
        for name, pinned in pins.items()
        if not _matches(pinned, installed.get(name))
    ]
    return sorted(drifted, key=_severity)


def format_report(drifts: list[Drift]) -> str:
    """Render the drift report: the count, the worst offenders, and the fix."""
    shown = drifts[:MAX_REPORTED]
    name_width = max([len(drift.name) for drift in shown] + [len("package")])
    pinned_width = max([len(drift.pinned) for drift in shown] + [len("pinned")])

    lines = [
        "Backend virtualenv has drifted from requirements.txt: "
        f"{len(drifts)} pinned package(s) at the wrong version.",
        "",
        f"  {'package'.ljust(name_width)}  {'pinned'.ljust(pinned_width)}  installed",
    ]
    lines += [
        f"  {drift.name.ljust(name_width)}  {drift.pinned.ljust(pinned_width)}  {drift.installed_label}"
        for drift in shown
    ]
    if len(drifts) > len(shown):
        lines.append(f"  ... and {len(drifts) - len(shown)} more.")
    lines += [
        "",
        "Test results from a drifted environment are not trustworthy: failures may be",
        "environment artifacts rather than application defects. Reinstall the pinned",
        "set from the backend/ directory:",
        "",
        "    pip install -r requirements.txt",
        "",
        "To run deliberately off-pin (for example while testing an upgrade), set:",
        "",
        f"    {SKIP_ENV_VAR}=1",
    ]
    return "\n".join(lines)


def check_for_drift(
    requirements_path: Path | None = None,
    installed: dict[str, str] | None = None,
    env: dict[str, str] | None = None,
) -> str | None:
    """Return a drift report, or ``None`` when the environment is fine or opted out."""
    environ = os.environ if env is None else env
    if environ.get(SKIP_ENV_VAR, "").strip():
        return None

    path = _REQUIREMENTS_PATH if requirements_path is None else requirements_path
    try:
        requirements_text = path.read_text(encoding="utf-8")
    except OSError:
        return None  # No pins to compare against; nothing to say.

    pins = parse_pins(requirements_text)
    drifts = find_drift(pins, installed_versions() if installed is None else installed)
    return format_report(drifts) if drifts else None


def fail_on_drift(stream: TextIO | None = None) -> None:
    """Abort the test session when the virtualenv has drifted from the pins.

    The root conftest calls this from its module body rather than from a pytest
    hook. By the time any hook runs, that conftest's ``pytest_plugins`` list has
    already imported ``app.main`` and the drifted packages along with it, so
    drift bad enough to break an import aborts as a bare conftest ``ImportError``
    with this guard never getting to speak -- the #190 confusion in a new form.

    Prints the report and exits with pytest's own ``EXIT_USAGEERROR``. Raising
    from a conftest body would bury the report under an "ImportError while
    loading conftest" headline that points at the wrong culprit.
    """
    report = check_for_drift()
    if report is None:
        return
    print(report, file=sys.stderr if stream is None else stream)
    raise SystemExit(_EXIT_USAGE_ERROR)
