"""Tests for check_explainers.py. Standard library only:

    python -m unittest discover -s scripts/docs -p "test_*.py"
"""

from __future__ import annotations

import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import check_explainers as ce  # noqa: E402

SOURCE = "\n".join(
    [
        "LIMIT = 5",  # 1
        "",  # 2
        "def evict(tokens):",  # 3
        "    overflow = len(tokens) - LIMIT",  # 4
        "    return tokens[:overflow]",  # 5
        "",  # 6
        "def keep(tokens):",  # 7
        "    return tokens",  # 8
    ]
)

PAGE = """<!doctype html>
<html><head><title>Demo</title>
<script type="application/json" id="demo-manifest">
{"limit": 5}
</script>
<script type="application/json" id="demo-scenes">
{"chapters": [{"n": 1, "id": "cap", "title": "The cap evicts the oldest.",
  "beats": [{"caption": "Six logins, five sessions.", "refs": ["backend/app/limits.py:3-5"]}]}]}
</script>
</head><body>
<h2>Reference</h2>
<p>The cap is set in <code>limits.py:1</code> and applied in (<code title="backend/app/limits.py:3-5">limits.py:3-5</code>, <code>:7-8</code>).</p>
<h3>Beat log</h3>
<h4 class="bl-h">The cap evicts the oldest.</h4>
<p>Six logins, five sessions.</p>
<script>
  var P = { lim: 'backend/app/limits.py' };
  function refs() { return [P.lim + ':7-8']; }
</script>
</body></html>
"""

RULES = {
    "page": "docs/explainers/demo.html",
    "manifestId": "demo-manifest",
    "dataIds": ["demo-scenes"],
    "scriptPathMaps": ["P"],
    "aliases": {"limits.py": "backend/app/limits.py"},
    "manifest": {"limit": {"file": "backend/app/limits.py", "pattern": "^LIMIT = (\\d+)", "type": "int"}},
}


class CheckerTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.write("backend/app/limits.py", SOURCE)
        self.write("docs/explainers/demo.html", PAGE)
        self.write("scripts/docs/explainer-rules/demo.json", json.dumps(RULES))

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def write(self, rel: str, text: str) -> None:
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="")

    def read(self, rel: str) -> str:
        return (self.root / rel).read_text(encoding="utf-8")

    def run_checker(self, *args: str) -> tuple[int, str]:
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = ce.main(["--root", str(self.root), *args])
        return code, out.getvalue()

    def stamp(self) -> None:
        code, out = self.run_checker("--stamp")
        self.assertEqual(code, 0, out)

    # ------------------------------------------------------------------------------------

    def test_unanchored_citations_fail_until_stamped(self) -> None:
        code, out = self.run_checker()
        self.assertEqual(code, 1)
        self.assertIn("backend/app/limits.py:1 has no anchor", out)
        self.assertIn("backend/app/limits.py:7-8 has no anchor", out)  # continuation and script
        self.stamp()
        code, out = self.run_checker()
        self.assertEqual(code, 0, out)

    def test_every_citation_form_is_found(self) -> None:
        page = ce.load_page(self.root, "docs/explainers/demo.html", RULES)
        keys = sorted({o.key for o in page.scan.occurrences})
        self.assertEqual(keys, ["backend/app/limits.py:1", "backend/app/limits.py:3-5", "backend/app/limits.py:7-8"])
        contexts = {o.context for o in page.scan.occurrences}
        self.assertIn("Reference", contexts)
        self.assertTrue(any(c.startswith("chapter 1 (cap), beat 1") for c in contexts), contexts)
        self.assertTrue(any(c.startswith("page script, line") for c in contexts), contexts)

    def test_edit_inside_a_cited_range_fails_and_names_the_beat(self) -> None:
        self.stamp()
        self.write("backend/app/limits.py", SOURCE.replace("len(tokens) - LIMIT", "len(tokens) - LIMIT - 1"))
        code, out = self.run_checker()
        self.assertEqual(code, 1)
        self.assertIn("backend/app/limits.py:3-5: the cited code changed", out)
        self.assertIn("chapter 1 (cap), beat 1", out)
        self.assertNotIn("limits.py:7-8: the cited code changed", out)

    def test_accept_after_review_re_anchors(self) -> None:
        self.stamp()
        self.write("backend/app/limits.py", SOURCE.replace("len(tokens) - LIMIT", "len(tokens) - LIMIT - 1"))
        code, out = self.run_checker("--accept", "backend/app/limits.py")
        self.assertEqual(code, 0, out)
        self.assertIn("accepted backend/app/limits.py:3-5", out)

    def test_accept_by_file_refuses_when_the_range_ends_changed(self) -> None:
        self.stamp()
        self.write("backend/app/limits.py", SOURCE.replace("def evict(tokens):", "def evict_oldest(tokens):"))
        code, out = self.run_checker("--accept", "backend/app/limits.py")
        self.assertEqual(code, 1)
        self.assertIn("NOT accepted backend/app/limits.py:3-5", out)
        code, out = self.run_checker("--accept", "backend/app/limits.py:3-5")
        self.assertEqual(code, 0, out)

    def test_code_that_only_moved_is_fixed_everywhere_it_is_cited(self) -> None:
        self.stamp()
        self.write("backend/app/limits.py", "# header\n# header\n" + SOURCE)
        code, out = self.run_checker()
        self.assertEqual(code, 1)
        self.assertIn("now sits at backend/app/limits.py:5-7", out)
        code, out = self.run_checker("--fix")
        self.assertEqual(code, 0, out)
        page = self.read("docs/explainers/demo.html")
        self.assertIn("<code>limits.py:3</code>", page)
        self.assertIn('<code title="backend/app/limits.py:5-7">limits.py:5-7</code>, <code>:9-10</code>', page)
        self.assertIn('"backend/app/limits.py:5-7"', page)
        self.assertIn("P.lim + ':9-10'", page)

    def test_code_that_moved_and_was_copied_needs_an_explicit_move(self) -> None:
        self.stamp()
        copy = "def evict(tokens):\n    overflow = len(tokens) - LIMIT\n    return tokens[:overflow]\n"
        self.write("backend/app/limits.py", "# header\n" + copy + "\n" + SOURCE)
        code, out = self.run_checker("--fix")
        self.assertEqual(code, 1)
        self.assertIn("now appears 2 times, at 2-4, 8-10", out)
        self.assertIn("--move backend/app/limits.py:3-5=<first line>", out)
        code, out = self.run_checker("--move", "backend/app/limits.py:3-5=99")
        self.assertIn("NOT moved backend/app/limits.py:3-5", out)
        code, out = self.run_checker("--move", "backend/app/limits.py:3-5=8")
        self.assertEqual(code, 0, out)
        self.assertIn(">limits.py:8-10</code>", self.read("docs/explainers/demo.html"))

    def test_manifest_value_must_match_the_code(self) -> None:
        self.stamp()
        self.write("backend/app/limits.py", SOURCE.replace("LIMIT = 5", "LIMIT = 10"))
        code, out = self.run_checker()
        self.assertEqual(code, 1)
        self.assertIn("manifest 'limit': the page says 5, the code says 10", out)

    def test_a_rule_that_stops_matching_fails(self) -> None:
        self.stamp()
        self.write("backend/app/limits.py", SOURCE.replace("LIMIT = 5", "MAX_SESSIONS = 5"))
        code, out = self.run_checker()
        self.assertEqual(code, 1)
        self.assertIn("the source rule no longer finds the value", out)

    def test_unknown_basename_fails(self) -> None:
        self.stamp()
        self.write("docs/explainers/demo.html", PAGE.replace("<h3>Beat log", "<p>See <code>other.py:4</code>.</p><h3>Beat log"))
        code, out = self.run_checker()
        self.assertEqual(code, 1)
        self.assertIn("'other.py' does not name one source file", out)

    def test_orphan_anchor_fails_until_stamp_drops_it(self) -> None:
        self.stamp()
        self.write("docs/explainers/demo.html", self.read("docs/explainers/demo.html").replace("<code>limits.py:1</code>", "LIMIT"))
        code, out = self.run_checker()
        self.assertEqual(code, 1)
        self.assertIn("anchor backend/app/limits.py:1 matches no citation", out)
        self.stamp()

    def test_caption_missing_from_the_beat_log_fails(self) -> None:
        self.stamp()
        self.write("docs/explainers/demo.html", self.read("docs/explainers/demo.html").replace("<p>Six logins, five sessions.</p>", ""))
        code, out = self.run_checker()
        self.assertEqual(code, 1)
        self.assertIn("beat 1 caption is in the data block but not in the static beat log", out)

    def test_citation_past_the_end_of_the_file_fails(self) -> None:
        self.write("docs/explainers/demo.html", PAGE.replace("<code>:7-8</code>", "<code>:7-12</code>"))
        code, out = self.run_checker("--stamp")
        self.assertEqual(code, 1)
        self.assertIn("limits.py:7-12: line 12 is past the end of backend/app/limits.py (8 lines)", out)

    def test_page_without_rules_fails(self) -> None:
        self.stamp()
        self.write("docs/explainers/other.html", "<html></html>")
        code, out = self.run_checker()
        self.assertEqual(code, 1)
        self.assertIn("no rules file at scripts/docs/explainer-rules/other.json", out)

    def test_manifest_key_without_a_rule_fails(self) -> None:
        self.stamp()
        self.write("docs/explainers/demo.html", self.read("docs/explainers/demo.html").replace('{"limit": 5}', '{"limit": 5, "ttl": 7}'))
        code, out = self.run_checker()
        self.assertEqual(code, 1)
        self.assertIn("manifest key 'ttl' has no source rule", out)

    def test_anchor_block_survives_script_closing_text(self) -> None:
        self.write("backend/app/limits.py", SOURCE + "\nx = '</script>'")
        self.write("docs/explainers/demo.html", PAGE.replace("<code>:7-8</code>", "<code>:7-9</code>"))
        self.stamp()
        page = self.read("docs/explainers/demo.html")
        self.assertIn("<\\/script>", page)
        code, out = self.run_checker()
        self.assertEqual(code, 0, out)


if __name__ == "__main__":
    unittest.main()
