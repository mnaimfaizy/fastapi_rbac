/**
 * Contract suite for the page shape (#143): step 1 chooses system stage, scene
 * stepper or static; the brief carries the stage fields; STAGE.md holds the
 * principles, taste rules, stage contract and terms; BUILD.md scopes its static
 * rules and lists the stage checks; and the shape example meets the contract.
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
const skillRaw = raw("SKILL.md");
const buildRaw = raw("BUILD.md");
const stageRaw = raw("STAGE.md");
const skill = flat(skillRaw);
const stage = flat(stageRaw);
const EXAMPLE = "examples/system-stage.html";
const page = raw(EXAMPLE);

/** The `<level> <title>` section of a Markdown file, up to the next heading of that level or higher, outside code fences. */
function section(text, title, level = 2) {
  const lines = text.split("\n");
  const start = lines.indexOf(`${"#".repeat(level)} ${title}`);
  assert.notEqual(start, -1, `no "${"#".repeat(level)} ${title}" section`);
  const stop = new RegExp(`^#{1,${level}} `);
  let fenced = false;
  let end = start + 1;
  for (; end < lines.length; end++) {
    if (lines[end].startsWith("```")) fenced = !fenced;
    else if (!fenced && stop.test(lines[end])) break;
  }
  return flat(lines.slice(start, end).join("\n"));
}

test("step 1 chooses the page shape by a stated rule, and only the user may override it", () => {
  const step1 = section(skillRaw, "1. Fix the audience, the one question and the page shape", 3);
  assert.match(
    step1,
    /\*\*System stage\*\* — the question is about a sequence that crosses \*\*two or more components\*\*/,
  );
  assert.match(step1, /\*\*Scene stepper\*\* — the sequence happens inside \*\*one component\*\*/);
  assert.match(step1, /\*\*Static\*\* — the subject is a structure, not a sequence/);
  assert.match(
    step1,
    /a question about a sequence is a stage when the sequence crosses two or more components, and a stepper when it stays inside one\. A question about a structure is static\./,
  );
  assert.match(step1, /`Shape: system stage`, `Shape: scene stepper` or `Shape: static`/);
  assert.match(step1, /Only the user may override it/);
  assert.match(step1, /The builder never changes it/);
  assert.match(step1, /read `STAGE\.md` \(beside this file\) before you draft/);
});

test("the brief anatomy has the stage fields, with checkpoints and sandbox optional", () => {
  const anatomy = section(skillRaw, "The brief anatomy");
  assert.match(anatomy, /\*\*What I want\.\*\* The page, its shape from step 1/);
  assert.match(anatomy, /\*\*The stage \(system stage and scene stepper only\)\.\*\*/);
  for (const field of [
    /\*\*Components \(zones\):\*\* for each, an id, a label, a shape idea, the live state shown inside it, and citations/,
    /\*\*Edges:\*\* which zones talk to which, and any edge a message must pass through/,
    /\*\*Chapters\*\*, in order: an id, a title, the question it settles, and its end state/,
    /\*\*Beats\*\* for each chapter: `from` and `to` zone \(or `in` for a local change\), a caption of 15 words or fewer, the state delta, refs, and `derived: true`/,
    /\*\*Halts:\*\* where the real process waits on a person or an outside action, and the gate action's label/,
    /\*\*Inspector content:\*\* what each message, state entry and record shows when opened/,
    /\*\*Expected state\*\* at each chapter end/,
    /\*\*Predict checkpoints\*\* _\(optional\)_: only at decisive moments\. Where, the question, three choices, the correct one, and one line of why/,
    /\*\*Sandbox\*\* _\(optional\)_: only when the rules are worth driving\. The actions, the rule each follows, and the disclaimer text/,
  ])
    assert.match(anatomy, field);
  assert.match(anatomy, /Every beat fact is cited like any other fact/);
  assert.match(anatomy, /The builder never invents them/);
});

test("story plus reference is one page; the split rule and the readability rule are stated", () => {
  const split = section(skillRaw, "Splitting one brief into two");
  assert.match(split, /A story on top and its reference below is \*\*one\*\* page/);
  assert.match(
    split,
    /Split only when the story cannot be read without the reference first, or when the two answer different questions/,
  );
  assert.match(
    split,
    /Reference panels are bullets and tables, one claim per sentence, collapsed by default under one "Expand all", and printed expanded/,
  );
  assert.doesNotMatch(
    split,
    /A reference you consult and a story you watch once are different pages/,
  );
});

