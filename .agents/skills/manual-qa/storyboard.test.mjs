/**
 * Contract suite for `storyboard.mjs` (SKILL.md step 6, ADAPTER.md "The
 * Storyboard", DESIGN.md "One file that stands alone"): one PNG per PASS or
 * FAIL scenario on a screen surface, a band above numbered steps with Before
 * beside After, built from the saved step records alone, and the caption
 * privacy check that runs before any Storyboard is written.
 *
 * The layout, the privacy check and the CLI's refusals run everywhere, on the
 * layout data, never on pixels. The test that renders a PNG needs Playwright
 * with Chromium in this repository; it skips without it, and fails instead
 * when `AGENT_KIT_REQUIRE_CHROMIUM=1` says it must be there.
 */

import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { findPlaywright } from "./adapter.mjs";
import {
  MIN_CROP_WIDTH,
  OUTLINE_GAP,
  OUTLINE_STROKE,
  SESSION_KINDS,
  VIEWPORT,
  WITHHELD,
  checkScenario,
  cropFor,
  knownFromEnv,
  layout,
  loadScenario,
  main,
  privacyCheck,
  render,
  shownFields,
  storyboardHtml,
} from "./storyboard.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const FIXTURES = join(HERE, "fixtures", "storyboard");
const adapterDoc = readFileSync(join(HERE, "ADAPTER.md"), "utf8");

const PLAYWRIGHT = findPlaywright(ROOT);
const REQUIRED = process.env.AGENT_KIT_REQUIRE_CHROMIUM === "1";
const NEEDS_CHROMIUM =
  PLAYWRIGHT.chromium || REQUIRED
    ? false
    : "Playwright with Chromium is not installed in this repository";

const EMAIL = "admin@example.test";
const PASSWORD = "Corr3ct-Horse-Battery";
const ENV = { QA_A_EMAIL: EMAIL, QA_A_PASSWORD: PASSWORD };
/** A made-up JWT, joined at run time so no token-shaped literal sits in the file. */
const JWT = ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxIn0", "c2lnbmF0dXJl"].join(".");
/** A 1×1 PNG: a still the renderer can scale; the tests never look at its pixels. */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==",
  "base64",
);

const dirs = [];
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** A copy of the fixture run folder, with a still beside each step record. */
function runFolder(edit = (meta) => meta) {
  const dir = mkdtempSync(join(tmpdir(), "storyboard-"));
  dirs.push(dir);
  cpSync(FIXTURES, dir, { recursive: true });
  for (const side of ["s1-web", "s1-before-web"])
    for (const name of ["step-01-a.png", "step-02-a.png"])
      writeFileSync(join(dir, side, name), PNG_1X1);
  const metaPath = join(dir, "s1-storyboard.json");
  const meta = edit(JSON.parse(readFileSync(metaPath, "utf8")));
  writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  return { dir, metaPath };
}

const fixtureMeta = () => JSON.parse(readFileSync(join(FIXTURES, "s1-storyboard.json"), "utf8"));
const fixtureSteps = (side) =>
  JSON.parse(readFileSync(join(FIXTURES, side, "steps.json"), "utf8")).steps;
const records = () => ({ after: fixtureSteps("s1-web"), before: fixtureSteps("s1-before-web") });

/** Box a contains box b. */
const contains = (a, b) =>
  a.x <= b.x && a.y <= b.y && a.x + a.width >= b.x + b.width && a.y + a.height >= b.y + b.height;

/** Every file under a folder, as text, to show a value appears in none of them. */
const allText = (dir) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => readFileSync(join(entry.parentPath ?? entry.path, entry.name), "latin1"))
    .join("\n");

/** A renderer stub that records the layout it was given and returns PNG bytes. */
const stubRenderer = (seen) => async (laid) => {
  seen.push(laid);
  return PNG_1X1;
};

// ── Layout: the band and Before beside After ────────────────────────────────

test("a two-step fix scenario lays out the band and two Before/After rows", () => {
  const laid = layout(records(), fixtureMeta());
  assert.equal(laid.band.scenario, "S1");
  assert.equal(laid.band.title, "Saving a profile lists the new name once");
  assert.equal(laid.band.result, "PASS");
  assert.deepEqual(
    laid.band.sides.map(({ side, mark }) => [side, mark]),
    [
      ["Before", "✓"],
      ["After", "✓"],
    ],
  );
  assert.equal(laid.band.sides[0].expected, "The members list shows Ada twice");
  assert.equal(laid.band.sides[1].observed, "The members list showed Ada once");
  assert.deepEqual(laid.band.commits, { base: "1111111", head: "4444444" });
  assert.deepEqual(laid.band.context, { accounts: ["admin"], sessions: ["A: admin"] });
  assert.equal(laid.columns, 2);
  assert.equal(laid.rows.length, 2);
  assert.deepEqual(
    laid.rows.map((row) => [row.number, row.session, row.before.still, row.after.still]),
    [
      [1, "A", "step-01-a.png", "step-01-a.png"],
      [2, "A", "step-02-a.png", "step-02-a.png"],
    ],
  );
  assert.deepEqual(
    laid.rows.map((row) => row.proves),
    [false, true],
  );
  for (const row of laid.rows) assert.equal(row.beforeNote, null);
});

