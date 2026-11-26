/**
 * Contract suite for `mp4.mjs` (SKILL.md step 6, ADAPTER.md "The MP4"): one
 * annotated MP4 per PASS or FAIL `web` scenario with `Capture: video`, Before
 * beside After or After alone, holding on each step and slowed between steps,
 * with the Storyboard's band and each step's caption and timing line overlaid,
 * after the caption privacy check.
 *
 * The timing line, the timeline and the CLI's refusals run everywhere, without
 * ffmpeg. The tests that build an MP4 need ffmpeg and ffprobe on `PATH`; they
 * skip without them, and fail instead when `AGENT_KIT_REQUIRE_FFMPEG=1` says
 * they must be there. They render the overlays with a stand-in for Chromium;
 * the one test that renders them in Chromium also needs Playwright with
 * Chromium in this repository, and is forced by `AGENT_KIT_REQUIRE_CHROMIUM=1`.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { findPlaywright, onPath } from "./adapter.mjs";
import {
  BETWEEN_SPEED,
  FPS,
  HOLD_SECONDS,
  NO_CHROMIUM_MP4,
  NO_FFMPEG,
  SIDE,
  ffmpegArgs,
  main,
  overlayFields,
  overlayPages,
  timeline,
  timingLine,
  wallClock,
} from "./mp4.mjs";
import { readReport } from "./report.mjs";
import { loadScenario, main as storyboard } from "./storyboard.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const FIXTURES = join(HERE, "fixtures", "mp4");
const adapterDoc = readFileSync(join(HERE, "ADAPTER.md"), "utf8");

const FFMPEG = onPath("ffmpeg") && onPath("ffprobe");
const REQUIRE_FFMPEG = process.env.AGENT_KIT_REQUIRE_FFMPEG === "1";
const NEEDS_FFMPEG = FFMPEG || REQUIRE_FFMPEG ? false : "ffmpeg with ffprobe is not on PATH";
const PLAYWRIGHT = findPlaywright(ROOT);
const REQUIRE_CHROMIUM = process.env.AGENT_KIT_REQUIRE_CHROMIUM === "1";
const NEEDS_BOTH =
  NEEDS_FFMPEG ||
  (PLAYWRIGHT.chromium || REQUIRE_CHROMIUM
    ? false
    : "Playwright with Chromium is not installed in this repository");

/**
 * A folder with empty `ffmpeg` and `ffprobe` files: `mp4.mjs` looks only for the files on
 * `PATH`, so the refusals are tested where ffmpeg is not installed. ffmpeg itself runs from
 * the real `PATH`.
 */
const STAND_IN_BIN = mkdtempSync(join(tmpdir(), "mp4-bin-"));
writeFileSync(join(STAND_IN_BIN, "ffmpeg"), "");
writeFileSync(join(STAND_IN_BIN, "ffprobe"), "");
/** The variables the run used, and `PATH`, where `mp4.mjs` finds ffmpeg and ffprobe. */
const ENV = {
  QA_A_EMAIL: "admin@example.test",
  QA_A_PASSWORD: "Corr3ct-Horse-Battery",
  PATH: [STAND_IN_BIN, process.env.PATH].join(delimiter),
};
/** A made-up JWT, joined at run time so no token-shaped literal sits in the file. */
const JWT = ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxIn0", "c2lnbmF0dXJl"].join(".");

const dirs = [STAND_IN_BIN];
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** A copy of the fixture run folder; with ffmpeg, a 4-second recording beside each step file. */
function runFolder({ edit = (meta) => meta, scenario = "s1", videos = FFMPEG } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "mp4-"));
  dirs.push(dir);
  cpSync(FIXTURES, dir, { recursive: true });
  const metaPath = join(dir, `${scenario}-storyboard.json`);
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  writeFileSync(metaPath, JSON.stringify(edit(meta)));
  if (videos)
    for (const side of ["s1-web", "s1-before-web", "s2-web"])
      recording(join(dir, side, "video-a.webm"));
  return { dir, metaPath };
}