test("the completion criteria ask for the shape and the stage fields", () => {
  const done = section(skillRaw, "Completion criteria");
  assert.match(done, /The brief states its shape \(system stage, scene stepper or static\)/);
  assert.match(done, /System stage and scene stepper, additionally:/);
  assert.match(
    done,
    /a caption of 15 words or fewer, a state delta and at least one ref, and every `from`\/`to` pair is a listed edge/,
  );
  assert.match(
    done,
    /Predict checkpoints and a sandbox are present only where you decided on them/,
  );
});

test("STAGE.md carries the eleven principles, each with its source", () => {
  const principles = section(stageRaw, "Design principles");
  for (let n = 1; n <= 11; n++)
    assert.match(principles, new RegExp(` ${n}\\. \\*\\*`), `principle ${n}`);
  for (const source of [
    "https://samwho.dev/load-balancing/",
    "https://distill.pub/2020/communicating-with-interactive-articles/",
    "Mayer's segmenting principle",
    "https://pmc.ncbi.nlm.nih.gov/articles/PMC7940870",
    "Shneiderman's mantra",
    "https://tls13.xargs.org/",
    "https://blog.ncase.me/explorable-explanations-4-more-design-patterns/",
    `Distill's "You Draw It"`,
    "https://pudding.cool/process/responsive-scrollytelling/",
  ])
    assert.ok(principles.includes(source), `missing source ${source}`);
});

test("STAGE.md carries the taste rules", () => {
  const taste = section(stageRaw, "Taste rules");
  assert.match(
    taste,
    /\*\*The first screen\*\* is the title, the one question in one line, and the stage ready at beat 1 with a visible Play/,
  );
  assert.match(taste, /Beat captions are \*\*15 words or fewer\*\*/);
  assert.match(taste, /about 450–700 ms at 1×/);
  assert.match(taste, /\*\*shape and glyph first\*\*, colour second/);
  assert.match(taste, /Everything must survive greyscale/);
  assert.match(taste, /No boxes inside boxes/);
  assert.match(taste, /\*\*Monospace for identifiers\*\*/);
  assert.match(taste, /\*\*Messages are compact capsules\*\*/);
});

test("STAGE.md defines the stage terms inside the skill", () => {
  const terms = section(stageRaw, "Terms");
  assert.match(terms, /They are not in any glossary outside the skill/);
  for (const term of [
    "System stage",
    "Scene stepper",
    "Zone",
    "Edge",
    "Chapter",
    "Beat",
    "Halt",
    "Predict checkpoint",
    "Inspector",
    "Sandbox",
    "Beat log",
  ])
    assert.ok(terms.includes(`- **${term}.**`), `term ${term} is not defined`);
});

test("STAGE.md holds the stage contract, with the stepper as its single-zone variant", () => {
  const contract = section(stageRaw, "The stage contract");
  for (const rule of [
    /\*\*Self-contained\.\*\* Vanilla JS and inline SVG\. No runtime framework, no CDN, nothing fetched/,
    /\*\*One data block\.\*\* One `<script type="application\/json">` block/,
    /The stage, the beat log, the inspector and the sandbox all render from it/,
    /The static beat log is prerendered from it/,
    /`role="group"`, an `aria-label`, and `aria-describedby` pointing at its `<desc>`\. It has no `<title>`/,
    /Messages travel along drawn edges only/,
    /A chapter rail, with halt chapters marked ✋/,
    /Speed 0\.5×, 1× and 2×/,
    /Keys, only while focus is inside the explainer/,
    /It stops at every predict checkpoint until it is answered or skipped, at every unopened halt, and at the end/,
    /\*\*Halts cannot be skipped\.\*\* At an unopened halt, Next is disabled and its label says why/,
    /an opened gate stays open for that visit/,
    /\*\*Captions\*\* are announced through one `aria-live="polite"` region/,
    /\*\*Beat log\.\*\* .* linked highlighting/,
    /Esc closes it, and focus returns to what opened it\. "Open all details" expands every beat's inspector content inline/,
    /A wrong answer never blocks/,
    /condensed animation, an event log, Reset, and the disclaimer on the page/,
    /messages appear at their destination instead of travelling/,
    /\*\*No-JS and print\.\*\* The beat log, with every chapter, beat and detail, is static HTML/,
    /No horizontal page scroll at 375px, and touch targets of 40px or more/,
  ])
    assert.match(contract, rule);
  const stepper = section(stageRaw, "The scene stepper");
  assert.match(stepper, /A scene stepper is the stage contract with one zone/);
  assert.match(
    stepper,
    /keeps the transport, captions, beat log, inspector, data block, reduced-motion, no-JS and print rules/,
  );
});

test("STAGE.md points at the shape example, read for shape and never for facts", () => {
  assert.ok(stageRaw.includes(`[\`${EXAMPLE}\`](${EXAMPLE})`));
  assert.match(stage, /Read it for shape, never for facts/);
});

