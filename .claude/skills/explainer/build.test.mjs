/**
 * Contract suite for BUILD.md and SKILL.md step 7: a brief that source or a
 * platform rule contradicts is a finding the builder reports (an uncited rule
 * marked unverified), the briefer acts on it, and the builder looks at
 * screenshots when it can and says so when it cannot.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const raw = (file) => readFileSync(join(HERE, file), "utf8").replace(/\r\n/g, "\n");
// Line wraps carry no meaning in Markdown prose, so match on single-spaced text.
const flat = (text) => text.replace(/\s+/g, " ");
const buildRaw = raw("BUILD.md");
const skill = flat(raw("SKILL.md"));

/** The `## <title>` section of BUILD.md, up to the next `## ` heading outside a code fence. */
function section(title) {
  const lines = buildRaw.split("\n");
  const start = lines.indexOf(`## ${title}`);
  assert.notEqual(start, -1, `no "## ${title}" section`);
  let fenced = false;
  let end = start + 1;
  for (; end < lines.length; end++) {
    if (lines[end].startsWith("```")) fenced = !fenced;
    else if (!fenced && lines[end].startsWith("## ")) break;
  }
  return flat(lines.slice(start, end).join("\n"));
}

test("a brief that source contradicts is rendered as source and reported as a brief error", () => {
  const contradictions = section("Contradictions are findings");
  assert.match(contradictions, /Source wins/);
  assert.match(contradictions, /\*\*Doc versus source\.\*\*/);
  assert.match(
    contradictions,
    /\*\*Brief versus source\.\*\* .*Render the source behaviour, and report the brief's claim against the source `file:line`, marked as a brief error\./,
  );
  assert.match(contradictions, /Do not edit the brief/);
  assert.match(
    contradictions,
    /Silently copying the doc or the brief, or silently rendering the source/,
  );
  assert.match(contradictions, /building the page yourself .* stop, fix the brief, and say so/);
});

test("a brief that a platform rule contradicts is rendered as the platform and reported as a brief error", () => {
  const contradictions = section("Contradictions are findings");
  assert.match(contradictions, /It comes in three kinds/);
  assert.match(contradictions, /the platform wins over a brief claim that breaks one of its rules/);
  const kind = contradictions.slice(contradictions.indexOf("**Brief versus platform rule.**"));
  assert.match(kind, /^\*\*Brief versus platform rule\.\*\* /);
  assert.match(kind, /a rule of the browser, protocol or runtime the page describes/);
  assert.match(
    kind,
    /Render what the platform actually does, and report the brief's claim against the rule, marked as a brief error\./,
  );
  assert.match(kind, /Cite the rule \(a spec section or vendor documentation\)/);
  assert.match(kind, /name it and mark it \*\*unverified\*\*, in the report and on the page\./);
  // The page itself carries the mark, so its reader never takes uncited behaviour as settled.
  assert.match(
    kind,
    /wherever the page shows it, visible text beside it \(not only a tooltip\) names the rule and says it is unverified\./,
  );
  assert.match(kind, /Never present an uncited rule as verified, in the report or on the page\./);
  assert.match(kind, /Do not edit the brief\./);
  // The worked example: the HttpOnly refresh cookie a local logout cannot remove.
  assert.match(kind, /HttpOnly refresh cookie/);
  assert.match(kind, /the cookie staying in the browser and the server-side session ending/);
  assert.match(contradictions, /All three go under _Contradictions found_/);
  assert.match(
    contradictions,
    /building the page yourself .* either kind, against source or a platform rule, is yours to fix/,
  );
});

test("the report's Contradictions found line shows every kind", () => {
  const report = section("Report format");
  const found = report.slice(report.indexOf("### Contradictions found"));
  assert.match(found, /<doc: source file:line vs doc file:line/);
  assert.match(found, /<brief error: the brief's claim vs source file:line — what source does>/);
  assert.match(
    found,
    /<brief error: the brief's claim vs platform rule \(citation \| unverified\) — what the platform does>/,
  );
});

test("with a real-origin headless browser the builder screenshots and names what it looked at", () => {
  const cannot = section("What you cannot verify — say so");
  assert.match(cannot, /headless browser that renders the page as a real origin/);
  assert.match(cannot, /not a static `file:\/\/` snapshot/);
  assert.match(
    cannot,
    /screenshot the first screen and each state the brief names as important .* at desktop and phone width, in light and dark/,
  );
  assert.match(cannot, /fix what reads poorly/);
  assert.match(
    cannot,
    /name in _Verified how_ exactly which states, widths and themes you looked at/,
  );
  assert.match(
    cannot,
    /Without such a browser, .* say the visual review was not possible, and why/,
  );
  assert.match(
    section("Report format"),
    /Visual review: <NOT POSSIBLE \(why\) \| done: each state, width and theme/,
  );
});

test("the constraints keep the visual-review rule word for word and forbid editing the brief", () => {
  const constraints = section("Constraints");
  assert.ok(constraints.includes("- Do NOT claim a visual review you did not perform."));
  assert.match(
    constraints,
    /Do NOT skip the screenshots when a headless browser renders the page as a real origin/,
  );
  assert.match(
    constraints,
    /Do NOT edit the brief\. .* unless you are the briefer building the page yourself/,
  );
  assert.match(
    constraints,
    /Do NOT present a platform rule you could not cite as verified; name it and mark it unverified, on the page as well as in the report\./,
  );
});

test("step 7 says what the briefer does with a brief error", () => {
  const step7 = skill.slice(skill.indexOf("### 7. Read the builder's report"));
  assert.match(step7, /marked as a brief error/);
  assert.match(step7, /Either fix the brief and rebuild, or accept the source rendering/);
  assert.match(step7, /tell the user which fact was wrong, what source says, and which you chose/);
});

test("step 7 handles a platform-rule brief error and relays an unverified rule as unverified", () => {
  const step7 = skill.slice(skill.indexOf("### 7. Read the builder's report"));
  assert.match(step7, /A brief error against a platform rule .* is handled the same way/);
  assert.match(
    step7,
    /fix the brief and rebuild, or accept the platform-correct rendering, and tell the user which fact was wrong, the rule it breaks with the builder's citation, and which you chose/,
  );
  assert.match(
    step7,
    /A rule the builder marked \*\*unverified\*\* reaches the user as unverified, never as settled, and the page marks it unverified too; if you accept the rendering, that mark stays\./,
  );
});
