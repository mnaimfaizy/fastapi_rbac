"""Tests for the virtualenv drift guard that runs at test-session start.

See ``backend/test/venv_drift.py`` and issue #200: a venv silently behind
``requirements.txt`` produces test output that reads exactly like an
application defect, so the guard has to be trustworthy in both directions --
it must catch real drift and must stay silent on a matching environment.
"""

import importlib.metadata
import io
import time
from pathlib import Path
from test.venv_drift import (
    _DIST_DIR_RE,
    MAX_REPORTED,
    SKIP_ENV_VAR,
    Drift,
    check_for_drift,
    fail_on_drift,
    find_drift,
    format_report,
    installed_versions,
    parse_pins,
)

import pytest

REQUIREMENTS_PATH = Path(__file__).resolve().parents[2] / "requirements.txt"


class TestParsePins:
    def test_reads_exact_pins(self) -> None:
        assert parse_pins("fastapi==0.141.1\nbcrypt==5.0.0\n") == {
            "fastapi": "0.141.1",
            "bcrypt": "5.0.0",
        }

    def test_canonicalizes_names(self) -> None:
        pins = parse_pins("email_validator==2.3.0\nSQLAlchemy-Utils==0.42.1\nfactory_boy==3.3.3\n")

        assert pins == {
            "email-validator": "2.3.0",
            "sqlalchemy-utils": "0.42.1",
            "factory-boy": "3.3.3",
        }

    def test_ignores_blank_lines_comments_and_pip_options(self) -> None:
        text = "\n".join(
            [
                "# a comment",
                "",
                "   ",
                "-r other-requirements.txt",
                "--index-url https://example.invalid/simple",
                "fastapi==0.141.1  # inline comment",
            ]
        )

        assert parse_pins(text) == {"fastapi": "0.141.1"}

    @pytest.mark.parametrize(
        "line",
        [
            "fastapi>=0.141.1",
            "fastapi<1.0",
            "fastapi==0.141.*",
            "fastapi>=0.140,<0.142",
            "fastapi",
            "not a requirement at all !!!",
            "fastapi @ https://example.invalid/fastapi.whl",
        ],
        ids=[
            "lower-bound",
            "upper-bound",
            "wildcard",
            "range",
            "unpinned",
            "garbage",
            "direct-url",
        ],
    )
    def test_ignores_anything_that_is_not_an_exact_pin(self, line: str) -> None:
        assert parse_pins(line) == {}

    def test_keeps_pins_with_a_marker_that_applies(self) -> None:
        assert parse_pins('tomli==2.4.1; python_version >= "3.0"') == {"tomli": "2.4.1"}

    def test_drops_pins_with_a_marker_that_does_not_apply(self) -> None:
        assert parse_pins('tomli==2.4.1; python_version < "3.0"') == {}

    def test_parses_the_real_requirements_file(self) -> None:
        pins = parse_pins(REQUIREMENTS_PATH.read_text(encoding="utf-8"))

        assert len(pins) > 100, "the repository's own pins must be readable by the guard"
        assert pins["fastapi-pagination"]


class TestFindDrift:
    def test_matching_environment_reports_nothing(self) -> None:
        pins = {"fastapi": "0.141.1", "bcrypt": "5.0.0"}

        assert find_drift(pins, dict(pins)) == []

    def test_reports_a_wrong_version(self) -> None:
        drifts = find_drift({"fastapi": "0.141.1"}, {"fastapi": "0.139.1"})

        assert drifts == [Drift(name="fastapi", pinned="0.141.1", installed="0.139.1")]

    def test_reports_a_pinned_package_that_is_missing_entirely(self) -> None:
        drifts = find_drift({"fastapi": "0.141.1"}, {})

        assert drifts == [Drift(name="fastapi", pinned="0.141.1", installed=None)]

    def test_ignores_installed_packages_that_are_not_pinned(self) -> None:
        pins = {"fastapi": "0.141.1"}
        installed = {"fastapi": "0.141.1", "pip": "25.0", "setuptools": "80.0", "wheel": "0.45"}

        assert find_drift(pins, installed) == []

    def test_treats_equivalent_version_spellings_as_a_match(self) -> None:
        assert find_drift({"pytz": "2026.3.post1"}, {"pytz": "2026.3.post1"}) == []
        assert find_drift({"black": "25.12.0"}, {"black": "25.12"}) == []

    def test_orders_worst_offenders_first(self) -> None:
        pins = {
            "patch-drift": "1.2.3",
            "minor-drift": "1.2.3",
            "major-drift": "1.2.3",
            "missing": "1.2.3",
        }
        installed = {
            "patch-drift": "1.2.9",
            "minor-drift": "1.9.3",
            "major-drift": "9.2.3",
        }

        assert [drift.name for drift in find_drift(pins, installed)] == [
            "missing",
            "major-drift",
            "minor-drift",
            "patch-drift",
        ]

    def test_unparseable_versions_are_reported_not_crashed_on(self) -> None:
        drifts = find_drift({"weird": "1.0.0"}, {"weird": "not-a-version"})

        assert drifts == [Drift(name="weird", pinned="1.0.0", installed="not-a-version")]


