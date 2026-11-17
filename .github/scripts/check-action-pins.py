#!/usr/bin/env python3
"""Fail when a third-party action is not pinned to a full commit SHA.

A tag such as `@v4` can be moved by the action's owner, so every third-party
`uses:` in .github/workflows/*.yml and .github/actions/**/action.yml must name
a 40-character commit SHA, with the version in a trailing comment:

    uses: docker/login-action@<40-hex-sha> # v4.8.0

Dependabot (github-actions) updates the SHA and its comment together.

Allowed on a tag: GitHub's own actions (actions/*, github/*), Agent-kit
(mnaimfaizy/agent-kit/*, whose tag is the contract in docs/agents/agent-kit.md)
and local actions (./). Standard library only. Run from the repository root;
ci.yml runs it on every change, and pre-commit runs it when a workflow changes.
"""

import re
import sys
from pathlib import Path

ALLOWED_PREFIXES = ("actions/", "github/", "mnaimfaizy/agent-kit/", "./")
USES = re.compile(r"^\s*(?:-\s+)?uses:\s*['\"]?([^'\"\s#]+)")
SHA = re.compile(r"^[0-9a-f]{40}$")


def files(root: Path) -> list[Path]:
    found = sorted((root / ".github/workflows").glob("*.yml"))
    found += sorted((root / ".github/actions").glob("**/action.yml"))
    return found


def unpinned(path: Path) -> list[tuple[int, str]]:
    bad = []
    for number, line in enumerate(path.read_text().splitlines(), start=1):
        match = USES.match(line)
        if not match:
            continue
        ref = match.group(1)
        if ref.startswith(ALLOWED_PREFIXES) or ref.startswith("docker://"):
            continue
        _, _, version = ref.partition("@")
        if not SHA.match(version):
            bad.append((number, ref))
    return bad


def main() -> int:
    root = Path.cwd()
    failures = [
        (path.relative_to(root), number, ref)
        for path in files(root)
        for number, ref in unpinned(path)
    ]
    for path, number, ref in failures:
        print(f"{path}:{number}: {ref} is not pinned to a full commit SHA")
    if failures:
        print(
            f"\n{len(failures)} third-party action ref(s) not pinned. Pin each to"
            " the commit its release tag points to, with the version in a"
            " trailing comment: owner/repo@<40-hex-sha> # vX.Y.Z"
        )
        return 1
    print("All third-party actions are pinned to a full commit SHA.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