test("BUILD.md scopes Motion and Interactivity to static and points stage builds to STAGE.md", () => {
  const conventions = section(buildRaw, "Conventions");
  assert.match(
    conventions,
    /\*\*Motion \(static shape\)\.\*\* One entrance animation and one active-step marker are enough/,
  );
  assert.match(
    conventions,
    /\*\*Interactivity earns its place \(static shape\)\.\*\* Add behaviour only where/,
  );
  assert.match(
    conventions,
    /These two rules apply to the static shape only\. A stage or stepper follows the stage contract in `STAGE\.md` instead/,
  );
  const input = section(buildRaw, "Input");
  assert.match(
    input,
    /\*\*The shape is the brief's\.\*\* .* a brief that states none is static\. Build the shape it states and never change it/,
  );
  assert.match(
    input,
    /read `STAGE\.md` \(beside this file\) and its shape example, `examples\/system-stage\.html`/,
  );
});

test("the notes rule is static-only in mechanics, and BUILD.md and STAGE.md agree on what replaces it", () => {
  const conventions = section(buildRaw, "Conventions");
  assert.match(
    conventions,
    /\*\*Notes live in the document, not in the shapes \(static shape\)\.\*\*/,
  );
  // The static rule itself is unchanged in substance.
  assert.match(conventions, /static "Diagram notes" list with `id="note-<key>"`/);
  assert.match(conventions, /Every `data-tip` has its note, and every note has its shape\./);
  assert.match(
    conventions,
    /A system stage or scene stepper keeps the rule's aim, not its mechanics\. .* the inspector replaces the popover\. The static beat log and a static list of the state records stand in for the "Diagram notes" list, and `data-tip` is not used/,
  );
  const contract = section(stageRaw, "The stage contract");
  assert.doesNotMatch(contract, /storage in `try`\/`catch`, notes in the document\./);
  assert.match(contract, /_Notes live in the document_ applies in aim only/);
  assert.match(contract, /the inspector replaces the `data-tip` popover/);
  assert.match(
    contract,
    /Each state entry's and record's inspector content is in a static list too/,
  );
});

test("BUILD.md lists the stage checks and the NOT POSSIBLE rule", () => {
  const checks = section(buildRaw, "Stage checks");
  for (const name of [
    "Data",
    "Topology",
    "Transport",
    "State",
    "Inspector",
    "Sandbox",
    "Reduced motion",
    "No-JS",
    "Print",
    "Width sweep",
    "Refs",
  ])
    assert.ok(checks.includes(`- **${name}`), `missing stage check ${name}`);
  assert.match(
    checks,
    /every beat has a route .* a caption of 15 words or fewer, and at least one ref/i,
  );
  assert.match(checks, /Every `from`\/`to` pair is an edge drawn on the stage/);
  assert.match(
    checks,
    /beat log contains every chapter title, beat caption and beat detail, every state entry's and record's inspector content is somewhere in the static page/,
  );
  assert.match(checks, /at many widths from 1440 to 375 \(not just three\)/);
  assert.match(
    checks,
    /labels fit, no text overlaps, nothing is truncated, no caption sits over a zone, and the page has no horizontal scroll/,
  );
  assert.match(
    checks,
    /\*\*A check that cannot run here is reported as NOT POSSIBLE \(why\)\*\*, never skipped silently/,
  );
  assert.match(checks, /The kit ships no checker for them/);
});

test("the report keeps #152's Verified how lines and adds the stage checks line", () => {
  const report = section(buildRaw, "Report format");
  const verified = report.slice(
    report.indexOf("### Verified how"),
    report.indexOf("### Contradictions found"),
  );
  assert.match(verified, /<each measurement you ran/);
  assert.match(
    verified,
    /Visual review: <NOT POSSIBLE \(why\) \| done: each state, width and theme/,
  );
  assert.match(
    verified,
    /Stage checks \(system stage and scene stepper only\), one line each: data, topology, transport, state, inspector, sandbox, reduced motion, no-JS, print, width sweep, refs — <PASS: what you measured \| FAIL: what broke \| NOT POSSIBLE \(why\)/,
  );
  const constraints = section(buildRaw, "Constraints");
  assert.match(
    constraints,
    /Do NOT change the brief's shape, and do NOT add a predict checkpoint or a sandbox the brief did not ask for/,
  );
});

// ---- The shape example ----------------------------------------------------------------------------