class TestFormatReport:
    @staticmethod
    def _drifts(count: int) -> list[Drift]:
        return [
            Drift(name=f"package-{index:02d}", pinned="1.0.0", installed="0.9.0") for index in range(count)
        ]

    def test_names_the_drift_count(self) -> None:
        assert "3 pinned package(s)" in format_report(self._drifts(3))

    def test_shows_pinned_versus_installed(self) -> None:
        report = format_report([Drift(name="fastapi-pagination", pinned="0.15.16", installed="0.13.1")])

        assert "fastapi-pagination" in report
        assert "0.15.16" in report
        assert "0.13.1" in report

    def test_labels_a_missing_package(self) -> None:
        report = format_report([Drift(name="fastapi", pinned="0.141.1", installed=None)])

        assert "(not installed)" in report

    def test_names_the_command_that_fixes_it(self) -> None:
        assert "pip install -r requirements.txt" in format_report(self._drifts(1))

    def test_names_the_escape_hatch(self) -> None:
        assert SKIP_ENV_VAR in format_report(self._drifts(1))

    def test_truncates_a_long_list_but_keeps_the_full_count(self) -> None:
        report = format_report(self._drifts(64))

        assert "64 pinned package(s)" in report
        assert f"... and {64 - MAX_REPORTED} more." in report
        assert f"package-{MAX_REPORTED:02d}" not in report


class TestCheckForDrift:
    def test_matching_environment_produces_no_report(self, tmp_path: Path) -> None:
        requirements = tmp_path / "requirements.txt"
        requirements.write_text("fastapi==0.141.1\n", encoding="utf-8")

        report = check_for_drift(
            requirements_path=requirements,
            installed={"fastapi": "0.141.1"},
            env={},
        )

        assert report is None

    def test_drifted_environment_produces_a_report(self, tmp_path: Path) -> None:
        requirements = tmp_path / "requirements.txt"
        requirements.write_text("fastapi==0.141.1\nbcrypt==5.0.0\n", encoding="utf-8")

        report = check_for_drift(
            requirements_path=requirements,
            installed={"fastapi": "0.139.1", "bcrypt": "5.0.0"},
            env={},
        )

        assert report is not None
        assert "1 pinned package(s)" in report
        assert "0.139.1" in report

    def test_escape_hatch_suppresses_the_report(self, tmp_path: Path) -> None:
        requirements = tmp_path / "requirements.txt"
        requirements.write_text("fastapi==0.141.1\n", encoding="utf-8")

        report = check_for_drift(
            requirements_path=requirements,
            installed={"fastapi": "0.139.1"},
            env={SKIP_ENV_VAR: "1"},
        )

        assert report is None

    def test_empty_escape_hatch_value_does_not_opt_out(self, tmp_path: Path) -> None:
        requirements = tmp_path / "requirements.txt"
        requirements.write_text("fastapi==0.141.1\n", encoding="utf-8")

        report = check_for_drift(
            requirements_path=requirements,
            installed={"fastapi": "0.139.1"},
            env={SKIP_ENV_VAR: "  "},
        )

        assert report is not None

    def test_missing_requirements_file_is_not_an_error(self, tmp_path: Path) -> None:
        assert check_for_drift(requirements_path=tmp_path / "absent.txt", installed={}, env={}) is None


class FakeDistribution:
    """Stand-in for ``importlib.metadata.PathDistribution``.

    ``metadata``/``version`` deliberately differ from the directory name in
    some tests: that is exactly the situation pip's rollback leftovers create.
    """

    def __init__(self, dir_name: str | None, metadata_name: str, version: str) -> None:
        self._path = Path("site-packages") / dir_name if dir_name is not None else None
        self.metadata = {"Name": metadata_name}
        self.version = version


