#!/usr/bin/env python3
"""Fail when an explainer page under docs/explainers/ has drifted from the code it describes.

Each page is checked against a rules file, scripts/docs/explainer-rules/<slug>.json:

* Manifest. Every value in the page's manifest block is read back out of source with the rule
  for that key, and must match.
* Citations. Every ``file:line`` the page prints (in markup, and in its data block) has an anchor
  in the page's ``citation-anchors`` block: the first and last line of the cited range and a hash
  of the whole range. Any edit inside a cited range fails the check; so does an edit that moves
  the range, until the page's line numbers are corrected (``--fix`` does that for pure moves).
* Data and beat log. Every chapter title and beat caption in the data block is also in the static
  beat log, so the no-JS page says what the animated one says.

Standard library only. See docs/development/explainer-pages.md for the workflow.

    python scripts/docs/check_explainers.py              # check every page
    python scripts/docs/check_explainers.py --fix        # move citations whose code only moved
    python scripts/docs/check_explainers.py --stamp      # anchor new citations, drop orphans
    python scripts/docs/check_explainers.py --accept backend/app/utils/token.py
                                                         # re-anchor reviewed changes in a file
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import html
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PAGES_DIR = "docs/explainers"
RULES_DIR = "scripts/docs/explainer-rules"
ANCHORS_ID = "citation-anchors"
CHECKER = "python scripts/docs/check_explainers.py"

# A cited source file, optionally with a line or range: token.py:191-207, backend/app/main.py:217
FILE_CITATION = re.compile(r"(?<![\w/.-])((?:[\w.-]+/)*[\w-]+(?:\.[\w-]+)*\.(?:py|tsx|ts))(?::(\d+)(?:-(\d+))?)?(?![\w-])")
# A bare continuation that inherits the last file named: ", :250"
CONTINUATION = re.compile(r"(?<![\w.:/])(:(\d+)(?:-(\d+))?)(?![\w:])")
TOKEN = re.compile(f"{FILE_CITATION.pattern}|{CONTINUATION.pattern}")


# --------------------------------------------------------------------------------------------
# Small helpers


def normalise(line: str) -> str:
    return " ".join(line.split())


def range_hash(lines: list[str]) -> str:
    return hashlib.sha256("\n".join(normalise(x) for x in lines).encode("utf-8")).hexdigest()[:16]


def read_lines(root: Path, rel: str) -> list[str] | None:
    path = root / rel
    if not path.is_file():
        return None
    return path.read_text(encoding="utf-8", errors="replace").splitlines()


def lines_label(start: int, end: int) -> str:
    return f"{start}" if start == end else f"{start}-{end}"


def parse_lines(label: str) -> tuple[int, int]:
    a, _, b = label.partition("-")
    return int(a), int(b or a)


def shorten(text: str, width: int = 110) -> str:
    text = normalise(text)
    return text if len(text) <= width else text[: width - 1] + "…"


@dataclass
class Finding:
    page: str
    kind: str  # manifest | moved | changed | new | orphan | unresolved | data | config
    message: str
    fix: str
    citation: str = ""
    file: str = ""  # source file the finding is about, for annotations
    line: int = 0
    used_in: list[str] = field(default_factory=list)
    detail: list[str] = field(default_factory=list)


# --------------------------------------------------------------------------------------------
# Reading the page


@dataclass
class Occurrence:
    key: str  # resolved citation, e.g. backend/app/utils/token.py:191-207
    file: str
    start: int
    end: int
    span: tuple[int, int]  # absolute offsets of the line-number text in the page
    context: str


class PageScanner(HTMLParser):
    """Collect citations with their offsets, the JSON blocks, and the visible text."""

    HEADINGS = {"h1", "h2", "h3", "summary"}

    def __init__(self, raw: str, rules: dict, root: Path) -> None:
        super().__init__(convert_charrefs=False)
        self.raw = raw
        self.rules = rules
        self.root = root
        self.aliases: dict[str, str] = rules.get("aliases", {})
        self.data_ids = set(rules.get("dataIds", []))
        self.line_starts = [0]
        for i, ch in enumerate(raw):
            if ch == "\n":
                self.line_starts.append(i + 1)
        self.occurrences: list[Occurrence] = []
        self.unresolved: dict[str, list[str]] = {}
        self.blocks: dict[str, tuple[int, int, str]] = {}  # id -> (start, end, text)
        self.text_parts: list[str] = []
        self.last_file: str | None = None
        self.section = "page header"
        self._script: dict | None = None
        self._skip = 0
        self._heading: list[str] | None = None
        self._heading_tag = ""
        self._data_context: dict[tuple[int, int], str] = {}

    # Position of the current parser event as an absolute offset.
    def _offset(self) -> int:
        line, col = self.getpos()
        return self.line_starts[line - 1] + col

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = dict(attrs)
        # Citations in attribute values (a title tooltip, an aria-label) are claims too.
        raw_tag = self.get_starttag_text() or ""
        if any(v and ":" in v for _, v in attrs):
            base = self._offset()
            assert self.raw[base : base + len(raw_tag)] == raw_tag, "offset bookkeeping drifted"
            for m in FILE_CITATION.finditer(raw_tag):
                if m.group(2):
                    s, e = int(m.group(2)), int(m.group(3) or m.group(2))
                    span = (base + m.start(2), base + m.end(3 if m.group(3) else 2))
                    self._record(m.group(1), s, e, span, self.section)
        if tag == "script":
            self._script = a
        elif tag == "style":
            self._skip += 1
        elif tag in self.HEADINGS or (tag == "h4" and "bl-h" in (a.get("class") or "")):
            self._heading, self._heading_tag = [], tag

    def handle_endtag(self, tag: str) -> None:
        if tag == "script":
            self._script = None
        elif tag == "style":
            self._skip = max(0, self._skip - 1)
        elif self._heading is not None and tag == self._heading_tag:
            text = normalise(" ".join(self._heading))
            if text:
                self.section = text
            self._heading = None

    def handle_entityref(self, name: str) -> None:
        self.text_parts.append(html.unescape(f"&{name};"))

    def handle_charref(self, name: str) -> None:
        self.text_parts.append(html.unescape(f"&#{name};"))

    def handle_data(self, data: str) -> None:
        start = self._offset()
        assert self.raw[start : start + len(data)] == data, "offset bookkeeping drifted"
        if self._script is not None:
            block_id = self._script.get("id") or ""
            if self._script.get("type") == "application/json" and block_id:
                self.blocks[block_id] = (start, start + len(data), data)
                if block_id in self.data_ids:
                    self._scan_data_block(data, start, block_id)
            elif self._script.get("type") in (None, "", "module", "text/javascript"):
                self._scan_script(data, start)
            return
        if self._skip:
            return
        self.text_parts.append(data)
        if self._heading is not None:
            self._heading.append(data)
        self._scan_text(data, start)

    def _resolve(self, name: str) -> str | None:
        if "/" in name:
            return name if (self.root / name).is_file() else None
        return self.aliases.get(name)

    def _record(self, name: str, start: int, end: int, span: tuple[int, int], context: str) -> None:
        rel = self._resolve(name)
        if rel is None:
            self.unresolved.setdefault(name, []).append(context)
            return
        key = f"{rel}:{lines_label(start, end)}"
        self.occurrences.append(Occurrence(key, rel, start, end, span, context))

    def _scan_text(self, data: str, base: int) -> None:
        for m in TOKEN.finditer(data):
            if m.group(1):  # file citation
                name = m.group(1)
                self.last_file = name
                if m.group(2):
                    s, e = int(m.group(2)), int(m.group(3) or m.group(2))
                    span = (base + m.start(2), base + m.end(3 if m.group(3) else 2))
                    self._record(name, s, e, span, self.section)
                elif self._resolve(name) is None:
                    self.unresolved.setdefault(name, []).append(self.section)
            else:  # continuation
                if self.last_file is None:
                    continue
                s, e = int(m.group(5)), int(m.group(6) or m.group(5))
                span = (base + m.start(5), base + m.end(6 if m.group(6) else 5))
                self._record(self.last_file, s, e, span, self.section)

    def _scan_script(self, js: str, base: int) -> None:
        """Citations the page script prints: full paths in strings, and ``P.token + ':38-48'``
        where ``P`` is a path map named in the rules' ``scriptPathMaps``."""
        paths: dict[str, str] = {}
        for var in self.rules.get("scriptPathMaps", []):
            m = re.search(rf"\b(?:var|let|const)\s+{re.escape(var)}\s*=\s*\{{(.*?)\}}", js, re.S)
            if m:
                paths.update({f"{var}.{k}": v for k, v in re.findall(r"(\w+)\s*:\s*'([^']+)'", m.group(1))})
        for m in FILE_CITATION.finditer(js):
            if m.group(2):
                s, e = int(m.group(2)), int(m.group(3) or m.group(2))
                span = (base + m.start(2), base + m.end(3 if m.group(3) else 2))
                where = f"page script, line {self.raw.count(chr(10), 0, base + m.start()) + 1}"
                self._record(m.group(1), s, e, span, where)
        if paths:
            names = "|".join(re.escape(k) for k in sorted(paths, key=len, reverse=True))
            for m in re.finditer(rf"\b({names})\s*\+\s*['\"]:(\d+)(?:-(\d+))?['\"]", js):
                s, e = int(m.group(2)), int(m.group(3) or m.group(2))
                span = (base + m.start(2), base + m.end(3 if m.group(3) else 2))
                where = f"page script, line {self.raw.count(chr(10), 0, base + m.start()) + 1}"
                self._record(paths[m.group(1)], s, e, span, where)

    def _scan_data_block(self, data: str, base: int, block_id: str) -> None:
        contexts = data_contexts(json.loads(data))
        for m in FILE_CITATION.finditer(data):
            if not m.group(2):
                continue
            s, e = int(m.group(2)), int(m.group(3) or m.group(2))
            span = (base + m.start(2), base + m.end(3 if m.group(3) else 2))
            name = m.group(1)
            rel = self._resolve(name) or name
            context = contexts.get(f"{rel}:{lines_label(s, e)}", f"{block_id} data")
            self._record(name, s, e, span, context)


