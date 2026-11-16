// The `web` surface's driver (SKILL.md steps 4 and 6, ADAPTER.md "The web
// driver", DESIGN.md "A driver for the web surface"; Agent-kit's ADR 0008).
//
// WHAT IT DOES
//   Carries out a step sequence the runner wrote from one scenario's steps, in
//   Playwright's Chromium, and records what each step showed. It makes no
//   assertions: the runner compares the stills and text with the scenario's
//   **Expected result:**, as on every other surface.
//
//   - The sequence is a JSON file under `working_dir`, never code and never
//     committed. A plan is never run: the runner reads its steps and writes
//     the sequence.
//   - Every navigation stays on the one address the run checked (`--base`); a
//     path is relative to it, and a page that leaves it stops the run.
//   - Each Session (`A`, `B`, …) gets its own browser context, with its own
//     cookies and storage.
//   - Sign-in values come only from `QA_*` environment variables, named in a
//     fill as `{{env:QA_NAME}}`. A sequence that carries one inline is
//     refused, and nothing runs.
//   - At each `step` it saves a still, the caption, the element the step is
//     about (its box), that element's visible text, the Session and the time.
//     A still is withheld while a password field, or any field holding a
//     sign-in value, has a value, or while a sign-in value is on the screen.
//   - With `--video`, a video per Session, Playwright's own `webm`.
//
//   Playwright is the repository's own, loaded from its `node_modules`; this
//   driver never installs it, and Agent-kit takes no dependency on it.
//
// CLI (run from the repository root)
//   node web.mjs run <sequence.json> --base <address> --out <dir> [--video]
//
//   Exit 0: every action completed. Exit 1: the sequence was refused (nothing
//   run), or an action did not complete (the step file holds every step up to
//   it). Exit 2: usage, or no Playwright with Chromium here. Stdout is a JSON
//   summary.

import { mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { findPlaywright } from "./adapter.mjs";
import { Redactor, encodedForms } from "./http.mjs";

/** The actions a sequence can hold, each with the other keys it may carry. */
export const ACTIONS = /** @type {const} */ ({
  goto: [],
  click: [],
  fill: ["value"],
  press: [],
  wait: ["timeoutMs"],
  step: ["subject", "timeoutMs"],
});
/** The keys of one step record, in order (ADAPTER.md "The step file"). */
export const STEP_KEYS = [
  "session",
  "index",
  "caption",
  "still",
  "subject",
  "text",
  "atMs",
  "withheld",
];
/** At most this many actions in one sequence. */
export const MAX_ACTIONS = 200;
/** How long a click, fill or press waits for its element. */
export const ACTION_TIMEOUT_MS = 10_000;
/** How long a page may take to load. */
export const NAVIGATION_TIMEOUT_MS = 30_000;
/** A wait, or a step's wait for its subject, is bounded by this. */
export const MAX_WAIT_MS = 15_000;
/** A wait, or a step with a subject, waits this long when it names no bound. */
export const DEFAULT_WAIT_MS = 5_000;
/** A subject's visible text longer than this is cut in its record. */
export const TEXT_LIMIT = 2_000;
const LEFT = "a page left the checked address; the run stopped there";
/** Why the run stopped for a tab or window, named by the last action that ran. */
const popupWhy = (n) =>
  `a tab or window was opened during or after action ${n}, and the driver closed it ` +
  "without following; drive that step with a browser tool";
/** How long the driver waits after the last action for a late tab or window. */
export const SETTLE_MS = 500;
const VIEWPORT = { width: 1280, height: 720 };
const MIN_SECRET_LENGTH = 4;

const PLACEHOLDER = /\{\{(\w+):([^}]*)\}\}/g;
const ENV_NAME = /^QA_[A-Z0-9_]+$/;
/** A `QA_*` variable whose name says it holds a secret or an email: looked for in any case. */
const SECRET_VARIABLE =
  /(?:^|_)(?:PASSWORD|PASSWD|PASSPHRASE|SECRET|TOKEN|API_?KEY|CREDENTIALS?|OTP|PIN|RECOVERY|MFA|EMAIL)(?:_|$)/;
