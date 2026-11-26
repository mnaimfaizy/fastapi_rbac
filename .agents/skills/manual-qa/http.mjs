// The `api` surface's driver (SKILL.md steps 4 and 6, ADAPTER.md "The api
// driver", DESIGN.md "A driver for the api surface").
//
// WHAT IT DOES
//   Runs a request sequence the runner wrote from one scenario's steps, and
//   writes that scenario's evidence log. It uses Node's built-in `fetch` and
//   no dependency, so no shell quoting or line ending can change a request.
//
//   - The sequence is a JSON file under `working_dir`. A plan is never run as
//     code: the runner reads the plan's steps and writes the sequence.
//   - Every request goes to the one address the run checked (`--base`, the
//     address `adapter.mjs host` let through); a path is relative to it, and
//     a redirect is recorded, never followed.
//   - Each Session (`A`, `B`, …) has its own cookie jar, `HttpOnly` cookies
//     included; no Session ever sends another's cookie.
//   - Sign-in values come only from `QA_*` environment variables, named in
//     the sequence as `{{env:QA_NAME}}`. Never from the sequence file or the
//     command line: a sequence that carries a secret inline is refused, and
//     nothing is sent.
//   - The log records, for each request, the method, path, status, each
//     header the sequence names (`Set-Cookie` always) and the response body,
//     with sign-in values, cookie values and tokens redacted.
//
//   Its exit status says whether every request completed (got a response,
//   whatever its status), never whether the scenario passed: the runner judges
//   that against the scenario's **Expected result:**.
//
// CLI (run from the repository root)
//   node http.mjs run <sequence.json> --base <address> --log <path>
//
//   Exit 0: every request completed. Exit 1: the sequence was refused (no
//   request sent), or a request did not complete (the log holds every request
//   up to it). Exit 2: usage. Stdout is a JSON summary, redacted like the log.

import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
const REQUEST_KEYS = ["session", "method", "path", "headers", "json", "form", "body", "capture"];
/** At most this many requests in one sequence. */
export const MAX_REQUESTS = 200;
/** A request with no response after this long did not complete. */
export const TIMEOUT_MS = 30_000;
/** A response body longer than this is cut in the log. */
export const BODY_LIMIT = 65_536;
/**
 * A value shorter than this is too common to find by its text: a cookie value
 * that short is redacted only in its `Set-Cookie` line, and a `QA_*` value
 * that short is not looked for in the sequence file.
 */
const MIN_SECRET_LENGTH = 4;
/** A cookie value this long is taken for an opaque token, whatever its name. */
const OPAQUE_COOKIE_LENGTH = 16;

const PLACEHOLDER = /\{\{(env|cookie):([^}]*)\}\}/g;
const ENV_NAME = /^QA_[A-Z0-9_]+$/;
const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
/** A key or header name that names a secret, compared lower case with `-` and `_` removed. */
const SECRET_NAME =
  /password|passwd|passphrase|secret|token|apikey|credential|authorization|^auth$|^pass$|^pwd$|^pw$|^otp$|^totp$|^pin$|^cookie$|^session$|^sessionid$|^sid$|recoverycode|mfacode/;
/** A header that carries a credential, whatever its name says. */
const SECRET_HEADER =
  /^(?:authorization|proxyauthorization)$|token|secret|apikey|password|auth|session/;