const dataBlock = (id) => {
  const m = new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)</script>`).exec(
    page,
  );
  assert.ok(m, `no ${id} block`);
  return JSON.parse(m[1]);
};

test("the example is labelled a shape example on a fictional subject", () => {
  assert.match(
    page,
    /<strong>Shape example<\/strong> · fictional subject · read for shape, never for facts/,
  );
  assert.match(page, /SHAPE EXAMPLE for the explainer skill's system stage \(STAGE\.md\)/);
  assert.match(page, /every name, value and ref on this page is invented/);
});

test("the example is self-contained: nothing fetched, no framework", () => {
  assert.doesNotMatch(page, /<link\b/i);
  assert.doesNotMatch(page, /@import/);
  assert.doesNotMatch(page, /\bfetch\(|XMLHttpRequest|import\(/);
  assert.doesNotMatch(page, /<script[^>]+\bsrc=/i);
  assert.doesNotMatch(page, /\b(?:src|href)="(?:https?:)?\/\//i);
  assert.doesNotMatch(page, /url\((?!#)/);
  const urls = page.match(/https?:\/\/[^\s"'<)]+/g) || [];
  assert.deepEqual(
    [...new Set(urls)],
    ["http://www.w3.org/2000/svg"],
    "only the SVG namespace may appear",
  );
});

test("the example has one data block of the agreed size, and every beat is routed, short and cited", () => {
  assert.equal(page.match(/id="holds-data"/g).length, 1);
  const data = dataBlock("holds-data");
  assert.equal(data.zones.length, 3);
  assert.deepEqual(
    data.chapters.map((c) => c.id),
    ["place", "collect"],
  );
  assert.equal(data.checkpoints.length, 1);
  assert.equal(data.halts.length, 1);
  assert.ok(data.sandbox.actions.length >= 1 && data.sandbox.disclaimer);
  const edges = new Set(data.edges.flatMap((e) => [`${e.a}>${e.b}`, `${e.b}>${e.a}`]));
  const zones = new Set(data.zones.map((z) => z.id));
  const beats = data.chapters.flatMap((c) => c.beats);
  const anchors = dataBlock("citation-anchors").anchors;
  for (const b of beats) {
    if (b.in) assert.ok(zones.has(b.in), `${b.id}: unknown zone ${b.in}`);
    else
      assert.ok(edges.has(`${b.from}>${b.to}`), `${b.id}: ${b.from} → ${b.to} is not a drawn edge`);
    assert.ok(b.caption.split(/\s+/).length <= 15, `${b.id}: caption over 15 words`);
    assert.ok(b.refs.length >= 1, `${b.id}: no ref`);
    for (const r of b.refs) assert.ok(anchors[r], `${b.id}: ref ${r} has no anchor`);
  }
  const ids = new Set(beats.map((b) => b.id));
  for (const x of [...data.checkpoints, ...data.halts])
    assert.ok(ids.has(x.before), `${x.id} sits before an unknown beat`);
  for (const c of data.checkpoints) assert.equal(c.choices.length, 3);
});

test("the example prerenders the beat log, the static diagram and the sandbox disclaimer", () => {
  const data = dataBlock("holds-data");
  const log = /<!-- log:start -->([\s\S]*?)<!-- log:end -->/.exec(page)[1];
  for (const c of data.chapters) {
    assert.ok(log.includes(c.title), `log is missing chapter ${c.title}`);
    for (const b of c.beats)
      assert.ok(
        log.includes(`data-beat="${b.id}"`) && log.includes(b.caption),
        `log is missing ${b.id}`,
      );
  }
  assert.match(page, /<figure class="stage-fallback">/);
  // No content is script-only: every record's inspector content and every zone ref is in the static HTML too.
  const staticHtml = page.replace(/<script[\s\S]*?<\/script>/g, "");
  for (const rec of Object.values(data.inspect)) {
    assert.ok(staticHtml.includes(rec.title), `record ${rec.title} is script-only`);
    for (const line of rec.shape.split("\n"))
      assert.ok(staticHtml.includes(line), `record shape "${line}" is script-only`);
    for (const r of rec.refs) assert.ok(staticHtml.includes(r), `ref ${r} is script-only`);
  }
  for (const z of data.zones)
    for (const r of z.refs) assert.ok(staticHtml.includes(r), `zone ref ${r} is script-only`);
  assert.ok(
    page.includes(`<p class="disclaimer" id="sb-disclaimer">${data.sandbox.disclaimer}</p>`),
  );
});

test("the example's stage is an accessible SVG group with no title, and captions go through one live region", () => {
  const svg = /<svg id="story-stage"[^>]*>/.exec(page)[0];
  assert.match(svg, /role="group"/);
  assert.match(svg, /aria-label="/);
  assert.match(svg, /aria-describedby="story-desc"/);
  assert.match(page, /<desc id="story-desc">/);
  assert.doesNotMatch(page, /<svg[^>]*>\s*<title>/);
  assert.equal(
    page.match(/aria-live="polite"/g).length,
    2,
    "the caption region and the sandbox event log",
  );
  assert.match(page, /id="live" class="sr-only" aria-live="polite"/);
});