test("each crop contains its subject, with the outline just outside it, at the viewport's aspect", () => {
  const laid = layout(records(), fixtureMeta());
  const aspect = VIEWPORT.width / VIEWPORT.height;
  for (const row of laid.rows)
    for (const cell of [row.before, row.after]) {
      const { crop, outline, subject } = cell;
      assert.ok(contains(crop, subject), `crop holds the subject of step ${row.number}`);
      assert.ok(contains(crop, outline), `crop holds the outline of step ${row.number}`);
      // The outline's inner edge sits OUTLINE_GAP outside the subject on every side: never over it.
      assert.equal(outline.x, subject.x - OUTLINE_GAP);
      assert.equal(outline.y, subject.y - OUTLINE_GAP);
      assert.equal(outline.width, subject.width + 2 * OUTLINE_GAP);
      assert.equal(outline.height, subject.height + 2 * OUTLINE_GAP);
      assert.ok(crop.width >= MIN_CROP_WIDTH);
      assert.ok(Math.abs(crop.width / crop.height - aspect) < 0.01, "the viewport's aspect");
      assert.ok(contains({ x: 0, y: 0, ...VIEWPORT }, crop), "inside the still");
    }
});

test("a step without a subject shows the full frame, unoutlined", () => {
  const steps = records();
  steps.after[0] = { ...steps.after[0], subject: null, text: null };
  const cell = layout(steps, fixtureMeta()).rows[0].after;
  assert.deepEqual(cell.crop, { x: 0, y: 0, ...VIEWPORT });
  assert.equal(cell.outline, null);
});

/** An outline's box with its stroke, drawn outward from its inner edge. */
const stroked = (o) => ({
  x: o.x - OUTLINE_STROKE,
  y: o.y - OUTLINE_STROKE,
  width: o.width + 2 * OUTLINE_STROKE,
  height: o.height + 2 * OUTLINE_STROKE,
});

test("a subject at the edge keeps all four sides of its outline in the crop, and one off-screen shows the full frame", () => {
  const steps = records();
  steps.after[0] = { ...steps.after[0], subject: { x: 1200, y: 690, width: 200, height: 100 } };
  steps.after[1] = { ...steps.after[1], subject: { x: 0, y: 900, width: 100, height: 40 } };
  const [edge, off] = layout(steps, fixtureMeta()).rows.map((row) => row.after);
  assert.ok(contains(edge.crop, { x: 1200, y: 690, width: 80, height: 30 }), "the visible part");
  assert.ok(contains(edge.crop, stroked(edge.outline)), "the whole outline, stroke included");
  const aspect = VIEWPORT.width / VIEWPORT.height;
  for (const subject of [
    { x: 0, y: 0, width: 1280, height: 60 },
    { x: 0, y: 100, width: 200, height: 500 },
    { x: 0, y: 0, width: 1280, height: 720 },
  ]) {
    const { crop, outline } = cropFor(subject);
    assert.ok(contains(crop, stroked(outline)), JSON.stringify(subject));
    assert.ok(Math.abs(crop.width / crop.height - aspect) < 0.01, "the viewport's aspect");
  }
  assert.deepEqual(off.crop, { x: 0, y: 0, ...VIEWPORT });
  assert.equal(off.outline, null);
});

test("a withheld still is a labelled empty frame that keeps its caption", () => {
  const steps = records();
  steps.after[1] = { ...steps.after[1], still: null, withheld: "a sign-in value is on the screen" };
  const cell = layout(steps, fixtureMeta()).rows[1].after;
  assert.equal(cell.still, null);
  assert.equal(cell.withheld, "a sign-in value is on the screen");
  assert.equal(cell.caption, "The members list after saving");
  const html = storyboardHtml(layout(steps, fixtureMeta()), () => PNG_1X1);
  assert.match(html, /Still withheld: a sign-in value is on the screen/);
});

test("a Before step with no After step, and the reverse, keep their row with the other side empty", () => {
  const steps = records();
  steps.before = steps.before.slice(0, 1);
  const laid = layout(steps, fixtureMeta());
  assert.equal(laid.rows.length, 2);
  assert.equal(laid.rows[1].before.missing, "no Before step");
});

