#!/usr/bin/env python3
"""Fail unless `.claude/skills` is the one tracked link to `.agents/skills`.

Skills live in `.agents/skills/`. Claude Code reads only `.claude/skills/`, so that path is a
relative link, `../.agents/skills`, committed to git as a symlink (mode 120000). This check fails
when any of these is false:

* the git index holds exactly one symlink entry, `.claude/skills`, and its blob is
  `../.agents/skills`;
* on disk `.claude/skills` is a link whose target, with `\\` read as `/`, is `../.agents/skills`;
* that link resolves to the same directory as `.agents/skills`;
* `.agents/skills` is a real directory.

When `.claude/skills` is a regular file, a clone made without symlink support (the Windows
default) turned the link into a text file; the message says how to repair it.

Standard library only. Run from anywhere inside the repository:

    python scripts/development/check_skills_link.py

See docs/agents/skills-and-agents.md and docs/development/DEVELOPER_SETUP.md.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

LINK = ".claude/skills"
TARGET = "../.agents/skills"
SKILLS_DIR = ".agents/skills"
SETUP_DOC = "docs/development/DEVELOPER_SETUP.md#windows-repo-skills-not-loading"

WINDOWS_FIX = f"""\
{LINK} is a regular file, not a link. Git checked it out without symlink support.
Fix (Windows): turn on Developer Mode, then run:
  git config --global core.symlinks true
  git config --local core.symlinks true
  git checkout -- {LINK}
Details: {SETUP_DOC}"""


def repo_root(start: Path) -> Path:
    out = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        cwd=start,
        capture_output=True,
        text=True,
        check=True,
    )
    return Path(out.stdout.strip())


def index_links(root: Path) -> list[tuple[str, str]]:
    """Return (path, blob text) for every mode-120000 entry in the git index."""
    listing = subprocess.run(
        ["git", "ls-files", "-s", "-z"],
        cwd=root,
        capture_output=True,
        check=True,
    ).stdout.decode("utf-8", "surrogateescape")
    links = []
    for entry in filter(None, listing.split("\0")):
        meta, path = entry.split("\t", 1)
        mode, blob, _stage = meta.split()
        if mode != "120000":
            continue
        text = subprocess.run(
            ["git", "cat-file", "blob", blob],
            cwd=root,
            capture_output=True,
            check=True,
        ).stdout.decode("utf-8", "surrogateescape")
        links.append((path, text))
    return links


def check(root: Path) -> list[str]:
    errors: list[str] = []

    links = index_links(root)
    paths = sorted(path for path, _ in links)
    if paths != [LINK]:
        found = ", ".join(paths) if paths else "none"
        errors.append(
            f"git index must hold exactly one symlink, {LINK}; found: {found}"
        )
    for path, blob in links:
        if path == LINK and blob.replace("\\", "/") != TARGET:
            errors.append(f"git index: {LINK} points to {blob!r}, expected {TARGET!r}")

    link = root / LINK
    skills = root / SKILLS_DIR
    if not skills.is_dir() or skills.is_symlink():
        errors.append(f"{SKILLS_DIR} must be a real directory")

    if link.is_symlink():
        target = os.readlink(link).replace("\\", "/")
        if target != TARGET:
            errors.append(f"{LINK} points to {target!r}, expected {TARGET!r}")
        elif skills.is_dir() and link.resolve() != skills.resolve():
            errors.append(f"{LINK} does not resolve to {SKILLS_DIR}")
    elif link.is_file():
        errors.append(WINDOWS_FIX)
    else:
        errors.append(f"{LINK} is missing; run: ln -s {TARGET} {LINK}")

    return errors


def main() -> int:
    errors = check(repo_root(Path.cwd()))
    if errors:
        print("skills link check failed:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print(f"{LINK} -> {TARGET}: ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
