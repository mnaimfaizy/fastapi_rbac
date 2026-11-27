#!/usr/bin/env python3
"""Generate the Claude Code and Cursor sub-agent files from one canonical file each.

Canonical file: `.github/agents/<name>.agent.md` (GitHub Copilot reads it as it is). Targets:
`.claude/agents/<name>.md` and `.cursor/agents/<name>.md`.

Canonical file shape:

* Frontmatter with `name` (equal to the file stem) and `description`.
* A body shared by every harness. Text for some harnesses only goes between marker lines:

      <!-- harness:claude -->
      Claude-only text.
      <!-- /harness -->

  A marker may list several harnesses, `<!-- harness:claude,cursor -->`. The harnesses are
  `claude`, `cursor` and `copilot`. Markers do not nest. An unknown name is an error.

Each target gets the shared body plus the sections that name its harness, after one generated-file
comment. Its `name` and `description` come from the canonical file. Every other frontmatter key
(Claude `tools`, `model`, `hooks`; Cursor `model`, `readonly`) stays as it is in the target, because
model pins and tool grants differ by harness. A target that does not exist yet is created with
`name` and `description` only; add the harness keys by hand.

Standard library only. Run from anywhere inside the repository:

    python scripts/development/sync_agents.py --check   # exit 1 on any drift
    python scripts/development/sync_agents.py --apply   # rewrite the targets

See docs/agents/skills-and-agents.md.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

CANON_DIR = ".github/agents"
CANON_SUFFIX = ".agent.md"
TARGET_DIRS = {"claude": ".claude/agents", "cursor": ".cursor/agents"}
HARNESSES = ("claude", "cursor", "copilot")
SYNC = "scripts/development/sync_agents.py"

OPEN = re.compile(r"^<!-- harness:([^>]*?) -->$")
CLOSE = "<!-- /harness -->"
KEY = re.compile(r"^([A-Za-z_][\w-]*):")
SHARED_KEYS = ("name", "description")


class SyncError(Exception):
    pass


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8").replace("\r\n", "\n")


def split_frontmatter(text: str) -> tuple[list[tuple[str, list[str]]], str]:
    """Return the frontmatter as ordered (key, raw lines) blocks, and the body."""
    lines = text.split("\n")
    if lines[0] != "---":
        return [], text
    try:
        end = lines.index("---", 1)
    except ValueError:
        raise SyncError("frontmatter is not closed") from None
    blocks: list[tuple[str, list[str]]] = []
    for line in lines[1:end]:
        match = KEY.match(line)
        if match:
            blocks.append((match.group(1), [line]))
        elif blocks:
            blocks[-1][1].append(line)
        elif line.strip():
            raise SyncError(f"unexpected frontmatter line: {line!r}")
    return blocks, "\n".join(lines[end + 1 :])


def filter_body(body: str, harness: str, label: str) -> str:
    out: list[str] = []
    keep = True
    open_line = 0
    for number, line in enumerate(body.split("\n"), start=1):
        match = OPEN.match(line)
        if match:
            if open_line:
                raise SyncError(f"{label}:{number}: harness sections do not nest")
            names = [n.strip() for n in match.group(1).split(",")]
            unknown = [n for n in names if n not in HARNESSES]
            if unknown:
                raise SyncError(
                    f"{label}:{number}: unknown harness {', '.join(unknown)} "
                    f"(use {', '.join(HARNESSES)})"
                )
            open_line = number
            keep = harness in names
        elif line == CLOSE:
            if not open_line:
                raise SyncError(f"{label}:{number}: closing marker with no opening one")
            open_line = 0
            keep = True
        elif keep:
            out.append(line)
    if open_line:
        raise SyncError(f"{label}:{open_line}: harness section is never closed")
    return "\n".join(out).strip("\n") + "\n"


def canon_parts(path: Path) -> tuple[list[tuple[str, list[str]]], str]:
    """Return the canonical name and description blocks, and the body. Validate them."""
    blocks, body = split_frontmatter(read(path))
    keys = {key: lines for key, lines in blocks}
    stem = path.name[: -len(CANON_SUFFIX)]
    missing = [k for k in SHARED_KEYS if k not in keys]
    if missing:
        raise SyncError(f"{path.name}: frontmatter lacks {', '.join(missing)}")
    value = keys["name"][0].split(":", 1)[1].strip().strip("'\"")
    if value != stem:
        raise SyncError(f"{path.name}: name is {value!r}, expected {stem!r}")
    for harness in HARNESSES:  # validate the markers once for every harness
        filter_body(body, harness, path.name)
    return [(k, keys[k]) for k in SHARED_KEYS], body


def generated_line(stem: str) -> str:
    return (
        f"<!-- Generated from {CANON_DIR}/{stem}{CANON_SUFFIX} by {SYNC}. "
        f"Edit that file, then run it with --apply. -->"
    )


def render(path: Path, harness: str, current: str | None) -> str:
    stem = path.name[: -len(CANON_SUFFIX)]
    shared, body = canon_parts(path)
    own: list[tuple[str, list[str]]] = []
    if current is not None:
        own = [(k, v) for k, v in split_frontmatter(current)[0] if k not in SHARED_KEYS]
    lines = ["---"]
    for _, block in shared + own:
        lines.extend(block)
    lines.append("---")
    lines.append(generated_line(stem))
    lines.append("")
    return "\n".join(lines) + "\n" + filter_body(body, harness, path.name)


def repo_root(start: Path) -> Path:
    out = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        cwd=start,
        capture_output=True,
        text=True,
        check=True,
    )
    return Path(out.stdout.strip())


def drift_reasons(expected: str, current: str) -> list[str]:
    exp_front, exp_body = split_frontmatter(expected)
    cur_front, cur_body = split_frontmatter(current)
    reasons = []
    exp_shared = {k: v for k, v in exp_front if k in SHARED_KEYS}
    cur_shared = {k: v for k, v in cur_front if k in SHARED_KEYS}
    for key in SHARED_KEYS:
        if exp_shared.get(key) != cur_shared.get(key):
            reasons.append(f"{key} differs from the canonical file")
    if exp_body != cur_body:
        reasons.append("body differs from the canonical file")
    return reasons or ["file differs from the generated output"]


def sync(root: Path, apply: bool) -> tuple[list[str], list[str]]:
    """Return (problems, notes). With apply, write every target that is missing or stale."""
    problems: list[str] = []
    notes: list[str] = []
    canon_dir = root / CANON_DIR
    canon = sorted(canon_dir.glob(f"*{CANON_SUFFIX}")) if canon_dir.is_dir() else []
    stems = {p.name[: -len(CANON_SUFFIX)] for p in canon}

    for path in canon:
        for harness, directory in TARGET_DIRS.items():
            target = root / directory / f"{path.name[: -len(CANON_SUFFIX)]}.md"
            rel = target.relative_to(root).as_posix()
            current = read(target) if target.is_file() else None
            try:
                expected = render(path, harness, current)
            except SyncError as error:
                problems.append(str(error))
                continue
            if current == expected:
                continue
            if apply:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(expected, encoding="utf-8", newline="\n")
                notes.append(f"wrote {rel}")
                if current is None:
                    notes.append(
                        f"{rel} is new: add the {harness} frontmatter keys "
                        "(model, tools or readonly) by hand."
                    )
            elif current is None:
                problems.append(f"{rel}: missing; run {SYNC} --apply")
            else:
                reasons = "; ".join(drift_reasons(expected, current))
                problems.append(f"{rel}: {reasons}; run {SYNC} --apply")

    for harness, directory in TARGET_DIRS.items():
        folder = root / directory
        for extra in sorted(folder.glob("*.md")) if folder.is_dir() else []:
            if extra.stem not in stems:
                problems.append(
                    f"{extra.relative_to(root).as_posix()}: no canonical file "
                    f"{CANON_DIR}/{extra.stem}{CANON_SUFFIX}"
                )
    return problems, notes


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="exit 1 on drift")
    mode.add_argument("--apply", action="store_true", help="rewrite the targets")
    args = parser.parse_args(argv)

    root = repo_root(Path.cwd())
    problems, notes = sync(root, apply=args.apply)
    for note in notes:
        print(note)
    if problems:
        print("sub-agent files are out of sync:", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        return 1
    if args.check:
        print("sub-agent files match their canonical files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