test("the proving step defaults to the last After step, and must be one", () => {
  const meta = fixtureMeta();
  delete meta.proves;
  assert.deepEqual(
    layout(records(), meta).rows.map((row) => row.proves),
    [false, true],
  );
  assert.throws(
    () => layout(records(), { ...fixtureMeta(), proves: { session: "B", index: 1 } }),
    /proves.*no After step/,
  );
});

// ── One column, with Before notes ────────────────────────────────────────────

test("a feature scenario renders one column, each row with a Before note", () => {
  const laid = layout(
    { after: fixtureSteps("s1-web"), before: null },
    { ...fixtureMeta(), before: null },
  );
  assert.equal(laid.columns, 1);
  assert.deepEqual(
    laid.band.sides.map((side) => side.side),
    ["After"],
  );
  for (const row of laid.rows) {
    assert.equal(row.before, null);
    assert.match(row.beforeNote, /^Before: not run, a feature scenario runs After only$/);
  }
});

test("a fix scenario whose Before matched After's expected text renders one column with Before notes", () => {
  const meta = fixtureMeta();
  meta.before = { ...meta.before, expected: meta.after.expected, judged: "expected" };
  const laid = layout(records(), meta);
  assert.equal(laid.columns, 1);
  assert.equal(laid.band.sides.length, 2, "the band still shows both sides");
  for (const row of laid.rows) {
    assert.equal(row.before, null);
    assert.match(row.beforeNote, /^Before: showed the same as After/);
  }
});

test("a fix scenario whose Before was not run or not observed renders one column with its why", () => {
  for (const state of ["not run", "not observed"]) {
    const meta = fixtureMeta();
    meta.before = {
      steps: null,
      state,
      expected: meta.before.expected,
      observed: "the Before stack did not come up",
      judged: "not judged",
    };
    const laid = layout({ after: fixtureSteps("s1-web"), before: null }, meta);
    assert.equal(laid.columns, 1);
    assert.equal(laid.band.sides[0].mark, "–");
    for (const row of laid.rows)
      assert.equal(row.beforeNote, `Before ${state}: the Before stack did not come up`);
  }
});

// ── The caption privacy check ────────────────────────────────────────────────

const KNOWN = [
  { name: "QA_A_EMAIL", value: EMAIL, kind: "sign-in", exact: false },
  { name: "QA_A_PASSWORD", value: PASSWORD, kind: "secret", exact: false },
  { name: "QA_A_USERNAME", value: "ada-l", kind: "sign-in", exact: true },
];

test("the privacy check names the field holding a sign-in value, a secret or a token, never the value", () => {
  const refusals = privacyCheck(
    [
      { field: "title", text: "Saving a profile" },
      { field: "After step 1 (A): caption", text: `Signed in as ${EMAIL.toUpperCase()}` },
      { field: "before.observed", text: `typed ${encodeURIComponent(PASSWORD)}` },
      { field: "after.observed", text: `the header showed Bearer ${JWT}` },
      { field: "context.accounts[0]", text: "ada-l" },
      { field: "After step 2 (A): caption", text: "Ada-L's page" },
    ],
    KNOWN,
  );
  assert.deepEqual(
    refusals.map((refusal) => refusal.field),
    [
      "After step 1 (A): caption",
      "before.observed",
      "after.observed",
      "after.observed",
      "context.accounts[0]",
    ],
  );
  assert.match(refusals[0].why, /a sign-in value \(QA_A_EMAIL\)/);
  assert.match(refusals[1].why, /a value marked secret \(QA_A_PASSWORD\)/);
  assert.match(refusals[2].why, /a JWT/);
  const text = JSON.stringify(refusals);
  for (const value of [EMAIL, PASSWORD, JWT, "ada-l"]) assert.ok(!text.includes(value));
});

test("only the values web.mjs counts as sign-in values are looked for: not `QA_SHIPPING_CITY` (#235 review)", () => {
  const env = {
    QA_SHIPPING_CITY: "London",
    QA_A_EMAIL: EMAIL,
    QA_A_PASSWORD: PASSWORD,
    QA_B_USERNAME: "ada-l",
    QA_A_CODE: "filled-code",
    HOME: "/home/x",
  };
  const known = knownFromEnv(env, ["QA_A_CODE"]);
  assert.deepEqual(known.map((k) => k.name).sort(), [
    "QA_A_CODE",
    "QA_A_EMAIL",
    "QA_A_PASSWORD",
    "QA_B_USERNAME",
  ]);
  assert.deepEqual(
    privacyCheck([{ field: "After step 1 (A): caption", text: "Order ships to London" }], known),
    [],
  );
  assert.equal(
    privacyCheck([{ field: "title", text: "typed filled-code" }], known)[0].why,
    "holds a sign-in value (QA_A_CODE)",
  );
});

