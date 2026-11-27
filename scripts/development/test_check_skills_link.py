"""Tests for check_skills_link.py. Run: python -m unittest discover -s scripts/development -p "test_*.py"."""

import os
import subprocess
import tempfile
import unittest
from pathlib import Path

import check_skills_link as c

CAN_LINK = hasattr(os, "symlink")


def git(root: Path, *args: str) -> None:
    subprocess.run(
        ["git", "-c", "core.symlinks=true", *args],
        cwd=root,
        check=True,
        capture_output=True,
    )


class CheckSkillsLink(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        git(self.root, "init", "-q")
        (self.root / ".agents/skills/demo").mkdir(parents=True)
        (self.root / ".agents/skills/demo/SKILL.md").write_text("---\nname: demo\n---\n")
        (self.root / ".claude").mkdir()

    def link(self, target: str = c.TARGET) -> None:
        os.symlink(target, self.root / c.LINK)

    def stage(self) -> None:
        git(self.root, "add", "-A")

    @unittest.skipUnless(CAN_LINK, "symlinks unavailable")
    def test_good_layout_passes(self) -> None:
        self.link()
        self.stage()
        self.assertEqual(c.check(self.root), [])

    @unittest.skipUnless(CAN_LINK, "symlinks unavailable")
    def test_wrong_target_fails(self) -> None:
        (self.root / "other").mkdir()
        self.link("../other")
        self.stage()
        errors = "\n".join(c.check(self.root))
        self.assertIn("expected '../.agents/skills'", errors)

    def test_regular_file_prints_windows_fix(self) -> None:
        (self.root / c.LINK).write_text(c.TARGET)
        self.stage()
        errors = "\n".join(c.check(self.root))
        self.assertIn("core.symlinks true", errors)
        self.assertIn("git checkout -- .claude/skills", errors)
        self.assertIn("exactly one symlink", errors)

    def test_missing_link_fails(self) -> None:
        self.stage()
        errors = "\n".join(c.check(self.root))
        self.assertIn(".claude/skills is missing", errors)

    @unittest.skipUnless(CAN_LINK, "symlinks unavailable")
    def test_extra_tracked_symlink_fails(self) -> None:
        self.link()
        os.symlink("demo", self.root / ".agents/skills/alias")
        self.stage()
        errors = "\n".join(c.check(self.root))
        self.assertIn("exactly one symlink", errors)
        self.assertIn(".agents/skills/alias", errors)

    @unittest.skipUnless(CAN_LINK, "symlinks unavailable")
    def test_link_not_tracked_fails(self) -> None:
        self.link()
        errors = "\n".join(c.check(self.root))
        self.assertIn("exactly one symlink", errors)

    @unittest.skipUnless(CAN_LINK, "symlinks unavailable")
    def test_skills_dir_must_be_real(self) -> None:
        import shutil

        shutil.move(str(self.root / ".agents/skills"), str(self.root / "real"))
        os.symlink("../real", self.root / ".agents/skills")
        self.link()
        self.stage()
        errors = "\n".join(c.check(self.root))
        self.assertIn(".agents/skills must be a real directory", errors)


if __name__ == "__main__":
    unittest.main()