/** A test pattern with a running counter, 1280×720 at 25 fps, as Playwright's `webm` is. */
function recording(file, seconds = 4) {
  const made = spawnSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `testsrc=size=1280x720:rate=25:duration=${seconds}`,
    "-c:v",
    "mpeg4",
    "-q:v",
    "8",
    "-f",
    "matroska",
    file,
  ]);
  assert.equal(made.status, 0, String(made.stderr));
}

/** A plain PNG of a given size, made by ffmpeg: a stand-in for Chromium's overlays. */
const plain = new Map();
function plainPng(width, height) {
  const key = `${width}x${height}`;
  if (!plain.has(key)) {
    const dir = mkdtempSync(join(tmpdir(), "mp4-png-"));
    dirs.push(dir);
    const file = join(dir, "x.png");
    const made = spawnSync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=white:s=${key}`,
      "-frames:v",
      "1",
      file,
    ]);
    assert.equal(made.status, 0, String(made.stderr));
    plain.set(key, readFileSync(file));
  }
  return plain.get(key);
}
/** Renders each page as a plain PNG at its width: a band 151 pixels high, a caption 61 or 75. */
const standIn = async (pages) =>
  pages.map((page, i) => plainPng(page.width, i === 0 ? 151 : i % 2 ? 61 : 75));

function probe(file) {
  const out = spawnSync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,codec_name:format=duration",
    "-of",
    "json",
    file,
  ]);
  assert.equal(out.status, 0, String(out.stderr));
  const parsed = JSON.parse(String(out.stdout));
  return { ...parsed.streams[0], duration: Number(parsed.format.duration) };
}

const loaded = (metaPath) => {
  const l = loadScenario(metaPath);
  return { ...l, laid: timeline(l.records, l.meta, l.raw) };
};

// ── The timing line, without ffmpeg ──────────────────────────────────────────

test("the timing line gives the wall clock in the run's zone, the time since the side started, and After minus Before", () => {
  const startedAt = "2026-11-16T10:04:12.000+11:00";
  assert.equal(
    timingLine({ side: "After", startedAt, atMs: 2500, beforeAtMs: 2800 }),
    "10:04:14 UTC+11:00 · 2.5 s since After started · After -0.3 s",
  );
  assert.equal(
    timingLine({ side: "After", startedAt, atMs: 3200, beforeAtMs: 1900 }),
    "10:04:15 UTC+11:00 · 3.2 s since After started · After +1.3 s",
  );
  // Before has no difference; nor has After without a paired Before step.
  assert.equal(
    timingLine({ side: "Before", startedAt: "2026-11-16T10:01:30.000+11:00", atMs: 2800 }),
    "10:01:32 UTC+11:00 · 2.8 s since Before started",
  );
  assert.equal(
    timingLine({ side: "After", startedAt, atMs: 2500, beforeAtMs: null }),
    "10:04:14 UTC+11:00 · 2.5 s since After started",
  );
  // A lead and a lag of the same size read the same; an equal time is +0.0, never -0.0.
  assert.match(
    timingLine({ side: "After", startedAt, atMs: 1250, beforeAtMs: 0 }),
    /After \+1\.3 s$/,
  );
  assert.match(
    timingLine({ side: "After", startedAt, atMs: 0, beforeAtMs: 1250 }),
    /After -1\.3 s$/,
  );
  assert.match(
    timingLine({ side: "After", startedAt, atMs: 1000, beforeAtMs: 1040 }),
    /After \+0\.0 s$/,
  );
});

test("the wall clock is whole seconds in the start time's own zone, rolls over midnight, and never the machine's", () => {
  assert.equal(wallClock("2026-11-16T23:59:59.900Z", 100), "00:00:00 UTC");
  assert.equal(wallClock("2026-11-16T10:00:00-05:30", 61_240), "10:01:01 UTC-05:30");
  assert.equal(wallClock("2026-11-16T10:00:00+00:00", 0), "10:00:00 UTC");
  assert.throws(() => wallClock("2026-11-16 10:00:00", 0), /not a start time/);
});

// ── The timeline, without ffmpeg ─────────────────────────────────────────────

test("a fix scenario plays two sides, each step held and the stretch between steps slowed to the longer side's", () => {
  const { laid } = loaded(runFolder({ videos: false }).metaPath);
  assert.deepEqual(
    laid.sides.map((s) => s.side),
    ["Before", "After"],
  );
  assert.equal(laid.session, "A");
  // Recording times: atMs less the Session's startedAtMs (After 500 ms, Before 300 ms).
  assert.deepEqual(
    laid.sides[1].steps.map((s) => s.at),
    [1, 2, 2.7],
  );
  assert.deepEqual(
    laid.sides[0].steps.map((s) => s.at),
    [1, 2.5, 2.7],
  );
  // Stretches: After 1.0 s then 0.7 s, Before 1.5 s then 0.2 s; the longer one sets each.
  assert.deepEqual(
    laid.pieces.map((p) => [p.kind, p.index, p.seconds]),
    [
      ["hold", 1, HOLD_SECONDS],
      ["between", 2, 1.5 / BETWEEN_SPEED],
      ["hold", 2, HOLD_SECONDS],
      ["between", 3, 0.7 / BETWEEN_SPEED],
      ["hold", 3, HOLD_SECONDS],
    ],
  );
  assert.equal(laid.seconds, 3 * HOLD_SECONDS + (1.5 + 0.7) / BETWEEN_SPEED);
  // Each held step's caption and timing line, After's with its difference from Before.
  const held = laid.sides[1].overlays.filter((o) => /timing line/.test(o.field));
  assert.deepEqual(
    held.map((o) => o.caption),
    [
      "The profile form, with the new name typed",
      "The saved toast",
      "The members list after saving",
    ],
  );
  assert.deepEqual(
    held.map((o) => o.timing),
    [
      "10:04:13 UTC+11:00 · 1.5 s since After started · After +0.2 s",
      "10:04:14 UTC+11:00 · 2.5 s since After started · After -0.3 s",
      "10:04:15 UTC+11:00 · 3.2 s since After started · After +0.2 s",
    ],
  );
  // Between steps, the line gives the stretch's ends on that side.
  assert.equal(
    laid.sides[1].overlays[1].timing,
    "played at 0.5× speed from step 1 (1.5 s) to step 2 (2.5 s since After started)",
  );
  // One overlay per piece on each side, in the pieces' order.
  for (const side of laid.sides) assert.equal(side.overlays.length, laid.pieces.length);
});

test("a feature scenario plays After alone, and says why Before is not beside it", () => {
  const { laid } = loaded(runFolder({ scenario: "s2", videos: false }).metaPath);
  assert.deepEqual(
    laid.sides.map((s) => s.side),
    ["After"],
  );
  assert.equal(laid.beforeNote, "Before: not run, a feature scenario runs After only");
  assert.equal(laid.seconds, 2 * HOLD_SECONDS + 1.5 / BETWEEN_SPEED);
  assert.equal(laid.sides[0].overlays[0].timing, "10:06:00 UTC · 0.8 s since After started");
});

test("a Before not run, or with no recording of the Session, leaves After alone", () => {
  const notRun = loaded(
    runFolder({
      videos: false,
      edit: (m) => ({
        ...m,
        before: {
          ...m.before,
          state: "not observed",
          steps: null,
          observed: "the stack did not start",
        },
      }),
    }).metaPath,
  ).laid;
  assert.deepEqual(
    notRun.sides.map((s) => s.side),
    ["After"],
  );
  assert.equal(notRun.beforeNote, "Before not observed: the stack did not start");
  const { dir, metaPath } = runFolder({ videos: false });
  const file = join(dir, "s1-before-web", "steps.json");
  const steps = JSON.parse(readFileSync(file, "utf8"));
  steps.sessions.A.video = null;
  writeFileSync(file, JSON.stringify(steps));
  assert.equal(loaded(metaPath).laid.beforeNote, "Before: no recording of Session A");
});

test("the video follows the Session the proving step names, else the first After step's", () => {
  const { dir, metaPath } = runFolder({
    videos: false,
    edit: (m) => ({ ...m, proves: { session: "B", index: 4 } }),
  });
  const file = join(dir, "s1-web", "steps.json");
  const steps = JSON.parse(readFileSync(file, "utf8"));
  steps.steps.push({
    ...steps.steps[2],
    session: "B",
    index: 4,
    still: "step-04-b.png",
    atMs: 3900,
  });
  steps.sessions.B = { startedAtMs: 3000, video: "video-b.webm" };
  writeFileSync(file, JSON.stringify(steps));
  const laid = loaded(metaPath).laid;
  assert.equal(laid.session, "B");
  assert.equal(laid.beforeNote, "Before: no recording of Session B");
  assert.deepEqual(
    laid.sides[0].steps.map((s) => s.index),
    [4],
  );
  assert.equal(laid.sides[0].video, "video-b.webm");
  const first = loaded(
    runFolder({ videos: false, edit: (m) => ({ ...m, proves: undefined }) }).metaPath,
  );
  assert.equal(first.laid.session, "A");
});

test("a step Before lacks waits where Before was, and its line says so", () => {
  const { dir, metaPath } = runFolder({ videos: false });
  const file = join(dir, "s1-before-web", "steps.json");
  const steps = JSON.parse(readFileSync(file, "utf8"));
  steps.steps.splice(1, 1);
  writeFileSync(file, JSON.stringify(steps));
  const { laid } = loaded(metaPath);
  const before = laid.sides[0];
  assert.deepEqual(
    before.steps.map((s) => s.at),
    [1, 1, 2.7],
  );
  assert.equal(before.steps[1].caption, "No Before step 2");
  assert.equal(before.overlays[2].timing, "not reached on this side");
  // After's step 2 has no Before to differ from.
  assert.doesNotMatch(laid.sides[1].overlays[2].timing, /After [+-]/);
});

test("the band and every caption are pages in the Storyboard's style, one per piece and side", () => {
  const { meta, records, laid } = loaded(runFolder({ videos: false }).metaPath);
  const pages = overlayPages(laid, meta, records);
  assert.equal(pages.length, 1 + 2 * laid.pieces.length);
  assert.equal(pages[0].width, 2 * SIDE.width);
  assert.match(
    pages[0].html,
    /<div class="band"><h1>S1: Saving a profile lists the new name once<\/h1>/,
  );
  assert.ok(pages.slice(1).every((p) => p.width === SIDE.width));
  assert.match(pages[1].html, /Before · step 1 of 3, Session A/);
  assert.match(
    pages.at(-1).html,
    /10:04:15 UTC\+11:00 · 3\.2 s since After started · After \+0\.2 s/,
  );
  // Self-contained: no script and nothing fetched.
  for (const { html } of pages) assert.doesNotMatch(html, /<script|src="http|url\(/);
});

test("ffmpeg only scales, pads, stacks and joins: two sides side by side under the band", () => {
  const { laid } = loaded(runFolder({ videos: false }).metaPath);
  const captions = laid.sides.map(() =>
    laid.pieces.map((_, j) => ({ file: `c${j}.png`, height: 61 })),
  );
  const args = ffmpegArgs(laid, {
    videos: ["before.webm", "after.webm"],
    durations: [4, 4],
    band: { file: "band.png", height: 151 },
    captions,
    encoder: "libx264",
    out: "s1.mp4",
  });
  const graph = args[args.indexOf("-filter_complex") + 1];
  assert.match(graph, /hstack=inputs=2\[sides\]/);
  assert.match(graph, /\[band\]\[sides\]vstack=inputs=2/);
  assert.match(graph, new RegExp(`setpts=\\(PTS-STARTPTS\\)/${BETWEEN_SPEED}`));
  assert.match(graph, /pad=1920:152:0:0:white/, "the band padded to an even height");
  assert.match(graph, /pad=960:62:0:0:white/, "each caption padded to the tallest, even");
  assert.doesNotMatch(graph, /drawtext|subtitles/, "no text is drawn by ffmpeg");
  assert.ok(args.includes("-an"), "no audio");
  assert.equal(args.at(-1), "s1.mp4");
  // Each piece of recording is read from its own place: After's step 2 stretch from 1.0 s.
  const seeks = [];
  args.forEach((a, i) => a === "-ss" && seeks.push([args[i + 1], args[i + 3], args[i + 5]]));
  assert.deepEqual(
    seeks.filter(([, , file]) => file === "after.webm").map(([at, length]) => [at, length]),
    [
      ["1.000", "0.080"],
      ["1.000", "1.000"],
      ["2.000", "0.700"],
    ],
  );
  // A step time past the recording's end is read from its last frames.
  const short = ffmpegArgs(laid, {
    videos: ["before.webm", "after.webm"],
    durations: [1.5, 1.5],
    band: { file: "band.png", height: 150 },
    captions,
    encoder: "mpeg4",
    out: "s1.mp4",
  });
  const last = short.lastIndexOf("-ss");
  assert.ok(Number(short[last + 1]) <= 1.5 - 2 / FPS + 1e-9);
  assert.ok(short.includes("mpeg4"));
});

// ── The privacy check, and the refusals ──────────────────────────────────────

test("a refused caption writes no MP4, names the field and never the value, and keeps it [withheld]", async () => {
  const { dir, metaPath } = runFolder();
  const file = join(dir, "s1-web", "steps.json");
  const steps = JSON.parse(readFileSync(file, "utf8"));
  steps.steps[1].caption = `Signed in as ${ENV.QA_A_EMAIL}`;
  writeFileSync(file, JSON.stringify(steps));
  writeFileSync(join(dir, "s1.mp4"), "an older MP4");
  const { code, out } = await main(["build", metaPath], { env: ENV, renderer: standIn });
  assert.equal(code, 1, out);
  assert.doesNotMatch(out, /admin@example/);
  assert.deepEqual(JSON.parse(out).refused, [
    { field: "After step 2 (A): caption", why: "holds a sign-in value (QA_A_EMAIL)" },
  ]);
  assert.equal(existsSync(join(dir, "s1.mp4")), false, "an older MP4 at its path goes too");
  assert.equal(JSON.parse(readFileSync(file, "utf8")).steps[1].caption, "[withheld]");
});

test("every text the MP4 adds is checked too: the headings, the timing lines and the Before note", async () => {
  const { meta, records, raw, laid } = loaded(
    runFolder({
      videos: false,
      edit: (m) => ({
        ...m,
        before: { ...m.before, state: "not run", steps: null, observed: `token ${JWT}` },
      }),
    }).metaPath,
  );
  void meta;
  void records;
  void raw;
  const fields = overlayFields(laid);
  assert.ok(fields.some((f) => f.field === "MP4 Before note" && f.text.includes(JWT)));
  assert.ok(fields.some((f) => /: MP4 timing line$/.test(f.field)));
  assert.ok(fields.some((f) => /: MP4 lead-in \(heading\)$/.test(f.field)));
});

test("a token in the Before note refuses the MP4 by that field", async () => {
  const { metaPath } = runFolder({
    edit: (m) => ({
      ...m,
      before: { ...m.before, state: "not run", steps: null, observed: `token ${JWT}` },
    }),
  });
  const { code, out } = await main(["build", metaPath], { env: ENV, renderer: standIn });
  assert.equal(code, 1, out);
  assert.ok(!out.includes(JWT));
  const fields = JSON.parse(out).refused.map((r) => r.field);
  assert.ok(fields.includes("before.observed"));
  assert.ok(fields.includes("MP4 Before note"));
});

test("a missing or zoneless start time, or a variable not given, is a problem and writes nothing", async () => {
  const noZone = runFolder({
    edit: (m) => ({ ...m, after: { ...m.after, startedAt: "2026-11-16T10:04:12" } }),
  });
  let result = await main(["build", noZone.metaPath], { env: ENV, renderer: standIn });
  assert.equal(result.code, 1);
  assert.match(JSON.parse(result.out).problems[0], /^after\.startedAt is not the time/);
  const noBefore = runFolder({
    edit: (m) => ({ ...m, before: { ...m.before, startedAt: undefined } }),
  });
  // Before plays only with its recording there: a stand-in will do, since nothing is built.
  for (const side of ["s1-web", "s1-before-web"])
    writeFileSync(join(noBefore.dir, side, "video-a.webm"), "");
  result = await main(["build", noBefore.metaPath], { env: ENV, renderer: standIn });
  assert.match(JSON.parse(result.out).problems[0], /^before\.startedAt/);
  // A feature scenario needs no Before start time.
  const { metaPath } = runFolder({ scenario: "s2", videos: false });
  result = await main(["build", metaPath], { env: { PATH: "" }, renderer: standIn });
  assert.equal(result.code, 2);
  result = await main(["build", noZone.metaPath], {
    env: { PATH: ENV.PATH },
    renderer: standIn,
  });
  assert.match(JSON.parse(result.out).problems[0], /QA_A_EMAIL is not set/);
});

test("without ffmpeg no MP4 is made, the Storyboard is kept, the reason is given, and the report reads", async () => {
  const { dir, metaPath } = runFolder({ videos: false });
  writeFileSync(join(dir, "s1-storyboard.png"), "the Storyboard");
  const { code, out } = await main(["build", metaPath], {
    env: { ...ENV, PATH: "" },
    renderer: standIn,
  });
  assert.equal(code, 2, out);
  assert.deepEqual(JSON.parse(out), { written: false, reason: NO_FFMPEG });
  // ffmpeg is looked for first: a file problem without it is the same reason, not a refusal.
  const zoneless = runFolder({
    videos: false,
    edit: (m) => ({ ...m, after: { ...m.after, startedAt: "10:04" } }),
  });
  const first = await main(["build", zoneless.metaPath], { env: { ...ENV, PATH: "" } });
  assert.equal(first.code, 2);
  assert.equal(JSON.parse(first.out).reason, NO_FFMPEG);
  assert.equal(readFileSync(join(dir, "s1-storyboard.png"), "utf8"), "the Storyboard");
  assert.equal(existsSync(join(dir, "s1.mp4")), false);
  // The row keeps its Storyboard, its note says why, and `report.mjs read` accepts it.
  const report = REPORT.replace(
    "EVIDENCE",
    "`qa-report-pr-7/s1-storyboard.png` `qa-report-pr-7/s1-web/step-03-a.png`",
  ).replace("NOTE", NO_FFMPEG);
  assert.deepEqual(readReport(report).problems, []);
});

test("without After's recording no MP4 is made, and a Before recording that is gone leaves After alone (#243 review)", async () => {
  // Stand-in recordings: they only need to be there until ffmpeg runs.
  const { dir, metaPath } = runFolder({ videos: false });
  const result = await main(["build", metaPath], { env: ENV, renderer: standIn });
  assert.equal(result.code, 2);
  assert.match(
    JSON.parse(result.out).reason,
    /^no MP4: no recording of Session A on After \(web\.mjs ran without --video, or its file is gone\)/,
  );
  writeFileSync(join(dir, "s1-web", "video-a.webm"), "");
  const loadedNow = loadScenario(metaPath);
  const laid = timeline(loadedNow.records, loadedNow.meta, loadedNow.raw, {
    recorded: (side, name) =>
      existsSync(join(dir, side === "Before" ? "s1-before-web" : "s1-web", name)),
  });
  assert.deepEqual(
    laid.sides.map((s) => s.side),
    ["After"],
  );
  assert.equal(laid.beforeNote, "Before: no recording of Session A");
});

test("a Before recording that is gone builds a one-sided MP4", { skip: NEEDS_FFMPEG }, async () => {
  const { dir, metaPath } = runFolder();
  rmSync(join(dir, "s1-before-web", "video-a.webm"));
  const { code, out } = await main(["build", metaPath], { env: ENV, renderer: standIn });
  assert.equal(code, 0, out);
  const summary = JSON.parse(out);
  assert.deepEqual(summary.sides, ["After"]);
  assert.equal(summary.note, "Before: no recording of Session A");
  assert.equal(probe(join(dir, "s1.mp4")).width, SIDE.width);
});

test("without Chromium no MP4 is made, and nothing is left behind (#243 review)", async () => {
  const { dir, metaPath } = runFolder({ videos: false });
  for (const side of ["s1-web", "s1-before-web"])
    writeFileSync(join(dir, side, "video-a.webm"), "");
  const empty = mkdtempSync(join(tmpdir(), "no-playwright-"));
  dirs.push(empty);
  const { code, out } = await main(["build", metaPath], { env: ENV, cwd: empty });
  assert.equal(code, 2, out);
  assert.deepEqual(JSON.parse(out), { written: false, reason: NO_CHROMIUM_MP4 });
  assert.equal(existsSync(join(dir, "s1.mp4")), false);
  assert.equal(existsSync(join(dir, ".s1.mp4.partial")), false);
});

test("usage errors exit 2", async () => {
  for (const argv of [
    [],
    ["render", "x.json"],
    ["build"],
    ["build", "x.json", "--out"],
    ["build", "x.json", "--out", "x.gif"],
  ])
    assert.equal((await main(argv, { env: ENV })).code, 2, argv.join(" "));
});

test("the build command is the one ADAPTER.md documents, with both pacing constants", () => {
  assert.ok(
    adapterDoc.includes('node "<skill>/mp4.mjs" build <s<n>-storyboard.json> [--out <file.mp4>]'),
  );
  assert.match(adapterDoc, new RegExp(`\`HOLD_SECONDS\`[^.]*${HOLD_SECONDS} s`));
  assert.match(adapterDoc, new RegExp(`\`BETWEEN_SPEED\`[^.]*${BETWEEN_SPEED}`));
  assert.ok(adapterDoc.includes("AGENT_KIT_REQUIRE_FFMPEG=1"));
});

