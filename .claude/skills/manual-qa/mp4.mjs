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
//   - One Session per side: the one `proves` names, or the first After step's.
//     Before beside After when Before has a recording of that Session; After
//     alone otherwise (a feature scenario, a Before not run or not observed).
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
//   ffmpeg and ffprobe are found on `PATH`, Playwright is the repository's own;
//   Agent-kit takes no dependency on either. The raw `webm` recordings stay in
//   `working_dir`, and are never the row's evidence.
//
// CLI (run from the repository root)
//   node mp4.mjs build <s<n>-storyboard.json> [--out <file.mp4>]
//
//   Exit 0: the MP4 was written. Exit 1: refused (the privacy check, a problem
//   in the files, a variable not given); no MP4 written.
//   Exit 2: usage, no ffmpeg or ffprobe on `PATH`, no Playwright with Chromium,
//   no recording of the Session, or ffmpeg did not build it: no MP4, the row
//   keeps its Storyboard, and `reason` is what its note says. Stdout is a JSON
//   summary.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { findPlaywright, onPath } from "./adapter.mjs";
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
  shownFields,
  withholdRefused,
} from "./storyboard.mjs";

/** How long each side holds on each step's frame, in seconds of the MP4. */
export const HOLD_SECONDS = 2;
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

/** The Session the MP4 follows: the one `proves` names, or the first After step's. */
const sessionOf = (records, meta) => meta.proves?.session ?? records.after[0]?.session;

/** A side's recording of the Session, by the name `web.mjs` gives it, or null. */
function videoOf(file, session) {
  const name = file?.sessions?.[session]?.video;
  return typeof name === "string" && VIDEO_NAME.test(name) ? name : null;
}

/**
 * Why Before does not play beside After, or null when it does: Before ran and
 * has a recording of the Session, named in its step file and, by `recorded`,
 * there on disk.
 * @param {(side: "Before" | "After", name: string) => boolean} recorded
 */
function beforeNoteFor(meta, raw, session, recorded) {
  const before = isObject(meta.before) ? meta.before : null;
  if (!before) return "Before: not run, a feature scenario runs After only";
  if (BEFORE_UNSEEN.includes(before.state)) return `Before ${before.state}: ${before.observed}`;
  const name = videoOf(raw.before, session);
  if (!name || !recorded("Before", name)) return `Before: no recording of Session ${session}`;
  return null;
}

/**
 * What the MP4 shows, from the saved files: pure data, so it is tested
 * without ffmpeg and is the same on every re-build.
 *
 * Each side's recording time of a step is its `atMs` less its Session's
 * `startedAtMs`, when the recording began. The MP4 opens on step 1's hold;
 * each later step is reached by its side's stretch from the step before,
 * played at `BETWEEN_SPEED`, and held for `HOLD_SECONDS`. A stretch lasts as
 * long as the longer side's, the shorter side waiting on its step's frame.
 *
 * @param {{after: any[], before: any[] | null}} records
 * @param {any} meta the scenario file
 * @param {{after: any, before: any}} raw the step files as read (their `sessions`)
 * @param {{recorded?: (side: "Before" | "After", name: string) => boolean}} [options]
 *   whether a side's recording is on disk (`main` looks; every recording counts as there by default)
 * @returns {{session: string, sides: Side[], beforeNote: string | null,
 *   pieces: {kind: "hold" | "between", index: number, seconds: number}[], seconds: number}}
 *
 * @typedef {{side: "Before" | "After", video: string | null, startedAt: string,
 *   steps: {index: number, caption: string, atMs: number | null, at: number, from: number}[],
 *   overlays: {field: string, heading: string, caption: string, timing: string}[]}} Side
 *   `at`: the step's time in the recording, in seconds; `from`: where its stretch starts
 */