class TestInstalledVersions:
    def test_reads_this_interpreters_environment(self) -> None:
        versions = installed_versions()

        assert versions["pytest"]
        assert versions["fastapi"]

    def test_canonicalizes_names_from_the_dist_info_directory(self) -> None:
        distributions = [FakeDistribution("email_validator-2.3.0.dist-info", "email_validator", "2.3.0")]

        assert installed_versions(distributions) == {"email-validator": "2.3.0"}

    def test_ignores_pip_rollback_leftovers(self) -> None:
        """``~``-prefixed dist-info dirs are pip's aborted-upgrade debris.

        Their ``METADATA`` still carries the original package name and the old
        version, so trusting it reports drift for a package that is in fact
        correctly installed -- the exact false positive this guard must not
        produce, since a false alarm here blocks the whole test session.
        """
        distributions = [
            FakeDistribution("ujson-5.13.0.dist-info", "ujson", "5.13.0"),
            FakeDistribution("~json-5.10.0.dist-info", "ujson", "5.10.0"),
        ]

        assert installed_versions(distributions) == {"ujson": "5.13.0"}
        assert find_drift({"ujson": "5.13.0"}, installed_versions(distributions)) == []

    def test_does_not_mis_split_a_legacy_egg_info_directory(self) -> None:
        """``foo-1.0-py3.10.egg-info`` splits naively as name ``foo-1.0``.

        That would hide ``foo`` entirely and report a pinned, correctly
        installed package as "(not installed)" -- a false alarm that aborts the
        whole session. The version half has to parse as a version, or the
        directory name is not trusted.
        """
        distributions = [FakeDistribution("bleach-6.4.0-py3.10.egg-info", "bleach", "6.4.0")]

        assert installed_versions(distributions) == {"bleach": "6.4.0"}
        assert find_drift({"bleach": "6.4.0"}, installed_versions(distributions)) == []

    def test_falls_back_to_metadata_for_an_unrecognised_layout(self) -> None:
        distributions = [
            FakeDistribution(None, "fastapi", "0.141.1"),
            FakeDistribution("not-a-package-dir", "bcrypt", "5.0.0"),
        ]

        assert installed_versions(distributions) == {"fastapi": "0.141.1", "bcrypt": "5.0.0"}

    def test_first_distribution_on_the_path_wins(self) -> None:
        distributions = [
            FakeDistribution("fastapi-0.141.1.dist-info", "fastapi", "0.141.1"),
            FakeDistribution("fastapi-0.139.1.dist-info", "fastapi", "0.139.1"),
        ]

        assert installed_versions(distributions) == {"fastapi": "0.141.1"}

    def test_the_dist_info_directory_fast_path_is_actually_live(self) -> None:
        """Canary for the private ``_path`` attribute this module reads.

        If a stdlib change ever removed it, every distribution would quietly
        fall through to the ``METADATA`` branch -- 30x slower, and blind to the
        ``~`` leftovers again. That degradation is invisible at runtime, so it
        has to fail here instead.
        """
        distributions = list(importlib.metadata.distributions())
        resolved_by_directory = [
            dist
            for dist in distributions
            if getattr(dist, "_path", None) is not None and _DIST_DIR_RE.match(dist._path.name)
        ]

        assert len(resolved_by_directory) > len(distributions) / 2, (
            "installed_versions() has silently fallen back to parsing METADATA; "
            "importlib.metadata.PathDistribution._path may have changed"
        )

    def test_is_fast_enough_to_run_on_every_session(self) -> None:
        start = time.perf_counter()
        installed_versions()
        elapsed = time.perf_counter() - start

        # ~11ms in practice. The bound is loose enough not to flake on a cold
        # CI filesystem, tight enough to catch a rewrite that shells out to pip
        # or parses every METADATA file (~0.5s) instead of reading dir names.
        assert elapsed < 0.4, f"reading installed metadata took {elapsed:.2f}s; it must stay cheap"


class TestFailOnDrift:
    def test_this_environment_matches_requirements_txt(self) -> None:
        """The guard is only credible if it passes on a correctly built venv."""
        fail_on_drift()

    def test_prints_the_report_and_exits_with_pytests_usage_error_code(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr("test.venv_drift.check_for_drift", lambda: "64 pinned package(s) drifted")
        stream = io.StringIO()

        with pytest.raises(SystemExit) as exit_info:
            fail_on_drift(stream=stream)

        assert exit_info.value.code == 4
        assert "64 pinned package(s) drifted" in stream.getvalue()

    def test_says_nothing_when_the_environment_matches(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr("test.venv_drift.check_for_drift", lambda: None)
        stream = io.StringIO()

        fail_on_drift(stream=stream)

        assert stream.getvalue() == ""
