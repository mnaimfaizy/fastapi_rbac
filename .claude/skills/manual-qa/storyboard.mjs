// The Storyboard: one PNG per PASS or FAIL scenario on a screen surface that
// stands alone (SKILL.md step 6, ADAPTER.md "The Storyboard", DESIGN.md "One
// file that stands alone").
//
// WHAT IT DOES
//   Builds `s<n>-storyboard.png` from what a run saved: the scenario file the
//   runner writes (`s<n>-storyboard.json`) and the step files `web.mjs` wrote,
//   After's and, for a fix scenario, Before's. Nothing is run again, so a
//   Storyboard can be built again at any time from the same files.
//
//   - A band across the top: the scenario id and title, the result, each
//     side's expected and observed text marked ✓ (as expected), ✗ (not as
//     expected) or – (not judged), the merge-base and head commits, and the
//     run context (role or Scenario account ids and Sessions, ids only).
//   - Numbered steps below, Before's still beside After's for the same step
//     and Session. One column, with a Before note on each row, when Before was
//     not run or not observed, or when its expected text equals After's and
//     both sides showed it.
//   - Each still is cropped around its step's subject, with padding, at the
//     viewport's aspect and a minimum width; an outline is drawn just outside
//     the subject, never over it. A step with no subject shows the full frame,
//     unoutlined. A withheld still is a labelled empty frame with its caption.
//     The step that proves the result is highlighted.
//   - The caption privacy check runs first: on any sign-in value, any value
//     marked secret, or token-shaped text in what the Storyboard would show,
//     nothing is written, each field is named (never its value), and that
//     field's text is kept as `[withheld]` in the files it came from.
//
//   It renders HTML to PNG in the repository's own Playwright Chromium, with
//   a fixed, neutral palette built in: the repository configures nothing, and
//   Agent-kit takes no dependency on Playwright.
//
// CLI (run from the repository root)
//   node storyboard.mjs render <s<n>-storyboard.json> [--out <file.png>]
//
//   Exit 0: the Storyboard was written. Exit 1: refused (the privacy check, a
//   problem in the files, a variable not given, a result that is not PASS or
//   FAIL); no Storyboard written.
//   Exit 2: usage, no Playwright with Chromium here, or Chromium did not render
//   it: the row keeps its plain
//   stills, and `reason` is what its note says. Stdout is a JSON summary.

import { readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { findPlaywright } from "./adapter.mjs";
import { encodedForms } from "./http.mjs";
import { BEFORE_STATES } from "./report.mjs";

/**
 * The `web` driver's viewport (web.mjs's `VIEWPORT`, which it does not export): every
 * still is this size, and every subject box is in it. Change the two together.
 */
export const VIEWPORT = Object.freeze({ width: 1280, height: 720 });
/** Space kept around a subject's outline inside its crop, in still pixels. */
export const CROP_PADDING = 48;
/** A crop is never narrower than this, in still pixels, so a small subject keeps its context. */
export const MIN_CROP_WIDTH = 480;
/** The outline's inner edge sits this far outside the subject, in still pixels. */
export const OUTLINE_GAP = 4;
/** What a field's text becomes in the saved files when the privacy check refuses it. */
export const WITHHELD = "[withheld]";
/** The results a Storyboard is made for. */
export const STORYBOARD_RESULTS = /** @type {const} */ ([
  "PASS",
  "FAIL: regression",
  "FAIL: pre-existing",
]);
/** How each side was judged, and the mark the band shows for it. */
export const MARKS = /** @type {const} */ ({
  expected: "✓",
  "not expected": "✗",
  "not judged": "–",
});
/** Each mark's words, beside it in the band, so the PNG needs no legend. */
const MARK_WORDS = { "✓": "as expected:", "✗": "not as expected:", "–": "not judged:" };
/**
 * A sign-in value shorter than this is not looked for: it would match common text. A copy
 * of web.mjs's `MIN_SECRET_LENGTH`, which it does not export: change the two together.
 */
const MIN_SECRET_LENGTH = 4;
/** The width of the rendered page, in CSS pixels. */
const PAGE_WIDTH = 1360;
/** The width a still's crop is shown at: two columns, or one. */
const CELL_WIDTH = { 1: 880, 2: 600 };

/**
 * Text that is a secret by its shape alone: a copy of web.mjs's `SECRET_SHAPES`, which it
 * does not export. Change the two together.
 */
const TOKEN_SHAPES = [
  ["a JWT", /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/],
  ["a bearer or basic credential", /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/],
  ["a GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/],
  ["an API key", /\b(?:sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|xox[abpr]-[A-Za-z0-9-]{10,})/],
];
const ENV_NAME = /^QA_[A-Z0-9_]+$/;
/**
 * A `QA_*` variable whose name marks its value secret, not only a sign-in value: web.mjs's
 * secret words without EMAIL, which here is a sign-in value. Change the two together.
 */
const SECRET_VARIABLE =
  /(?:^|_)(?:PASSWORD|PASSWD|PASSPHRASE|SECRET|TOKEN|API_?KEY|CREDENTIALS?|OTP|PIN|RECOVERY|MFA)(?:_|$)/;
/** A `QA_*` variable that holds only a username: looked for as written, as a whole word. */
const USER_VARIABLE = /(?:^|_)(?:USER(?:NAME)?|LOGIN)(?:_|$)/;
const EMAIL_VARIABLE = /(?:^|_)EMAIL(?:_|$)/;
/** The still names `web.mjs` writes: a plain file name, so no path leaves the step file's folder. */
const STILL_NAME = /^step-\d+-[a-z]\.png$/;
const SCENARIO = /^S\d+$/;
const SESSION = /^[A-Z]$/;
/** A step file's path in the scenario file: `web.mjs`'s own folder beside it, so nothing outside is read or written. */
const STEP_FILE = /^s\d+(?:-before)?-web\/steps\.json$/;
/** The Before states with no step records to show. */
const BEFORE_UNSEEN = ["not run", "not observed"];
const COMMIT = /^[0-9a-f]{7,40}$/;

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ── The caption privacy check ───────────────────────────────────────────────

/**
 * A value the run knew and the Storyboard must never show.
 * @typedef {{name: string, value: string, kind: "sign-in" | "secret", exact: boolean}} Known
 *   `exact`: a username, looked for as written and as a whole word, since it is
 *   often a common word ("Admin"); any other value in any case, and in its
 *   encoded forms (URL, JSON, HTML)
 */

/**
 * The caption privacy check: which fields hold a known sign-in value, a value
 * marked secret, or token-shaped text. Pure, so the MP4 (#236) reuses it.
 * Each refusal names the field and why, never the value.
 * @param {{field: string, text: string | null | undefined}[]} fields
 * @param {Known[]} knownSecrets
 * @returns {{field: string, why: string}[]}
 */
export function privacyCheck(fields, knownSecrets) {
  const refusals = [];
  for (const { field, text } of fields) {
    if (typeof text !== "string" || !text) continue;
    const lowered = text.toLowerCase();
    const whys = [];
    for (const { name, value, kind, exact } of knownSecrets) {
      if (typeof value !== "string" || value.length < MIN_SECRET_LENGTH) continue;
      const found = exact
        ? new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(value)}(?![A-Za-z0-9])`).test(text)
        : encodedForms(value).some((form) => lowered.includes(form.toLowerCase()));
      if (found)
        whys.push(
          kind === "secret"
            ? `holds a value marked secret (${name})`
            : `holds a sign-in value (${name})`,
        );
    }
    for (const [shape, pattern] of TOKEN_SHAPES)
      if (pattern.test(text)) whys.push(`holds text shaped like ${shape}`);
    for (const why of new Set(whys)) refusals.push({ field, why });
  }
  return refusals;
}

/**
 * The values a run knew, from the `QA_*` variables given to this command, as
 * `web.mjs` counts them: each variable the run used (the scenario file's
 * `variables`, the ones its sequences filled), and any whose name says secret,
 * email or username. Any other (`QA_SHIPPING_CITY`) is not one. A name that
 * marks a secret (`PASSWORD`, `TOKEN`, …) is a value marked secret, any other a
 * sign-in value.
 * @param {Record<string, string | undefined>} env
 * @param {string[]} [used] the variables the run used
 * @returns {Known[]}
 */
export function knownFromEnv(env, used = []) {
  const signIn = (name) =>
    used.includes(name) ||
    SECRET_VARIABLE.test(name) ||
    EMAIL_VARIABLE.test(name) ||
    USER_VARIABLE.test(name);
  return Object.entries(env)
    .filter(
      ([name, value]) => ENV_NAME.test(name) && signIn(name) && typeof value === "string" && value,
    )
    .map(([name, value]) => ({
      name,
      value: /** @type {string} */ (value).replace(/[\r\n]+$/, ""),
      kind: SECRET_VARIABLE.test(name) ? "secret" : "sign-in",
      exact: USER_VARIABLE.test(name) && !SECRET_VARIABLE.test(name) && !EMAIL_VARIABLE.test(name),
    }));
}

/**
 * Every text the Storyboard would show, with the field it is named by and
 * where it came from, so a refused field can be kept as `[withheld]`.
 * @param {{after: any[], before: any[] | null}} records
 * @param {any} meta
 * @returns {{field: string, text: string, from: {file: "meta" | "after" | "before", path: (string | number)[]}}[]}
 */
export function shownFields(records, meta) {
  const fields = [];
  const add = (field, text, file, path) => {
    if (typeof text === "string") fields.push({ field, text, from: { file, path } });
  };
  add("title", meta.title, "meta", ["title"]);
  for (const side of ["before", "after"])
    if (isObject(meta[side]))
      for (const key of ["expected", "observed", "note"])
        add(`${side}.${key}`, meta[side][key], "meta", [side, key]);
  const context = isObject(meta.context) ? meta.context : {};
  (Array.isArray(context.accounts) ? context.accounts : []).forEach((id, i) =>
    add(`context.accounts[${i}]`, id, "meta", ["context", "accounts", i]),
  );
  (Array.isArray(context.sessions) ? context.sessions : []).forEach((entry, i) => {
    if (isObject(entry))
      add(`context.sessions[${i}].account`, entry.account, "meta", [
        "context",
        "sessions",
        i,
        "account",
      ]);
  });
  for (const [side, label] of [
    ["after", "After"],
    ["before", "Before"],
  ])
    (records[side] ?? []).forEach((record, i) => {
      const at = `${label} step ${record.index} (${record.session})`;
      add(`${at}: caption`, record.caption, side, ["steps", i, "caption"]);
      add(`${at}: withheld`, record.withheld, side, ["steps", i, "withheld"]);
    });
  return fields;
}

// ── Layout ──────────────────────────────────────────────────────────────────

/** @typedef {{x: number, y: number, width: number, height: number}} Box */

/** A box clipped to the viewport, or null when none of it is on screen. @param {Box} box */
function onScreen(box) {
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  const right = Math.min(VIEWPORT.width, box.x + box.width);
  const bottom = Math.min(VIEWPORT.height, box.y + box.height);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

/** The outline's stroke, drawn outward from its inner edge: the crop keeps room for it. */
export const OUTLINE_STROKE = 3;
const FULL_FRAME = () => ({ x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height });

/**
 * The crop and outline for one still: around the subject's on-screen part,
 * with padding, at the viewport's aspect and at least `MIN_CROP_WIDTH` wide,
 * inside the still. The outline's inner edge is `OUTLINE_GAP` outside the
 * subject; its stroke is drawn outward from there, never over the subject.
 * When the outline and its stroke reach past the still (a subject at its edge),
 * the crop reaches past it too, by just that much, so all four sides show.
 * @param {Box | null} subject
 * @returns {{crop: Box, outline: Box | null, subject: Box | null}}
 */
export function cropFor(subject) {
  const visible = subject && onScreen(subject);
  if (!visible) return { crop: FULL_FRAME(), outline: null, subject: null };
  const outline = {
    x: visible.x - OUTLINE_GAP,
    y: visible.y - OUTLINE_GAP,
    width: visible.width + 2 * OUTLINE_GAP,
    height: visible.height + 2 * OUTLINE_GAP,
  };
  const aspect = VIEWPORT.width / VIEWPORT.height;
  const needWidth = outline.width + 2 * CROP_PADDING;
  const needHeight = outline.height + 2 * CROP_PADDING;
  // Where a crop may reach: the still, and as far past it as the outline's stroke does.
  const x0 = Math.min(0, outline.x - OUTLINE_STROKE);
  const y0 = Math.min(0, outline.y - OUTLINE_STROKE);
  const x1 = Math.max(VIEWPORT.width, outline.x + outline.width + OUTLINE_STROKE);
  const y1 = Math.max(VIEWPORT.height, outline.y + outline.height + OUTLINE_STROKE);
  const width = Math.ceil(Math.max(needWidth, needHeight * aspect, MIN_CROP_WIDTH));
  if (width >= VIEWPORT.width) {
    // The full frame, widened or heightened to the viewport's aspect around any overhang.
    const w = Math.max(x1 - x0, (y1 - y0) * aspect);
    const h = w / aspect;
    return {
      crop: { x: x0 - (w - (x1 - x0)) / 2, y: y0 - (h - (y1 - y0)) / 2, width: w, height: h },
      outline,
      subject: visible,
    };
  }
  const height = width / aspect;
  const centre = (from, size, span, low, high) =>
    Math.min(Math.max(from + size / 2 - span / 2, low), high - span);
  const crop = {
    x: centre(outline.x, outline.width, width, x0, x1),
    y: centre(outline.y, outline.height, height, y0, y1),
    width,
    height,
  };
  return { crop, outline, subject: visible };
}

/** One still's cell: its crop, or why there is no still. */
function cell(record) {
  return {
    caption: record.caption,
    still: record.still,
    withheld: record.still ? null : (record.withheld ?? "no still was taken"),
    missing: null,
    ...cropFor(record.still ? record.subject : null),
  };
}

const missingCell = (why) => ({
  caption: null,
  still: null,
  withheld: null,
  missing: why,
  crop: FULL_FRAME(),
  outline: null,
  subject: null,
});

/**
 * The Storyboard's layout, from the step records and the scenario file: pure
 * data, so it is tested without pixels and is the same on every re-render.
 * @param {{after: any[], before: any[] | null}} records
 * @param {any} meta the scenario file `checkScenario` accepted
 */
export function layout(records, meta) {
  const before = isObject(meta.before) ? meta.before : null;
  const after = meta.after;
  const side = (name, s) => ({
    side: name,
    expected: s.expected,
    observed: s.observed,
    mark: MARKS[s.judged],
  });
  const sides = [...(before ? [side("Before", before)] : []), side("After", after)];

  // One column when there is no Before to show, or nothing it would add.
  let beforeNote = null;
  if (!before) beforeNote = "Before: not run, a feature scenario runs After only";
  else if (BEFORE_UNSEEN.includes(before.state))
    beforeNote = `Before ${before.state}: ${before.observed}`;
  else if (
    before.expected === after.expected &&
    before.judged === "expected" &&
    after.judged === "expected"
  )
    beforeNote = "Before: showed the same as After, so its stills are not repeated";
  else if (!records.before?.length) beforeNote = "Before: no step records";
  if (before?.note && beforeNote) beforeNote = `${beforeNote}; ${before.note}`;
  const columns = beforeNote ? 1 : 2;

  const key = (r) => `${r.session}:${r.index}`;
  const beforeBy = new Map((columns === 2 ? records.before : []).map((r) => [key(r), r]));
  const afterKeys = new Set(records.after.map(key));
  const last = records.after.at(-1);
  const proves = meta.proves ?? (last ? { session: last.session, index: last.index } : null);
  if (proves && !afterKeys.has(`${proves.session}:${proves.index}`))
    throw new Error(
      `proves names step ${proves.index} in Session ${proves.session}, and there is no After step ` +
        "with that index and Session",
    );

  const rows = records.after.map((record) => {
    const paired = beforeBy.get(key(record));
    return {
      number: record.index,
      session: record.session,
      proves: Boolean(proves) && key(record) === `${proves.session}:${proves.index}`,
      before: columns === 2 ? (paired ? cell(paired) : missingCell("no Before step")) : null,
      after: cell(record),
      beforeNote,
    };
  });
  // A Before step with no After step keeps its row, after the others.
  if (columns === 2)
    for (const record of records.before)
      if (!afterKeys.has(key(record)))
        rows.push({
          number: record.index,
          session: record.session,
          proves: false,
          before: cell(record),
          after: missingCell("no After step"),
          beforeNote: null,
        });

  const context = isObject(meta.context) ? meta.context : {};
  return {
    band: {
      scenario: meta.scenario,
      title: meta.title,
      result: meta.result,
      sides,
      commits: { base: meta.commits.base.slice(0, 7), head: meta.commits.head.slice(0, 7) },
      context: {
        accounts: [...(context.accounts ?? [])],
        sessions: (context.sessions ?? []).map((s) => `${s.session}: ${s.account}`),
      },
    },
    columns,
    rows,
  };
}

// ── HTML and the PNG ────────────────────────────────────────────────────────

const PALETTE = {
  page: "#ffffff",
  panel: "#f6f7f9",
  ink: "#1f2328",
  muted: "#5b636d",
  line: "#d0d7de",
  frame: "#e9ecef",
  outline: "#d4a017",
  proves: "#2f6fde",
  pass: "#1a7f37",
  fail: "#c62828",
};

export const escapeHtml = (text) =>
  String(text ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

/**
 * One still's frame: the crop scaled to the column's width, the outline drawn
 * outward from its inner edge, or a labelled empty frame.
 */
function frameHtml(c, width, png) {
  const height = Math.round((width * VIEWPORT.height) / VIEWPORT.width);
  const box = `width:${width}px;height:${height}px`;
  const caption = c.caption ? `<div class="caption">${escapeHtml(c.caption)}</div>` : "";
  const empty = (label) =>
    `<div class="frame empty" style="${box}"><span>${escapeHtml(label)}</span></div>${caption}`;
  if (c.missing) return empty(c.missing);
  if (!c.still) return empty(`Still withheld: ${c.withheld}`);
  if (!png) return empty("Still not found");
  const scale = width / c.crop.width;
  const image =
    `<img alt="" src="data:image/png;base64,${png.toString("base64")}" style="` +
    `left:${-c.crop.x * scale}px;top:${-c.crop.y * scale}px;` +
    `width:${VIEWPORT.width * scale}px;height:${VIEWPORT.height * scale}px">`;
  const outline = c.outline
    ? `<div class="outline" style="left:${(c.outline.x - c.crop.x) * scale}px;` +
      `top:${(c.outline.y - c.crop.y) * scale}px;width:${c.outline.width * scale}px;` +
      `height:${c.outline.height * scale}px"></div>`
    : "";
  return `<div class="frame" style="${box}">${image}${outline}</div>${caption}`;
}

/**
 * The band across the top: the scenario, the result, each side's expected and
 * observed text with its mark, the commits and the run context. Exported so the
 * MP4 (#236) shows the same band.
 * @param {ReturnType<typeof layout>["band"]} band
 */
export function bandHtml(band) {
  const sides = band.sides
    .map(
      (s) =>
        `<div class="side"><h3>${s.side}</h3>` +
        `<p><b>Expected</b> ${escapeHtml(s.expected)}</p>` +
        `<p><b>Observed</b> <span class="mark">${s.mark} ${MARK_WORDS[s.mark]}</span> ` +
        `${escapeHtml(s.observed)}</p></div>`,
    )
    .join("");
  const context = [
    band.context.accounts.length ? `Accounts: ${band.context.accounts.join(", ")}` : "",
    band.context.sessions.length ? `Sessions: ${band.context.sessions.join(", ")}` : "",
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" · ");
  return `<div class="band"><h1>${escapeHtml(band.scenario)}: ${escapeHtml(band.title)}</h1>
<div class="result">${escapeHtml(band.result)}</div>
<div class="sides">${sides}</div>
<div class="meta">Merge-base ${band.commits.base} · Head ${band.commits.head}${context ? ` · ${context}` : ""}</div></div>`;
}

/**
 * A self-contained page in the Storyboard's palette and type: no script, no
 * font, no request. Exported so the MP4 (#236) renders its band and captions
 * in the same style.
 * @param {string} body
 * @param {{pageWidth: number, cellWidth: number, failed: boolean}} options
 */
export function pageHtml(body, { pageWidth, cellWidth, failed }) {
  const p = PALETTE;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}
body{margin:0;width:${pageWidth}px;background:${p.page};color:${p.ink};font:15px/1.4 -apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
.band{padding:20px 24px;background:${p.panel};border-bottom:1px solid ${p.line}}
.band h1{margin:0 0 4px;font-size:22px}
.result{display:inline-block;margin-bottom:12px;padding:2px 10px;border-radius:4px;color:#fff;font-weight:600;background:${failed ? p.fail : p.pass}}
.sides{display:flex;gap:24px}
.side{flex:1;min-width:0}
.side h3{margin:0 0 4px;font-size:14px;text-transform:uppercase;color:${p.muted}}
.side p{margin:2px 0}
.mark{font-weight:700}
.meta{margin-top:12px;color:${p.muted};font-size:13px}
.heads{display:flex;gap:16px;padding:12px 24px 0;color:${p.muted};font-weight:600}
.heads span:first-child{width:56px}
.heads span{width:${cellWidth}px}
.row{display:flex;gap:16px;align-items:flex-start;padding:12px 24px;border-bottom:1px solid ${p.line}}
.row.proves{background:#eef4ff;box-shadow:inset 4px 0 0 ${p.proves}}
.number{width:56px;font-size:22px;font-weight:700}
.number small{display:block;font-size:12px;color:${p.muted}}
.proves-label{margin-top:6px;font-size:11px;font-weight:600;color:${p.proves}}
.frame{position:relative;overflow:hidden;background:${p.frame};border:1px solid ${p.line}}
.frame img{position:absolute;max-width:none}
.frame.empty{display:flex;align-items:center;justify-content:center;color:${p.muted};font-weight:600;padding:16px;text-align:center}
.outline{position:absolute;outline:3px solid ${p.outline};outline-offset:0}
.caption{margin-top:4px;width:${cellWidth}px;font-size:13px}
.note{flex:1;padding-top:4px;color:${p.muted};font-size:13px}
</style></head><body>
${body}
</body></html>`;
}

/**
 * The Storyboard as one self-contained HTML page: no script, no font, no
 * request, the stills inlined.
 * @param {ReturnType<typeof layout>} laid
 * @param {(side: "before" | "after", still: string) => Buffer | null} stillOf
 */
export function storyboardHtml(laid, stillOf) {
  const { band } = laid;
  const width = CELL_WIDTH[laid.columns];
  const failed = band.result.startsWith("FAIL");
  const heads =
    laid.columns === 2
      ? `<div class="heads"><span></span><span>Before</span><span>After</span></div>`
      : "";
  const rows = laid.rows
    .map((row) => {
      const cells = [
        row.before
          ? frameHtml(row.before, width, row.before.still && stillOf("before", row.before.still))
          : null,
        frameHtml(row.after, width, row.after.still && stillOf("after", row.after.still)),
      ]
        .filter((c) => c !== null)
        .map((c) => `<div class="cell">${c}</div>`)
        .join("");
      const note = row.beforeNote ? `<div class="note">${escapeHtml(row.beforeNote)}</div>` : "";
      const proves = row.proves ? `<div class="proves-label">Proves the result</div>` : "";
      return (
        `<div class="row${row.proves ? " proves" : ""}">` +
        `<div class="number">${row.number}<small>${escapeHtml(row.session)}</small>${proves}</div>` +
        `${cells}${note}</div>`
      );
    })
    .join("");
  return pageHtml(`${bandHtml(band)}\n${heads}${rows}`, {
    pageWidth: PAGE_WIDTH,
    cellWidth: width,
    failed,
  });
}

/**
 * Renders a Storyboard to PNG bytes in Playwright's Chromium: JavaScript off,
 * every request refused, so the page shows only what it carries.
 * @param {{after: any[], before: any[] | null, afterDir?: string, beforeDir?: string}} records
 * @param {any} meta
 * @param {{playwright: any}} options the repository's own Playwright module
 * @returns {Promise<Buffer>}
 */
export async function render(records, meta, { playwright }) {
  const laid = layout(records, meta);
  return renderLayout(laid, stillReader(records), playwright);
}

/** Reads a still beside its step file, or null when it is not there. */
const stillReader = (records) => (side, still) => {
  const dir = side === "before" ? records.beforeDir : records.afterDir;
  if (!dir || !STILL_NAME.test(still)) return null;
  try {
    return readFileSync(join(dir, still));
  } catch {
    return null;
  }
};

async function renderLayout(laid, stillOf, playwright) {
  const [png] = await renderPages([{ html: storyboardHtml(laid, stillOf), width: PAGE_WIDTH }], {
    playwright,
  });
  return png;
}

/**
 * Renders self-contained pages to PNG bytes in one Chromium: JavaScript off,
 * every request refused, so a page shows only what it carries. Each PNG is the
 * page's full height at its width, and at least its `height` (600 by default;
 * the MP4 gives 1, so an overlay is only as tall as its text). Exported so the
 * MP4 (#236) renders its band and captions here.
 * @param {{html: string, width: number, height?: number}[]} pages
 * @param {{playwright: any}} options the repository's own Playwright module
 * @returns {Promise<Buffer[]>}
 */
export async function renderPages(pages, { playwright }) {
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const pngs = [];
    for (const { html, width, height = 600 } of pages) {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 1,
        javaScriptEnabled: false,
      });
      await context.route("**/*", (route) => route.abort());
      const page = await context.newPage();
      await page.setContent(html, { waitUntil: "load" });
      pngs.push(await page.screenshot({ fullPage: true, type: "png" }));
      await context.close();
    }
    return pngs;
  } finally {
    await browser.close().catch(() => {});
  }
}

// ── The scenario file ───────────────────────────────────────────────────────

/** Problems with one side's step records, each naming the record and field. */
function recordProblems(steps, where) {
  if (!Array.isArray(steps)) return [`${where}: "steps" is not a list`];
  const problems = [];
  steps.forEach((r, i) => {
    const at = `${where}: step record ${i + 1}`;
    if (!isObject(r)) return problems.push(`${at} is not an object`);
    if (typeof r.session !== "string" || !SESSION.test(r.session))
      problems.push(`${at}: session is not a capital letter`);
    if (!Number.isInteger(r.index) || r.index < 1) problems.push(`${at}: index is not 1 or more`);
    if (typeof r.caption !== "string") problems.push(`${at}: caption is not text`);
    if (r.still !== null && (typeof r.still !== "string" || !STILL_NAME.test(r.still)))
      problems.push(`${at}: still is not a still name web.mjs writes (step-<NN>-<session>.png)`);
    if (r.withheld !== null && r.withheld !== undefined && typeof r.withheld !== "string")
      problems.push(`${at}: withheld is not text`);
    if (
      r.subject !== null &&
      r.subject !== undefined &&
      !(
        isObject(r.subject) &&
        ["x", "y", "width", "height"].every((k) => Number.isFinite(r.subject[k]))
      )
    )
      problems.push(`${at}: subject is not a box {x, y, width, height}`);
  });
  return problems;
}

/**
 * Problems with a scenario file, each naming its field.
 * @param {unknown} meta
 * @returns {string[]}
 */
export function checkScenario(meta) {
  if (!isObject(meta)) return ["the scenario file is not a JSON object"];
  const m = /** @type {any} */ (meta);
  const problems = [];
  const text = (value, where) => {
    if (typeof value !== "string" || !value.trim()) problems.push(`${where} is not text`);
  };
  if (typeof m.scenario !== "string" || !SCENARIO.test(m.scenario))
    problems.push("scenario is not a scenario id such as S1");
  text(m.title, "title");
  if (!STORYBOARD_RESULTS.includes(m.result))
    problems.push(
      `result is ${JSON.stringify(m.result)}: a Storyboard is made for a PASS or FAIL only ` +
        `(${STORYBOARD_RESULTS.join(", ")})`,
    );
  const stepFile = (value, where) => {
    if (typeof value !== "string" || !STEP_FILE.test(value))
      problems.push(
        `${where} is not a step file beside the scenario file (s<n>-web/steps.json, s<n>-before-web/steps.json)`,
      );
  };
  const judged = (value, where) => {
    if (!Object.hasOwn(MARKS, value))
      problems.push(`${where} is not one of ${Object.keys(MARKS).join(", ")}`);
  };
  if (!isObject(m.after)) problems.push("after is not an object");
  else {
    stepFile(m.after.steps, "after.steps");
    text(m.after.expected, "after.expected");
    text(m.after.observed, "after.observed");
    judged(m.after.judged, "after.judged");
  }
  if (m.before !== null && m.before !== undefined) {
    if (!isObject(m.before)) problems.push("before is not an object or null");
    else {
      if (!BEFORE_STATES.includes(m.before.state))
        problems.push(`before.state is not one of ${BEFORE_STATES.join(", ")}`);
      // Required when Before ran; a Before not run or not observed may name none.
      if (!BEFORE_UNSEEN.includes(m.before.state) || (m.before.steps ?? null) !== null)
        stepFile(m.before.steps, "before.steps");
      text(m.before.expected, "before.expected");
      text(m.before.observed, "before.observed");
      judged(m.before.judged, "before.judged");
      if (m.before.note !== undefined) text(m.before.note, "before.note");
    }
  }
  if (
    !isObject(m.commits) ||
    !COMMIT.test(m.commits.base ?? "") ||
    !COMMIT.test(m.commits.head ?? "")
  )
    problems.push("commits is not {base, head}, each a commit sha in lower-case hex");
  if (m.context !== undefined) {
    const c = m.context;
    if (
      !isObject(c) ||
      (c.accounts !== undefined &&
        !(Array.isArray(c.accounts) && c.accounts.every((id) => typeof id === "string"))) ||
      (c.sessions !== undefined &&
        !(
          Array.isArray(c.sessions) &&
          c.sessions.every(
            (s) => isObject(s) && SESSION.test(s.session ?? "") && typeof s.account === "string",
          )
        ))
    )
      problems.push('context is not {"accounts": [ids], "sessions": [{"session", "account"}]}');
  }
  if (
    m.proves !== undefined &&
    !(
      isObject(m.proves) &&
      SESSION.test(m.proves.session ?? "") &&
      Number.isInteger(m.proves.index)
    )
  )
    problems.push('proves is not {"session", "index"}');
  // Required, so the check always knows which values the run used; an empty list says none.
  if (!(Array.isArray(m.variables) && m.variables.every((name) => ENV_NAME.test(name))))
    problems.push("variables is not a list of the QA_ variable names the run used ([] for none)");
  return problems;
}

/**
 * Reads a scenario file and the step files it names, relative to its folder.
 * @param {string} metaPath
 * @returns {{meta: any, records: {after: any[], before: any[] | null, afterDir: string, beforeDir: string | null},
 *   files: {meta: string, after: string, before: string | null}, raw: {meta: any, after: any, before: any}, problems: string[]}}
 */
export function loadScenario(metaPath) {
  const problems = [];
  const read = (path, what) => {
    try {
      return JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
      problems.push(`${what}: ${error?.code === "ENOENT" ? "no such file" : "not JSON"}`);
      return null;
    }
  };
  const dir = dirname(resolve(metaPath));
  const meta = read(metaPath, basename(metaPath));
  const empty = { after: [], before: null, afterDir: dir, beforeDir: null };
  const files = { meta: resolve(metaPath), after: "", before: null };
  if (!meta)
    return { meta, records: empty, files, raw: { meta, after: null, before: null }, problems };
  problems.push(...checkScenario(meta));
  if (problems.length)
    return { meta, records: empty, files, raw: { meta, after: null, before: null }, problems };
  const side = (path, what) => {
    const file = resolve(dir, path);
    const raw = read(file, `${what} (${path})`);
    if (raw && !isObject(raw)) problems.push(`${what} (${path}) is not a step file`);
    else if (raw) problems.push(...recordProblems(raw.steps, `${what} (${path})`));
    return { file, raw };
  };
  const after = side(meta.after.steps, "after.steps");
  const before =
    typeof meta.before?.steps === "string" ? side(meta.before.steps, "before.steps") : null;
  files.after = after.file;
  files.before = before?.file ?? null;
  return {
    meta,
    records: {
      after: after.raw?.steps ?? [],
      before: before ? (before.raw?.steps ?? []) : null,
      afterDir: dirname(after.file),
      beforeDir: before ? dirname(before.file) : null,
    },
    files,
    raw: { meta, after: after.raw, before: before?.raw ?? null },
    problems,
  };
}

/** Sets one value at a key path. */
function setAt(object, path, value) {
  let at = object;
  for (const key of path.slice(0, -1)) at = at[key];
  at[path.at(-1)] = value;
}

/**
 * Keeps each refused field's text as `[withheld]` in the file it came from, the
 * step file or the scenario file, so a later build runs without it. Exported so
 * the MP4 (#236) refuses the same way.
 * @param {ReturnType<typeof loadScenario>} loaded
 * @param {ReturnType<typeof shownFields>} fields
 * @param {{field: string}[]} refused
 */
export function withholdRefused(loaded, fields, refused) {
  const names = new Set(refused.map((r) => r.field));
  const touched = new Set();
  for (const field of fields)
    if (names.has(field.field)) {
      setAt(loaded.raw[field.from.file], field.from.path, WITHHELD);
      touched.add(field.from.file);
    }
  for (const file of touched)
    writeFileSync(loaded.files[file], `${JSON.stringify(loaded.raw[file], null, 2)}\n`);
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const USAGE = "usage: node storyboard.mjs render <s<n>-storyboard.json> [--out <file.png>]\n";
export const NO_CHROMIUM =
  "no Storyboard: no Playwright with Chromium in this repository; the row keeps its plain stills";

/**
 * @param {string[]} argv the arguments after the script
 * @param {{env?: Record<string, string | undefined>, cwd?: string,
 *   renderer?: (laid: ReturnType<typeof layout>, stillOf: (side: string, still: string) => Buffer | null) => Promise<Buffer>}} [io]
 *   `renderer` turns a layout into PNG bytes (a seam for tests; Chromium's by default)
 * @returns {Promise<{code: number, out: string}>}
 */
export async function main(argv, io = {}) {
  const usage = { code: 2, out: USAGE };
  const [command, target, ...rest] = argv;
  if (command !== "render" || target === undefined || target.startsWith("--")) return usage;
  let out;
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === "--out" && rest[i + 1] !== undefined && out === undefined) out = rest[++i];
    else return usage;
  }
  if (out !== undefined && !out.endsWith(".png")) return usage;
  const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
  const env = io.env ?? process.env;

  const loaded = loadScenario(target);
  const { meta, records } = loaded;
  // The Storyboard's path, known before any check, so every refusal removes an older one:
  // a Storyboard left from an earlier run would show what this run no longer says.
  const scenario = typeof meta?.scenario === "string" && SCENARIO.test(meta.scenario);
  const png =
    out !== undefined || scenario
      ? resolve(
          out ?? join(dirname(resolve(target)), `${meta.scenario.toLowerCase()}-storyboard.png`),
        )
      : null;
  /** No Storyboard this time: any older one at its path goes too. */
  const none = (code, body) => {
    if (png) rmSync(png, { force: true });
    return { code, out: json({ written: false, ...body }) };
  };
  if (loaded.problems.length) return none(1, { problems: loaded.problems });

  const unset = (meta.variables ?? []).filter((name) => !env[name]);
  if (unset.length)
    return none(1, {
      problems: unset.map(
        (name) => `${name} is not set: give each variable the run used as this command's own`,
      ),
    });

  // The privacy check comes before anything is drawn.
  const fields = shownFields(records, meta);
  const refused = privacyCheck(fields, knownFromEnv(env, meta.variables));
  if (refused.length) {
    withholdRefused(loaded, fields, refused);
    return none(1, { refused });
  }

  let laid;
  try {
    laid = layout(records, meta);
  } catch (error) {
    return none(1, { problems: [String(error.message)] });
  }

  let renderer = io.renderer;
  if (!renderer) {
    const found = findPlaywright(io.cwd ?? process.cwd());
    if (!found.chromium) {
      return none(2, { reason: NO_CHROMIUM });
    }
    renderer = (l, stillOf) => renderLayout(l, stillOf, found.module);
  }
  let bytes;
  try {
    bytes = await renderer(laid, stillReader(records));
  } catch (error) {
    rmSync(png, { force: true });
    const why = String(error?.message ?? error)
      .split("\n")[0]
      .slice(0, 300);
    return {
      code: 2,
      out: json({ written: false, reason: `no Storyboard: Chromium did not render it (${why})` }),
    };
  }
  writeFileSync(png, bytes);
  return {
    code: 0,
    out: json({
      written: true,
      storyboard: out ?? join(dirname(target), basename(png)),
      columns: laid.columns,
      rows: laid.rows.length,
    }),
  };
}

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