def data_contexts(data: dict) -> dict[str, str]:
    """Map each citation in the data block to a readable place: 'chapter 3 (refresh), beat 2'."""
    out: dict[str, str] = {}

    def walk(node, where: str) -> None:
        if isinstance(node, dict):
            for k, v in node.items():
                walk(v, where)
        elif isinstance(node, list):
            for v in node:
                walk(v, where)
        elif isinstance(node, str):
            for m in FILE_CITATION.finditer(node):
                if m.group(2):
                    key = f"{m.group(1)}:{lines_label(int(m.group(2)), int(m.group(3) or m.group(2)))}"
                    out.setdefault(key, where)

    for ch in data.get("chapters", []):
        label = f"chapter {ch.get('n', '?')} ({ch.get('id', '?')})"
        for i, beat in enumerate(ch.get("beats", []), 1):
            walk(beat, f"{label}, beat {i}: {shorten(beat.get('caption', ''), 70)}")
        walk({k: v for k, v in ch.items() if k != "beats"}, label)
    for k, v in data.items():
        if k != "chapters":
            walk(v, f"data: {k}")
    return out


@dataclass
class Page:
    path: str
    raw: str
    rules: dict
    scan: PageScanner

    @property
    def slug(self) -> str:
        return Path(self.path).stem

    def block(self, block_id: str) -> dict | None:
        if block_id not in self.scan.blocks:
            return None
        return json.loads(self.scan.blocks[block_id][2])

    def visible_text(self) -> str:
        return normalise("".join(self.scan.text_parts))

    def line_of(self, offset: int) -> int:
        return self.raw.count("\n", 0, offset) + 1