export function timeline(records, meta, raw, { recorded = () => true } = {}) {
  const session = sessionOf(records, meta);
  const afterSteps = records.after.filter((r) => r.session === session);
  if (!afterSteps.length) throw new Error("After has no steps to show");
  const startOf = (file) => {
    const ms = file?.sessions?.[session]?.startedAtMs;
    return Number.isFinite(ms) ? ms : 0;
  };

  const before = isObject(meta.before) ? meta.before : null;
  const beforeNote = beforeNoteFor(meta, raw, session, recorded);
  const two = beforeNote === null;
  const beforeBy = new Map(
    (two ? (records.before ?? []) : [])
      .filter((r) => r.session === session)
      .map((r) => [r.index, r]),
  );

  const n = afterSteps.length;
  const side = (name, file, startedAt, pick) => {
    const start = startOf(file);
    let last = 0;
    const steps = afterSteps.map((a, k) => {
      const record = pick(a);
      const from = last;
      // A step this side lacks takes no time: it waits where it was.
      const at = record ? Math.max((record.atMs - start) / 1000, k ? from : 0) : from;
      last = at;
      return {
        index: a.index,
        caption: record ? record.caption : `No ${name} step ${a.index}`,
        atMs: record ? record.atMs : null,
        at,
        from: k ? from : at,
      };
    });
    const overlays = [];
    steps.forEach((s, k) => {
      const where = `${name} step ${s.index} (${session})`;
      if (k)
        overlays.push({
          field: `${where}: MP4 lead-in`,
          heading: `${name} · on to step ${s.index} of ${n}, Session ${session}`,
          caption: s.caption,
          timing:
            `played at ${BETWEEN_SPEED}× speed from step ${steps[k - 1].index}` +
            (s.atMs !== null && steps[k - 1].atMs !== null
              ? ` (${tenths(steps[k - 1].atMs)} s) to step ${s.index} (${tenths(s.atMs)} s since ${name} started)`
              : ""),
        });
      const paired = beforeBy.get(s.index);
      overlays.push({
        field: `${where}: MP4 timing line`,
        heading: `${name} · step ${s.index} of ${n}, Session ${session}`,
        caption: s.caption,
        timing:
          s.atMs === null
            ? "not reached on this side"
            : timingLine({
                side: name,
                startedAt,
                atMs: s.atMs,
                beforeAtMs: name === "After" && paired ? paired.atMs : null,
              }),
      });
    });
    return { side: name, video: videoOf(file, session), startedAt, steps, overlays };
  };

  const sides = [
    ...(two ? [side("Before", raw.before, before.startedAt, (a) => beforeBy.get(a.index))] : []),
    side("After", raw.after, meta.after.startedAt, (a) => a),
  ];
  const pieces = [];
  for (let k = 0; k < n; k += 1) {
    if (k) {
      const stretch = Math.max(...sides.map((s) => s.steps[k].at - s.steps[k].from));
      pieces.push({
        kind: "between",
        index: afterSteps[k].index,
        seconds: frames(stretch / BETWEEN_SPEED),
      });
    }
    pieces.push({ kind: "hold", index: afterSteps[k].index, seconds: frames(HOLD_SECONDS) });
  }
  const seconds = frames(pieces.reduce((sum, p) => sum + p.seconds, 0));
  return { session, sides, beforeNote, pieces, seconds };
}

/**
 * The texts the MP4 adds over what the Storyboard shows: each overlay's
 * heading and timing line. Its captions are the step records', which the
 * Storyboard's fields already hold.
 * @param {ReturnType<typeof timeline>} laid
 */
export function overlayFields(laid) {
  const fields = laid.sides.flatMap((s) =>
    s.overlays.flatMap((o) => [
      { field: `${o.field} (heading)`, text: o.heading },
      { field: o.field, text: o.timing },
    ]),
  );
  if (laid.beforeNote) fields.push({ field: "MP4 Before note", text: laid.beforeNote });
  return fields;
}

// ── Overlay pages ───────────────────────────────────────────────────────────

