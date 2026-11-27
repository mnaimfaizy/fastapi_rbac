// The annotated MP4: one video per PASS or FAIL `web` scenario with
// `Capture: video` that stands alone, next to its Storyboard (SKILL.md step 6,
// ADAPTER.md "The MP4", DESIGN.md "One file that stands alone").
//
// WHAT IT DOES
//   Builds `s<n>.mp4` from what a run saved: the Storyboard's scenario file
//   (`s<n>-storyboard.json`), the step files and the per-Session `webm`
//   recordings `web.mjs --video` wrote. Nothing is run again, so the MP4 can be
//   built again at any time from the same files.
//
//   - The steps play in order across Sessions, split into Scenes at each Cut,
//     where the story moves to another Session; both sides cut to that
//     Session there, full frame. A role's Session (or a signed-out one) first
//     plays from its recording's start, so its sign-in is on camera (ADR
//     0020); a Scenario account's, or one whose `kind` is not given, from its
//     first step. A later Scene plays from the previous step's time.
//     `proves` only sets the highlight.
//   - Each Scene opens on its Title card, held for `TITLE_SECONDS`: one centred
//     bold sentence, the scenario file's `story` sentence for that Scene, full
//     frame across both sides under the band (with no Story, the card names
//     the Scene and its Session).
//   - Before beside After when Before has a recording of a Session shown, a
//     Scene whose Session it lacks showing the no-recording frame on Before;
//     After alone otherwise (a feature scenario, a Before not run or not
//     observed, or no recording of any Session shown).
//   - Each side holds on each step's frame for `HOLD_SECONDS`, and plays the
//     stretch between two steps at `BETWEEN_SPEED`; the side whose stretch is
//     shorter waits on its step's frame, so both sides reach each step together.
//   - Overlaid: the Storyboard's band across the top, and under each side the
//     step's caption with a timing line beneath it (the wall-clock time with its
//     zone, in whole seconds, the time since the side started, and on After its
//     difference from Before). The band and captions are images from the Storyboard's renderer;
//     ffmpeg only scales, pads, stacks and joins them.
//   - The caption privacy check runs first, over everything the Storyboard
//     shows and every text the MP4 adds: on a refusal nothing is written, each
//     field is named (never its value), and it is kept as `[withheld]` in the
//     file it came from, as the Storyboard does.
//
//   ffmpeg and ffprobe are found on `PATH`, Playwright is the repository's own
//   (from `run.playwright` or `--playwright-dir`, else the root);
//   Agent-kit takes no dependency on either. The raw `webm` recordings stay in
//   `working_dir`, and are never the row's evidence.
//
// CLI (run from the repository root)
//   node mp4.mjs build <s<n>-storyboard.json> [--out <file.mp4>] [--playwright-dir <dir>]
//
//   Exit 0: the MP4 was written. Exit 1: refused (the privacy check, a problem
//   in the files, a variable not given); no MP4 written.
//   Exit 2: usage, no ffmpeg or ffprobe on `PATH`, no Playwright with Chromium,
//   no recording of a Session on After, or ffmpeg did not build it: no MP4, the row
//   keeps its Storyboard, and `reason` is what its note says. Stdout is a JSON
//   summary.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { onPath, resolvePlaywright } from "./adapter.mjs";
import {
  NO_CHROMIUM,
  bandHtml,
  escapeHtml,
  knownFromEnv,
  layout,
  loadScenario,
  pageHtml,
  privacyCheck,
  renderPages,
  sceneName,
  scenesOf,
  shownFields,
  storyOf,
  withholdRefused,
} from "./storyboard.mjs";

/** How long each side holds on each step's frame, in seconds of the MP4. */
export const HOLD_SECONDS = 2;
/** How long each Scene's Title card is held before it, in seconds of the MP4. */
export const TITLE_SECONDS = 2;
/** The speed each side plays at between two steps: 0.5 is half speed. */
export const BETWEEN_SPEED = 0.5;
/** Frames per second of the MP4; every piece is a whole number of frames. */
export const FPS = 25;
/** The size each side's recording is scaled to: the 1280×720 viewport at three quarters. */
export const SIDE = Object.freeze({ width: 960, height: 540 });

export const NO_FFMPEG = "no MP4: no ffmpeg with ffprobe on PATH; the row keeps its Storyboard";
export const NO_CHROMIUM_MP4 =
  "no MP4: no Playwright with Chromium in this repository, so no band or captions to overlay";

const SCENARIO = /^S\d+$/;
/** The recording names `web.mjs` writes: a plain file name, so nothing outside its folder is read. */
const VIDEO_NAME = /^video-[a-z]\.webm$/;
/** A start time with its zone: ISO 8601, to the millisecond at most, `Z` or an offset. */
const STARTED_AT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/;
const BEFORE_UNSEEN = ["not run", "not observed"];

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
/** Seconds rounded to whole frames. */
const frames = (seconds) => Math.round(seconds * FPS) / FPS;
const tenths = (ms) => (ms / 1000).toFixed(1);

// ── The timing line ─────────────────────────────────────────────────────────