def load_page(root: Path, rel: str, rules: dict) -> Page:
    raw = (root / rel).read_text(encoding="utf-8")
    scan = PageScanner(raw, rules, root)
    scan.feed(raw)
    scan.close()
    return Page(rel, raw, rules, scan)


# --------------------------------------------------------------------------------------------
# Manifest rules


class RuleError(Exception):
    pass


def _safe_arith(expr: str) -> int:
    node = ast.parse(expr.strip(), mode="eval").body

    def ev(n):
        if isinstance(n, ast.Constant) and isinstance(n.value, int):
            return n.value
        if isinstance(n, ast.BinOp) and isinstance(n.op, (ast.Mult, ast.Add, ast.Sub)):
            a, b = ev(n.left), ev(n.right)
            return a * b if isinstance(n.op, ast.Mult) else a + b if isinstance(n.op, ast.Add) else a - b
        raise RuleError(f"not plain integer arithmetic: {expr!r}")

    return ev(node)


def extract(rule: dict, root: Path) -> tuple[object, str]:
    """Return (value, where) for one manifest rule."""
    kind = rule.get("type", "str")
    if kind == "concat":
        parts = [extract(p, root) for p in rule["parts"]]
        return "".join(str(v) for v, _ in parts), "; ".join(w for _, w in parts)
    if kind == "map":
        keys, w1 = extract(rule["keys"], root)
        table, w2 = extract(rule["table"], root)
        missing = [k for k in keys if k not in table]
        if missing:
            raise RuleError(f"{', '.join(missing)} not found in {w2}")
        return [table[k] for k in keys], f"{w1}; {w2}"

    rel = rule["file"]
    lines = read_lines(root, rel)
    if lines is None:
        raise RuleError(f"{rel} does not exist")
    full = text = "\n".join(lines)
    offset = 0
    if "within" in rule:
        found = list(re.finditer(rule["within"], text, re.M | re.S))
        if len(found) != 1:
            raise RuleError(f"region /{rule['within']}/ matched {len(found)} times in {rel}, expected 1")
        offset, text = found[0].start(1), found[0].group(1)
    pattern = re.compile(rule["pattern"], re.M | re.S)

    def where(pos: int) -> str:
        return f"{rel}:{full.count(chr(10), 0, offset + pos) + 1}"

    if kind in ("list", "pairs"):
        found = list(pattern.finditer(text))
        if not found:
            raise RuleError(f"/{rule['pattern']}/ matched nothing in {rel}")
        if kind == "list":
            return [m.group(1) for m in found], where(found[0].start())
        return {m.group(1): m.group(2) for m in found}, where(found[0].start())

    found = list(pattern.finditer(text))
    if len(found) != 1:
        raise RuleError(f"/{rule['pattern']}/ matched {len(found)} times in {rel}, expected exactly 1")
    m = found[0]
    if kind == "present":
        return rule["expect"], where(m.start())
    raw = m.group(1)
    if kind == "int":
        return int(raw), where(m.start(1))
    if kind == "arith":
        return _safe_arith(raw), where(m.start(1))
    if kind == "bool":
        if raw not in ("True", "False", "true", "false"):
            raise RuleError(f"{raw!r} is not a boolean")
        return raw in ("True", "true"), where(m.start(1))
    return raw, where(m.start(1))