test("a plain `QA_*` value in a caption is not refused, and its step file is left alone", async () => {
  const { dir, metaPath } = runFolder();
  const file = join(dir, "s1-web", "steps.json");
  const stepFile = JSON.parse(readFileSync(file, "utf8"));
  stepFile.steps[0].caption = "Order ships to London";
  writeFileSync(file, JSON.stringify(stepFile));
  const before = readFileSync(file, "utf8");
  const { code, out } = await main(["render", metaPath], {
    env: { ...ENV, QA_SHIPPING_CITY: "London" },
    cwd: ROOT,
    renderer: stubRenderer([]),
  });
  assert.equal(code, 0, out);
  assert.equal(readFileSync(file, "utf8"), before);
});

test("the privacy check is pure, and passes clean fields", () => {
  const fields = [{ field: "title", text: "Saving a profile" }];
  assert.deepEqual(privacyCheck(fields, KNOWN), []);
  assert.deepEqual(fields, [{ field: "title", text: "Saving a profile" }]);
});

test("the checked fields are everything the Storyboard shows", () => {
  const steps = records();
  steps.after[1] = { ...steps.after[1], withheld: "a password field holds a value", still: null };
  const names = shownFields(steps, fixtureMeta()).map((f) => f.field);
  for (const name of [
    "title",
    "before.expected",
    "before.observed",
    "after.expected",
    "after.observed",
    "context.accounts[0]",
    "context.sessions[0].account",
    "After step 1 (A): caption",
    "Before step 2 (A): caption",
    "After step 2 (A): withheld",
  ])
    assert.ok(names.includes(name), name);
});

for (const [what, edit] of [
  ["a known sign-in value", (meta) => ({ ...meta, title: `Saving ${EMAIL}'s profile` })],
  [
    "a secret-marked value",
    (meta) => ({ ...meta, after: { ...meta.after, observed: `the page echoed ${PASSWORD}` } }),
  ],
  ["a JWT", (meta) => ({ ...meta, before: { ...meta.before, observed: `a cookie ${JWT}` } })],
])
  test(`a field holding ${what} refuses the Storyboard: no file, the field named, the value nowhere`, async () => {
    const { dir, metaPath } = runFolder(edit);
    const seen = [];
    const { code, out } = await main(["render", metaPath], {
      env: ENV,
      cwd: ROOT,
      renderer: stubRenderer(seen),
    });
    assert.equal(code, 1);
    const summary = JSON.parse(out);
    assert.equal(summary.written, false);
    assert.equal(summary.refused.length, 1);
    assert.match(summary.refused[0].field, /^(?:title|after\.observed|before\.observed)$/);
    assert.equal(seen.length, 0, "nothing rendered");
    assert.ok(!existsSync(join(dir, "s1-storyboard.png")));
    for (const value of [EMAIL, PASSWORD, JWT]) {
      assert.ok(!out.includes(value));
      assert.ok(!allText(dir).includes(value), "kept as [withheld] in the records");
    }
    const meta = JSON.parse(readFileSync(metaPath, "utf8"));
    assert.ok(JSON.stringify(meta).includes(WITHHELD));
  });

test("a caption holding a sign-in value is kept as [withheld] in its step file", async () => {
  const { dir, metaPath } = runFolder();
  const file = join(dir, "s1-web", "steps.json");
  const stepFile = JSON.parse(readFileSync(file, "utf8"));
  stepFile.steps[0].caption = `Signed in as ${EMAIL}`;
  writeFileSync(file, JSON.stringify(stepFile));
  const { code, out } = await main(["render", metaPath], {
    env: ENV,
    cwd: ROOT,
    renderer: stubRenderer([]),
  });
  assert.equal(code, 1);
  assert.deepEqual(JSON.parse(out).refused, [
    { field: "After step 1 (A): caption", why: "holds a sign-in value (QA_A_EMAIL)" },
  ]);
  const kept = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(kept.steps[0].caption, WITHHELD);
  assert.equal(kept.steps[1].caption, "The members list after saving");
});

test("a variable the run used must be given, or nothing is checked or written", async () => {
  const { dir, metaPath } = runFolder();
  const { code, out } = await main(["render", metaPath], {
    env: { QA_A_EMAIL: EMAIL },
    cwd: ROOT,
    renderer: stubRenderer([]),
  });
  assert.equal(code, 1);
  assert.match(out, /QA_A_PASSWORD is not set/);
  assert.ok(!existsSync(join(dir, "s1-storyboard.png")));
});

// ── Re-rendering from the saved records ──────────────────────────────────────