/**
 * A wall-clock time in a start time's own zone, to the second: `10:04:15 UTC+11:00`.
 * Whole seconds only: `startedAt` is the runner's note of when it started
 * `web.mjs`, which counts `atMs` from its own start a moment later, so the
 * wall clock is as close as that start-up and no closer. The time since the
 * side started and the difference from Before are exact. The machine's zone
 * plays no part.
 * @param {string} startedAt ISO 8601 with `Z` or an offset
 * @param {number} atMs milliseconds after it
 */
export function wallClock(startedAt, atMs) {
  const zone = /(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(startedAt);
  if (!zone || !STARTED_AT.test(startedAt)) throw new Error(`not a start time: ${startedAt}`);
  const offsetMin = zone[1] ? (zone[1] === "-" ? -1 : 1) * (+zone[2] * 60 + +zone[3]) : 0;
  const local = Math.floor((Date.parse(startedAt) + atMs + offsetMin * 60_000) / 1000) * 1000;
  const d = new Date(local);
  const two = (n) => String(n).padStart(2, "0");
  const clock = `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}`;
  return `${clock} ${offsetMin === 0 ? "UTC" : `UTC${zone[1]}${zone[2]}:${zone[3]}`}`;
}

/**
 * The line under a step's caption: its wall-clock time with the zone, the time
 * since its side started (`atMs`, which `web.mjs` counts from its own start),
 * and on After its difference from Before's same step: `After +1.3 s`.
 * @param {{side: "Before" | "After", startedAt: string, atMs: number, beforeAtMs?: number | null}} step
 */
export function timingLine({ side, startedAt, atMs, beforeAtMs = null }) {
  const parts = [wallClock(startedAt, atMs), `${tenths(atMs)} s since ${side} started`];
  if (side === "After" && Number.isFinite(beforeAtMs)) {
    const ms = atMs - /** @type {number} */ (beforeAtMs);
    // Rounded half away from zero, so a lead and a lag of the same size read the same.
    const diff = Math.round(Math.abs(ms) / 100);
    parts.push(`After ${ms < 0 && diff ? "-" : "+"}${(diff / 10).toFixed(1)} s`);
  }
  return parts.join(" · ");
}

// ── The timeline ────────────────────────────────────────────────────────────

/** Whether a piece is a Scene's Title card, which spans both sides. */
const isCard = (piece) => piece.kind === "title";
/** The pieces that play a step, in order: each side has one caption per piece. */
const stepPiecesOf = (pieces) => pieces.filter((piece) => !isCard(piece));

/** A side's recording of a Session, by the name `web.mjs` gives it, or null. */
function videoOf(file, session) {
  const name = file?.sessions?.[session]?.video;
  return typeof name === "string" && VIDEO_NAME.test(name) ? name : null;
}

/** When a side's recording of a Session began, in `atMs` terms: 0 when not given. */
function startOf(file, session) {
  const ms = file?.sessions?.[session]?.startedAtMs;
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Whether Before plays beside After, and why not: Before ran and has a
 * recording of at least one Session shown, named in its step file and, by
 * `recorded`, there on disk. `missing` lists the Sessions it has none of.
 * @param {(side: "Before" | "After", name: string) => boolean} recorded
 * @returns {{two: boolean, note: string | null, missing: Set<string>}}
 */
function beforePlays(meta, raw, sessions, recorded) {
  const before = isObject(meta.before) ? meta.before : null;
  const none = (note) => ({ two: false, note, missing: new Set(sessions) });
  if (!before) return none("Before: not run, a feature scenario runs After only");
  if (BEFORE_UNSEEN.includes(before.state))
    return none(`Before ${before.state}: ${before.observed}`);
  const missing = new Set(
    sessions.filter((session) => {
      const name = videoOf(raw.before, session);
      return !name || !recorded("Before", name);
    }),
  );
  if (missing.size < sessions.length) return { two: true, note: null, missing };
  return none(
    `Before: no recording of Session${sessions.length > 1 ? "s" : ""} ${sessions.join(", ")}`,
  );
}

/** The Sessions After's steps show, in the order they first appear. */
const sessionsOf = (records) => [...new Set(records.after.map((r) => r.session))];

/**
 * Whether a Session's first Scene opens on its recording's start: a role's
 * or a signed-out Session's does, so its sign-in plays (ADR 0020). A
 * Scenario account's, or one the run context does not say, opens on its
 * first step: its values never go into the evidence.
 */
function opensAtStart(meta, session) {
  const sessions = isObject(meta.context) ? meta.context.sessions : null;
  const entry = Array.isArray(sessions) ? sessions.find((s) => s?.session === session) : null;
  return entry?.kind === "role" || entry?.kind === "nobody";
}

/**
 * What the MP4 shows, from the saved files: pure data, so it is tested
 * without ffmpeg and is the same on every re-build.
 *
 * The steps play in After's order across Sessions, split into Scenes at each
 * Cut; each side cuts to the Scene's Session there, so Before and After
 * Cut together, paired by index and Session. A step's time in its recording
 * is its `atMs` less its Session's `startedAtMs`. Each Scene plays its
 * Session's recording from a window's start to each of its steps in turn,
 * the stretch at `BETWEEN_SPEED`, then held for `HOLD_SECONDS`; a stretch
 * lasts as long as the longer side's, the shorter side waiting on its step's
 * frame. A Session's first Scene starts at its recording's start for a role
 * or a signed-out Session (a role's sign-in plays), and at its first step for
 * a Scenario account or one whose `kind` is not given; a later
 * Scene starts at the previous step's time, so the Session's idle time while
 * another acted is not replayed. Nothing of a Session plays before its first
 * Scene. `proves` only says which step is highlighted. Each Scene opens on its
 * Title card, held for `TITLE_SECONDS`, full frame across both sides.
 *
 * @param {{after: any[], before: any[] | null}} records
 * @param {any} meta the scenario file
 * @param {{after: any, before: any}} raw the step files as read (their `sessions`)
 * @param {{recorded?: (side: "Before" | "After", name: string) => boolean}} [options]
 *   whether a side's recording is on disk (`main` looks; every recording counts as there by default)
 * @returns {{sessions: string[], scenes: Scene[], sides: Side[], beforeNote: string | null,
 *   pieces: {kind: "title" | "hold" | "between", index: number, session: string, scene: number, seconds: number}[],
 *   seconds: number}}
 *   `pieces`: each Scene's Title card (`TITLE_SECONDS`, its `index` the Scene's first step), then
 *   each of its steps' stretch and hold; `seconds` is their sum, the cards included
 *
 * @typedef {{number: number, session: string, steps: number[], title: string, beforeNote: string | null}} Scene
 *   `title`: its Title card's sentence, the scenario file's `story` sentence for it, or, with
 *   none, `Scene <n> of <N>, Session <X>`;
 *   `beforeNote`: why Before shows the no-recording frame in this Scene, or null
 * @typedef {{side: "Before" | "After", startedAt: string, videos: Record<string, string>,
 *   steps: {index: number, session: string, scene: number, recorded: boolean, caption: string,
 *     atMs: number | null, at: number, from: number}[],
 *   overlays: {field: string, heading: string, caption: string, timing: string, proves: boolean}[]}} Side
 *   `at`: the step's time in its Session's recording, in seconds; `from`: where its stretch starts;
 *   `recorded`: whether this side plays the Session's recording here (else the no-recording frame)
 */
export function timeline(records, meta, raw, { recorded = () => true } = {}) {
  const afterSteps = records.after;
  if (!afterSteps.length) throw new Error("After has no steps to show");
  const sessions = sessionsOf(records);
  const plays = beforePlays(meta, raw, sessions, recorded);
  const story = storyOf(meta);
  const scenes = scenesOf(afterSteps).map((scene, _, all) => ({
    ...scene,
    // The Scene's Story sentence; a scenario file with none names the Scene and its Session.
    title: story[scene.number - 1] ?? sceneName(scene, all.length),
    beforeNote:
      plays.two && plays.missing.has(scene.session)
        ? `Before: no recording of Session ${scene.session}`
        : null,
  }));
  const sceneOf = new Map(
    scenes.flatMap((scene) => scene.steps.map((i) => [`${scene.session}:${i}`, scene])),
  );
  const key = (r) => `${r.session}:${r.index}`;
  const afterBy = new Map(afterSteps.map((r) => [key(r), r]));
  const last = afterSteps.at(-1);
  const proves = meta.proves ?? { session: last.session, index: last.index };
  const proving = (a) => a.session === proves.session && a.index === proves.index;
  const before = isObject(meta.before) ? meta.before : null;
  const beforeBy = new Map((plays.two ? (records.before ?? []) : []).map((r) => [key(r), r]));
  const n = afterSteps.length;

  const side = (name, file, startedAt, pick, has) => {
    const time = (record) => (record.atMs - startOf(file, record.session)) / 1000;
    /** Each Session's place in its recording, once its first Scene has started. */
    const place = new Map();
    /** The last step this side reached, in any Session: its index and `atMs`. */
    let reachedLast = null;
    const steps = afterSteps.map((a, k) => {
      const scene = /** @type {Scene} */ (sceneOf.get(key(a)));
      const record = pick(a);
      const first = !place.has(a.session);
      let from;
      if (first) {
        // A role's first Scene from its recording's start; a Scenario account's at its
        // first step this side reached, so no stretch before it plays its sign-in.
        const reached = scene.steps
          .map((index) => pick(afterBy.get(`${a.session}:${index}`)))
          .find(Boolean);
        const start = startOf(file, a.session);
        from = opensAtStart(meta, a.session)
          ? 0
          : Math.max(reached ? time(reached) : ((reachedLast?.atMs ?? start) - start) / 1000, 0);
      } else {
        from = /** @type {number} */ (place.get(a.session));
        // A later Scene from the previous step's time, never back past where the Session was.
        if (scene.steps[0] === a.index && reachedLast)
          from = Math.max((reachedLast.atMs - startOf(file, a.session)) / 1000, from);
      }
      // A step this side lacks takes no time: it waits where it was.
      const at = record ? Math.max(time(record), from) : from;
      place.set(a.session, at);
      const prev = reachedLast;
      if (record) reachedLast = { index: a.index, atMs: record.atMs };
      return {
        index: a.index,
        session: a.session,
        scene: scene.number,
        recorded: has(a.session),
        caption: record ? record.caption : `No ${name} step ${a.index}`,
        atMs: record ? record.atMs : null,
        at,
        from,
        // Where its stretch starts, for its line: the recording's start, or the last step
        // reached. A first step that does not open at the start has no stretch, so no line.
        fromStart: first && opensAtStart(meta, a.session),
        prev,
      };
    });
    const videos = Object.fromEntries(
      sessions.filter(has).map((s) => [s, /** @type {string} */ (videoOf(file, s))]),
    );
    return { side: name, file, startedAt, videos, steps };
  };

  const sidesRaw = [
    ...(plays.two
      ? [
          side(
            "Before",
            raw.before,
            before.startedAt,
            (a) => beforeBy.get(key(a)),
            (s) => !plays.missing.has(s),
          ),
        ]
      : []),
    side(
      "After",
      raw.after,
      meta.after.startedAt,
      (a) => a,
      () => true,
    ),
  ];

  const pieces = [];
  afterSteps.forEach((a, k) => {
    const stretch = Math.max(
      ...sidesRaw.map((s) => (s.steps[k].recorded ? s.steps[k].at - s.steps[k].from : 0)),
    );
    const scene = sceneOf.get(key(a)).number;
    // Each Scene opens on its Title card, before its first step's stretch.
    if (sceneOf.get(key(a)).steps[0] === a.index)
      pieces.push({
        kind: "title",
        index: a.index,
        session: a.session,
        scene,
        seconds: frames(TITLE_SECONDS),
      });
    const seconds = frames(stretch / BETWEEN_SPEED);
    if (seconds > 0)
      pieces.push({ kind: "between", index: a.index, session: a.session, scene, seconds });
    pieces.push({
      kind: "hold",
      index: a.index,
      session: a.session,
      scene,
      seconds: frames(HOLD_SECONDS),
    });
  });

  const sides = sidesRaw.map(({ side: name, file, startedAt, videos, steps }) => {
    // A Title card spans both sides, so each side's overlays are its steps' pieces only.
    const overlays = stepPiecesOf(pieces).map((piece) => {
      const k = afterSteps.findIndex((a) => a.index === piece.index && a.session === piece.session);
      const s = steps[k];
      const where = `${name} step ${s.index} (${s.session})`;
      const heading = `${name} · ${piece.kind === "between" ? "on to " : ""}step ${s.index} of ${n}, Session ${s.session}`;
      const unrecorded = `no recording of Session ${s.session} on ${name}`;
      if (piece.kind === "between") {
        const fromLabel = s.fromStart
          ? `the start of Session ${s.session}'s recording (${tenths(startOf(file, s.session))} s)`
          : s.prev
            ? `step ${s.prev.index} (${tenths(s.prev.atMs)} s)`
            : `step ${s.index}'s own time`;
        return {
          field: `${where}: MP4 lead-in`,
          heading,
          caption: s.caption,
          timing: !s.recorded
            ? unrecorded
            : `played at ${BETWEEN_SPEED}× speed from ${fromLabel}` +
              (s.atMs !== null
                ? ` to step ${s.index} (${tenths(s.atMs)} s since ${name} started)`
                : ""),
          proves: false,
        };
      }
      const paired = beforeBy.get(key(afterSteps[k]));
      return {
        field: `${where}: MP4 timing line`,
        heading,
        caption: s.caption,
        timing: !s.recorded
          ? unrecorded
          : s.atMs === null
            ? "not reached on this side"
            : timingLine({
                side: name,
                startedAt,
                atMs: s.atMs,
                beforeAtMs: name === "After" && paired ? paired.atMs : null,
              }),
        proves: proving(afterSteps[k]),
      };
    });
    return {
      side: name,
      startedAt,
      videos,
      steps: steps.map(({ fromStart, prev, ...s }) => s),
      overlays,
    };
  });
  const seconds = frames(pieces.reduce((sum, p) => sum + p.seconds, 0));
  return { sessions, scenes, sides, beforeNote: plays.note, pieces, seconds };
}

/**
 * The texts the MP4 adds over what the Storyboard shows: each Title card's
 * sentence, each overlay's heading and timing line, and each note on Before.
 * Its captions are the step records', and its Story sentences the scenario
 * file's, which the Storyboard's fields already hold.
 * @param {ReturnType<typeof timeline>} laid
 */
export function overlayFields(laid) {
  const fields = laid.sides.flatMap((s) =>
    s.overlays.flatMap((o) => [
      { field: `${o.field} (heading)`, text: o.heading },
      { field: o.field, text: o.timing },
    ]),
  );
  for (const scene of laid.scenes)
    fields.push({ field: `MP4 Title card, Scene ${scene.number}`, text: scene.title });
  if (laid.beforeNote) fields.push({ field: "MP4 Before note", text: laid.beforeNote });
  for (const scene of laid.scenes)
    if (scene.beforeNote)
      fields.push({ field: `MP4 Before note, Scene ${scene.number}`, text: scene.beforeNote });
  return fields;
}

/** The notes on Before the summary gives: the one for the MP4, or each Scene's. */
function notesOf(laid) {
  if (laid.beforeNote) return laid.beforeNote;
  const each = laid.scenes.filter((scene) => scene.beforeNote);
  return each.length
    ? each.map((scene) => `Scene ${scene.number}: ${scene.beforeNote}`).join("; ")
    : null;
}

// ── Overlay pages ───────────────────────────────────────────────────────────

/**
 * The pages each overlay image is rendered from, in the Storyboard's style:
 * the band for each Scene, with its note on Before; each side's caption for
 * each step's piece; on Before the no-recording frame for each Scene it lacks;
 * and each Scene's Title card, full frame across both sides, one centred bold
 * sentence.
 * @returns {{kind: "band" | "caption" | "frame" | "title", scene?: number, html: string, width: number, height: number}[]}
 */
export function overlayPages(laid, meta, records) {
  const width = SIDE.width * laid.sides.length;
  const failed = meta.result.startsWith("FAIL");
  const style = { cellWidth: SIDE.width - 32, failed };
  const band = layout(records, meta).band;
  const noteHtml = (note) =>
    note
      ? `<div class="meta" style="padding:0 24px 12px;margin:0;background:#f6f7f9">${escapeHtml(note)}</div>`
      : "";
  const pages = laid.scenes.map((scene) => ({
    kind: /** @type {const} */ ("band"),
    scene: scene.number,
    html: pageHtml(`${bandHtml(band)}${noteHtml(laid.beforeNote ?? scene.beforeNote)}`, {
      pageWidth: width,
      ...style,
    }),
    width,
    height: 1,
  }));
  for (const s of laid.sides)
    for (const o of s.overlays)
      pages.push({
        kind: "caption",
        width: SIDE.width,
        height: 1,
        html: pageHtml(
          `<div${o.proves ? ' class="row proves"' : ""} style="display:block;padding:8px 16px 12px">` +
            `<div class="meta" style="margin:0;font-weight:600">${escapeHtml(o.heading)}</div>` +
            `<div class="caption" style="font-size:16px">${escapeHtml(o.caption)}</div>` +
            `<div class="meta" style="margin-top:2px">${escapeHtml(o.timing)}</div>` +
            (o.proves ? `<div class="proves-label">Proves the result</div>` : "") +
            `</div>`,
          { pageWidth: SIDE.width, ...style },
        ),
      });
  for (const scene of laid.scenes)
    if (scene.beforeNote)
      pages.push({
        kind: "frame",
        scene: scene.number,
        width: SIDE.width,
        height: SIDE.height,
        html: pageHtml(
          `<div class="frame empty" style="width:${SIDE.width}px;height:${SIDE.height}px">${escapeHtml(scene.beforeNote)}</div>`,
          { pageWidth: SIDE.width, ...style },
        ),
      });
  for (const scene of laid.scenes)
    pages.push({
      kind: "title",
      scene: scene.number,
      width,
      height: SIDE.height,
      html: pageHtml(
        `<div class="title-card" style="width:${width}px;height:${SIDE.height}px">${escapeHtml(scene.title)}</div>`,
        { pageWidth: width, ...style },
      ),
    });
  return pages;
}

/** A PNG's width and height, from its IHDR chunk. @param {Buffer} png */
function pngSize(png) {
  if (png.subarray(1, 4).toString() !== "PNG") throw new Error("an overlay is not a PNG");
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

const even = (n) => Math.ceil(n / 2) * 2;

// ── ffmpeg ──────────────────────────────────────────────────────────────────

/**
 * The ffmpeg arguments that build the MP4: pure, from the timeline, each
 * recording's length, and the overlay images already rendered. Each Scene is
 * its Title card, full frame across both sides, then the sides, each its
 * recording above its captions; the band runs across the top throughout.
 * @param {ReturnType<typeof timeline>} laid
 * @param {{videos: Record<string, string>[], durations: Record<string, number>[],
 *   bands: {file: string, height: number}[], captions: {file: string, height: number}[][],
 *   titles: {file: string}[], frames: Record<number, {file: string}>, encoder: string, out: string}} files
 *   `videos` and `durations` are per side, in `laid.sides` order, by Session; `bands` and
 *   `titles` per Scene; `captions` per side and step's piece; `frames` Before's no-recording
 *   frame, by Scene number
 */
export function ffmpegArgs(
  laid,
  { videos, durations, bands, captions, titles, frames: shown, encoder, out },
) {
  const width = SIDE.width * laid.sides.length;
  const captionHeight = even(Math.max(...captions.flat().map((c) => c.height)));
  const bandHeight = even(Math.max(...bands.map((b) => b.height)));
  const sidesHeight = SIDE.height + captionHeight;
  const args = ["-hide_banner", "-loglevel", "error", "-y"];
  const filters = [];
  let input = 0;
  const image = (file, seconds) => {
    args.push("-loop", "1", "-framerate", String(FPS), "-t", seconds.toFixed(3), "-i", file);
    return input++;
  };
  const still = (pad, h) =>
    `fps=${FPS},scale=${pad}:-1,pad=${pad}:${h}:0:0:white,setsar=1,format=yuv420p`;
  /** A Scene's length: its card and its steps, or its steps alone. */
  const sceneSeconds = (number, card = false) =>
    frames(
      laid.pieces
        .filter((p) => p.scene === number && (card || !isCard(p)))
        .reduce((sum, p) => sum + p.seconds, 0),
    );
  /** The steps' pieces, in order: each side's captions are one per piece. */
  const stepPieces = stepPiecesOf(laid.pieces);

  // The band: one image per Scene, each with that Scene's note on Before, over its card too.
  const bandParts = laid.scenes.map((scene, j) => {
    const seconds = sceneSeconds(scene.number, true);
    const at = image(bands[j].file, seconds);
    filters.push(
      `[${at}:v]${still(width, bandHeight)},trim=duration=${seconds},setpts=PTS-STARTPTS[b${j}]`,
    );
    return `[b${j}]`;
  });
  filters.push(`${bandParts.join("")}concat=n=${bandParts.length}:v=1:a=0[band]`);

  const parts = [];
  laid.scenes.forEach((scene, j) => {
    // The Title card: one image across both sides, centred in the sides' height.
    const card = /** @type {{seconds: number}} */ (
      laid.pieces.find((p) => isCard(p) && p.scene === scene.number)
    ).seconds;
    const at = image(titles[j].file, card);
    filters.push(
      `[${at}:v]fps=${FPS},scale=${width}:${sidesHeight}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${sidesHeight}:(ow-iw)/2:(oh-ih)/2:white,setsar=1,format=yuv420p,` +
        `trim=duration=${card},setpts=PTS-STARTPTS[t${j}]`,
    );
    parts.push(`[t${j}]`);

    laid.sides.forEach((s, i) => {
      const tag = `s${i}`;
      const chunks = [];
      const first = s.steps.findIndex((step) => step.scene === scene.number);
      if (!s.steps[first].recorded) {
        // No recording of the Scene's Session on this side: its frame, for the whole Scene.
        const seconds = sceneSeconds(scene.number);
        const at = image(shown[scene.number].file, seconds);
        filters.push(
          `[${at}:v]fps=${FPS},scale=${SIDE.width}:${SIDE.height}:force_original_aspect_ratio=decrease,` +
            `pad=${SIDE.width}:${SIDE.height}:0:0:white,setsar=1,format=yuv420p,` +
            `trim=duration=${seconds},setpts=PTS-STARTPTS[${tag}f${scene.number}]`,
        );
        chunks.push(`[${tag}f${scene.number}]`);
      } else {
        const video = videos[i][scene.session];
        const last = Math.max(durations[i][scene.session] - 2 / FPS, 0);
        const clamp = (t) => Math.min(Math.max(t, 0), last);
        // The recording: one piece per step, its stretch with its hold, each its own input.
        s.steps.forEach((step, k) => {
          if (step.scene !== scene.number) return;
          const between = laid.pieces.find(
            (p) => p.kind === "between" && p.index === step.index && p.session === step.session,
          );
          const seconds = frames((between?.seconds ?? 0) + HOLD_SECONDS);
          const from = clamp(step.from);
          const length = Math.max(clamp(step.at) - from, 2 / FPS);
          args.push("-ss", from.toFixed(3), "-t", length.toFixed(3), "-i", video);
          const at = input++;
          filters.push(
            `[${at}:v]setpts=(PTS-STARTPTS)/${BETWEEN_SPEED},fps=${FPS},` +
              `scale=${SIDE.width}:${SIDE.height},setsar=1,format=yuv420p,` +
              `tpad=stop_mode=clone:stop_duration=${seconds},trim=duration=${seconds},setpts=PTS-STARTPTS[${tag}r${k}]`,
          );
          chunks.push(`[${tag}r${k}]`);
        });
      }
      filters.push(`${chunks.join("")}concat=n=${chunks.length}:v=1:a=0[${tag}v${j}]`);
      // The captions: one image per step's piece of this Scene, in the pieces' order.
      const captionParts = [];
      stepPieces.forEach((piece, m) => {
        if (piece.scene !== scene.number) return;
        const at = image(captions[i][m].file, piece.seconds);
        filters.push(
          `[${at}:v]${still(SIDE.width, captionHeight)},trim=duration=${piece.seconds},setpts=PTS-STARTPTS[${tag}c${m}]`,
        );
        captionParts.push(`[${tag}c${m}]`);
      });
      filters.push(`${captionParts.join("")}concat=n=${captionParts.length}:v=1:a=0[${tag}k${j}]`);
      filters.push(`[${tag}v${j}][${tag}k${j}]vstack=inputs=2[${tag}y${j}]`);
    });
    const sides = laid.sides.map((_, i) => `[s${i}y${j}]`).join("");
    filters.push(
      laid.sides.length === 2 ? `${sides}hstack=inputs=2[x${j}]` : `${sides}null[x${j}]`,
    );
    parts.push(`[x${j}]`);
  });
  filters.push(
    `${parts.join("")}concat=n=${parts.length}:v=1:a=0[sides]`,
    `[band][sides]vstack=inputs=2,format=yuv420p[out]`,
  );
  args.push("-filter_complex", filters.join(";"), "-map", "[out]", "-an", "-r", String(FPS));
  args.push(
    ...(encoder === "libx264"
      ? ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23"]
      : ["-c:v", "mpeg4", "-q:v", "4"]),
  );
  args.push("-pix_fmt", "yuv420p", "-movflags", "+faststart", "-f", "mp4", out);
  return args;
}

/** A recording's length in seconds, from ffprobe: the container's, else its last frame's time. */
function probeSeconds(run, file) {
  const format = run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    file,
  ]);
  const seconds = Number.parseFloat(format.stdout);
  if (format.status === 0 && Number.isFinite(seconds) && seconds > 0) return seconds;
  const packets = run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "packet=pts_time",
    "-of",
    "csv=p=0",
    file,
  ]);
  const times = String(packets.stdout).split(/\s+/).map(Number.parseFloat).filter(Number.isFinite);
  if (packets.status !== 0 || !times.length)
    throw new Error(`ffprobe could not read ${basename(file)}`);
  return Math.max(...times);
}