def check_manifest(page: Page, root: Path) -> list[Finding]:
    rules = page.rules
    out: list[Finding] = []
    manifest_id = rules["manifestId"]
    manifest = page.block(manifest_id)
    fix_rule = f"edit {RULES_DIR}/{page.slug}.json"
    if manifest is None:
        return [Finding(page.path, "config", f"no JSON block with id {manifest_id!r}", "restore the manifest block")]
    key_rules: dict = rules.get("manifest", {})
    for key in sorted(set(manifest) - set(key_rules)):
        out.append(
            Finding(page.path, "config", f"manifest key {key!r} has no source rule, so nothing checks it", fix_rule)
        )
    for key in sorted(set(key_rules) - set(manifest)):
        out.append(Finding(page.path, "config", f"rule for {key!r} has no manifest key", fix_rule))
    for key in sorted(set(manifest) & set(key_rules)):
        try:
            value, where = extract(key_rules[key], root)
        except (RuleError, KeyError, re.error, SyntaxError) as exc:
            out.append(
                Finding(
                    page.path,
                    "manifest",
                    f"manifest {key!r}: the source rule no longer finds the value ({exc})",
                    "the code was refactored: find where the value lives now, update the rule, and check the "
                    "page still describes it",
                    file=key_rules[key].get("file", ""),
                )
            )
            continue
        if value != manifest[key]:
            file, _, line = where.split(";")[0].rpartition(":")
            out.append(
                Finding(
                    page.path,
                    "manifest",
                    f"manifest {key!r}: the page says {json.dumps(manifest[key])}, the code says "
                    f"{json.dumps(value)} ({where})",
                    "update the manifest value and every place the page states it (stage labels, captions, beat "
                    "log, sandbox, reference)",
                    file=file,
                    line=int(line) if line.isdigit() else 0,
                )
            )
    return out


# --------------------------------------------------------------------------------------------
# Citation anchors


def find_moves(lines: list[str], anchor: dict) -> list[int]:
    """Start lines (1-based) where the anchored range now sits, unchanged."""
    n = anchor["n"]
    first = normalise(anchor["start"])
    hits = []
    for i in range(0, len(lines) - n + 1):
        if normalise(lines[i]) == first and range_hash(lines[i : i + n]) == anchor["sha"]:
            hits.append(i + 1)
    return hits


def guess_new_range(lines: list[str], anchor: dict, start: int, end: int) -> tuple[int, int] | None:
    """Where the range probably is now, by its first and last line, when its body changed.

    In place if both ends still sit at the cited lines; else a unique same-length match; else a
    unique start line followed by the nearest end line."""
    first, last, n = normalise(anchor["start"]), normalise(anchor.get("end", anchor["start"])), anchor["n"]

    def at(i: int) -> str:
        return normalise(lines[i - 1]) if 1 <= i <= len(lines) else "\0"

    if at(start) == first and at(end) == last:
        return start, end
    starts = [i + 1 for i, x in enumerate(lines) if normalise(x) == first]
    same = [(i, i + n - 1) for i in starts if at(i + n - 1) == last]
    if len(same) == 1:
        return same[0]
    near = []
    for i in starts:
        for j in range(i, min(len(lines), i + 2 * n + 20) + 1):
            if at(j) == last:
                near.append((i, j))
                break
    return near[0] if len(near) == 1 else None


def diff_hunks(root: Path, base: str | None, rel: str, start: int, end: int) -> list[str]:
    """The base..worktree diff hunks that overlap a cited range (in base-side line numbers)."""
    if not base:
        return []
    try:
        out = subprocess.run(
            ["git", "diff", "--unified=0", "--no-color", base, "--", rel],
            cwd=root,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=True,
        ).stdout
    except (OSError, subprocess.CalledProcessError):
        return []
    hunks, current, keep = [], [], False
    header = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@")
    for line in out.splitlines():
        m = header.match(line)
        if m:
            if keep:
                hunks.extend(current)
            a, b = int(m.group(1)), int(m.group(2) if m.group(2) is not None else 1)
            lo, hi = (a, a) if b == 0 else (a, a + b - 1)
            keep = lo <= end and hi >= start - (1 if b == 0 else 0)
            current = [line]
        elif current and not line.startswith(("diff ", "index ", "--- ", "+++ ")):
            current.append(line)
    if keep:
        hunks.extend(current)
    return hunks[:40] + (["… (diff truncated)"] if len(hunks) > 40 else [])