// ── Building it with ffmpeg ──────────────────────────────────────────────────

test(
  "ffmpeg and ffprobe are on PATH when AGENT_KIT_REQUIRE_FFMPEG says they must be",
  { skip: !REQUIRE_FFMPEG },
  () => {
    assert.ok(FFMPEG, "AGENT_KIT_REQUIRE_FFMPEG=1, but no ffmpeg with ffprobe on PATH");
  },
);

test(
  "a fix scenario builds a two-sided MP4 whose length is its holds plus its slowed stretches",
  { skip: NEEDS_FFMPEG },
  async () => {
    const { dir, metaPath } = runFolder();
    const { code, out } = await main(["build", metaPath], { env: ENV, renderer: standIn });
    assert.equal(code, 0, out);
    const summary = JSON.parse(out);
    assert.deepEqual(summary.sides, ["Before", "After"]);
    const expected = 3 * HOLD_SECONDS + (1.5 + 0.7) / BETWEEN_SPEED;
    assert.equal(summary.seconds, expected);
    const video = probe(join(dir, "s1.mp4"));
    assert.ok(
      Math.abs(video.duration - expected) <= 0.15,
      `${video.duration} s, expected ${expected} s`,
    );
    assert.equal(video.width, 2 * SIDE.width);
    assert.equal(video.height, 152 + SIDE.height + 76);
    // The raw recordings stay where web.mjs left them; nothing else is left behind.
    assert.ok(existsSync(join(dir, "s1-web", "video-a.webm")));
    assert.equal(existsSync(join(dir, ".s1.mp4.partial")), false);
  },
);