test("re-rendering from the saved step records gives the same layout, without running the scenario", async () => {
  const { dir, metaPath } = runFolder();
  const seen = [];
  for (let i = 0; i < 2; i += 1) {
    const { code, out } = await main(["render", metaPath], {
      env: ENV,
      cwd: ROOT,
      renderer: stubRenderer(seen),
    });
    assert.equal(code, 0, out);
    assert.equal(JSON.parse(out).written, true);
  }
  assert.deepEqual(seen[0], seen[1]);
  assert.deepEqual(seen[0], layout(records(), fixtureMeta()));
  assert.ok(existsSync(join(dir, "s1-storyboard.png")));
  const loaded = loadScenario(metaPath);
  assert.deepEqual(layout(loaded.records, loaded.meta), seen[0]);
});

test("the re-render command is the one ADAPTER.md documents", () => {
  assert.ok(adapterDoc.includes('node "<skill>/storyboard.mjs" render <s<n>-storyboard.json>'));
});

// ── Without Chromium, and other refusals ─────────────────────────────────────

test("without Chromium no Storyboard is made, and the reason is the one the report gives", async () => {
  const { dir, metaPath } = runFolder();
  const empty = mkdtempSync(join(tmpdir(), "no-playwright-"));
  dirs.push(empty);
  const { code, out } = await main(["render", metaPath], { env: ENV, cwd: empty });
  assert.equal(code, 2);
  const summary = JSON.parse(out);
  assert.equal(summary.written, false);
  assert.match(summary.reason, /^no Storyboard: no Playwright with Chromium in this repository/);
  assert.ok(!existsSync(join(dir, "s1-storyboard.png")));
});

test("a Storyboard is made for a PASS or FAIL only", async () => {
  for (const result of ["Not proven", "left for a person"]) {
    const { metaPath } = runFolder((meta) => ({ ...meta, result }));
    const { code, out } = await main(["render", metaPath], {
      env: ENV,
      cwd: ROOT,
      renderer: stubRenderer([]),
    });
    assert.equal(code, 1);
    assert.match(out, /PASS or FAIL/);
  }
});

test("a still name that is not the driver's own is refused, so no file outside the run is read", async () => {
  const { dir, metaPath } = runFolder();
  const file = join(dir, "s1-web", "steps.json");
  const stepFile = JSON.parse(readFileSync(file, "utf8"));
  stepFile.steps[0].still = "../../secret.png";
  writeFileSync(file, JSON.stringify(stepFile));
  const { code, out } = await main(["render", metaPath], {
    env: ENV,
    cwd: ROOT,
    renderer: stubRenderer([]),
  });
  assert.equal(code, 1);
  assert.match(out, /still/);
});

test("a scenario file without `variables`, or with a step file outside the run, is refused (#235 review)", async () => {
  for (const [edit, why] of [
    [
      (meta) => {
        delete meta.variables;
        return meta;
      },
      /variables is not a list/,
    ],
    [
      (meta) => ({ ...meta, after: { ...meta.after, steps: "../elsewhere/steps.json" } }),
      /after\.steps is not a step file beside the scenario file/,
    ],
  ]) {
    const { dir, metaPath } = runFolder(edit);
    const { code, out } = await main(["render", metaPath], {
      env: ENV,
      cwd: ROOT,
      renderer: stubRenderer([]),
    });
    assert.equal(code, 1);
    assert.match(out, why);
    assert.ok(!existsSync(join(dir, "s1-storyboard.png")));
  }
});

test("each Session in the run context says how it signs in, ids only, and the check refuses any other word", () => {
  assert.deepEqual(SESSION_KINDS, ["role", "scenario account", "nobody"]);
  const withSessions = (sessions) => ({ ...fixtureMeta(), context: { accounts: [], sessions } });
  assert.deepEqual(
    checkScenario(
      withSessions([
        { session: "A", account: "admin", kind: "role" },
        { session: "B", account: "temp-user", kind: "scenario account" },
        { session: "C", account: "nobody", kind: "nobody" },
      ]),
    ),
    [],
  );
  // An older scenario file, written before Sessions said how they sign in, still loads.
  assert.deepEqual(checkScenario(withSessions([{ session: "A", account: "admin" }])), []);
  for (const kind of ["Role", "account", "", 1, null])
    assert.deepEqual(
      checkScenario(withSessions([{ session: "A", account: "admin", kind }])),
      [
        'context is not {"accounts": [ids], "sessions": [{"session", "account", "kind"}]}, ' +
          "kind one of role, scenario account, nobody",
      ],
      String(kind),
    );
  // A Session named twice is out of shape: the MP4 could not tell which entry is its own.
  assert.equal(
    checkScenario(
      withSessions([
        { session: "A", account: "admin", kind: "role" },
        { session: "A", account: "member", kind: "role" },
      ]),
    ).length,
    1,
  );
});

// ── The Story: one sentence per Scene, carried in the scenario file (#385) ──