def make_anchor(lines: list[str], start: int, end: int, rel: str) -> dict:
    chunk = lines[start - 1 : end]
    anchor = {"file": rel, "start": normalise(chunk[0]), "n": len(chunk), "sha": range_hash(chunk)}
    if end > start:
        anchor["end"] = normalise(chunk[-1])
    return anchor


def citation_state(page: Page, root: Path, base: str | None):
    """Yield (key, occurrences, anchor, status, info) for every citation and every orphan anchor."""
    block = page.block(ANCHORS_ID) or {"anchors": {}}
    anchors: dict = block.get("anchors", {})
    by_key: dict[str, list[Occurrence]] = {}
    for occ in page.scan.occurrences:
        by_key.setdefault(occ.key, []).append(occ)
    cache: dict[str, list[str] | None] = {}
    for key, occs in by_key.items():
        rel, start, end = occs[0].file, occs[0].start, occs[0].end
        lines = cache.setdefault(rel, read_lines(root, rel))
        anchor = anchors.get(key)
        if lines is None:
            yield key, occs, anchor, "missing", {}
            continue
        if end > len(lines) or start < 1 or end < start:
            moves = find_moves(lines, anchor) if anchor else []
            yield key, occs, anchor, ("moved" if len(moves) == 1 else "out-of-range"), {"moves": moves}
            continue
        if anchor is None:
            yield key, occs, None, "new", {}
            continue
        if range_hash(lines[start - 1 : end]) == anchor["sha"] and anchor["n"] == end - start + 1:
            yield key, occs, anchor, "ok", {}
            continue
        moves = find_moves(lines, anchor)
        if len(moves) == 1:
            yield key, occs, anchor, "moved", {"moves": moves}
        else:
            guess = guess_new_range(lines, anchor, start, end)
            yield key, occs, anchor, "changed", {"guess": guess, "lines": lines, "moves": moves}
    for key in sorted(set(anchors) - set(by_key)):
        yield key, [], anchors[key], "orphan", {}


def check_citations(page: Page, root: Path, base: str | None) -> list[Finding]:
    out: list[Finding] = []
    for name, contexts in sorted(page.scan.unresolved.items()):
        out.append(
            Finding(
                page.path,
                "unresolved",
                f"{name!r} does not name one source file",
                f'write the full path on the page, or add "{name}": "<path>" to aliases in '
                f"{RULES_DIR}/{page.slug}.json",
                used_in=sorted(set(contexts)),
            )
        )
    for key, occs, anchor, status, info in citation_state(page, root, base):
        used = sorted({o.context for o in occs})
        rel = occs[0].file if occs else anchor["file"]
        start, end = (occs[0].start, occs[0].end) if occs else parse_lines(key.rpartition(":")[2])
        if status == "ok":
            continue
        if status == "new":
            out.append(
                Finding(
                    page.path,
                    "new",
                    f"{key} has no anchor, so nothing would notice if it went stale",
                    f"check the page's claim against {key}, then run `{CHECKER} --stamp`",
                    key,
                    rel,
                    start,
                    used,
                )
            )
        elif status == "orphan":
            out.append(
                Finding(
                    page.path,
                    "orphan",
                    f"anchor {key} matches no citation on the page",
                    f"run `{CHECKER} --stamp` to drop it",
                    key,
                )
            )
        elif status == "missing":
            out.append(
                Finding(
                    page.path,
                    "changed",
                    f"{key}: {rel} no longer exists",
                    "find where the code went, update the citation and what the page says about it",
                    key,
                    rel,
                    0,
                    used,
                )
            )
        elif status == "moved":
            new = info["moves"][0]
            label = lines_label(new, new + anchor["n"] - 1)
            out.append(
                Finding(
                    page.path,
                    "moved",
                    f"{key}: the cited code is unchanged but now sits at {rel}:{label}",
                    f"run `{CHECKER} --fix` to update the line numbers on the page",
                    key,
                    rel,
                    new,
                    used,
                )
            )
        elif status == "out-of-range":
            n = len(read_lines(root, rel) or [])
            out.append(
                Finding(
                    page.path,
                    "changed",
                    f"{key}: line {end} is past the end of {rel} ({n} lines)",
                    "find where the cited code is now, correct the line numbers, and check what the page says "
                    f"about it; then run `{CHECKER} --accept {key}` (or `--stamp` if it was never anchored)",
                    key,
                    rel,
                    0,
                    used,
                )
            )
        else:  # changed
            detail: list[str] = []
            lines = info.get("lines") or read_lines(root, rel) or []
            if anchor:
                detail.append(f"page was anchored on: {shorten(anchor['start'])}")
                if anchor.get("end"):
                    detail.append(f"                 … {shorten(anchor['end'])}")
            if 1 <= start <= len(lines):
                detail.append(f"line {start} now reads: {shorten(lines[start - 1])}")
            if end != start and 1 <= end <= len(lines):
                detail.append(f"line {end} now reads: {shorten(lines[end - 1])}")
            guess = info.get("guess")
            if guess and guess != (start, end):
                detail.append(f"the range's first and last lines are now at {rel}:{lines_label(*guess)}")
            hunks = diff_hunks(root, base, rel, start, end)
            if hunks:
                detail.append(f"diff against {base} inside the cited lines:")
                detail.extend(f"    {h}" for h in hunks)
            fix = (
                "review what the page says in the places listed against the new code and update it; then run "
                f"`{CHECKER} --accept {key}`"
            )
            if guess and guess != (start, end):
                fix = (
                    f"run `{CHECKER} --fix` to move the line numbers to {lines_label(*guess)}, review what the "
                    f"page says against the new code, then `{CHECKER} --accept {rel}:{lines_label(*guess)}`"
                )
            copies = info.get("moves") or []
            if len(copies) > 1:
                n = anchor["n"]
                places = ", ".join(lines_label(c, c + n - 1) for c in copies)
                detail.insert(0, f"the cited code is unchanged but now appears {len(copies)} times, at {places}")
                fix = (
                    "the checker cannot tell which copy the page means: check the code, then run "
                    f"`{CHECKER} --move {key}=<first line>` with the right one"
                )
            out.append(
                Finding(
                    page.path,
                    "changed",
                    f"{key}: the cited code changed since the page was written",
                    fix,
                    key,
                    rel,
                    start,
                    used,
                    detail,
                )
            )
    return out