test("a feature scenario builds a one-sided MP4", { skip: NEEDS_FFMPEG }, async () => {
  const { dir, metaPath } = runFolder({ scenario: "s2" });
  const { code, out } = await main(["build", metaPath], { env: ENV, renderer: standIn });
  assert.equal(code, 0, out);
  assert.deepEqual(JSON.parse(out).sides, ["After"]);
  const video = probe(join(dir, "s2.mp4"));
  assert.equal(video.width, SIDE.width);
  const expected = 2 * HOLD_SECONDS + 1.5 / BETWEEN_SPEED;
  assert.ok(
    Math.abs(video.duration - expected) <= 0.15,
    `${video.duration} s, expected ${expected} s`,
  );
});

test(
  "the MP4 is built again from the saved files, without running the scenario",
  { skip: NEEDS_FFMPEG },
  async () => {
    const { dir, metaPath } = runFolder({ scenario: "s2" });
    const out = join(dir, "again.mp4");
    assert.equal((await main(["build", metaPath], { env: ENV, renderer: standIn })).code, 0);
    const again = await main(["build", metaPath, "--out", out], { env: ENV, renderer: standIn });
    assert.equal(again.code, 0, again.out);
    assert.equal(probe(out).duration, probe(join(dir, "s2.mp4")).duration);
  },
);