/** The fixture's two steps, the second in Session B: two Scenes, so a Cut between them. */
function twoSessionFolder(edit = (meta) => meta) {
  const folder = runFolder((meta) => edit({ ...meta, proves: { session: "B", index: 2 } }));
  for (const side of ["s1-web", "s1-before-web"]) {
    const file = join(folder.dir, side, "steps.json");
    const stepFile = JSON.parse(readFileSync(file, "utf8"));
    stepFile.steps[1] = { ...stepFile.steps[1], session: "B", still: "step-02-b.png" };
    writeFileSync(join(folder.dir, side, "step-02-b.png"), PNG_1X1);
    writeFileSync(file, JSON.stringify(stepFile));
  }
  return folder;
}
const TWO_STORY = ["Ada saves her new name.", "The admin sees it listed once."];

test("the scenario file carries the plan's Story as `story`, a list of sentences, and an older file without it still loads", () => {
  const withStory = (story) => ({ ...fixtureMeta(), story });
  assert.deepEqual(checkScenario(withStory(["Ada saves her new name."])), []);
  assert.deepEqual(checkScenario(withStory([])), []);
  assert.deepEqual(checkScenario(fixtureMeta()), [], "a scenario file from before #385");
  for (const story of ["Ada saves her new name.", [""], ["  "], [1], [null], {}, null])
    assert.deepEqual(
      checkScenario(withStory(story)),
      ["story is not a list of sentences, one per Scene ([] for none)"],
      JSON.stringify(story),
    );
});

test("a Story with fewer sentences than After's steps make Scenes is a problem; one with more is a run that stopped early", async () => {
  const short = twoSessionFolder((meta) => ({ ...meta, story: [TWO_STORY[0]] }));
  assert.deepEqual(loadScenario(short.metaPath).problems, [
    "story has 1 sentence, and After's steps make 2 Scenes: copy the plan's Story:, one sentence per Scene",
  ]);
  const { code, out } = await main(["render", short.metaPath], {
    env: ENV,
    cwd: ROOT,
    renderer: stubRenderer([]),
  });
  assert.equal(code, 1, out);
  // After stopped before its last Scene: the Story keeps every planned sentence.
  const long = runFolder((meta) => ({ ...meta, story: TWO_STORY }));
  assert.deepEqual(loadScenario(long.metaPath).problems, []);
  assert.deepEqual(loadScenario(runFolder().metaPath).problems, []);
});

/** An admin ends a member's session: Scenes A, B, A, each step its own row, as #381's story. */
function cutRecords() {
  const step = (session, index, caption, extra = {}) => ({
    session,
    index,
    caption,
    still: `step-0${index}-${session.toLowerCase()}.png`,
    subject: null,
    text: null,
    withheld: null,
    ...extra,
  });
  const steps = () => [
    step("A", 1, "The member's dashboard"),
    step("B", 2, "The admin's sessions page, the member's session ended"),
    step("A", 3, "The member's page after a reload"),
    step("A", 4, "The sign-in page the member lands on"),
  ];
  return { after: steps(), before: steps() };
}
const CUT_STORY = [
  "The member is signed in and on their dashboard.",
  "The admin ends the member's session.",
  "The member reloads and lands on the sign-in page.",
];
const cutMeta = (edit = {}) => ({
  ...fixtureMeta(),
  before: { ...fixtureMeta().before, expected: "The member stays on the dashboard" },
  proves: { session: "A", index: 4 },
  story: CUT_STORY,
  ...edit,
});
/** The laid-out Storyboard read top to bottom: each heading row and each numbered row. */
const readDown = (laid) => {
  const seen = new Set();
  return laid.rows.flatMap((row) => {
    const scene = laid.scenes.find((s) => s.number === row.scene);
    const heading = scene?.sentence && !seen.has(scene.number) ? [`# ${scene.sentence}`] : [];
    if (scene) seen.add(scene.number);
    return [...heading, `${row.number} ${row.session}`];
  });
};

test("each Scene's Story sentence is a heading row above that Scene's steps, in order (#385)", () => {
  const laid = layout(cutRecords(), cutMeta());
  assert.deepEqual(
    laid.scenes.map((s) => [s.number, s.session, s.steps, s.sentence]),
    [
      [1, "A", [1], CUT_STORY[0]],
      [2, "B", [2], CUT_STORY[1]],
      [3, "A", [3, 4], CUT_STORY[2]],
    ],
  );
  // The admin's confirming step and the member's landing step are each their own numbered row.
  assert.deepEqual(readDown(laid), [
    `# ${CUT_STORY[0]}`,
    "1 A",
    `# ${CUT_STORY[1]}`,
    "2 B",
    `# ${CUT_STORY[2]}`,
    "3 A",
    "4 A",
  ]);
  // The page draws them in that order, each heading once.
  const html = storyboardHtml(laid, () => PNG_1X1);
  const at = (text) => html.indexOf(text.replaceAll("'", "&#39;"));
  const order = [
    CUT_STORY[0],
    "The member's dashboard",
    CUT_STORY[1],
    "The admin's sessions page",
    CUT_STORY[2],
    "after a reload",
    "The sign-in page the member lands on",
  ].map(at);
  assert.ok(order.every((i) => i >= 0));
  assert.deepEqual(
    [...order].sort((a, b) => a - b),
    order,
  );
  assert.equal(html.match(/class="scene"/g).length, 3);
  assert.match(html, /<div class="scene"><small>Scene 2 of 3, Session B<\/small>The admin ends/);
});