/** A `QA_*` variable whose name says it holds a username. */
const USER_VARIABLE = /(?:^|_)(?:USER(?:NAME)?|LOGIN)(?:_|$)/;
/**
 * Whether a variable holds only a username, looked for only as written: its name has
 * a username word and no secret or email word (`QA_A_LOGIN_PASSWORD` is a secret).
 */
const usernameOnly = (name) => USER_VARIABLE.test(name) && !SECRET_VARIABLE.test(name);
/** A field's label or name that names a secret: its fill takes only placeholders. */
const SECRET_FIELD =
  /pass(?:word|wd|phrase|code)?\b|secret|token|api.?key|credential|\botp\b|one.?time|\bpin\b|recovery|mfa|2fa|verification|security code/i;
/** A query parameter whose name names a secret. */
const SECRET_PARAM =
  /password|passwd|secret|token|apikey|credential|^otp$|^pin$|^code$|^sid$|session/;
/** Values that are secrets by their shape alone. */
const SECRET_SHAPES = [
  ["a JWT", /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/],
  ["a bearer or basic credential", /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/],
  ["a GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/],
  ["an API key", /\b(?:sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|xox[abpr]-[A-Za-z0-9-]{10,})/],
];
const TARGET_KEYS = ["role", "name", "label", "text", "exact"];
const KEY = /^(?:(?:Control|Shift|Alt|Meta|ControlOrMeta)\+)*(?:[A-Za-z0-9]+|[!-~])$/;

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const onlyPlaceholders = (text) => text.replace(PLACEHOLDER, "").trim() === "";
const controlChar = (text) => /[\x00-\x1f\x7f]/.test(text);

/** Every string value in a JSON value, with its key path. */
function* strings(value, path) {
  if (typeof value === "string") yield [path, value];
  else if (Array.isArray(value))
    for (const [i, v] of value.entries()) yield* strings(v, `${path}[${i}]`);
  else if (isObject(value))
    for (const [k, v] of Object.entries(value)) yield* strings(v, `${path}.${k}`);
}

const decode = (text) => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

/** An environment value with any trailing line ending removed. */
function envValue(env, name) {
  const value = env[name];
  return typeof value === "string" ? value.replace(/[\r\n]+$/, "") : undefined;
}

/** Problems with one element target, each naming the field. */
function targetProblems(target, where) {
  if (!isObject(target))
    return [`${where} must be an element: {"role", "name"}, {"label"} or {"text"}`];
  const problems = [];
  for (const key of Object.keys(target))
    if (!TARGET_KEYS.includes(key)) problems.push(`${where}: unknown key "${key}"`);
  const ways = ["role", "label", "text"].filter((key) => target[key] !== undefined);
  if (ways.length !== 1)
    problems.push(`${where} must give exactly one of "role", "label" and "text"`);
  for (const key of ["role", "name", "label", "text"])
    if (
      target[key] !== undefined &&
      (typeof target[key] !== "string" || !target[key].trim() || controlChar(target[key]))
    )
      problems.push(`${where}.${key} must be text on one line`);
  if (target.role !== undefined && !/^[a-z]+$/.test(String(target.role)))
    problems.push(`${where}.role must be an ARIA role, such as "button" or "link"`);
  if (target.name !== undefined && target.role === undefined)
    problems.push(`${where}.name goes with "role" only`);
  if (target.exact !== undefined && typeof target.exact !== "boolean")
    problems.push(`${where}.exact must be true or false`);
  return problems;
}

/**
 * Checks a parsed sequence before anything runs. Each problem names the action
 * and the field, never a value.
 * @param {unknown} sequence
 * @param {Record<string, string | undefined>} env
 * @returns {string[]}
 */
export function checkSequence(sequence, env) {
  if (!isObject(sequence)) return ['the sequence is not a JSON object with an "actions" list'];
  const problems = [];
  for (const key of Object.keys(sequence))
    if (key !== "actions") problems.push(`unknown key "${key}"; a sequence has only "actions"`);
  const { actions } = /** @type {any} */ (sequence);
  if (!Array.isArray(actions) || actions.length === 0)
    return [...problems, '"actions" must be a list of one or more actions'];
  if (actions.length > MAX_ACTIONS)
    problems.push(`${actions.length} actions; a sequence holds at most ${MAX_ACTIONS}`);

  const named = new Set();
  actions.forEach((action, i) => {
    const at = `action ${i + 1}`;
    const flag = (text) => problems.push(`${at}: ${text}`);
    if (!isObject(action)) return flag("is not a JSON object");
    const verbs = Object.keys(ACTIONS).filter((verb) => verb in action);
    if (verbs.length !== 1)
      return flag(`must hold exactly one action: ${Object.keys(ACTIONS).join(", ")}`);
    const [verb] = verbs;
    for (const key of Object.keys(action))
      if (key !== "session" && key !== verb && !ACTIONS[verb].includes(key))
        flag(`unknown key "${key}"`);
    const { session } = action;
    if (typeof session !== "string" || !/^[A-Z]$/.test(session))
      flag("session must name the action's Session: a single capital letter (A, B, …)");
    const value = action[verb];

    if (verb === "goto") {
      if (typeof value !== "string" || !value.startsWith("/") || /^\/[/\\]/.test(value))
        flag('goto must be a path starting with one "/": every page is on the checked address');
      else if (/\s/.test(value) || controlChar(value))
        flag("goto holds a space or control character");
      else {
        const query = value.includes("?") ? value.slice(value.indexOf("?") + 1).split("#")[0] : "";
        for (const pair of query.split("&").filter(Boolean)) {
          const key = decode(pair.split("=")[0]).toLowerCase().replace(/[-_]/g, "");
          if (SECRET_PARAM.test(key))
            flag(`goto: query parameter "${pair.split("=")[0]}" names a secret`);
        }
      }
    } else if (verb === "press") {
      if (typeof value !== "string" || value.length > 40 || !KEY.test(value))
        flag('press must be one key, such as "Enter", "Tab" or "Control+A"');
    } else if (verb === "step") {
      if (typeof value !== "string" || !value.trim() || value.length > 300)
        flag("step must be its caption: text of 1 to 300 characters");
      if (action.subject !== undefined)
        problems.push(...targetProblems(action.subject, `${at}: subject`));
      else if (action.timeoutMs !== undefined)
        flag("timeoutMs bounds the wait for a subject; a step with no subject takes it at once");
    } else problems.push(...targetProblems(value, `${at}: ${verb}`));

    if (
      action.timeoutMs !== undefined &&
      (!Number.isInteger(action.timeoutMs) ||
        action.timeoutMs < 0 ||
        action.timeoutMs > MAX_WAIT_MS)
    )
      flag(`timeoutMs must be a whole number of milliseconds, at most ${MAX_WAIT_MS}`);

    if (verb === "fill") {
      const text = action.value;
      if (typeof text !== "string" || text.length > 10_000)
        flag("value must be text of at most 10,000 characters");
      else {
        const field = isObject(value) ? [value.label, value.name, value.text].join(" ") : "";
        if (SECRET_FIELD.test(field) && !onlyPlaceholders(text) && text !== "")
          flag("value: the field names a secret; give it as {{env:QA_…}}");
        for (const [, kind, name] of text.matchAll(PLACEHOLDER)) {
          if (kind !== "env") flag(`value: {{${kind}:…}} is not a placeholder; use {{env:QA_…}}`);
          else if (!ENV_NAME.test(name))
            flag(`value: {{env:${name}}} cannot be read; only QA_ variables can (QA_A_PASSWORD)`);
          else named.add(name);
        }
      }
    }
  });

  for (const [where, text] of strings(sequence, "")) {
    const field = where.replace(/^\.actions\[(\d+)\]\.?/, (_, n) => `action ${Number(n) + 1}: `);
    if (!/\.value$/.test(where) && /\{\{/.test(text) && text.match(PLACEHOLDER))
      problems.push(`${field}: a placeholder goes only in a fill's value`);
    for (const [kind, pattern] of SECRET_SHAPES)
      if (pattern.test(text.replace(PLACEHOLDER, "")))
        problems.push(`${field} looks like ${kind}; give it as {{env:QA_…}}`);
  }
  for (const name of named) {
    const value = envValue(env, name);
    if (value === undefined || value === "") problems.push(`${name} is not set`);
    else if (/[\r\n]/.test(value)) problems.push(`${name} holds a line break`);
  }
  // A sign-in value written in, in place of its placeholder: in any case, a value
  // this sequence fills and any `QA_*` value whose name says it is a secret or an
  // email; as written and as a whole string or query value, one whose name says it
  // is only a username, filled or not, since a username such as `admin` is often a
  // common word a label or caption uses ("Admin", "the admin page"). Any other
  // variable is not looked for.
  const written = [...strings(sequence, "")].flatMap(([, text]) => [
    text,
    decode(text),
    decode(text.replace(/\+/g, " ")),
  ]);
  const lowered = written.map((text) => text.toLowerCase());
  // A username is a whole string or a whole query value, so "the admin page" is prose.
  const whole = new Set(
    written.flatMap((text) => {
      const query = text.indexOf("?");
      if (query < 0) return [text];
      return [text, ...new URLSearchParams(text.slice(query + 1)).values()];
    }),
  );
  for (const name of Object.keys(env)) {
    const value = ENV_NAME.test(name) ? envValue(env, name) : undefined;
    if (!value || value.length < MIN_SECRET_LENGTH) continue;
    const user = usernameOnly(name);
    const anyCase = !user && (named.has(name) || SECRET_VARIABLE.test(name));
    if (!anyCase && !user) continue;
    const found = anyCase
      ? encodedForms(value).some((form) =>
          lowered.some((text) => text.includes(form.toLowerCase())),
        )
      : whole.has(value);
    if (found)
      problems.push(
        `the sequence holds the value of ${name} inline; write {{env:${name}}} instead`,
      );
  }
  return problems;
}

// ── Running ─────────────────────────────────────────────────────────────────

/** A Playwright locator for a checked target. */
function locate(page, target) {
  const exact = target.exact ?? false;
  if (target.role !== undefined)
    return page.getByRole(
      target.role,
      target.name === undefined ? {} : { name: target.name, exact },
    );
  if (target.label !== undefined) return page.getByLabel(target.label, { exact });
  return page.getByText(target.text, { exact });
}

/** Masks one field's text with dots, over any page style. @param {Element} element */
const maskField = (element) =>
  /** @type {HTMLElement} */ (element).style.setProperty(
    "-webkit-text-security",
    "disc",
    "important",
  );

/**
 * Masks again, after every action, each field that holds a sign-in value, in
 * case the page replaced the field it was filled into (a re-render). Between
 * two actions a replaced field shows its text, so a video's masking is
 * best-effort; stills are covered by `withholdReason`.
 * @param {any} page @param {Held[]} values
 */
async function mask(page, values) {
  if (!values.length) return;
  for (const frame of page.frames())
    await frame
      .$$eval(
        "input:not([type=password]), textarea",
        (elements, [held, style]) => {
          for (const e of elements)
            if (
              held.some(({ value, exact }) => {
                const text = /** @type {HTMLInputElement} */ (e).value;
                return exact
                  ? text.includes(value)
                  : text.toLowerCase().includes(value.toLowerCase());
              })
            )
              /** @type {HTMLElement} */ (e).style.setProperty(style, "disc", "important");
        },
        [values, "-webkit-text-security"],
      )
      .catch(() => {});
}

/** Whether a page's address is the checked one (or the blank page a context opens on). */
const onAddress = (url, origin) => {
  if (url === "about:blank") return true;
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
};

/** The first line of an error, with no colour codes: Playwright's call logs stay out. */
const why = (error) =>
  String(/** @type {Error} */ (error)?.message ?? error)
    .replace(/\x1b\[[0-9;]*m/g, "")
    .split("\n")[0]
    .slice(0, 500);

/**
 * A sign-in value this run filled. A username (`exact`) is compared as written, since
 * it is often a common word the page shows in another case ("Admin"); any other is
 * compared in lower case, since `text-transform` changes the case `innerText` reports.
 * @typedef {{ value: string, exact: boolean }} Held
 */

/** Whether a text holds a filled sign-in value. @param {string} text @param {Held} held */
const holds = (text, { value, exact }) =>
  exact ? text.includes(value) : text.toLowerCase().includes(value.toLowerCase());

/**
 * Why a still must not be taken now, or null: a password field with a value,
 * a field holding a sign-in value, or a sign-in value on the screen (the
 * baseline capture rules, ADAPTER.md "Capture rules").
 * @param {any} page @param {Held[]} values the sign-in values this run filled
 */
async function withholdReason(page, values) {
  for (const frame of page.frames()) {
    let fields;
    let screen;
    try {
      fields = await frame.$$eval("input, textarea", (elements) =>
        elements.map((e) => ({
          password: e instanceof HTMLInputElement && e.type === "password",
          value: /** @type {HTMLInputElement} */ (e).value,
        })),
      );
      // The rendered text, and the text of every open shadow root (a web component's
      // "Signed in as …"), which `innerText` leaves out. Closed shadow roots stay unread.
      screen = await frame.evaluate(() => {
        const texts = [document.body?.innerText ?? ""];
        const walk = (root) => {
          for (const element of root.querySelectorAll("*"))
            if (element.shadowRoot) {
              texts.push(element.shadowRoot.textContent ?? "");
              walk(element.shadowRoot);
            }
        };
        walk(document);
        return texts.join("\n");
      });
    } catch {
      return "a frame's fields could not be read, so the still is withheld";
    }
    if (fields.some((f) => f.password && f.value)) return "a password field holds a value";
    if (fields.some((f) => f.value && values.some((held) => holds(f.value, held))))
      return "a field holds a sign-in value";
    if (values.some((held) => holds(screen, held))) return "a sign-in value is on the screen";
  }
  return null;
}

/**
 * Runs a checked sequence. Stops at the first action that does not complete.
 * @param {any} sequence a sequence `checkSequence` accepted
 * @param {{base: string, env: Record<string, string | undefined>, out: string,
 *   video: boolean, playwright: any, now?: () => number,
 *   screenshot?: (page: any, path: string) => Promise<unknown>}} options
 *   `screenshot` takes the still (a seam for tests; Playwright's own by default)
 */
export async function runSequence(
  sequence,
  { base, env, out, video, playwright, now, screenshot },
) {
  const clock = now ?? (() => performance.now());
  const shoot = screenshot ?? ((page, path) => page.screenshot({ path }));
  const origin = new URL(base).origin;
  const redact = new Redactor();
  /** @type {Held[]} each sign-in value a fill names, in the order filled, for the withhold check */
  const values = [];
  /** @type {[string, string][]} each sign-in value and its label */
  const labelled = [];
  for (const action of sequence.actions)
    if (typeof action.value === "string")
      for (const [, , name] of action.value.matchAll(PLACEHOLDER)) {
        const value = envValue(env, name);
        redact.add(value, `[redacted:${name}]`);
        if (value) labelled.push([value, `[redacted:${name}]`]);
        if (value && !values.some((held) => held.value === value))
          values.push({ value, exact: usernameOnly(name) });
      }

  const start = clock();
  const steps = [];
  /** @type {Record<string, {startedAtMs: number, video: string | null}>} */
  const sessionInfo = {};
  /** The action that did not complete, once one has not; also in the step file. */
  let error = null;
  const writeSteps = () =>
    writeFileSync(
      join(out, "steps.json"),
      `${JSON.stringify({ steps, sessions: sessionInfo, error }, null, 2)}\n`,
    );
  writeSteps();

  // No extra Chromium switches: a second disable-features switch would replace
  // Playwright's own list. An activated prerender is guarded by the main-frame
  // rule below, which decides per request.
  const browser = await playwright.chromium.launch({ headless: true });
  /** @type {Map<string, {context: any, page: any, state: {left: boolean}}>} */
  const sessions = new Map();
  const open = async (session) => {
    if (sessions.has(session)) return sessions.get(session);
    const letter = session.toLowerCase();
    const context = await browser.newContext({
      viewport: VIEWPORT,
      acceptDownloads: false,
      ...(video ? { recordVideo: { dir: join(out, `.video-${letter}`), size: VIEWPORT } } : {}),
    });
    context.setDefaultTimeout(ACTION_TIMEOUT_MS);
    context.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
    const state = { left: false, popup: false };
    const page = await context.newPage();
    // A page that tries to leave the checked address is stopped before the request
    // is sent: a link, a script, or a redirect at any hop, since a 307 after a
    // sign-in POST would resend the form. Playwright's routes see only a redirect's
    // first address, so this pauses each top-level document request, hops
    // included, through Chromium's own Fetch interception.
    const cdp = await context.newCDPSession(page);
    // A frame is a main frame unless it is known to have a parent: decided per
    // request, not by an id read once, so a main frame that replaces another
    // (an activated prerender, a new frame tree) is still guarded. A frame not yet
    // known counts as a main frame, so a doubt blocks rather than lets through.
    /** @type {Set<string>} */
    const subframes = new Set();
    cdp.on("Page.frameAttached", ({ frameId, parentFrameId }) => {
      if (parentFrameId) subframes.add(frameId);
    });
    cdp.on("Page.frameDetached", ({ frameId }) => subframes.delete(frameId));
    cdp.on("Page.frameNavigated", ({ frame }) => {
      if (frame.parentId) subframes.add(frame.id);
      else subframes.delete(frame.id);
    });
    await cdp.send("Page.enable");
    cdp.on("Fetch.requestPaused", (paused) => {
      const leaves = !subframes.has(paused.frameId) && !onAddress(paused.request.url, origin);
      if (leaves) state.left = true;
      cdp
        .send(
          leaves ? "Fetch.failRequest" : "Fetch.continueRequest",
          leaves
            ? { requestId: paused.requestId, errorReason: "BlockedByClient" }
            : { requestId: paused.requestId },
        )
        .catch(() => {});
    });
    await cdp.send("Fetch.enable", {
      patterns: [{ urlPattern: "*", resourceType: "Document", requestStage: "Request" }],
    });
    // A tab or window a click opens is closed, not followed. Its first request is
    // stopped before it is sent: a route sees every page's first request, popups'
    // included (a `target="_blank"` sign-in form would carry its password out).
    await context.route("**/*", (route) => {
      const request = route.request();
      if (!request.isNavigationRequest()) return route.continue();
      // A popup's first request comes before Playwright knows its page, so it has
      // no frame yet: that, or any page but the Session's, is a popup.
      let ours = false;
      try {
        ours = request.frame().page() === page;
      } catch {
        // no frame yet
      }
      if (ours) return route.continue();
      state.popup = true;
      return route.abort("blockedbyclient");
    });
    context.on("page", (opened) => {
      if (opened === page) return;
      state.popup = true;
      opened.close().catch(() => {});
    });
    sessionInfo[session] = { startedAtMs: Math.round(clock() - start), video: null };
    const opened = { context, page, state };
    sessions.set(session, opened);
    return opened;
  };
  /** A sign-in value in any case (`text-transform`), replaced by its variable's name. */
  const redactAnyCase = (text) =>
    labelled.reduce(
      (out, [value, label]) =>
        out.replace(new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), label),
      text,
    );
  const fill = (text) => text.replace(PLACEHOLDER, (_, __, name) => envValue(env, name) ?? "");

  let done = 0;
  /** Whether any Session's context has opened a tab or window. */
  const opened = () => [...sessions.values()].some(({ state }) => state.popup);
  let lastAt = -1;
  const videos = [];
  try {
    for (const [i, action] of sequence.actions.entries()) {
      const { session } = action;
      const [verb] = Object.keys(ACTIONS).filter((v) => v in action);
      try {
        const { page, state } = await open(session);
        if (verb === "goto") await page.goto(new URL(action.goto, origin).href);
        else if (verb === "click") await locate(page, action.click).click();
        else if (verb === "press") await page.keyboard.press(action.press);
        else if (verb === "wait")
          await locate(page, action.wait).waitFor({
            state: "visible",
            timeout: action.timeoutMs ?? DEFAULT_WAIT_MS,
          });
        else if (verb === "fill") {
          const field = locate(page, action.fill);
          const type = await field.evaluate((e) => (e instanceof HTMLInputElement ? e.type : ""));
          if (type === "password" && action.value !== "" && !onlyPlaceholders(action.value))
            throw new Error("a literal value into a password field; give it as {{env:QA_…}}");
          // A field filled from a sign-in value shows dots, as a password field does,
          // so the value as typed reaches no still or video frame (best-effort: see `mask`).
          if (action.value.match(PLACEHOLDER)) await field.evaluate(maskField);
          await field.fill(fill(action.value));
        } else {
          let subject = null;
          let text = null;
          if (action.subject) {
            const element = locate(page, action.subject);
            await element.waitFor({
              state: "visible",
              timeout: action.timeoutMs ?? DEFAULT_WAIT_MS,
            });
            const box = await element.boundingBox();
            subject = box && {
              x: Math.round(box.x),
              y: Math.round(box.y),
              width: Math.round(box.width),
              height: Math.round(box.height),
            };
            const visible = redactAnyCase(redact.text((await element.innerText()).trim()));
            text =
              visible.length > TEXT_LIMIT
                ? `${visible.slice(0, TEXT_LIMIT)} [cut at ${TEXT_LIMIT} characters]`
                : visible;
          }
          const index = steps.length + 1;
          let withheld = await withholdReason(page, values);
          let still = withheld
            ? null
            : `step-${String(index).padStart(2, "0")}-${session.toLowerCase()}.png`;
          const atMs = Math.max(Math.round(clock() - start), lastAt + 1);
          lastAt = atMs;
          if (still) {
            await shoot(page, join(out, still));
            // The page's scripts kept running while the still was taken: check again,
            // and drop a still that may show what the first check did not.
            withheld = await withholdReason(page, values);
            if (withheld) {
              rmSync(join(out, still), { force: true });
              still = null;
            }
          }
          steps.push({
            session,
            index,
            caption: redactAnyCase(redact.text(action.step)),
            still,
            subject,
            text,
            atMs,
            withheld,
          });
          writeSteps();
        }
        if (state.left || !onAddress(page.url(), origin)) throw new Error(LEFT);
        // A popup may come from a callback after its action returned: any Session's
        // counts, and is named by the last action that ran, not blamed on it.
        if (opened()) throw new Error(popupWhy(i + 1));
        await mask(page, values);
        done += 1;
      } catch (failure) {
        const left = sessions.get(session)?.state.left;
        error = {
          action: i + 1,
          session,
          verb,
          why: left ? LEFT : redact.text(why(failure)),
        };
        break;
      }
    }
    // A last action may still open a tab or window: wait briefly, and check once more.
    if (!error && sessions.size) {
      await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
      const n = sequence.actions.length;
      if (opened()) {
        const last = sequence.actions[n - 1];
        const verb = Object.keys(ACTIONS).find((v) => v in last);
        error = { action: n, session: last.session, verb, why: popupWhy(n) };
        done -= 1;
      }
    }
  } finally {
    for (const [session, { context, page }] of sessions) {
      const recording = video ? page.video() : null;
      await context.close().catch(() => {});
      if (recording) {
        const name = `video-${session.toLowerCase()}.webm`;
        try {
          await recording.saveAs(join(out, name));
          await recording.delete();
          sessionInfo[session].video = name;
          videos.push(name);
        } catch {
          // the run's own error says what went wrong
        }
      }
      rmSync(join(out, `.video-${session.toLowerCase()}`), { recursive: true, force: true });
    }
    await browser.close().catch(() => {});
    writeSteps();
  }
  return {
    completed: error === null && done === sequence.actions.length,
    actions: done,
    steps,
    videos,
    ...(error ? { error } : {}),
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const USAGE = "usage: node web.mjs run <sequence.json> --base <address> --out <dir> [--video]\n";
const INSTALL =
  "web.mjs needs Playwright with Chromium in this repository, and never installs it. " +
  "To use it, run `npm install --save-dev playwright` and `npx playwright install chromium` here; " +
  "otherwise drive the `web` scenarios with the harness's browser (manual-qa SKILL.md step 4).\n";
/** The files a run writes into `--out`, removed before the next run writes its own. */
const OWN_FILE = /^(?:steps\.json|step-\d+-[a-z]\.png|video-[a-z]\.webm)$/;

/**
 * @param {string[]} argv the arguments after the script
 * @param {{env?: Record<string, string | undefined>, cwd?: string,
 *   readFile?: (path: string) => string | null}} [io]
 * @returns {Promise<{code: number, out: string}>}
 */
export async function main(argv, io = {}) {
  const usage = { code: 2, out: USAGE };
  const [command, target, ...rest] = argv;
  if (command !== "run" || target === undefined || target.startsWith("--")) return usage;
  const options = {};
  for (let i = 0; i < rest.length; i += 1) {
    const flag = rest[i];
    if (flag === "--video" && !("--video" in options)) options[flag] = true;
    else if (["--base", "--out"].includes(flag) && rest[i + 1] !== undefined && !(flag in options))
      options[flag] = rest[++i];
    else return usage;
  }
  if (options["--base"] === undefined || options["--out"] === undefined) return usage;
  let base;
  try {
    base = new URL(options["--base"]);
  } catch {
    return usage;
  }
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) return usage;
  if (base.pathname !== "/" || base.search || base.hash)
    return {
      code: 2,
      out: `${USAGE}--base is an address with no path; put the path in each goto\n`,
    };

  const env = io.env ?? process.env;
  const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
  const readFile =
    io.readFile ??
    ((path) => {
      try {
        return readFileSync(resolve(path), "utf8");
      } catch {
        return null;
      }
    });
  const text = readFile(target);
  if (text === null)
    return { code: 1, out: json({ completed: false, problems: [`${target}: no such file`] }) };
  let sequence;
  try {
    sequence = JSON.parse(text);
  } catch {
    return { code: 1, out: json({ completed: false, problems: [`${target}: not JSON`] }) };
  }
  const problems = checkSequence(sequence, env);
  if (problems.length) return { code: 1, out: json({ completed: false, problems }) };

  const found = findPlaywright(io.cwd ?? process.cwd());
  if (!found.module) return { code: 2, out: INSTALL };
  if (!found.chromium)
    return {
      code: 2,
      out: `Playwright (\`${found.package}\`) is here but its Chromium is not: run \`npx playwright install chromium\`. ${INSTALL}`,
    };

  const out = resolve(options["--out"]);
  mkdirSync(out, { recursive: true });
  for (const file of readdirSync(out))
    if (OWN_FILE.test(file)) rmSync(join(out, file), { force: true });
  let result;
  try {
    result = await runSequence(sequence, {
      base: base.href,
      env,
      out,
      video: options["--video"] === true,
      playwright: found.module,
    });
  } catch (error) {
    // Chromium would not start: the driver's own failure, not an action's.
    return { code: 2, out: `Chromium did not start: ${why(error)}\n${INSTALL}` };
  }
  const summary = {
    out: options["--out"],
    steps: join(options["--out"], "steps.json"),
    completed: result.completed,
    actions: result.actions,
    stills: result.steps.filter((s) => s.still).length,
    withheld: result.steps.filter((s) => s.withheld).length,
    videos: result.videos,
    ...(result.error ? { error: result.error } : {}),
  };
  return { code: result.completed ? 0 : 1, out: json(summary) };
}

const real = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

// Compared as real paths: `file://${argv[1]}` never matches on Windows, and a
// symlinked skills directory must still count as running this file.
if (process.argv[1] && real(fileURLToPath(import.meta.url)) === real(process.argv[1])) {
  const { code, out } = await main(process.argv.slice(2));
  process.stdout.write(out);
  process.exitCode = code;
}