const spawn = (command, args) => {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return {
    status: result.error ? -1 : result.status,
    stdout: result.stdout ?? "",
    stderr: result.error ? String(result.error.message) : (result.stderr ?? ""),
  };
};

// ── The scenario file's start times ─────────────────────────────────────────

/** Problems with the start times the timing line reads, each naming its field. */
function checkStartTimes(meta, two) {
  const problems = [];
  const check = (value, where) => {
    if (typeof value !== "string" || !STARTED_AT.test(value) || Number.isNaN(Date.parse(value)))
      problems.push(
        `${where} is not the time ${where.split(".")[0]}'s web.mjs run started, ISO 8601 with its zone ` +
          "(2026-11-16T10:04:12.000+11:00, or Z): the MP4's timing line needs it",
      );
  };
  check(meta.after?.startedAt, "after.startedAt");
  if (two) check(meta.before?.startedAt, "before.startedAt");
  return problems;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const USAGE =
  "usage: node mp4.mjs build <s<n>-storyboard.json> [--out <file.mp4>] [--playwright-dir <dir>]\n";

/**
 * @param {string[]} argv the arguments after the script
 * @param {{env?: Record<string, string | undefined>, cwd?: string,
 *   renderer?: (pages: {html: string, width: number, height?: number}[]) => Promise<Buffer[]>,
 *   run?: (command: string, args: string[]) => {status: number | null, stdout: string, stderr: string}}} [io]
 *   `renderer` turns overlay pages into PNG bytes (a seam for tests; Chromium's by default);
 *   `run` runs ffmpeg and ffprobe (found on `env.PATH`)
 * @returns {Promise<{code: number, out: string}>}
 */
export async function main(argv, io = {}) {
  const usage = { code: 2, out: USAGE };
  const [command, target, ...rest] = argv;
  if (command !== "build" || target === undefined || target.startsWith("--")) return usage;
  let out;
  let playwrightDir;
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === "--out" && rest[i + 1] !== undefined && out === undefined) out = rest[++i];
    else if (
      rest[i] === "--playwright-dir" &&
      rest[i + 1] !== undefined &&
      playwrightDir === undefined
    )
      playwrightDir = rest[++i];
    else return usage;
  }
  if (out !== undefined && !out.endsWith(".mp4")) return usage;
  const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
  const env = io.env ?? process.env;
  const run = io.run ?? spawn;

  const loaded = loadScenario(target);
  const { meta, records } = loaded;
  // Known before any check, so every refusal removes an older MP4 at its path:
  // one left from an earlier run would show what this run no longer says.
  const named = typeof meta?.scenario === "string" && SCENARIO.test(meta.scenario);
  const mp4 =
    out !== undefined || named
      ? resolve(out ?? join(dirname(resolve(target)), `${meta.scenario.toLowerCase()}.mp4`))
      : null;
  const none = (code, body) => {
    if (mp4) rmSync(mp4, { force: true });
    return { code, out: json({ written: false, ...body }) };
  };
  // Without ffmpeg there is no MP4 to check or refuse: the row keeps its Storyboard.
  if (!onPath("ffmpeg", env) || !onPath("ffprobe", env)) return none(2, { reason: NO_FFMPEG });
  if (loaded.problems.length) return none(1, { problems: loaded.problems });
  const unset = (meta.variables ?? []).filter((name) => !env[name]);
  if (unset.length)
    return none(1, {
      problems: unset.map(
        (name) => `${name} is not set: give each variable the run used as this command's own`,
      ),
    });

  const dirs = { Before: loaded.records.beforeDir, After: loaded.records.afterDir };
  const recorded = (side, name) => Boolean(dirs[side]) && existsSync(join(dirs[side], name));
  const { two } = beforePlays(meta, loaded.raw, sessionsOf(records), recorded);
  const times = checkStartTimes(meta, two);
  if (times.length) return none(1, { problems: times });
  let laid;
  try {
    layout(records, meta); // the Storyboard's own checks: `proves` names an After step
    laid = timeline(records, meta, loaded.raw, { recorded });
  } catch (error) {
    return none(1, { problems: [String(error.message)] });
  }

  // The privacy check comes before anything is drawn: the Storyboard's fields, and the MP4's own.
  const fields = shownFields(records, meta);
  const refused = privacyCheck(
    [...fields, ...overlayFields(laid)],
    knownFromEnv(env, meta.variables),
  );
  if (refused.length) {
    withholdRefused(loaded, fields, refused);
    return none(1, { refused });
  }

  // Before plays a Session only with its recording there, so only After can lack one here.
  const after = /** @type {Side} */ (laid.sides.at(-1));
  const lacking = laid.sessions.find(
    (session) => !after.videos[session] || !existsSync(join(dirs.After, after.videos[session])),
  );
  if (lacking)
    return none(2, {
      reason:
        `no MP4: no recording of Session ${lacking} on After ` +
        "(web.mjs ran without --video, or its file is gone); the row keeps its Storyboard",
    });
  const videos = laid.sides.map((s) =>
    Object.fromEntries(
      Object.entries(s.videos).map(([session, name]) => [session, join(dirs[s.side], name)]),
    ),
  );

  let renderer = io.renderer;
  if (!renderer) {
    const resolved = resolvePlaywright(io.cwd ?? process.cwd(), playwrightDir);
    if (resolved.error) return none(2, { reason: resolved.error });
    const found = resolved.found;
    if (!found.chromium) return none(2, { reason: NO_CHROMIUM_MP4 });
    renderer = (pages) => renderPages(pages, { playwright: found.module });
  }

  const work = mkdtempSync(join(tmpdir(), "qa-mp4-"));
  // Built beside its place, then moved in, so a failed build leaves nothing behind.
  const partial = join(
    dirname(/** @type {string} */ (mp4)),
    `.${basename(/** @type {string} */ (mp4))}.partial`,
  );
  const failed = (why) => {
    rmSync(partial, { force: true });
    return none(2, { reason: `no MP4: ${why}; the row keeps its Storyboard` });
  };
  try {
    const durations = videos.map((bySession) =>
      Object.fromEntries(
        Object.entries(bySession).map(([session, file]) => [session, probeSeconds(run, file)]),
      ),
    );
    const pages = overlayPages(laid, meta, records);
    let pngs;
    try {
      pngs = await renderer(pages);
    } catch (error) {
      return failed(`Chromium did not render its overlays (${firstLine(error)})`);
    }
    const files = pngs.map((png, i) => {
      const file = join(work, `overlay-${i}.png`);
      writeFileSync(file, png);
      return { file, height: pngSize(png).height, page: pages[i] };
    });
    const bands = files.filter((f) => f.page.kind === "band");
    const rest = files.filter((f) => f.page.kind === "caption");
    const titles = files.filter((f) => f.page.kind === "title");
    const per = stepPiecesOf(laid.pieces).length;
    const captions = laid.sides.map((_, i) => rest.slice(i * per, (i + 1) * per));
    const frameFiles = Object.fromEntries(
      files.filter((f) => f.page.kind === "frame").map((f) => [f.page.scene, f]),
    );
    const encoders = run("ffmpeg", ["-hide_banner", "-encoders"]);
    if (encoders.status !== 0) return failed(`ffmpeg did not run (${firstLine(encoders.stderr)})`);
    const encoder = /\blibx264\b/.test(encoders.stdout) ? "libx264" : "mpeg4";
    const built = run(
      "ffmpeg",
      ffmpegArgs(laid, {
        videos,
        durations,
        bands,
        captions,
        titles,
        frames: frameFiles,
        encoder,
        out: partial,
      }),
    );
    if (built.status !== 0 || !existsSync(partial))
      return failed(`ffmpeg did not build it (${firstLine(built.stderr)})`);
    renameSync(partial, /** @type {string} */ (mp4));
  } catch (error) {
    return failed(firstLine(error));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  return {
    code: 0,
    out: json({
      written: true,
      mp4: out ?? join(dirname(target), basename(/** @type {string} */ (mp4))),
      session: laid.sessions,
      sides: laid.sides.map((s) => s.side),
      steps: laid.sides[0].steps.length,
      seconds: laid.seconds,
      ...(notesOf(laid) ? { note: notesOf(laid) } : {}),
    }),
  };
}

const firstLine = (error) =>
  String(error?.message ?? error)
    .trim()
    .split("\n")[0]
    .slice(0, 300);

const real = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

if (process.argv[1] && real(fileURLToPath(import.meta.url)) === real(process.argv[1])) {
  const { code, out } = await main(process.argv.slice(2));
  process.stdout.write(out);
  process.exitCode = code;
}
