"""Compare two Cobertura XMLs for the same executable line set.

Unit and integration coverage are collected in different environments
(GitHub runner vs Docker ``/app``). Codecov used to merge those XMLs under
one ``backend`` flag. When the inputs disagree about which line is which,
that merge produces internally impossible line data -- a miss beside a hit
in a straight-line block -- which is what #236 caught on ``auth.py``.

Hits may differ between the two reports; that is the point of combining
them. The executable *line set* for a file must not. This module is the
check CI runs before ``coverage combine``.
"""

from __future__ import annotations

import argparse
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Iterable, Mapping, Sequence, TextIO

# filename -> {line number -> hits}
FileHits = dict[str, dict[int, int]]

_APP_MARKERS = ("/backend/app/", "/app/app/", "backend/app/", "app/")


def normalize_filename(filename: str) -> str:
    """Collapse runner and Docker prefixes onto ``app/...``.

    Coverage XML from the unit job uses the GitHub runner checkout path;
    the integration job uses Docker ``WORKDIR /app``. Both are the same
    package once those prefixes are stripped.
    """
    unix = filename.replace("\\", "/")
    for marker in _APP_MARKERS:
        idx = unix.find(marker)
        if idx != -1:
            remainder = unix[idx + len(marker) :]
            return remainder if remainder.startswith("app/") else f"app/{remainder}"
    return unix.lstrip("/")


def parse_cobertura(xml: str) -> FileHits:
    """Return hit counts keyed by normalized filename then line number."""
    root = ET.fromstring(xml)
    files: FileHits = {}
    for class_el in root.iter("class"):
        raw_name = class_el.get("filename")
        if not raw_name:
            continue
        name = normalize_filename(raw_name)
        hits = files.setdefault(name, {})
        for line_el in class_el.iter("line"):
            number = line_el.get("number")
            if number is None:
                continue
            hits[int(number)] = int(line_el.get("hits", "0"))
    return files


def executable_line_mismatch(
    left: Mapping[str, Mapping[int, int]],
    right: Mapping[str, Mapping[int, int]],
    filename: str,
) -> tuple[frozenset[int], frozenset[int]]:
    """Lines listed in only one report. Empty pair means the sets match."""
    key = normalize_filename(filename)
    left_lines = frozenset(left.get(key, {}))
    right_lines = frozenset(right.get(key, {}))
    return left_lines - right_lines, right_lines - left_lines


def hit_miss_disagreements(
    left: Mapping[str, Mapping[int, int]],
    right: Mapping[str, Mapping[int, int]],
    filename: str,
) -> list[tuple[int, int, int]]:
    """Shared lines where one report recorded a hit and the other a miss."""
    key = normalize_filename(filename)
    left_hits = left.get(key, {})
    right_hits = right.get(key, {})
    disagreements: list[tuple[int, int, int]] = []
    for line in sorted(set(left_hits) & set(right_hits)):
        left_n = left_hits[line]
        right_n = right_hits[line]
        if (left_n == 0) != (right_n == 0):
            disagreements.append((line, left_n, right_n))
    return disagreements


def compare_files(
    left: Mapping[str, Mapping[int, int]],
    right: Mapping[str, Mapping[int, int]],
    filenames: Iterable[str],
    out: TextIO,
) -> int:
    """Print the comparison. Return 1 if any executable line set mismatches."""
    exit_code = 0
    for filename in filenames:
        key = normalize_filename(filename)
        in_left = key in left
        in_right = key in right
        if not in_left or not in_right:
            missing = []
            if not in_left:
                missing.append("first report")
            if not in_right:
                missing.append("second report")
            out.write(f"{key}: missing from {' and '.join(missing)}\n")
            exit_code = 1
            continue
        only_left, only_right = executable_line_mismatch(left, right, key)
        if only_left or only_right:
            out.write(
                f"{key}: executable line sets differ "
                f"(only first: {sorted(only_left)}; only second: {sorted(only_right)})\n"
            )
            exit_code = 1
        else:
            out.write(f"{key}: executable line sets match ({len(left[key])} lines)\n")
        disagreements = hit_miss_disagreements(left, right, key)
        if disagreements:
            out.write(
                f"{key}: {len(disagreements)} line(s) hit in one report and missed in the other "
                "(expected; coverage combine unions these)\n"
            )
            for line, left_n, right_n in disagreements[:20]:
                out.write(f"  line {line}: first hits={left_n} second hits={right_n}\n")
    return exit_code


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Fail if two Cobertura reports disagree about executable lines."
    )
    parser.add_argument("first", type=Path, help="Unit (or first) coverage.xml")
    parser.add_argument("second", type=Path, help="Integration (or second) coverage.xml")
    parser.add_argument(
        "--file",
        action="append",
        dest="files",
        default=[],
        help="Repo-relative or app-relative file to compare. Repeatable. "
        "Defaults to app/api/v1/endpoints/auth.py (the file in #236).",
    )
    args = parser.parse_args(list(argv) if argv is not None else None)
    files = args.files or ["app/api/v1/endpoints/auth.py"]
    left = parse_cobertura(args.first.read_text(encoding="utf-8"))
    right = parse_cobertura(args.second.read_text(encoding="utf-8"))
    return compare_files(left, right, files, sys.stdout)


if __name__ == "__main__":
    raise SystemExit(main())
