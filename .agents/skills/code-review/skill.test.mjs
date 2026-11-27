/**
 * Contract suite for SKILL.md: the Standards pass carries the Docs-impact
 * check (ADR 0010), with the Docs map lookup and the fallback search, and the
 * check stays generic, so a Consumer who copies the folder gets it with no
 * setup. It reads only SKILL.md: Consumers copy this folder verbatim.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const skill = readFileSync(join(HERE, "SKILL.md"), "utf8").replace(/\r\n/g, "\n");

/** A level-2 section's body, from its heading to the next level-2 heading. */
const section = (heading) => {
  const start = skill.indexOf(`\n## ${heading}\n`);
  if (start === -1) return "";
  const rest = skill.slice(start + heading.length + 5);
  const end = rest.search(/\n## /);
  return end === -1 ? rest : rest.slice(0, end);
};
const flat = (text) => text.replace(/\s+/g, " ");
const standards = () => flat(section("Standards pass"));
const docsImpact = () => {
  const text = section("Standards pass");
  const start = text.indexOf("### Docs impact");
  return start === -1 ? "" : flat(text.slice(start));
};

test("the skill keeps its name, scope and three axis headings", () => {
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(skill)?.[1] ?? "";
  assert.match(frontmatter, /^name: code-review$/m);
  assert.match(frontmatter, /^ {2}agent-kit-scope: user$/m);
  for (const axis of ["Standards", "Spec", "Correctness"]) {
    assert.ok(skill.includes(`\`## ${axis}\``), `report heading ## ${axis}`);
  }
});

test("the Standards pass has a Docs impact subsection", () => {
  assert.ok(standards().length > 0, "SKILL.md has a ## Standards pass section");
  assert.ok(docsImpact().length > 0, "the Standards pass has a ### Docs impact subsection");
});

test("it applies when the diff adds, renames, changes or removes something a doc describes", () => {
  assert.match(docsImpact(), /adds, renames, changes or removes something a doc describes/);
});

test("it names each doc page and line still saying the old thing, as a Standards finding", () => {
  const text = docsImpact();
  assert.match(text, /\*\*Docs-impact finding\*\*/);
  assert.match(text, /each doc page and line that still says? the old thing/);
  assert.match(text, /`path:line`/);
  assert.match(text, /a Standards finding that names each doc page/);
});

test("the finding does not block the change", () => {
  assert.match(docsImpact(), /does not block/);
});

test("it reads the repository's Docs map if one exists", () => {
  const text = docsImpact();
  assert.match(text, /\*\*Docs map\*\*/);
  assert.match(text, /`AGENTS\.md` or `CLAUDE\.md`/);
  assert.match(text, /`docs-map\.md`/);
  assert.match(text, /Read the pages it lists for each changed path/);
});

test("with no Docs map, it searches the docs for the changed names", () => {
  const text = docsImpact();
  assert.match(text, /no Docs map[^.]*search the docs for each changed name/);
  assert.match(text, /a changed path the map does not cover/);
  assert.match(text, /its old form too, when renamed or removed/);
});

test("history keeps old names, so it is skipped", () => {
  assert.match(docsImpact(), /changelog, release notes, ADRs/i);
});

test("it flags a hand-written list that copies a code constant without a Generated block", () => {
  const text = docsImpact();
  assert.match(text, /hand-written list or table/);
  assert.match(text, /copies a constant from the code/);
  assert.match(text, /\*\*Generated block\*\*/);
  assert.match(text, /Name the constant it copies/);
});

test("it is generic: no Agent-kit name or path a Consumer would not have", () => {
  const body = skill.replace(/^---\n[\s\S]*?\n---\n/, "");
  for (const local of [/agent-kit/i, /mnaimfaizy/, /docs\/agents\//, /\.github\/agent-/]) {
    assert.doesNotMatch(body, local);
  }
});
