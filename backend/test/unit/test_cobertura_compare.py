"""Two backend coverage XMLs must describe the same executable lines (#236).

Unit and integration coverage used to be uploaded separately under one
``backend`` flag. A union of hits can only add coverage, so a miss beside
a hit in one straight-line block means the inputs disagreed about which
line is which, not that the tests skipped a statement. This helper is the
check CI runs on those two XMLs before ``coverage combine``: same file,
same executable line set. Hits may differ; that is why the reports are
combined.
"""

from __future__ import annotations

from pathlib import Path
from test.cobertura_compare import (
    executable_line_mismatch,
    hit_miss_disagreements,
    main,
    normalize_filename,
    parse_cobertura,
)

import pytest

AUTH = "app/api/v1/endpoints/auth.py"


def _report(filename: str, lines: dict[int, int], source: str = "/app") -> str:
    line_tags = "\n".join(f'            <line number="{n}" hits="{h}"/>' for n, h in sorted(lines.items()))
    return f"""<?xml version="1.0" ?>
<coverage version="7.15.4" line-rate="0.5" lines-covered="1" lines-valid="2">
  <sources>
    <source>{source}</source>
  </sources>
  <packages>
    <package name="app.api.v1.endpoints" line-rate="0.5">
      <classes>
        <class name="auth.py" filename="{filename}" line-rate="0.5">
          <methods/>
          <lines>
{line_tags}
          </lines>
        </class>
      </classes>
    </package>
  </packages>
</coverage>
"""


def test_parse_cobertura_maps_hits_by_filename_and_line() -> None:
    xml = _report(AUTH, {317: 0, 325: 1})

    parsed = parse_cobertura(xml)

    assert parsed[AUTH] == {317: 0, 325: 1}


@pytest.mark.parametrize(
    "raw",
    [
        "app/api/v1/endpoints/auth.py",
        "/app/app/api/v1/endpoints/auth.py",
        "backend/app/api/v1/endpoints/auth.py",
        "/home/runner/work/fastapi_rbac/fastapi_rbac/backend/app/api/v1/endpoints/auth.py",
        r"backend\app\api\v1\endpoints\auth.py",
        r"C:\app\app\api\v1\endpoints\auth.py",
    ],
)
def test_normalize_filename_collapses_docker_and_runner_prefixes(raw: str) -> None:
    assert normalize_filename(raw) == AUTH


def test_executable_line_sets_may_disagree_on_hits_but_not_on_which_lines_exist() -> None:
    unit = parse_cobertura(_report(AUTH, {317: 1, 325: 1}))
    integration = parse_cobertura(_report(AUTH, {317: 0, 325: 1}))

    only_unit, only_integration = executable_line_mismatch(unit, integration, AUTH)

    assert only_unit == frozenset()
    assert only_integration == frozenset()
    assert hit_miss_disagreements(unit, integration, AUTH) == [(317, 1, 0)]


def test_executable_line_mismatch_when_reports_list_different_lines() -> None:
    unit = parse_cobertura(_report(AUTH, {317: 1, 325: 1}))
    integration = parse_cobertura(_report("/app/app/api/v1/endpoints/auth.py", {325: 1, 329: 1}))

    only_unit, only_integration = executable_line_mismatch(unit, integration, AUTH)

    assert only_unit == frozenset({317})
    assert only_integration == frozenset({329})


def test_cli_accepts_matching_executable_lines_even_when_hits_differ(tmp_path: Path) -> None:
    unit = tmp_path / "unit.xml"
    integration = tmp_path / "integration.xml"
    unit.write_text(_report(AUTH, {317: 1, 325: 1}), encoding="utf-8")
    integration.write_text(_report(AUTH, {317: 0, 325: 1}), encoding="utf-8")

    assert main([str(unit), str(integration), "--file", AUTH]) == 0


def test_cli_rejects_reports_that_do_not_share_an_executable_line_set(tmp_path: Path) -> None:
    unit = tmp_path / "unit.xml"
    integration = tmp_path / "integration.xml"
    unit.write_text(_report(AUTH, {317: 1, 325: 1}), encoding="utf-8")
    integration.write_text(_report(AUTH, {325: 1}), encoding="utf-8")

    assert main([str(unit), str(integration), "--file", AUTH]) == 1


def test_cli_rejects_when_the_file_is_missing_from_one_report(tmp_path: Path) -> None:
    unit = tmp_path / "unit.xml"
    integration = tmp_path / "integration.xml"
    unit.write_text(_report(AUTH, {325: 1}), encoding="utf-8")
    integration.write_text(_report("app/utils/token.py", {1: 1}), encoding="utf-8")

    assert main([str(unit), str(integration), "--file", AUTH]) == 1


def test_cli_defaults_to_auth_py(tmp_path: Path) -> None:
    unit = tmp_path / "unit.xml"
    integration = tmp_path / "integration.xml"
    unit.write_text(_report(AUTH, {317: 1, 325: 1}), encoding="utf-8")
    integration.write_text(_report(AUTH, {317: 0, 325: 1}), encoding="utf-8")

    assert main([str(unit), str(integration)]) == 0