/** What an Authorization header may hold besides placeholders. */
const AUTH_SCHEME = /^\s*(?:Bearer|Basic|Token|Bot)?\s*$/i;
/** Values that are secrets by their shape alone. */
const SECRET_SHAPES = [
  ["a JWT", /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g],
  [
    "a bearer or basic credential",
    // A challenge's auth-param (`Bearer realm="api"`) is not a credential, but
    // only these names count as one: a base64 credential can end `="` too.
    /\b(?:Bearer|Basic)\s+(?!\{\{|\[redacted|(?:realm|error|error_description|error_uri|scope|charset|nonce|opaque|algorithm|qop|stale|domain)\s*=)[A-Za-z0-9._~+/=-]{6,}/g,
  ],
  ["a GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g],
  ["an API key", /\b(?:sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|xox[abpr]-[A-Za-z0-9-]{10,})/g],
];
/**
 * `key=value` or `"key": "value"` with a secret-named key, in raw text: the
 * words `SECRET_NAME` holds, as whole keys. A quoted value runs to its closing
 * quote; an unquoted one stops at a space or a separator.
 */
const NAMED_IN_TEXT =
  /(?<![A-Za-z0-9_-])(["']?)([A-Za-z0-9_-]*(?:password|passwd|passphrase|secret|token|api[_-]?key|credential|recovery[_-]?code|mfa[_-]?code)[A-Za-z0-9_-]*|auth|pass|pwd|pw|otp|totp|pin|session|session[_-]?id|sid)\1(\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s"'&,;}[{?][^\s"'&,;}?]*)/gi;
/**
 * A value `NAMED_IN_TEXT` leaves as it is: empty, already redacted, or
 * `true`, `false` or `null`, which say whether a secret is there, not what it
 * is (`"password_changed": true`, `"session": null` after sign-out).
 */
const KEPT_VALUE = /^(?:""|''|["']?\[redacted|(?:true|false|null)$)/;
/** The text matches of `NAMED_IN_TEXT` that hold a value, not an empty or redacted one. */
const namedValues = (text) =>
  [...text.matchAll(NAMED_IN_TEXT)].filter(([, , , , value]) => !KEPT_VALUE.test(value));

const secretName = (name) => SECRET_NAME.test(String(name).toLowerCase().replace(/[-_]/g, ""));
/**
 * Headers that name auth but carry no credential: a challenge's scheme, realm
 * and `error="invalid_token"` are often the evidence an auth scenario needs.
 * The text rules still remove anything token-shaped inside them.
 */
const CHALLENGE_HEADERS = new Set(["wwwauthenticate", "proxyauthenticate", "authenticationinfo"]);
const secretHeader = (name) => {
  const key = name.toLowerCase().replace(/[-_]/g, "");
  return !CHALLENGE_HEADERS.has(key) && SECRET_HEADER.test(key);
};
const onlyPlaceholders = (text) => text.replace(PLACEHOLDER, "").trim() === "";
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Every placeholder in a string, as `{kind, name}`. */
const placeholdersIn = (text) =>
  [...text.matchAll(PLACEHOLDER)].map((m) => ({ kind: m[1], name: m[2] }));

/** Every string value in a JSON value, with its dotted key path. */
function* strings(value, path) {
  if (typeof value === "string") yield [path, value];
  else if (Array.isArray(value))
    for (const [i, v] of value.entries()) yield* strings(v, `${path}[${i}]`);
  else if (isObject(value))
    for (const [k, v] of Object.entries(value)) yield* strings(v, `${path}.${k}`);
}

/** Every `[key, value]` pair under a secret-named key, at any depth. */
function* secretFields(value, path) {
  if (Array.isArray(value))
    for (const [i, v] of value.entries()) yield* secretFields(v, `${path}[${i}]`);
  else if (isObject(value))
    for (const [k, v] of Object.entries(value)) {
      if (secretName(k)) yield [`${path}.${k}`, v];
      else yield* secretFields(v, `${path}.${k}`);
    }
}

/** A secret-named field may hold only placeholders, `null` or a boolean. */
const literalSecret = (value) =>
  !(
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "string" && onlyPlaceholders(value))
  );

/** The `key=value` pairs of a query string or form-encoded text, undecoded. */
const pairs = (text) =>
  text
    .split("&")
    .filter(Boolean)
    .map((pair) => {
      const at = pair.indexOf("=");
      return at < 0 ? [pair, ""] : [pair.slice(0, at), pair.slice(at + 1)];
    });

/**
 * Checks a parsed sequence before anything is sent. Each problem names the
 * request and the field, never a value.
 * @param {unknown} sequence
 * @param {Record<string, string | undefined>} env
 * @returns {string[]}
 */
export function checkSequence(sequence, env) {
  if (!isObject(sequence)) return ['the sequence is not a JSON object with a "requests" list'];
  const problems = [];
  for (const key of Object.keys(sequence))
    if (key !== "requests") problems.push(`unknown key "${key}"; a sequence has only "requests"`);
  const { requests } = /** @type {any} */ (sequence);
  if (!Array.isArray(requests) || requests.length === 0)
    return [...problems, '"requests" must be a list of one or more requests'];
  if (requests.length > MAX_REQUESTS)
    problems.push(`${requests.length} requests; a sequence holds at most ${MAX_REQUESTS}`);

  const named = new Set();
  requests.forEach((request, i) => {
    const at = `request ${i + 1}`;
    const flag = (text) => problems.push(`${at}: ${text}`);
    if (!isObject(request)) return flag("is not a JSON object");
    for (const key of Object.keys(request))
      if (!REQUEST_KEYS.includes(key)) flag(`unknown key "${key}"`);
    const { session = "A", method, path, headers = {}, json, form, body, capture = [] } = request;

    if (typeof session !== "string" || !/^[A-Z]$/.test(session))
      flag("session must be a single capital letter (A, B, …)");
    if (!METHODS.includes(method)) flag(`method must be one of ${METHODS.join(", ")}`);
    /** Each string a placeholder may appear in, by field. */
    const texts = [];
    if (typeof path !== "string" || !path.startsWith("/") || /^\/[/\\]/.test(path))
      flag('path must start with one "/": every request goes to the checked address');
    else if (/[\s\x00-\x1f\x7f]/.test(path)) flag("path holds a space or control character");
    else {
      texts.push(["path", path]);
      const query = path.includes("?") ? path.slice(path.indexOf("?") + 1).split("#")[0] : "";
      for (const [key, value] of pairs(query))
        if (secretName(decodeURIComponentSafe(key)) && !onlyPlaceholders(value))
          flag(`path: query parameter "${key}" names a secret; give it as {{env:QA_…}}`);
    }

    if (!isObject(headers)) flag("headers must be an object of header names to string values");
    else
      for (const [name, value] of Object.entries(headers)) {
        const where = `headers.${name}`;
        if (!TOKEN.test(name)) flag(`${where} is not a valid header name`);
        else if (typeof value !== "string") flag(`${where} must be a string`);
        else if (/[\r\n]/.test(value)) flag(`${where} holds a line break`);
        else if (name.toLowerCase() === "cookie")
          flag(
            `${where}: cookies come from the Session's jar; a sequence never sets a Cookie header`,
          );
        else if (["host", "content-length"].includes(name.toLowerCase()))
          flag(`${where} is set by the driver, not the sequence`);
        else {
          texts.push([where, value]);
          if (secretHeader(name)) {
            const rest = value.replace(PLACEHOLDER, "");
            if (!placeholdersIn(value).length || !AUTH_SCHEME.test(rest))
              flag(`${where} names a secret; give it as {{env:QA_…}}, after its scheme at most`);
          }
        }
      }

    const bodies = [json, form, body].filter((b) => b !== undefined).length;
    // fetch refuses a body here at run time, which would read as a request
    // that got no response.
    if (bodies > 0 && ["GET", "HEAD"].includes(method))
      flag(`${method} cannot carry a body; drop "json", "form" and "body", or use another method`);
    if (bodies > 1) flag('give at most one of "json", "form" and "body"');
    if (json !== undefined) {
      texts.push(...strings(json, "json"));
      for (const [where, value] of secretFields(json, "json"))
        if (literalSecret(value)) flag(`${where} names a secret; give it as {{env:QA_…}}`);
    }
    if (form !== undefined) {
      if (!isObject(form) || Object.values(form).some((v) => typeof v !== "string"))
        flag("form must be an object of names to string values");
      else
        for (const [name, value] of Object.entries(form)) {
          texts.push([`form.${name}`, value]);
          if (secretName(name) && !onlyPlaceholders(value))
            flag(`form.${name} names a secret; give it as {{env:QA_…}}`);
        }
    }
    if (body !== undefined) {
      if (typeof body !== "string") flag("body must be a string; use json for a JSON body");
      else {
        texts.push(["body", body]);
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = undefined;
        }
        const literal =
          parsed !== undefined
            ? [...secretFields(parsed, "body")].some(([, v]) => literalSecret(v))
            : pairs(body).some(([k, v]) => secretName(k) && !onlyPlaceholders(v)) ||
              namedValues(body.replace(PLACEHOLDER, "")).length > 0;
        if (literal) flag("body names a secret; give it as {{env:QA_…}}");
      }
    }
    if (!Array.isArray(capture) || capture.some((h) => typeof h !== "string" || !TOKEN.test(h)))
      flag("capture must be a list of header names");

    for (const [where, text] of texts) {
      for (const [kind, pattern] of SECRET_SHAPES)
        if (text.replace(PLACEHOLDER, "").match(new RegExp(pattern.source)))
          flag(`${where} looks like ${kind}; give it as {{env:QA_…}}`);
      for (const { kind, name } of placeholdersIn(text)) {
        if (kind === "cookie") {
          if (!TOKEN.test(name)) flag(`${where}: {{cookie:${name}}} is not a cookie name`);
        } else if (!ENV_NAME.test(name))
          flag(
            `${where}: {{env:${name}}} cannot be read; only QA_ variables can (QA_ADMIN_PASSWORD)`,
          );
        else named.add(name);
      }
    }
  });

  for (const name of named) {
    const value = envValue(env, name);
    if (value === undefined || value === "") problems.push(`${name} is not set`);
    else if (/[\r\n]/.test(value)) problems.push(`${name} holds a line break`);
  }
  // A sign-in value written into the file itself, in place of its placeholder,
  // in any form it could be sent in: each string is also read percent- and
  // form-decoded, since a value may be encoded in more than one way.
  const written = [...strings(sequence, "")].flatMap(([, text]) => [
    text,
    decodeURIComponentSafe(text),
    decodeURIComponentSafe(text.replace(/\+/g, " ")),
  ]);
  for (const name of Object.keys(env)) {
    const value = ENV_NAME.test(name) ? envValue(env, name) : undefined;
    if (
      value &&
      value.length >= MIN_SECRET_LENGTH &&
      encodedForms(value).some((form) => written.some((text) => text.includes(form)))
    )
      problems.push(
        `the sequence holds the value of ${name} inline; write {{env:${name}}} instead`,
      );
  }
  return problems;
}

function decodeURIComponentSafe(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * Each form a value can travel or come back in: raw, URL-encoded, form-encoded
 * (a space as `+`), JSON-escaped and HTML-escaped.
 * @param {string} value
 */
export function encodedForms(value) {
  const html = value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
  return [
    ...new Set([
      value,
      encodeURIComponent(value),
      encodePathValue(value),
      new URLSearchParams([["", value]]).toString().slice(1),
      JSON.stringify(value).slice(1, -1),
      html,
    ]),
  ];
}

/**
 * A value as it goes into a path: `encodeURIComponent`, and also `!'()*`,
 * which `new URL` would otherwise percent-encode in a query on its own,
 * sending a form the redactor would not know.
 * @param {string} value
 */
export function encodePathValue(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** A `Set-Cookie` line's name, value and attributes. @param {string} line */
export function parseSetCookie(line) {
  const [pair, ...attributes] = line.split(";");
  const eq = pair.indexOf("=");
  return eq < 0
    ? { name: pair.trim(), value: "", attributes }
    : { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim(), attributes };
}

/**
 * A removing line's value that is a placeholder, not a credential: one word of
 * letters, shorter than an opaque token (`deleted`, `removed`, `expired`).
 */
const PLACEHOLDER_VALUE = /^[A-Za-z]{0,15}$/;

/** How far past an `Expires` must be to count as removal when the response has no `Date`. */
const NO_DATE_MARGIN_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a `Set-Cookie` line removes its own cookie: a `Max-Age` of 0 or
 * less, or, with no valid `Max-Age`, an `Expires` earlier than the response's
 * `Date`. The server sets both by its own clock, so the runner's clock cannot
 * skew the call. With no usable `Date`, only an `Expires` more than a day
 * before the runner's clock counts. A wrong "removed" leaks a credential, so a
 * doubtful `Expires` keeps the value searched. Attribute names match in any case.
 * @param {string[]} attributes @param {number | null} [responseDate] the response's `Date`, in ms
 */
function removesItself(attributes, responseDate) {
  let maxAge = null;
  let expires = null;
  for (const attribute of attributes) {
    const [key, ...rest] = attribute.split("=");
    const val = rest.join("=").trim();
    const k = key.trim().toLowerCase();
    if (k === "max-age" && /^-?\d+$/.test(val)) maxAge = Number(val);
    else if (k === "expires" && !Number.isNaN(Date.parse(val))) expires = Date.parse(val);
  }
  if (maxAge !== null) return maxAge <= 0;
  if (expires === null) return false;
  return Number.isFinite(responseDate)
    ? expires < responseDate
    : expires < Date.now() - NO_DATE_MARGIN_MS;
}

/**
 * Whether a cookie's value is also redacted wherever else it appears in the
 * log, not only in its own `Set-Cookie` line: when the cookie is a secret by
 * its name, is `HttpOnly`, or holds an opaque value of 16 characters or more.
 * A flag-like cookie (`logged_in=true`, `theme=light`, `user_id=1042`) is not
 * searched for, so the same text in a body stays readable evidence. Nor is a
 * placeholder on a line that removes its cookie (`PHPSESSID=deleted; Max-Age=0`).
 * Any other value on a removing line goes through the rules above, and a value
 * another line in the run made searched stays searched.
 * @param {{name: string, value: string, attributes: string[]}} cookie
 * @param {number | null} [responseDate] the `Date` of the response that set it, in ms
 */
export function searchedCookie({ name, value, attributes }, responseDate = null) {
  if (value.length < MIN_SECRET_LENGTH || /^(?:true|false|null)$/i.test(value)) return false;
  if (PLACEHOLDER_VALUE.test(value) && removesItself(attributes, responseDate)) return false;
  const httpOnly = attributes.some((a) => a.trim().toLowerCase() === "httponly");
  return secretName(name) || httpOnly || value.length >= OPAQUE_COOKIE_LENGTH;
}

/** An environment value with any trailing line ending removed (a `\r` from a Windows tool). */
function envValue(env, name) {
  const value = env[name];
  return typeof value === "string" ? value.replace(/[\r\n]+$/, "") : undefined;
}

// ── Cookies ─────────────────────────────────────────────────────────────────

/**
 * One Session's cookies, for the one checked origin: kept by name and Path,
 * dropped when the server expires them, sent where their Path matches.
 */
export class CookieJar {
  constructor() {
    /** @type {Map<string, {name: string, value: string, path: string, expires: number | null}>} */
    this.cookies = new Map();
  }

  /**
   * @param {string[]} setCookies the response's `Set-Cookie` lines
   * @param {string} requestPath the path of the request that got them
   */
  store(setCookies, requestPath) {
    for (const line of setCookies) {
      const { name, value, attributes } = parseSetCookie(line);
      if (!name || !line.includes("=")) continue;
      let path = null;
      let expires = null;
      let maxAge = null;
      for (const attribute of attributes) {
        const [key, ...rest] = attribute.split("=");
        const val = rest.join("=").trim();
        const k = key.trim().toLowerCase();
        if (k === "path" && val.startsWith("/")) path = val;
        else if (k === "max-age" && /^-?\d+$/.test(val)) maxAge = Number(val);
        else if (k === "expires" && !Number.isNaN(Date.parse(val))) expires = Date.parse(val);
      }
      if (maxAge !== null) expires = Date.now() + maxAge * 1000;
      path ??= defaultPath(requestPath);
      const key = `${name}\n${path}`;
      if (expires !== null && expires <= Date.now()) this.cookies.delete(key);
      else this.cookies.set(key, { name, value, path, expires });
    }
  }

  /**
   * The value the jar would send to a path under this name, or undefined.
   * @param {string} name @param {string} requestPath
   */
  value(name, requestPath) {
    return this.matching(requestPath).find((c) => c.name === name)?.value;
  }

  all() {
    const now = Date.now();
    return [...this.cookies.values()].filter((c) => c.expires === null || c.expires > now);
  }

  /** The cookies sent to a path, longest Path first. */
  matching(requestPath) {
    return this.all()
      .filter((c) => pathMatches(requestPath, c.path))
      .sort((a, b) => b.path.length - a.path.length);
  }

  /** @param {string} requestPath @returns {string} the `Cookie` header, or "" */
  header(requestPath) {
    return this.matching(requestPath)
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
  }
}

function defaultPath(requestPath) {
  const path = requestPath.split("?")[0];
  const slash = path.lastIndexOf("/");
  return slash <= 0 ? "/" : path.slice(0, slash);
}

function pathMatches(requestPath, cookiePath) {
  const path = requestPath.split("?")[0] || "/";
  if (path === cookiePath) return true;
  if (!path.startsWith(cookiePath)) return false;
  return cookiePath.endsWith("/") || path[cookiePath.length] === "/";
}

// ── Redaction ───────────────────────────────────────────────────────────────

/**
 * The redaction rule (ADAPTER.md "The api driver"). Everything written to the
 * log or stdout passes through it.
 */
export class Redactor {
  constructor() {
    /** @type {{text: string, label: string}[]} */
    this.secrets = [];
  }

  /** A value replaced by `label` wherever it appears, in each of its `encodedForms`. */
  add(text, label) {
    if (!text) return;
    for (const form of encodedForms(text))
      if (!this.secrets.some((s) => s.text === form)) this.secrets.push({ text: form, label });
    this.secrets.sort((a, b) => b.text.length - a.text.length);
  }

  /** @param {string} text */
  text(text) {
    let out = text;
    for (const { text: secret, label } of this.secrets) out = out.split(secret).join(label);
    for (const [kind, pattern] of SECRET_SHAPES)
      out = out.replace(pattern, (match) =>
        kind.startsWith("a bearer") ? `${match.split(/\s+/)[0]} [redacted]` : "[redacted]",
      );
    return out.replace(NAMED_IN_TEXT, (match, q, key, sep, value) => {
      if (KEPT_VALUE.test(value)) return match;
      const quote = /^["']/.test(value) ? value[0] : "";
      return `${q}${key}${q}${sep}${quote}[redacted]${quote}`;
    });
  }

  /** A path, with each secret-named query parameter's value redacted. */
  path(path) {
    const at = path.indexOf("?");
    if (at < 0) return this.text(path);
    const query = pairs(path.slice(at + 1))
      .map(([k, v]) => (secretName(decodeURIComponentSafe(k)) ? `${k}=[redacted]` : `${k}=${v}`))
      .join("&");
    return this.text(`${path.slice(0, at)}?${query}`);
  }

  /** A `Set-Cookie` line: its value always redacted, its attributes kept. */
  setCookie(line) {
    const { name, attributes } = parseSetCookie(line);
    return this.text([`${name}=[redacted:cookie ${name}]`, ...attributes].join(";"));
  }

  /**
   * A response body, as the server sent it, through the text rules. Only a
   * JSON body with a secret-named field holding a value is written out again,
   * with that field's whole value (a list or object included) redacted; a
   * body that needs no field redacted keeps its exact text (a 64-bit id, a
   * duplicate key, `1.0`).
   */
  body(text) {
    let out = text;
    try {
      const parsed = JSON.parse(text);
      let redacted = false;
      const replacer = (key, value) => {
        if (!key || !secretName(key) || value === null || typeof value === "boolean") return value;
        redacted = true;
        return "[redacted]";
      };
      if (parsed !== null && typeof parsed === "object") {
        const rewritten = JSON.stringify(parsed, replacer, 2);
        if (redacted) out = rewritten;
      }
    } catch {
      // not JSON: the text rules alone
    }
    out = this.text(out);
    return out.length > BODY_LIMIT
      ? `${out.slice(0, BODY_LIMIT)}\n[cut at ${BODY_LIMIT} characters]`
      : out;
  }
}

// ── Running ─────────────────────────────────────────────────────────────────

/**
 * Runs a checked sequence. Stops at the first request that does not complete.
 * @param {any} sequence a sequence `checkSequence` accepted
 * @param {{base: string, env: Record<string, string | undefined>, fetch?: typeof fetch}} options
 */
export async function runSequence(sequence, { base, env, fetch: send = fetch }) {
  const origin = new URL(base).origin;
  const redact = new Redactor();
  /** @type {Map<string, CookieJar>} */
  const jars = new Map();
  const entries = [];
  const fill = (text, jar, path, encode) =>
    text.replace(PLACEHOLDER, (_, kind, name) => {
      const value = kind === "env" ? envValue(env, name) : jar.value(name, path);
      if (value === undefined) throw new Error(`the Session has no cookie ${name}`);
      if (kind === "env") redact.add(value, `[redacted:${name}]`);
      return encode ? encodePathValue(value) : value;
    });
  const fillJson = (value, jar, path) =>
    typeof value === "string"
      ? fill(value, jar, path, false)
      : Array.isArray(value)
        ? value.map((v) => fillJson(v, jar, path))
        : isObject(value)
          ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fillJson(v, jar, path)]))
          : value;

  for (const [i, request] of sequence.requests.entries()) {
    const session = request.session ?? "A";
    const method = request.method;
    if (!jars.has(session)) jars.set(session, new CookieJar());
    const jar = jars.get(session);
    const entry = { n: i + 1, session, method, path: request.path, status: null };
    entries.push(entry);
    try {
      // A `{{cookie:…}}` takes the value the jar would send to this path.
      const target = request.path.split("?")[0];
      const path = fill(request.path, jar, target, true);
      entry.path = path;
      const url = new URL(path, origin);
      if (url.origin !== origin) throw new Error("the path leaves the checked address");
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers ?? {}))
        headers.set(name, fill(value, jar, url.pathname, false));
      let body;
      if (request.json !== undefined) {
        body = JSON.stringify(fillJson(request.json, jar, url.pathname));
        if (!headers.has("content-type")) headers.set("content-type", "application/json");
      } else if (request.form !== undefined)
        body = new URLSearchParams(
          Object.entries(request.form).map(([k, v]) => [
            k,
            fill(/** @type {string} */ (v), jar, url.pathname, false),
          ]),
        );
      else if (request.body !== undefined) body = fill(request.body, jar, url.pathname, false);
      const cookie = jar.header(url.pathname);
      if (cookie) headers.set("cookie", cookie);

      const response = await send(url, {
        method,
        headers,
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const text = method === "HEAD" ? "" : await response.text();
      const setCookies = response.headers.getSetCookie();
      jar.store(setCookies, url.pathname);
      // Every cookie the jar takes in is redacted from here on, before it is
      // ever sent: in its Set-Cookie line always, elsewhere by `searchedCookie`.
      const responseDate = Date.parse(response.headers.get("date") ?? "");
      for (const cookie of setCookies.map(parseSetCookie))
        if (searchedCookie(cookie, responseDate))
          redact.add(cookie.value, `[redacted:cookie ${cookie.name}]`);
      entry.status = response.status;
      entry.setCookies = setCookies;
      entry.headers = (request.capture ?? [])
        .filter((h) => h.toLowerCase() !== "set-cookie")
        .flatMap((h) => {
          const value = response.headers.get(h);
          return value === null ? [] : [[h.toLowerCase(), value]];
        });
      entry.body = text;
    } catch (error) {
      entry.error =
        /** @type {Error} */ (error).name === "TimeoutError"
          ? `no response after ${TIMEOUT_MS / 1000} seconds`
          : /** @type {any} */ (error.cause?.code ?? /** @type {Error} */ (error).message);
      break;
    }
  }

  const completed = entries.length === sequence.requests.length && entries.every((e) => !e.error);
  const lines = [
    "# http.mjs evidence log",
    "# Sign-in values, cookie values and tokens are redacted (manual-qa ADAPTER.md, The api driver).",
  ];
  const summary = [];
  for (const e of entries) {
    const path = redact.path(e.path);
    const row = { n: e.n, session: e.session, method: e.method, path, status: e.status };
    summary.push(row);
    lines.push("", `## ${e.n}. ${e.session} ${e.method} ${path}`);
    if (e.error) {
      row.error = redact.text(e.error);
      lines.push(`did not complete: ${row.error}`);
      continue;
    }
    lines.push(`status: ${e.status}`);
    for (const line of e.setCookies) lines.push(`set-cookie: ${redact.setCookie(line)}`);
    for (const [name, value] of e.headers)
      lines.push(`${name}: ${secretHeader(name) ? "[redacted]" : redact.text(value)}`);
    if (e.body) lines.push("", redact.body(e.body));
  }
  const log = `${redact.text(lines.join("\n"))}\n`;
  // Each summary field that can carry a value (path, error) is redacted above.
  return { completed, log, requests: summary };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const USAGE = "usage: node http.mjs run <sequence.json> --base <address> --log <path>\n";

/**
 * @param {string[]} argv the arguments after the script
 * @param {{env?: Record<string, string | undefined>, readFile?: (path: string) => string | null,
 *   writeFile?: (path: string, text: string) => void, fetch?: typeof fetch}} [io]
 * @returns {Promise<{code: number, out: string}>}
 */
export async function main(argv, io = {}) {
  const usage = { code: 2, out: USAGE };
  const [command, target, ...rest] = argv;
  if (command !== "run" || target === undefined || target.startsWith("--")) return usage;
  const options = {};
  for (let i = 0; i < rest.length; i += 2) {
    const [flag, value] = [rest[i], rest[i + 1]];
    if (!["--base", "--log"].includes(flag) || value === undefined || flag in options) return usage;
    options[flag] = value;
  }
  if (options["--base"] === undefined || options["--log"] === undefined) return usage;
  let base;
  try {
    base = new URL(options["--base"]);
  } catch {
    return usage;
  }
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) return usage;
  // An address only: a path on it would be silently dropped, since every path
  // in the sequence starts with "/".
  if (base.pathname !== "/" || base.search || base.hash)
    return {
      code: 2,
      out: `${USAGE}--base is an address with no path; put the path in each request\n`,
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

  const result = await runSequence(sequence, { base: base.href, env, fetch: io.fetch });
  const logPath = options["--log"];
  const writeFile =
    io.writeFile ??
    ((path, body) => {
      mkdirSync(dirname(resolve(path)), { recursive: true });
      writeFileSync(resolve(path), body);
    });
  writeFile(logPath, result.log);
  const out = json({ log: logPath, completed: result.completed, requests: result.requests });
  return { code: result.completed ? 0 : 1, out };
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