test("a still withheld for privacy keeps its row, caption and labelled frame under its Scene's heading", () => {
  const steps = cutRecords();
  steps.after[1] = { ...steps.after[1], still: null, withheld: "a sign-in value is on the screen" };
  const laid = layout(steps, cutMeta());
  assert.deepEqual(readDown(laid).slice(2, 4), [`# ${CUT_STORY[1]}`, "2 B"]);
  const row = laid.rows[1];
  assert.equal(row.scene, 2);
  assert.equal(row.after.caption, "The admin's sessions page, the member's session ended");
  assert.equal(row.after.withheld, "a sign-in value is on the screen");
  const html = storyboardHtml(laid, () => PNG_1X1);
  assert.ok(
    html.indexOf(CUT_STORY[1].replaceAll("'", "&#39;")) <
      html.indexOf("Still withheld: a sign-in value is on the screen"),
  );
});

test("a scenario file with no Story has no heading rows, and lays out as before", () => {
  const laid = layout(cutRecords(), cutMeta({ story: undefined }));
  assert.deepEqual(
    laid.scenes.map((s) => s.sentence),
    [null, null, null],
  );
  assert.deepEqual(readDown(laid), ["1 A", "2 B", "3 A", "4 A"]);
  assert.doesNotMatch(
    storyboardHtml(laid, () => PNG_1X1),
    /class="scene"/,
  );
  // A Before step with no After step keeps its row, after the others, under no Scene.
  const steps = cutRecords();
  steps.after.pop();
  const short = layout(steps, cutMeta({ proves: { session: "A", index: 3 } }));
  assert.deepEqual(readDown(short).slice(-2), ["3 A", "4 A"]);
  assert.equal(short.rows.at(-1).scene, null);
});

test("every Story sentence is a field the privacy check reads, a Storyboard shown or not", () => {
  const meta = { ...fixtureMeta(), story: ["One.", "Two."] };
  const fields = shownFields(records(), meta).filter((f) => f.field.startsWith("story"));
  assert.deepEqual(fields, [
    { field: "story[0]", text: "One.", from: { file: "meta", path: ["story", 0] } },
    { field: "story[1]", text: "Two.", from: { file: "meta", path: ["story", 1] } },
  ]);
});

test("a Story sentence holding a sign-in value refuses the Storyboard by its field, never its value, and is kept [withheld]", async () => {
  const { dir, metaPath } = twoSessionFolder((meta) => ({
    ...meta,
    story: [TWO_STORY[0], `The admin, ${EMAIL}, sees it listed once.`],
  }));
  const seen = [];
  const { code, out } = await main(["render", metaPath], {
    env: ENV,
    cwd: ROOT,
    renderer: stubRenderer(seen),
  });
  assert.equal(code, 1, out);
  assert.deepEqual(JSON.parse(out).refused, [
    { field: "story[1]", why: "holds a sign-in value (QA_A_EMAIL)" },
  ]);
  assert.equal(seen.length, 0, "nothing rendered");
  assert.ok(!out.includes(EMAIL));
  assert.ok(!allText(dir).includes(EMAIL));
  assert.deepEqual(JSON.parse(readFileSync(metaPath, "utf8")).story, [TWO_STORY[0], WITHHELD]);
  // Run again, it builds, the sentence shown as [withheld].
  const again = await main(["render", metaPath], {
    env: ENV,
    cwd: ROOT,
    renderer: stubRenderer(seen),
  });
  assert.equal(again.code, 0, again.out);
  assert.deepEqual(
    seen[0].scenes.map((s) => s.sentence),
    [TWO_STORY[0], WITHHELD],
  );
});

