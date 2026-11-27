"""Tests for sync_agents.py. Run: python -m unittest discover -s scripts/development -p "test_*.py"."""

import tempfile
import unittest
from pathlib import Path

import sync_agents as s

CANON = """\
---
name: demo
description: Demo agent. Read-only.
---

# Demo

<!-- harness:claude -->
Claude text.
<!-- /harness -->
<!-- harness:cursor,copilot -->
Other text.
<!-- /harness -->

Shared text.
"""

CLAUDE_OWN = """\
---
name: demo
description: Demo agent. Read-only.
tools: Read, Grep
model: haiku
hooks:
  PreToolUse:
    - matcher: "Bash"
---
"""


class SyncAgents(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        (self.root / s.CANON_DIR).mkdir(parents=True)
        self.canon = self.root / s.CANON_DIR / "demo.agent.md"
        self.canon.write_text(CANON)

    def target(self, harness: str) -> Path:
        return self.root / s.TARGET_DIRS[harness] / "demo.md"

    def write(self, harness: str, text: str) -> None:
        path = self.target(harness)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)

    def test_missing_targets_fail_check(self) -> None:
        problems, _ = s.sync(self.root, apply=False)
        self.assertEqual(len(problems), 2)
        self.assertIn("missing", problems[0])

    def test_apply_creates_targets_with_name_and_description_only(self) -> None:
        problems, notes = s.sync(self.root, apply=True)
        self.assertEqual(problems, [])
        self.assertTrue(any("by hand" in n for n in notes))
        text = self.target("claude").read_text()
        self.assertTrue(text.startswith("---\nname: demo\ndescription: Demo agent. Read-only.\n---\n"))
        self.assertIn("Claude text.", text)
        self.assertNotIn("Other text.", text)
        self.assertIn("Shared text.", text)
        self.assertNotIn("<!-- harness", text)
        self.assertIn("Generated from .github/agents/demo.agent.md", text)
        cursor = self.target("cursor").read_text()
        self.assertIn("Other text.", cursor)
        self.assertNotIn("Claude text.", cursor)
        self.assertEqual(s.sync(self.root, apply=False)[0], [])

    def test_harness_keys_are_kept(self) -> None:
        self.write("claude", CLAUDE_OWN + "\nstale\n")
        s.sync(self.root, apply=True)
        text = self.target("claude").read_text()
        self.assertIn("tools: Read, Grep\nmodel: haiku\nhooks:\n  PreToolUse:\n    - matcher: \"Bash\"\n---\n", text)
        self.assertNotIn("stale", text)
        self.assertEqual(s.sync(self.root, apply=False)[0], [])

    def test_body_drift_is_named(self) -> None:
        s.sync(self.root, apply=True)
        path = self.target("cursor")
        path.write_text(path.read_text() + "extra\n")
        problems, _ = s.sync(self.root, apply=False)
        self.assertEqual(len(problems), 1)
        self.assertIn(".cursor/agents/demo.md", problems[0])
        self.assertIn("body differs", problems[0])

    def test_description_drift_is_named(self) -> None:
        s.sync(self.root, apply=True)
        path = self.target("claude")
        path.write_text(path.read_text().replace("Demo agent.", "Old text."))
        problems, _ = s.sync(self.root, apply=False)
        self.assertIn("description differs", problems[0])

    def test_extra_target_fails(self) -> None:
        s.sync(self.root, apply=True)
        (self.root / ".cursor/agents/other.md").write_text("# other\n")
        problems, _ = s.sync(self.root, apply=False)
        self.assertEqual(len(problems), 1)
        self.assertIn(".cursor/agents/other.md: no canonical file", problems[0])

    def test_crlf_is_normalized(self) -> None:
        s.sync(self.root, apply=True)
        for harness in s.TARGET_DIRS:
            path = self.target(harness)
            path.write_bytes(path.read_bytes().replace(b"\n", b"\r\n"))
        self.assertEqual(s.sync(self.root, apply=False)[0], [])

    def test_unknown_harness_is_an_error(self) -> None:
        self.canon.write_text(CANON.replace("harness:claude", "harness:gemini"))
        problems, _ = s.sync(self.root, apply=False)
        self.assertTrue(any("unknown harness gemini" in p for p in problems))

    def test_unclosed_and_stray_markers_are_errors(self) -> None:
        self.canon.write_text(CANON.replace("<!-- /harness -->\n\nShared", "\nShared"))
        self.assertTrue(any("nest" in p or "never closed" in p for p in s.sync(self.root, apply=False)[0]))
        self.canon.write_text(CANON + "<!-- /harness -->\n")
        self.assertTrue(any("closing marker" in p for p in s.sync(self.root, apply=False)[0]))

    def test_name_must_match_file_stem(self) -> None:
        self.canon.write_text(CANON.replace("name: demo", "name: other"))
        problems, _ = s.sync(self.root, apply=False)
        self.assertTrue(any("expected 'demo'" in p for p in problems))


class RepoFiles(unittest.TestCase):
    def test_real_targets_match_canonical_files(self) -> None:
        root = s.repo_root(Path(__file__).parent)
        problems, _ = s.sync(root, apply=False)
        self.assertEqual(problems, [])


if __name__ == "__main__":
    unittest.main()