test("an MP4 right after its Storyboard is accepted in the Evidence cell", () => {
  const report = REPORT.replace(
    "EVIDENCE",
    "`qa-report-pr-7/s1-storyboard.png` `qa-report-pr-7/s1.mp4` `qa-report-pr-7/s1-web/step-03-a.png`",
  ).replace("NOTE", "the members list showed Ada once");
  assert.deepEqual(readReport(report).problems, []);
});

test("the MP4 renders its band and captions in Chromium", { skip: NEEDS_BOTH }, async () => {
  const { dir, metaPath } = runFolder();
  assert.equal(
    (
      await storyboard(["render", metaPath], {
        env: ENV,
        cwd: ROOT,
        renderer: async () => plainPng(4, 4),
      })
    ).code,
    0,
  );
  const { code, out } = await main(["build", metaPath], { env: ENV, cwd: ROOT });
  assert.equal(code, 0, out);
  const video = probe(join(dir, "s1.mp4"));
  assert.equal(video.width, 2 * SIDE.width);
  assert.ok(video.height > SIDE.height + 100);
  assert.ok(existsSync(join(dir, "s1-storyboard.png")), "the Storyboard stays beside it");
});

const REPORT = `# QA Report: Profile names

**QA passed**

- **Plan:** \`qa-plan.md\`, subject #7, pull request #7, head \`4444444ddddddd5555555eeeeeee6666666fffff\`
- **Build check:** verified by \`gh\`
- **Run:** \`stack\`; \`web\` by \`web.mjs\`, on 2026-11-16 10:04
- **Before:** at merge-base \`1111111aaaaaaa2222222bbbbbbb3333333ccccc\`, on the same QA Stack before the head run, for S1
- **Accounts:** admin
- **Scenario accounts:** none
- **Teardown:** \`down\` run, for the Before stack and the head stack

## Results

| Scenario | Result | Before | Evidence | Notes |
| --- | --- | --- | --- | --- |
| S1: Saving a profile | PASS | matched: the list showed Ada twice | EVIDENCE | NOTE |

## Follow-ups

None.

## Execution record

- S1: PASS, head \`4444444\`, 2026-11-16
`;