test("every refusal removes an older Storyboard at its path, so none outlives what the run now says (#235 review)", async () => {
  const cases = [
    ["a result re-graded to Not proven", (meta) => ({ ...meta, result: "Not proven" }), {}],
    ["a variable not given", (meta) => meta, { env: { QA_A_EMAIL: EMAIL } }],
    [
      "a proving step that is not there",
      (meta) => ({ ...meta, proves: { session: "B", index: 9 } }),
      {},
    ],
    ["a caption holding a sign-in value", (meta) => ({ ...meta, title: `For ${EMAIL}` }), {}],
  ];
  for (const [what, edit, io] of cases) {
    const { dir, metaPath } = runFolder(edit);
    const old = join(dir, "s1-storyboard.png");
    writeFileSync(old, PNG_1X1);
    const { code } = await main(["render", metaPath], {
      env: ENV,
      cwd: ROOT,
      renderer: stubRenderer([]),
      ...io,
    });
    assert.equal(code, 1, what);
    assert.ok(!existsSync(old), `${what}: the older Storyboard is gone`);
  }
});

test("usage errors exit 2", async () => {
  for (const argv of [[], ["draw", "x.json"], ["render"], ["render", "x.json", "--out"]])
    assert.equal((await main(argv, { env: ENV })).code, 2, argv.join(" "));
});

// ── Rendering in Chromium ────────────────────────────────────────────────────

test(
  "Chromium is here when AGENT_KIT_REQUIRE_CHROMIUM says it must be",
  { skip: !REQUIRED },
  () => {
    assert.ok(PLAYWRIGHT.chromium, "AGENT_KIT_REQUIRE_CHROMIUM=1, but no Playwright with Chromium");
  },
);

test("the Storyboard renders to a PNG in Chromium", { skip: NEEDS_CHROMIUM }, async () => {
  const { dir, metaPath } = runFolder();
  const { code, out } = await main(["render", metaPath], { env: ENV, cwd: ROOT });
  assert.equal(code, 0, out);
  const png = readFileSync(join(dir, "s1-storyboard.png"));
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  // Width and height from the IHDR chunk: a page, not a still.
  assert.ok(png.readUInt32BE(16) >= 1000);
  assert.ok(png.readUInt32BE(20) >= 600);
  const loaded = loadScenario(metaPath);
  const again = await render(loaded.records, loaded.meta, { playwright: PLAYWRIGHT.module });
  assert.equal(again.subarray(1, 4).toString(), "PNG");
});

test("storyboard.mjs resolves Playwright from `run.playwright` (or `--playwright-dir`) while run from the repo root", async () => {
  const { dir, metaPath } = runFolder();
  const repo = mkdtempSync(join(tmpdir(), "storyboard-subdir-"));
  dirs.push(repo);
  mkdirSync(join(repo, "react-frontend", "node_modules", "playwright"), { recursive: true });
  writeFileSync(join(repo, "react-frontend", "package.json"), "{}");
  const fakeBrowser = join(repo, "react-frontend", "chromium-bin");
  writeFileSync(fakeBrowser, "");
  const launchMarker = join(repo, "launched.txt");
  writeFileSync(
    join(repo, "react-frontend", "node_modules", "playwright", "index.js"),
    [
      `const fs = require("node:fs");`,
      `const png = Buffer.from(${JSON.stringify(PNG_1X1.toString("base64"))}, "base64");`,
      `module.exports = {`,
      `  chromium: {`,
      `    executablePath: () => ${JSON.stringify(fakeBrowser)},`,
      `    launch: async () => {`,
      `      fs.writeFileSync(${JSON.stringify(launchMarker)}, "ok");`,
      `      return {`,
      `        newContext: async () => ({`,
      `          route: async () => {},`,
      `          newPage: async () => ({ setContent: async () => {}, screenshot: async () => png }),`,
      `          close: async () => {},`,
      `        }),`,
      `        close: async () => {},`,
      `      };`,
      `    },`,
      `  },`,
      `};`,
    ].join("\n"),
  );

  // Without `run.playwright`, running from `repo` returns exit 2.
  assert.equal((await main(["render", metaPath], { env: ENV, cwd: repo })).code, 2);
  assert.equal(existsSync(launchMarker), false);

  // With `--playwright-dir react-frontend`, it loads from `react-frontend`.
  const byFlag = await main(["render", metaPath, "--playwright-dir", "react-frontend"], {
    env: ENV,
    cwd: repo,
  });
  assert.equal(byFlag.code, 0, byFlag.out);
  assert.equal(existsSync(launchMarker), true);

  // With `qa.config.yml` setting `run.playwright: react-frontend`, no flag is needed.
  rmSync(launchMarker, { force: true });
  rmSync(join(dir, "s1-storyboard.png"), { force: true });
  writeFileSync(join(repo, "qa.config.yml"), "run:\n  playwright: react-frontend\n");
  const byConfig = await main(["render", metaPath], { env: ENV, cwd: repo });
  assert.equal(byConfig.code, 0, byConfig.out);
  assert.equal(existsSync(launchMarker), true);
  assert.equal(existsSync(join(dir, "s1-storyboard.png")), true);
});