# --------------------------------------------------------------------------------------------
# Data block vs static beat log


def check_data_log(page: Page) -> list[Finding]:
    out: list[Finding] = []
    text = page.visible_text()
    for block_id in page.rules.get("dataIds", []):
        data = page.block(block_id)
        if data is None:
            out.append(Finding(page.path, "config", f"no JSON block with id {block_id!r}", "restore the data block"))
            continue
        for ch in data.get("chapters", []):
            wanted = [("chapter title", ch.get("title", ""))]
            wanted += [(f"beat {i} caption", b.get("caption", "")) for i, b in enumerate(ch.get("beats", []), 1)]
            for what, value in wanted:
                if value and normalise(value) not in text:
                    out.append(
                        Finding(
                            page.path,
                            "data",
                            f"chapter {ch.get('n')} ({ch.get('id')}) {what} is in the data block but not in the "
                            f"static beat log: {shorten(value, 80)!r}",
                            "regenerate the beat log from the data block so the no-JS page matches",
                        )
                    )
    return out


# --------------------------------------------------------------------------------------------
# Writing the page


def write_anchors(page: Page, anchors: dict, root: Path) -> str:
    """Return the page with its citation-anchors block replaced (or inserted after the manifest)."""
    note = (
        "Expected content at each cited range: first line, last line, line count and a hash of the "
        f"whitespace-normalised range. Written by {CHECKER}; see docs/development/explainer-pages.md."
    )
    body = ",\n".join(
        f"    {json.dumps(k)}: {json.dumps(anchors[k], ensure_ascii=False)}" for k in sorted(anchors)
    )
    text = '{\n  "note": ' + json.dumps(note) + ',\n  "anchors": {\n' + body + "\n  }\n}"
    text = text.replace("</", "<\\/")
    raw = page.raw
    if ANCHORS_ID in page.scan.blocks:
        s, e, _ = page.scan.blocks[ANCHORS_ID]
        return raw[:s] + "\n" + text + "\n" + raw[e:]
    s, e, _ = page.scan.blocks[page.rules["manifestId"]]
    close = raw.index("</script>", e) + len("</script>")
    block = f'\n<script type="application/json" id="{ANCHORS_ID}">\n{text}\n</script>'
    return raw[:close] + block + raw[close:]


def rewrite_numbers(raw: str, edits: list[tuple[tuple[int, int], str]]) -> str:
    for (s, e), new in sorted(edits, key=lambda x: x[0][0], reverse=True):
        raw = raw[:s] + new + raw[e:]
    return raw


def do_fix(page: Page, root: Path) -> tuple[str, list[str]]:
    """Move citations whose code only moved (and changed ones whose ends are found)."""
    edits, notes = [], []
    anchors = dict((page.block(ANCHORS_ID) or {"anchors": {}})["anchors"])
    for key, occs, anchor, status, info in citation_state(page, root, None):
        if not occs:
            continue
        if status == "moved":
            new_start = info["moves"][0]
            new_end = new_start + anchor["n"] - 1
        elif status == "changed" and info.get("guess"):
            new_start, new_end = info["guess"]
            if (new_start, new_end) == (occs[0].start, occs[0].end):
                continue
        else:
            continue
        new_key = f"{occs[0].file}:{lines_label(new_start, new_end)}"
        for occ in occs:
            edits.append((occ.span, lines_label(new_start, new_end)))
        anchors[new_key] = anchors.pop(key)
        notes.append(f"{key} -> {new_key} ({status})")
    raw = rewrite_numbers(page.raw, edits)
    if notes:
        moved = load_page_from_raw(root, page.path, page.rules, raw)
        raw = write_anchors(moved, anchors, root)
    return raw, notes