/** The page each overlay image is rendered from, in the Storyboard's style. */
export function overlayPages(laid, meta, records) {
  const width = SIDE.width * laid.sides.length;
  const failed = meta.result.startsWith("FAIL");
  const style = { cellWidth: SIDE.width - 32, failed };
  const band = layout(records, meta).band;
  const note = laid.beforeNote
    ? `<div class="meta" style="padding:0 24px 12px;margin:0;background:#f6f7f9">${escapeHtml(laid.beforeNote)}</div>`
    : "";
  const pages = [
    {
      html: pageHtml(`${bandHtml(band)}${note}`, { pageWidth: width, ...style }),
      width,
      height: 1,
    },
  ];
  for (const s of laid.sides)
    for (const o of s.overlays)
      pages.push({
        width: SIDE.width,
        height: 1,
        html: pageHtml(
          `<div style="padding:8px 16px 12px">` +
            `<div class="meta" style="margin:0;font-weight:600">${escapeHtml(o.heading)}</div>` +
            `<div class="caption" style="font-size:16px">${escapeHtml(o.caption)}</div>` +
            `<div class="meta" style="margin-top:2px">${escapeHtml(o.timing)}</div></div>`,
          { pageWidth: SIDE.width, ...style },
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
 * recording's length, and the overlay images already rendered.
 * @param {ReturnType<typeof timeline>} laid
 * @param {{videos: string[], durations: number[], band: {file: string, height: number},
 *   captions: {file: string, height: number}[][], encoder: string, out: string}} files
 *   `videos`, `durations` and `captions` are per side, in `laid.sides` order
 */
export function ffmpegArgs(laid, { videos, durations, band, captions, encoder, out }) {
  const width = SIDE.width * laid.sides.length;
  const captionHeight = even(Math.max(...captions.flat().map((c) => c.height)));
  const args = ["-hide_banner", "-loglevel", "error", "-y"];
  const filters = [];
  let input = 0;
  const image = (file, seconds) => {
    args.push("-loop", "1", "-framerate", String(FPS), "-t", seconds.toFixed(3), "-i", file);
    return input++;
  };
  const still = (pad, h) =>
    `fps=${FPS},scale=${pad}:-1,pad=${pad}:${h}:0:0:white,setsar=1,format=yuv420p`;

  const b = image(band.file, laid.seconds);
  filters.push(`[${b}:v]${still(width, even(band.height))},trim=duration=${laid.seconds}[band]`);

  laid.sides.forEach((s, i) => {
    const tag = `s${i}`;
    const last = Math.max(durations[i] - 2 / FPS, 0);
    const clamp = (t) => Math.min(Math.max(t, 0), last);
    // The recording: one piece per hold, and per stretch with its hold, each its own input.
    const chunks = [];
    for (let k = 0; k < s.steps.length; k += 1) {
      const step = s.steps[k];
      const between = k
        ? laid.pieces.find((p) => p.kind === "between" && p.index === step.index)
        : null;
      const seconds = frames((between?.seconds ?? 0) + HOLD_SECONDS);
      const from = clamp(k ? step.from : step.at);
      const length = Math.max(clamp(step.at) - from, 2 / FPS);
      args.push("-ss", from.toFixed(3), "-t", length.toFixed(3), "-i", videos[i]);
      const at = input++;
      filters.push(
        `[${at}:v]setpts=(PTS-STARTPTS)/${BETWEEN_SPEED},fps=${FPS},` +
          `scale=${SIDE.width}:${SIDE.height},setsar=1,format=yuv420p,` +
          `tpad=stop_mode=clone:stop_duration=${seconds},trim=duration=${seconds},setpts=PTS-STARTPTS[${tag}v${k}]`,
      );
      chunks.push(`[${tag}v${k}]`);
    }
    filters.push(`${chunks.join("")}concat=n=${chunks.length}:v=1:a=0[${tag}v]`);
    // The captions: one image per piece, in the same order as the pieces.
    const parts = laid.pieces.map((piece, j) => {
      const at = image(captions[i][j].file, piece.seconds);
      filters.push(
        `[${at}:v]${still(SIDE.width, captionHeight)},trim=duration=${piece.seconds},setpts=PTS-STARTPTS[${tag}c${j}]`,
      );
      return `[${tag}c${j}]`;
    });
    filters.push(`${parts.join("")}concat=n=${parts.length}:v=1:a=0[${tag}c]`);
    filters.push(`[${tag}v][${tag}c]vstack=inputs=2[${tag}]`);
  });
  const sides = laid.sides.map((_, i) => `[s${i}]`).join("");
  filters.push(
    laid.sides.length === 2 ? `${sides}hstack=inputs=2[sides]` : `${sides}null[sides]`,
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

const USAGE = "usage: node mp4.mjs build <s<n>-storyboard.json> [--out <file.mp4>]\n";

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
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === "--out" && rest[i + 1] !== undefined && out === undefined) out = rest[++i];
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
  const two = beforeNoteFor(meta, loaded.raw, sessionOf(records, meta), recorded) === null;
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

  // Before plays only with its recording there, so only After can lack one here.
  const videos = laid.sides.map((s) => (s.video ? join(dirs[s.side], s.video) : null));
  const lacking = laid.sides.find((s, i) => !videos[i] || !existsSync(videos[i]));
  if (lacking)
    return none(2, {
      reason:
        `no MP4: no recording of Session ${laid.session} on ${lacking.side} ` +
        "(web.mjs ran without --video, or its file is gone); the row keeps its Storyboard",
    });

  let renderer = io.renderer;
  if (!renderer) {
    const found = findPlaywright(io.cwd ?? process.cwd());
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
    const durations = videos.map((file) => probeSeconds(run, /** @type {string} */ (file)));
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
      return { file, height: pngSize(png).height };
    });
    const [band, ...rest] = files;
    const per = laid.pieces.length;
    const captions = laid.sides.map((_, i) => rest.slice(i * per, (i + 1) * per));
    const encoders = run("ffmpeg", ["-hide_banner", "-encoders"]);
    if (encoders.status !== 0) return failed(`ffmpeg did not run (${firstLine(encoders.stderr)})`);
    const encoder = /\blibx264\b/.test(encoders.stdout) ? "libx264" : "mpeg4";
    const built = run(
      "ffmpeg",
      ffmpegArgs(laid, {
        videos: /** @type {string[]} */ (videos),
        durations,
        band,
        captions,
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
      session: laid.session,
      sides: laid.sides.map((s) => s.side),
      steps: laid.sides[0].steps.length,
      seconds: laid.seconds,
      ...(laid.beforeNote ? { note: laid.beforeNote } : {}),
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