def do_move(page: Page, root: Path, specs: list[str]) -> tuple[str, list[str]]:
    """Move named citations (``CITATION=FIRST_LINE``) whose code is unchanged at the new line.

    For a move ``--fix`` cannot make alone: the same code now appears more than once."""
    anchors = dict((page.block(ANCHORS_ID) or {"anchors": {}})["anchors"])
    by_key: dict[str, list[Occurrence]] = {}
    for occ in page.scan.occurrences:
        by_key.setdefault(occ.key, []).append(occ)
    edits, notes = [], []
    for spec in specs:
        key, _, target = spec.rpartition("=")
        if key not in by_key or key not in anchors or not target.isdigit():
            notes.append(f"NOT moved {spec}: expected CITATION=FIRST_LINE for an anchored citation on the page")
            continue
        anchor, occs = anchors[key], by_key[key]
        new_start = int(target)
        new_end = new_start + anchor["n"] - 1
        lines = read_lines(root, occs[0].file) or []
        if new_end > len(lines) or range_hash(lines[new_start - 1 : new_end]) != anchor["sha"]:
            notes.append(
                f"NOT moved {key}: the code at line {new_start} is not the anchored code; "
                "review and use --accept instead"
            )
            continue
        new_key = f"{occs[0].file}:{lines_label(new_start, new_end)}"
        edits += [(occ.span, lines_label(new_start, new_end)) for occ in occs]
        anchors[new_key] = anchors.pop(key)
        notes.append(f"{key} -> {new_key} (moved)")
    if not edits:
        return page.raw, notes
    raw = rewrite_numbers(page.raw, edits)
    return write_anchors(load_page_from_raw(root, page.path, page.rules, raw), anchors, root), notes


def load_page_from_raw(root: Path, rel: str, rules: dict, raw: str) -> Page:
    scan = PageScanner(raw, rules, root)
    scan.feed(raw)
    scan.close()
    return Page(rel, raw, rules, scan)


def do_stamp(page: Page, root: Path, stamp: bool, accept: list[str]) -> tuple[str, list[str]]:
    """With ``stamp``, anchor new citations and drop orphans; re-anchor ``accept``-ed changes."""
    anchors = dict((page.block(ANCHORS_ID) or {"anchors": {}})["anchors"])
    notes = []
    for key, occs, anchor, status, info in citation_state(page, root, None):
        if status == "orphan" and stamp:
            anchors.pop(key, None)
            notes.append(f"dropped orphan {key}")
        elif status == "new" and stamp:
            lines = read_lines(root, occs[0].file) or []
            anchors[key] = make_anchor(lines, occs[0].start, occs[0].end, occs[0].file)
            notes.append(f"anchored {key}")
        elif status == "changed" and occs and any(a == key or a == occs[0].file for a in accept):
            lines = read_lines(root, occs[0].file) or []
            fresh = make_anchor(lines, occs[0].start, occs[0].end, occs[0].file)
            same_ends = normalise(anchor["start"]) == fresh["start"] and normalise(
                anchor.get("end", anchor["start"])
            ) == fresh.get("end", fresh["start"])
            if not same_ends and not any(a == key for a in accept):
                notes.append(
                    f"NOT accepted {key}: its first or last line changed too, so the line numbers may be "
                    f"wrong. Check them, then accept it by its full citation."
                )
                continue
            anchors[key] = fresh
            notes.append(f"accepted {key}")
    if not notes:
        return page.raw, notes
    return write_anchors(page, anchors, root), notes


# --------------------------------------------------------------------------------------------
# Reporting


TITLES = {
    "manifest": "Manifest value no longer matches the code",
    "changed": "Cited code changed",
    "moved": "Cited code moved",
    "new": "Citation with no anchor",
    "orphan": "Anchor with no citation",
    "unresolved": "Citation that names no single file",
    "data": "Data block and beat log disagree",
    "config": "Checker configuration",
}
ORDER = list(TITLES)


def report_text(findings: list[Finding], pages: list[str]) -> str:
    if not findings:
        return f"explainers: {len(pages)} page(s) match the code ({', '.join(pages)})."
    out = [f"explainers: {len(findings)} problem(s). The page no longer matches the code; update it.", ""]
    for kind in ORDER:
        group = [f for f in findings if f.kind == kind]
        if not group:
            continue
        out.append(f"== {TITLES[kind]} ({len(group)})")
        for f in group:
            out.append(f"- [{f.page}] {f.message}")
            for place in f.used_in[:6]:
                out.append(f"    used in: {place}")
            if len(f.used_in) > 6:
                out.append(f"    … and {len(f.used_in) - 6} more places")
            for d in f.detail:
                out.append(f"    {d}")
            out.append(f"    fix: {f.fix}")
        out.append("")
    out.append("How to fix: docs/development/explainer-pages.md")
    return "\n".join(out)


def report_markdown(findings: list[Finding]) -> str:
    if not findings:
        return "### Explainer pages\n\nEvery explainer page matches the code.\n"
    server, repo, sha = (os.environ.get(k, "") for k in ("GITHUB_SERVER_URL", "GITHUB_REPOSITORY", "GITHUB_SHA"))
    guide = "docs/development/explainer-pages.md"
    if server and repo and sha:
        guide = f"[{guide}]({server}/{repo}/blob/{sha}/{guide})"
    out = [
        "### Explainer pages are out of date",
        "",
        "This change touches code that an explainer page describes. Update the page in the same pull request. "
        f"How: {guide}.",
        "",
    ]
    for kind in ORDER:
        group = [f for f in findings if f.kind == kind]
        if not group:
            continue
        out += [f"#### {TITLES[kind]} ({len(group)})", ""]
        for f in group:
            out.append(f"- **{f.page}**: {f.message}")
            if f.used_in:
                out.append(f"  - Used in: {'; '.join(f.used_in[:6])}{' …' if len(f.used_in) > 6 else ''}")
            if f.detail:
                out.append("  - <details><summary>What changed</summary>\n\n    ```text")
                out += [f"    {d}" for d in f.detail]
                out.append("    ```\n    </details>")
            out.append(f"  - Fix: {f.fix}")
        out.append("")
    return "\n".join(out)


def annotate(findings: list[Finding]) -> None:
    def esc(s: str) -> str:
        return s.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")

    for f in findings[:40]:
        where = f.page
        line = ""
        if f.file and f.line:
            where, line = f.file, f",line={f.line}"
        msg = f"{f.message}. Used in {f.page}: {'; '.join(f.used_in[:3]) or 'the page'}. Fix: {f.fix}"
        print(f"::error file={where}{line},title={esc(TITLES[f.kind])}::{esc(msg)}")


# --------------------------------------------------------------------------------------------


def discover(root: Path) -> tuple[list[tuple[str, dict]], list[Finding]]:
    pages, findings = [], []
    for path in sorted((root / PAGES_DIR).glob("*.html")):
        rel = path.relative_to(root).as_posix()
        rules_path = root / RULES_DIR / f"{path.stem}.json"
        if not rules_path.is_file():
            findings.append(
                Finding(
                    rel,
                    "config",
                    f"no rules file at {RULES_DIR}/{path.stem}.json, so nothing checks this page",
                    "add one (copy an existing rules file) — see docs/development/explainer-pages.md",
                )
            )
            continue
        pages.append((rel, json.loads(rules_path.read_text(encoding="utf-8"))))
    for rules_path in sorted((root / RULES_DIR).glob("*.json")):
        if not (root / PAGES_DIR / f"{rules_path.stem}.html").is_file():
            findings.append(
                Finding(
                    rules_path.relative_to(root).as_posix(),
                    "config",
                    "rules file for a page that does not exist",
                    "delete it, or restore the page",
                )
            )
    return pages, findings


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", type=Path, default=REPO_ROOT, help="repository root (default: this checkout)")
    ap.add_argument("--fix", action="store_true", help="move line numbers of citations whose code moved")
    ap.add_argument("--stamp", action="store_true", help="anchor new citations and drop orphan anchors")
    ap.add_argument(
        "--accept",
        nargs="+",
        default=[],
        metavar="CITATION_OR_FILE",
        help="after review, re-anchor changed citations (a full citation, or a file to accept all in it)",
    )
    ap.add_argument(
        "--move",
        nargs="+",
        default=[],
        metavar="CITATION=LINE",
        help="move a citation whose unchanged code now appears more than once to the copy at LINE",
    )
    ap.add_argument("--base", help="git ref to diff cited ranges against when reporting changes")
    ap.add_argument("--github", action="store_true", help="emit GitHub annotations and a job summary")
    args = ap.parse_args(argv)
    root = args.root.resolve()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    pages, findings = discover(root)
    writing = args.fix or args.stamp or args.accept or args.move
    for rel, rules in pages:
        page = load_page(root, rel, rules)
        if writing:
            original, raw, notes = page.raw, page.raw, []
            if args.move:
                raw, n = do_move(page, root, args.move)
                notes += n
                page = load_page_from_raw(root, rel, rules, raw)
            if args.fix:
                raw, n = do_fix(page, root)
                notes += n
                page = load_page_from_raw(root, rel, rules, raw)
            if args.stamp or args.accept:
                raw, n = do_stamp(page, root, args.stamp, args.accept)
                notes += n
            if raw != original:
                (root / rel).write_text(raw, encoding="utf-8", newline="")
            for n in notes:
                print(f"{rel}: {n}")
            page = load_page(root, rel, rules)
        findings += check_manifest(page, root)
        findings += check_citations(page, root, args.base)
        findings += check_data_log(page)

    print(report_text(findings, [p for p, _ in pages]))
    if args.github:
        annotate(findings)
        summary = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary:
            with open(summary, "a", encoding="utf-8") as fh:
                fh.write(report_markdown(findings) + "\n")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
