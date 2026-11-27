/**
 * Contract suite for `http.mjs`, the `api` surface's driver (SKILL.md steps 4
 * and 6, ADAPTER.md "The api driver"): it runs a request sequence against a
 * local test server, keeps one cookie jar per Session, takes sign-in values
 * only from `QA_*` environment variables, refuses a sequence that carries a
 * secret inline, and writes a redacted evidence log. Its exit status says
 * whether every request completed, never whether the scenario passed.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import { CookieJar, checkSequence, main, parseSetCookie, searchedCookie } from "./http.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "http.mjs");
const skill = readFileSync(join(HERE, "SKILL.md"), "utf8");
const adapterDoc = readFileSync(join(HERE, "ADAPTER.md"), "utf8");

/** A long, opaque-looking cookie value, built at run time so no secret scanner flags a literal. */
const OPAQUE_TOKEN = "tok3n".repeat(8);
const PASSWORD = "Corr3ct-Horse-Battery";
const EMAIL = "admin@example.test";
/** Each request the server saw: method, path, Cookie header, body. */
const seen = [];
let server;
let base;
let dir;
let sid = 0;

before(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      seen.push({
        method: req.method,
        path: req.url,
        cookie: req.headers.cookie ?? null,
        csrf: req.headers["x-csrf-token"] ?? null,
        pin: req.headers["x-pin"] ?? null,
        otp: req.headers["x-otp"] ?? null,
        body,
      });
      const url = new URL(req.url, "http://x");
      if (url.pathname === "/login") {
        const sent = body ? JSON.parse(body) : {};
        if (sent.password !== PASSWORD) {
          res.writeHead(401, { "content-type": "application/json" });
          return res.end(JSON.stringify({ error: "bad sign-in" }));
        }
        sid += 1;
        const value = `s3ss10n-value-${sid}-abcdef`;
        res.writeHead(200, {
          "content-type": "application/json",
          "set-cookie": [
            `sid=${value}; Path=/; HttpOnly; SameSite=Lax`,
            `theme=dark-mode-cookie; Path=/`,
          ],
          // A careless server echoing the password back must still not leak it.
          "x-echo": sent.password,
        });
        return res.end(
          JSON.stringify({ user: sent.email, password: sent.password, token: "tok-abcdef-123456" }),
        );
      }
      if (url.pathname === "/me") {
        const signedIn = /(?:^|; )sid=/.test(req.headers.cookie ?? "");
        res.writeHead(signedIn ? 200 : 401, { "content-type": "application/json" });
        return res.end(JSON.stringify({ signedIn, echo: req.headers.cookie ?? null }));
      }
      if (url.pathname === "/echo") {
        // Echoes the request body as sent, and as an HTML page would.
        const html = body.replace(/&/g, "&amp;");
        res.writeHead(200, { "content-type": "text/plain" });
        return res.end(`${body}\n${html}`);
      }
      if (url.pathname === "/flags") {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end('{"password_changed": true, "session": null, "token_expired": false}');
      }
      if (url.pathname === "/ids") {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end('{"id":9007199254740993,"ratio":1.0,"dup":1,"dup":2}');
      }
      if (url.pathname === "/snowflake") {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end('{"id":1234567890123456789,"ratio":1.0,"exp":1e3}');
      }
      if (url.pathname === "/self") {
        res.writeHead(200, { "content-type": "text/plain" });
        return res.end(`you asked for ${req.url}`);
      }
      if (url.pathname === "/prefs") {
        res.writeHead(200, {
          "content-type": "application/json",
          "set-cookie": [
            "logged_in=true; Path=/",
            "theme=light; Path=/",
            "user_id=1042; Path=/",
            "csrftoken=k9Qw7xZp; Path=/",
            "tracker=0123456789abcdefXYZ; Path=/",
          ],
        });
        return res.end("{}");
      }
      if (url.pathname === "/signout") {
        // PHP's own sign-out line: the value is a placeholder, not a session.
        res.writeHead(200, {
          "content-type": "application/json",
          "set-cookie": [
            "PHPSESSID=deleted; expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; path=/; HttpOnly",
          ],
        });
        return res.end('{"status": "deleted"}');
      }
      if (url.pathname === "/signout-sid") {
        // Removes the session cookie the last sign-in set.
        res.writeHead(200, {
          "content-type": "text/plain",
          "set-cookie": ["sid=deleted; Max-Age=0; Path=/; HttpOnly"],
        });
        return res.end("Account deleted");
      }
      if (url.pathname === "/signout-empty") {
        res.writeHead(200, {
          "content-type": "text/plain",
          "set-cookie": ["sid=; Max-Age=0; Path=/; HttpOnly"],
        });
        return res.end("signed out, session deleted");
      }
      if (url.pathname === "/forget-me") {
        // A server that removes a cookie by echoing its real, never-seen value.
        res.writeHead(200, {
          "content-type": "text/plain",
          "set-cookie": [`remember_token=${OPAQUE_TOKEN}; Max-Age=0; Path=/; HttpOnly`],
        });
        return res.end(`forgot ${OPAQUE_TOKEN}`);
      }
      if (url.pathname === "/last-session") {
        // A careless page that shows the session value it issued.
        res.writeHead(200, { "content-type": "text/plain" });
        return res.end(`last session: s3ss10n-value-${sid}-abcdef`);
      }
      if (url.pathname === "/profile") {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(
          '{"admin": true, "theme": "light", "id": 1042, "csrf": "k9Qw7xZp", "t": "0123456789abcdefXYZ"}',
        );
      }
      if (url.pathname === "/debug") {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end('{"debug": "Basic dXNlcjpwdzE=", "also": "Bearer abcdefgh1234="}');
      }
      if (url.pathname === "/challenge") {
        res.writeHead(401, {
          "www-authenticate": 'Bearer realm="api", error="invalid_token"',
        });
        return res.end();
      }
      if (url.pathname === "/tokens") {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ refresh_tokens: ["abcdefgh12345"], keep: "visible" }));
      }
      if (url.pathname === "/text") {
        res.writeHead(200, { "content-type": "text/plain" });
        return res.end('password: "hunter two" and api_key=k3y-value-9');
      }
      if (url.pathname === "/cb") {
        res.writeHead(302, { location: "/done?sid=abcdef12&next=/home" });
        return res.end();
      }
      if (url.pathname === "/go") {
        res.writeHead(302, { location: "/elsewhere" });
        return res.end();
      }
      if (url.pathname === "/boom") {
        res.writeHead(500, { "content-type": "text/plain" });
        return res.end("server error");
      }
      if (url.pathname === "/api/v1/auth/csrf-token") {
        res.writeHead(200, {
          "content-type": "application/json",
          "set-cookie": ["fastapi-csrf-token=SIGNED.sig; Path=/; HttpOnly"],
        });
        return res.end(JSON.stringify({ data: { csrf_token: "UNSIGNED" } }));
      }
      if (url.pathname === "/api/v1/protected") {
        res.writeHead(200, {
          "content-type": "application/json",
          "x-echo-csrf": req.headers["x-csrf-token"] ?? "",
        });
        return res.end(
          JSON.stringify({
            ok: true,
            echoed: req.headers["x-csrf-token"] ?? null,
            cookie: req.headers.cookie ?? null,
          }),
        );
      }
      if (url.pathname === "/resources") {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(
          JSON.stringify({
            data: {
              id: 42,
              obj: { nested: "x" },
              flag: true,
              empty: null,
              jwt: ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxIn0", "c2lnbmF0dXJl"].join("."),
            },
            auth: { code: "s3cr3t-anc3stor" },
            items: [{ id: "itm_99" }],
          }),
        );
      }
      if (url.pathname === "/short-secret") {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(
          JSON.stringify({ data: { pin: "200", otp: "1" }, note: "count 200 and step 1" }),
        );
      }
      if (url.pathname.startsWith("/verify")) {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ verified: true }));
      }
      if (url.pathname.startsWith("/users/")) {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ user: url.pathname.slice("/users/".length) }));
      }
      res.writeHead(404);
      res.end();
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  base = `http://127.0.0.1:${server.address().port}`;
  dir = mkdtempSync(join(tmpdir(), "http-mjs-"));
});

after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

const ENV = { QA_ADMIN_EMAIL: EMAIL, QA_ADMIN_PASSWORD: PASSWORD };
const signIn = (session) => ({
  session,
  method: "POST",
  path: "/login",
  json: { email: "{{env:QA_ADMIN_EMAIL}}", password: "{{env:QA_ADMIN_PASSWORD}}" },
  capture: ["X-Echo", "Content-Type"],
});

let file = 0;
/** Writes a sequence to a file and runs the CLI in a child process. */
function run(sequence, { env = ENV, args = [] } = {}) {
  file += 1;
  const seqPath = join(dir, `seq-${file}.json`);
  const logPath = join(dir, `s${file}-http.log`);
  writeFileSync(seqPath, typeof sequence === "string" ? sequence : JSON.stringify(sequence));
  const child = spawn(
    process.execPath,
    [SCRIPT, "run", seqPath, "--base", base, "--log", logPath, ...args],
    { env: { PATH: process.env.PATH, ...env } },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (c) => (stdout += c));
  child.stderr.on("data", (c) => (stderr += c));
  return new Promise((done) =>
    child.on("close", (code) => {
      let log = null;
      try {
        log = readFileSync(logPath, "utf8");
      } catch {
        // no log written
      }
      done({ code, stdout, stderr, log });
    }),
  );
}

// ── Sessions ────────────────────────────────────────────────────────────────

test("a cookie set in one Session is sent by its next request, and never by another Session's", async () => {
  const start = seen.length;
  const result = await run({
    requests: [
      signIn("A"),
      { session: "A", method: "GET", path: "/me" },
      { session: "B", method: "GET", path: "/me" },
    ],
  });
  assert.equal(result.code, 0, result.stdout + result.stderr);
  const [login, meA, meB] = seen.slice(start);
  assert.equal(login.cookie, null);
  assert.match(meA.cookie, /(?:^|; )sid=s3ss10n-value-\d+-abcdef(?:;|$)/);
  assert.match(meA.cookie, /theme=dark-mode-cookie/);
  assert.equal(meB.cookie, null);
  const out = JSON.parse(result.stdout);
  assert.equal(out.completed, true);
  assert.deepEqual(
    out.requests.map((r) => [r.session, r.status]),
    [
      ["A", 200],
      ["A", 200],
      ["B", 401],
    ],
  );
});

test("two Sessions signed in at once each keep their own cookie", async () => {
  const start = seen.length;
  const result = await run({
    requests: [
      signIn("A"),
      signIn("B"),
      { session: "A", method: "GET", path: "/me" },
      { session: "B", method: "GET", path: "/me" },
    ],
  });
  assert.equal(result.code, 0);
  const [, , meA, meB] = seen.slice(start);
  const sidOf = (cookie) => /sid=([^;]+)/.exec(cookie)[1];
  assert.notEqual(sidOf(meA.cookie), sidOf(meB.cookie));
});

test("a cookie expired by the server is dropped, and a cookie's Path limits where it goes", () => {
  const jar = new CookieJar();
  jar.store(["sid=abc; Path=/", "keep=1; Path=/"], "/login");
  jar.store(["sid=; Path=/; Max-Age=0"], "/logout");
  assert.equal(jar.header("/me"), "keep=1");
  jar.store(["old=1; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"], "/login");
  assert.equal(jar.header("/me"), "keep=1");
  jar.store(["scoped=1; Path=/admin"], "/login");
  assert.equal(jar.header("/me"), "keep=1");
  assert.equal(jar.header("/administrator"), "keep=1");
  assert.equal(jar.header("/admin/users"), "scoped=1; keep=1");
  // With no Path, the default is the request path's directory.
  jar.store(["dflt=1"], "/api/login");
  assert.equal(jar.header("/api/me"), "dflt=1; keep=1");
  assert.equal(jar.header("/me"), "keep=1");
});

test("{{cookie:<name>}} sends the Session's own cookie value, redacted in the log", async () => {
  const start = seen.length;
  const echo = {
    session: "A",
    method: "POST",
    path: "/me",
    headers: { "X-CSRF-Token": "{{cookie:sid}}" },
  };
  const result = await run({ requests: [signIn("A"), echo] });
  assert.equal(result.code, 0);
  const [, sent] = seen.slice(start);
  assert.match(sent.csrf, /^s3ss10n-value-\d+-abcdef$/);
  assert.doesNotMatch(result.log, /s3ss10n-value/);

  const missing = await run({ requests: [{ ...echo, session: "B" }] });
  assert.equal(missing.code, 1);
  assert.equal(JSON.parse(missing.stdout).completed, false);
  assert.match(missing.log, /did not complete: the Session has no cookie sid/);
});

// ── The evidence log ────────────────────────────────────────────────────────

test("an HttpOnly cookie's attributes appear in the log, and its value is redacted", async () => {
  const result = await run({
    requests: [signIn("A"), { session: "A", method: "GET", path: "/me" }],
  });
  assert.equal(result.code, 0);
  const { log } = result;
  assert.match(log, /set-cookie: sid=\[redacted:cookie sid\]; Path=\/; HttpOnly; SameSite=Lax/);
  assert.match(log, /set-cookie: theme=\[redacted:cookie theme\]; Path=\//);
  assert.doesNotMatch(log, /s3ss10n-value/);
  assert.doesNotMatch(log, /dark-mode-cookie/);
  // A cookie value echoed in a body is redacted too.
  assert.match(log, /"echo": ?"sid=\[redacted:cookie sid\]; theme=\[redacted:cookie theme\]"/);
});

test("a flag-like cookie's value stays readable in bodies; a secret or opaque one does not", async () => {
  const result = await run({
    requests: [
      { session: "A", method: "GET", path: "/prefs" },
      { session: "A", method: "GET", path: "/profile" },
    ],
  });
  assert.equal(result.code, 0);
  const { log } = result;
  // Every Set-Cookie line still redacts its own value.
  for (const name of ["logged_in", "theme", "user_id", "csrftoken", "tracker"])
    assert.match(log, new RegExp(`set-cookie: ${name}=\\[redacted:cookie ${name}\\]; Path=/`));
  // The same text elsewhere is evidence, unless the cookie is a secret.
  assert.match(
    log,
    /"admin": true, "theme": "light", "id": 1042, "csrf": "\[redacted:cookie csrftoken\]", "t": "\[redacted:cookie tracker\]"/,
  );
  assert.doesNotMatch(log, /k9Qw7xZp|0123456789abcdefXYZ/);
});

test("a cookie its own Set-Cookie line removes is a placeholder: readable in bodies, redacted in its line", async () => {
  const result = await run({
    requests: [
      { session: "A", method: "DELETE", path: "/signout" },
      { session: "A", method: "GET", path: "/signout-sid" },
    ],
  });
  assert.equal(result.code, 0);
  const { log } = result;
  assert.match(
    log,
    /set-cookie: PHPSESSID=\[redacted:cookie PHPSESSID\]; expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; path=\/; HttpOnly/,
  );
  assert.match(log, /set-cookie: sid=\[redacted:cookie sid\]; Max-Age=0; Path=\/; HttpOnly/);
  assert.match(log, /\{"status": "deleted"\}/);
  assert.match(log, /Account deleted/);
});

test("only a placeholder-shaped value on a removing line goes unsearched: empty or one short word", async () => {
  const result = await run({
    requests: [
      { session: "A", method: "GET", path: "/signout-empty" },
      { session: "A", method: "GET", path: "/forget-me" },
    ],
  });
  assert.equal(result.code, 0);
  const { log } = result;
  assert.match(log, /set-cookie: sid=\[redacted:cookie sid\]; Max-Age=0; Path=\/; HttpOnly/);
  assert.match(log, /signed out, session deleted/);
  // A long opaque value is a credential even on a removing line, though never set before.
  assert.match(log, /forgot \[redacted:cookie remember_token\]/);
  assert.ok(!log.includes(OPAQUE_TOKEN));
  const searched = (line) => searchedCookie(parseSetCookie(line));
  assert.equal(searched("sid=x9k2Lq7z; Max-Age=0; HttpOnly"), true);
  assert.equal(searched("session_token=deleted; Max-Age=0"), false);
});

test("Max-Age of 0 or less, in any case, or a past Expires removes a cookie; Max-Age outranks Expires", () => {
  const searched = (line) => searchedCookie(parseSetCookie(line));
  // Removed, with a placeholder value: never searched for, whatever the name or HttpOnly.
  assert.equal(
    searched(
      "PHPSESSID=deleted; expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; path=/; HttpOnly",
    ),
    false,
  );
  assert.equal(searched("session=deleted; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly"), false);
  assert.equal(searched("sid=removed; max-age=0; HttpOnly"), false);
  assert.equal(searched("token=expired; MAX-AGE=-1"), false);
  assert.equal(searched("sid=deleted; EXPIRES=Wed, 21 Oct 2015 07:28:00 GMT; HttpOnly"), false);
  // Not removed: still searched.
  assert.equal(searched("PHPSESSID=8f3k2j9d0a7b6c5e4f3g; path=/; HttpOnly"), true);
  assert.equal(
    searched("sid=8f3k2j9d0a7b; Max-Age=3600; Expires=Thu, 01 Jan 1970 00:00:01 GMT; HttpOnly"),
    true,
  );
  assert.equal(searched("sid=8f3k2j9d0a7b; Expires=Fri, 01 Jan 2100 00:00:00 GMT; HttpOnly"), true);
  assert.equal(searched("sid=8f3k2j9d0a7b; Expires=not a date; HttpOnly"), true);
  assert.equal(searched("theme=light"), false);
});

test("an Expires-only removal is read against the response's Date, so clock skew cannot unredact a live cookie", () => {
  const at = (ms) => new Date(ms).toUTCString();
  const t = Date.parse("Sun, 15 Nov 2026 12:00:00 GMT");
  const live = (expires) => ({
    name: "csrf",
    value: "pending",
    attributes: [` Expires=${at(expires)}`, " HttpOnly"],
  });
  // A word-like HttpOnly value, live 30s more by the server's own clock: searched, whatever the runner's clock says.
  assert.equal(searchedCookie(live(t + 30_000), Date.parse(at(t))), true);
  // Already past by the server's clock: removed.
  assert.equal(searchedCookie(live(t - 1_000), Date.parse(at(t))), false);
  // With no Date header, only an Expires more than a day past counts: a runner a minute ahead still redacts.
  assert.equal(searchedCookie(live(Date.now() - 60_000)), true);
  assert.equal(searchedCookie(live(Date.now() - 2 * 86_400_000)), false);
  // Max-Age needs no clock.
  assert.equal(
    searchedCookie({ ...live(t + 30_000), attributes: [" Max-Age=0", " HttpOnly"] }),
    false,
  );
});

test("a real session value stays redacted across the log after a later response removes its cookie", async () => {
  const result = await run({
    requests: [
      signIn("A"),
      { session: "A", method: "GET", path: "/signout-sid" },
      { session: "A", method: "GET", path: "/last-session" },
    ],
  });
  assert.equal(result.code, 0);
  const { log } = result;
  assert.doesNotMatch(log, /s3ss10n-value/);
  assert.match(log, /last session: \[redacted:cookie sid\]/);
  assert.match(log, /Account deleted/);
});

test("the log records method, path, status and the named headers, one entry per request", async () => {
  const result = await run({
    requests: [
      signIn("A"),
      { session: "A", method: "GET", path: "/boom", capture: ["Content-Type"] },
    ],
  });
  assert.equal(result.code, 0, "a 500 is still a completed request");
  const { log } = result;
  assert.match(log, /^## 1\. A POST \/login$/m);
  assert.match(log, /^status: 200$/m);
  assert.match(log, /^content-type: application\/json$/m);
  assert.match(log, /^## 2\. A GET \/boom$/m);
  assert.match(log, /^status: 500$/m);
  assert.match(log, /server error/);
  // A header nobody named is not logged.
  assert.doesNotMatch(log, /^date:/m);
});

test("a sign-in value read from the environment never appears in the log or on stdout", async () => {
  const result = await run({ requests: [signIn("A")] });
  assert.equal(result.code, 0);
  for (const text of [result.log, result.stdout, result.stderr]) {
    assert.ok(!text.includes(PASSWORD), text);
    assert.ok(!text.includes(EMAIL), text);
  }
  assert.match(result.log, /x-echo: \[redacted:QA_ADMIN_PASSWORD\]/);
  assert.match(result.log, /"password": "\[redacted\]"/);
  assert.match(result.log, /"user": "\[redacted:QA_ADMIN_EMAIL\]"/);
  // A token in a response body is redacted by its key.
  assert.match(result.log, /"token": "\[redacted\]"/);
  assert.doesNotMatch(result.log, /tok-abcdef/);
});

test("a sign-in value is redacted even where the request carries it in the path", async () => {
  const result = await run({
    requests: [{ session: "A", method: "GET", path: "/me?who={{env:QA_ADMIN_EMAIL}}" }],
  });
  assert.equal(result.code, 0);
  assert.ok(!result.log.includes(EMAIL) && !result.log.includes(encodeURIComponent(EMAIL)));
  assert.ok(!result.stdout.includes(EMAIL) && !result.stdout.includes(encodeURIComponent(EMAIL)));
  assert.match(result.log, /GET \/me\?who=\[redacted:QA_ADMIN_EMAIL\]/);
});

test("a variable the sequence names but the environment lacks is refused, by name only", async () => {
  const start = seen.length;
  const result = await run({ requests: [signIn("A")] }, { env: { QA_ADMIN_EMAIL: EMAIL } });
  assert.equal(result.code, 1);
  assert.match(result.stdout, /QA_ADMIN_PASSWORD is not set/);
  assert.equal(seen.length, start, "no request is sent");
});

test("only QA_ variables can be read, so no other shell secret can be sent", () => {
  const problems = checkSequence(
    { requests: [{ method: "GET", path: "/me", headers: { "X-Note": "{{env:GITHUB_TOKEN}}" } }] },
    { GITHUB_TOKEN: "ghp_x" },
  );
  assert.ok(
    problems.some((p) => /GITHUB_TOKEN.*QA_/.test(p)),
    problems.join("\n"),
  );
});

test("a sign-in value echoed form-encoded or HTML-escaped is still redacted", async () => {
  const value = "my pass!x&y";
  const result = await run(
    { requests: [{ session: "A", method: "POST", path: "/echo", form: { pw: "{{env:QA_PW}}" } }] },
    { env: { QA_PW: value } },
  );
  assert.equal(result.code, 0);
  for (const form of [value, "my+pass%21x%26y", "my pass!x&amp;y", encodeURIComponent(value)])
    assert.ok(!result.log.includes(form), `${form} in\n${result.log}`);
  assert.match(result.log, /pw=\[redacted:QA_PW\]/);
});

test("a secret-named field's whole value is redacted, a list included, and the JSON stays whole", async () => {
  const result = await run({ requests: [{ session: "A", method: "GET", path: "/tokens" }] });
  assert.equal(result.code, 0);
  assert.doesNotMatch(result.log, /abcdefgh12345/);
  const body = result.log.slice(result.log.indexOf("{"));
  assert.deepEqual(JSON.parse(body), { refresh_tokens: "[redacted]", keep: "visible" });
});

test("a quoted secret in plain text is redacted whole, and a captured Location's sid too", async () => {
  const result = await run({
    requests: [
      { session: "A", method: "GET", path: "/text" },
      { session: "A", method: "GET", path: "/cb", capture: ["Location"] },
    ],
  });
  assert.equal(result.code, 0);
  assert.match(result.log, /password: "\[redacted\]" and api_key=\[redacted\]/);
  assert.doesNotMatch(result.log, /hunter|two"|k3y-value/);
  assert.match(result.log, /^location: \/done\?sid=\[redacted\]&next=\/home$/m);
});

test("true, false and null under a secret-named key are kept: they say whether, not what", async () => {
  const result = await run({ requests: [{ session: "A", method: "GET", path: "/flags" }] });
  assert.equal(result.code, 0);
  assert.match(result.log, /"password_changed": true/);
  assert.match(result.log, /"session": null/);
  assert.match(result.log, /"token_expired": false/);
});

test("a body with no secret field is logged exactly as the server sent it", async () => {
  const result = await run({ requests: [{ session: "A", method: "GET", path: "/ids" }] });
  assert.equal(result.code, 0);
  assert.ok(result.log.includes('{"id":9007199254740993,"ratio":1.0,"dup":1,"dup":2}'), result.log);
});

test("a sign-in value with ' ( ) ! * in a query is sent in a form the redactor knows", async () => {
  const start = seen.length;
  const value = "it's a (pw)!*";
  const result = await run(
    { requests: [{ session: "A", method: "GET", path: "/self?u={{env:QA_PW}}" }] },
    { env: { QA_PW: value } },
  );
  assert.equal(result.code, 0);
  const sent = seen[start].path;
  assert.equal(new URLSearchParams(sent.split("?")[1]).get("u"), value);
  assert.ok(!result.log.includes(sent.split("=")[1]), result.log);
  assert.match(result.log, /you asked for \/self\?u=\[redacted:QA_PW\]/);
});

test("a base64 credential ending in = before a quote is still redacted", async () => {
  const result = await run({ requests: [{ session: "A", method: "GET", path: "/debug" }] });
  assert.equal(result.code, 0);
  assert.doesNotMatch(result.log, /dXNlcjpwdzE|abcdefgh1234/);
  assert.match(result.log, /"debug": "Basic \[redacted\]", "also": "Bearer \[redacted\]"/);
  // The same shape is refused in a raw body.
  const problems = checkSequence(
    { requests: [{ method: "POST", path: "/x", body: '{"debug": "Basic dXNlcjpwdzE="}' }] },
    ENV,
  );
  assert.ok(
    problems.some((p) => /bearer or basic credential/.test(p)),
    problems.join("\n"),
  );
});

test("a WWW-Authenticate challenge is logged, not redacted", async () => {
  const result = await run({
    requests: [{ session: "A", method: "GET", path: "/challenge", capture: ["WWW-Authenticate"] }],
  });
  assert.equal(result.code, 0);
  assert.match(result.log, /^www-authenticate: Bearer realm="api", error="invalid_token"$/m);
});

test("{{cookie:<name>}} takes the cookie the jar would send to that path", () => {
  const jar = new CookieJar();
  jar.store(["csrf=root-value; Path=/", "csrf=admin-value; Path=/admin"], "/");
  assert.equal(jar.value("csrf", "/admin/users"), "admin-value");
  assert.equal(jar.value("csrf", "/me"), "root-value");
  jar.store(["only=x1; Path=/admin"], "/");
  assert.equal(jar.value("only", "/me"), undefined);
});

// ── Inline secrets ──────────────────────────────────────────────────────────

const INLINE = {
  "a literal password in a JSON body": {
    method: "POST",
    path: "/login",
    json: { email: "{{env:QA_ADMIN_EMAIL}}", password: "hunter22" },
  },
  "a nested literal token": {
    method: "POST",
    path: "/x",
    json: { auth: { refresh_token: "abc" } },
  },
  "a literal in a form body": { method: "POST", path: "/login", form: { passwd: "hunter22" } },
  "a hand-built Cookie header": { method: "GET", path: "/me", headers: { Cookie: "sid=abc" } },
  "a Cookie header even from the environment": {
    method: "GET",
    path: "/me",
    headers: { cookie: "sid={{env:QA_SID}}" },
  },
  "a literal Authorization header": {
    method: "GET",
    path: "/me",
    headers: { Authorization: "Bearer abc.def.ghi" },
  },
  "a literal API key header": { method: "GET", path: "/me", headers: { "X-Api-Key": "k-123" } },
  "a token in the query string": { method: "GET", path: "/me?access_token=abc123" },
  "a JWT anywhere": {
    method: "POST",
    path: "/x",
    json: { note: ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxIn0", "c2lnbmF0dXJl"].join(".") },
  },
  "a secret in a raw body": { method: "POST", path: "/login", body: "user=a&password=hunter22" },
  "an address with credentials": { method: "GET", path: "//user:pw@evil.example/" },
};

for (const [name, request] of Object.entries(INLINE))
  test(`a sequence carrying ${name} is refused`, () => {
    const problems = checkSequence({ requests: [request] }, { ...ENV, QA_SID: "x" });
    assert.ok(problems.length > 0, name);
    assert.ok(
      problems.every((p) => !p.includes("hunter22") && !p.includes("abc123")),
      problems.join(),
    );
  });

test("a placeholder under a secret-named key or Authorization header is accepted", () => {
  const problems = checkSequence(
    {
      requests: [
        signIn("A"),
        {
          method: "GET",
          path: "/me?token={{env:QA_TOKEN}}",
          headers: { Authorization: "Bearer {{env:QA_TOKEN}}", Accept: "application/json" },
        },
        { method: "POST", path: "/x", json: { remember_session: true, otp: null } },
      ],
    },
    { ...ENV, QA_TOKEN: "t0k3n-value" },
  );
  assert.deepEqual(problems, []);
});

test("a sequence holding a sign-in value's own text is refused, without naming the value", async () => {
  const start = seen.length;
  const result = await run({
    requests: [{ session: "A", method: "POST", path: "/x", json: { note: PASSWORD } }],
  });
  assert.equal(result.code, 1);
  assert.match(result.stdout, /QA_ADMIN_PASSWORD/);
  assert.ok(!result.stdout.includes(PASSWORD));
  assert.equal(result.log, null, "nothing is logged");
  assert.equal(seen.length, start, "no request is sent");
});

test("a sign-in value written in encoded is refused too", () => {
  const env = { QA_PW: "my pass!x" };
  for (const path of ["/a?u=my%20pass%21x", "/a?u=my+pass%21x"])
    assert.ok(
      checkSequence({ requests: [{ method: "GET", path }] }, env).some((p) =>
        /QA_PW inline/.test(p),
      ),
      path,
    );
});

test("a refused sequence sends no request at all", async () => {
  const start = seen.length;
  const result = await run({ requests: [signIn("A"), INLINE["a hand-built Cookie header"]] });
  assert.equal(result.code, 1);
  assert.equal(seen.length, start);
  assert.match(result.stdout, /request 2: .*Cookie/);
});

// ── Shape ───────────────────────────────────────────────────────────────────

test("every request stays on the checked address: a path is relative, never a URL", () => {
  for (const path of ["http://evil.example/", "//evil.example/x", "me", ""])
    assert.ok(
      checkSequence({ requests: [{ method: "GET", path }] }, ENV).length > 0,
      `path ${JSON.stringify(path)}`,
    );
});

test("a GET or HEAD with a body is refused at check time, not left to fail at run time", async () => {
  for (const method of ["GET", "HEAD"])
    for (const part of [{ json: { a: 1 } }, { form: { a: "1" } }, { body: "a=1" }]) {
      const problems = checkSequence({ requests: [{ method, path: "/me", ...part }] }, ENV);
      assert.ok(
        problems.some(
          (p) =>
            p ===
            `request 1: ${method} cannot carry a body; drop "json", "form" and "body", or use another method`,
        ),
        `${method} ${JSON.stringify(part)}: ${problems.join("; ")}`,
      );
    }
  const start = seen.length;
  const result = await run({ requests: [{ session: "A", method: "GET", path: "/me", json: {} }] });
  assert.equal(result.code, 1);
  assert.match(result.stdout, /GET cannot carry a body/);
  assert.equal(result.log, null);
  assert.equal(seen.length, start);
});

test("unknown keys, bad sessions, methods and body shapes are named problems", () => {
  const bad = [
    { method: "GET", path: "/", run: "rm -rf /" },
    { session: "a", method: "GET", path: "/" },
    { session: "AB", method: "GET", path: "/" },
    { method: "FETCH", path: "/" },
    { method: "POST", path: "/", json: {}, form: {} },
    { method: "GET", path: "/", capture: "Location" },
  ];
  for (const request of bad)
    assert.ok(checkSequence({ requests: [request] }, ENV).length > 0, JSON.stringify(request));
  assert.ok(checkSequence({ requests: [] }, ENV).length > 0);
  assert.ok(checkSequence({ requests: [{ method: "GET", path: "/" }], extra: 1 }, ENV).length > 0);
  assert.ok(checkSequence([], ENV).length > 0);
});

test("a file that is not JSON is refused", async () => {
  const result = await run("{ not json");
  assert.equal(result.code, 1);
  assert.match(result.stdout, /not JSON/);
});

test("a redirect is recorded, not followed", async () => {
  const start = seen.length;
  const result = await run({
    requests: [{ session: "A", method: "GET", path: "/go", capture: ["Location"] }],
  });
  assert.equal(result.code, 0);
  assert.equal(seen.length, start + 1);
  assert.match(result.log, /^status: 302$/m);
  assert.match(result.log, /^location: \/elsewhere$/m);
});

// ── Exit status ─────────────────────────────────────────────────────────────

test("the exit status says whether every request completed, not whether the scenario passed", async () => {
  const failing = await run({ requests: [{ session: "A", method: "GET", path: "/me" }] });
  assert.equal(failing.code, 0, "a 401 is a completed request");

  const closed = createServer();
  await new Promise((done) => closed.listen(0, "127.0.0.1", done));
  const deadBase = `http://127.0.0.1:${closed.address().port}`;
  await new Promise((done) => closed.close(done));
  const seqPath = join(dir, "dead.json");
  const logPath = join(dir, "dead-http.log");
  writeFileSync(seqPath, JSON.stringify({ requests: [{ method: "GET", path: "/me" }] }));
  const io = { env: {}, write: () => {} };
  const result = await main(["run", seqPath, "--base", deadBase, "--log", logPath], io);
  assert.equal(result.code, 1);
  const out = JSON.parse(result.out);
  assert.equal(out.completed, false);
  assert.match(readFileSync(logPath, "utf8"), /did not complete/);
});

test("usage errors exit 2, and sign-in values are never taken from the command line", async () => {
  assert.equal((await main([], { env: {} })).code, 2);
  assert.equal((await main(["run"], { env: {} })).code, 2);
  assert.equal((await main(["run", "x.json", "--log", "y.log"], { env: {} })).code, 2);
  assert.equal((await main(["run", "x.json", "--base", base], { env: {} })).code, 2);
  const withValue = await main(
    ["run", "x.json", "--base", base, "--log", "y.log", "--env", "QA_X=1"],
    { env: {} },
  );
  assert.equal(withValue.code, 2);
  const badBase = await main(["run", "x.json", "--base", "ftp://h", "--log", "y.log"], { env: {} });
  assert.equal(badBase.code, 2);
  const withPath = await main(["run", "x.json", "--base", `${base}/api`, "--log", "y.log"], {
    env: {},
  });
  assert.equal(withPath.code, 2);
  assert.match(withPath.out, /no path/);
});

// ── The skill names the driver and its log ─────────────────────────────────

test("step 4 names http.mjs first for api, with curl as the fallback without Node", () => {
  const step4 = /### 4\. Find a driver([\s\S]*?)### 5\./.exec(skill)[1];
  const api = /^- `api`: (.*)$/m.exec(step4)[1];
  assert.ok(api.indexOf("http.mjs") >= 0 && api.indexOf("http.mjs") < api.indexOf("curl"), api);
  assert.match(api, /curl.*when Node/);
});

test("step 6 names s<n>-http.log as an api scenario's evidence", () => {
  const step6 = /### 6\. Run the scenarios([\s\S]*?)### 7\./.exec(skill)[1].replace(/\s+/g, " ");
  assert.match(step6, /`s<n>-http\.log`/);
  assert.match(step6, /node "<skill>\/http\.mjs" run/);
  assert.match(
    step6,
    /exit status says whether every request completed, not whether the scenario passed/,
  );
});

test("ADAPTER.md's example sequence takes each cookie from a Session that holds one", () => {
  const example = JSON.parse(/## The api driver[\s\S]*?```json\n([\s\S]*?)```/.exec(adapterDoc)[1]);
  const signedIn = new Set();
  for (const request of example.requests) {
    const session = request.session ?? "A";
    if (JSON.stringify(request).includes("{{cookie:"))
      assert.ok(signedIn.has(session), `Session ${session} uses a cookie before it signs in`);
    if (/sign-in|login/.test(request.path)) signedIn.add(session);
  }
  assert.deepEqual(
    checkSequence(example, { QA_A_EMAIL: "a@x.test", QA_A_PASSWORD: "p1", QA_NEW_PASSWORD: "p2" }),
    [],
  );
});

test("ADAPTER.md documents the sequence format and the redaction rule", () => {
  assert.match(adapterDoc, /## The api driver/);
  assert.match(adapterDoc, /\{\{env:QA_/);
  assert.match(adapterDoc, /\{\{json:<n>:<path>\}\}/);
  assert.match(adapterDoc, /\[redacted:cookie <name>\]/);
  assert.match(adapterDoc, /\[redacted:<VARIABLE>\]/);
  assert.match(adapterDoc, /\[redacted:request <n> <path>\]/);
  assert.match(adapterDoc, /by `\{\{json:<n>:<path>\}\}` reference only/);
});

// ── {{json:<n>:<path>}} references ──────────────────────────────────────────

test("{{json:<n>:<path>}} fills a CSRF header from an earlier JSON body and redacts it by body rules", async () => {
  const start = seen.length;
  const result = await run({
    requests: [
      { session: "A", method: "GET", path: "/api/v1/auth/csrf-token" },
      {
        session: "A",
        method: "POST",
        path: "/api/v1/protected",
        headers: { "X-CSRF-Token": "{{json:1:data.csrf_token}}" },
        capture: ["X-Echo-Csrf"],
      },
    ],
  });
  assert.equal(result.code, 0, result.stdout + result.stderr);
  const [, protectedReq] = seen.slice(start);
  assert.equal(protectedReq.csrf, "UNSIGNED");
  assert.match(protectedReq.cookie, /fastapi-csrf-token=SIGNED\.sig/);
  assert.doesNotMatch(result.log, /UNSIGNED/);
  assert.doesNotMatch(result.log, /SIGNED\.sig/);
  assert.doesNotMatch(result.stdout, /UNSIGNED/);
  assert.match(result.log, /X-CSRF-Token from request 1, session A/);
  assert.match(result.log, /\[redacted:request 1 data\.csrf_token\]/);
  assert.match(result.log, /set-cookie: fastapi-csrf-token=\[redacted:cookie fastapi-csrf-token\]/);
});

test("{{json:<n>:<path>}} refuses non-earlier request numbers and malformed paths at check time", async () => {
  const invalid = [
    [{ method: "GET", path: "/users/{{json:1:data.id}}" }],
    [
      { method: "GET", path: "/resources" },
      { method: "GET", path: "/users/{{json:3:id}}" },
    ],
    [
      { method: "GET", path: "/resources" },
      { method: "GET", path: "/users/{{json:2:id}}" },
    ],
    [
      { method: "GET", path: "/resources" },
      { method: "GET", path: "/users/{{json:0:id}}" },
    ],
    [
      { method: "GET", path: "/resources" },
      { method: "GET", path: "/users/{{json:1:}}" },
    ],
    [
      { method: "GET", path: "/resources" },
      { method: "GET", path: "/users/{{json:1:.id}}" },
    ],
    [
      { method: "GET", path: "/resources" },
      { method: "GET", path: "/users/{{json:1:id.}}" },
    ],
    [
      { method: "GET", path: "/resources" },
      { method: "GET", path: "/users/{{json:1:a..b}}" },
    ],
    [
      { method: "GET", path: "/resources" },
      { method: "GET", path: "/users/{{json:1:items[0].id}}" },
    ],
    [
      { method: "GET", path: "/resources" },
      { method: "GET", path: "/users/{{json:1:a b}}" },
    ],
    [
      { method: "GET", path: "/resources" },
      { method: "GET", path: "/users/{{json:1}}" },
    ],
  ];
  for (const requests of invalid) {
    const problems = checkSequence({ requests }, ENV);
    assert.ok(problems.length > 0, `expected refusal for ${JSON.stringify(requests)}`);
  }

  const start = seen.length;
  const refused = await run({
    requests: [
      { method: "GET", path: "/resources" },
      { method: "GET", path: "/users/{{json:3:id}}" },
    ],
  });
  assert.equal(refused.code, 1);
  assert.equal(seen.length, start, "no request is sent when checkSequence refuses");
  assert.equal(refused.log, null);

  // Accepted in path, secret headers, json, form and raw body.
  const okProblems = checkSequence(
    {
      requests: [
        { method: "GET", path: "/resources" },
        {
          method: "POST",
          path: "/users/{{json:1:data.id}}?token={{json:1:data.csrf_token}}",
          headers: {
            "X-CSRF-Token": "{{json:1:data.csrf_token}}",
            Authorization: "Bearer {{json:1:data.jwt}}",
          },
          json: { token: "{{json:1:data.csrf_token}}" },
        },
        {
          method: "POST",
          path: "/echo",
          form: { token: "{{json:1:items.0.id}}" },
        },
        {
          method: "POST",
          path: "/echo",
          body: "token={{json:1:items.0.id}}",
        },
      ],
    },
    ENV,
  );
  assert.deepEqual(okProblems, []);
});

test("{{json:<n>:<path>}} stops before sending when the referenced field is missing, non-JSON, or not a string/number", async () => {
  // Missing field
  let start = seen.length;
  let result = await run({
    requests: [
      { method: "GET", path: "/resources" },
      { method: "GET", path: "/users/{{json:1:data.missing}}" },
      { method: "GET", path: "/me" },
    ],
  });
  assert.equal(result.code, 1);
  assert.equal(JSON.parse(result.stdout).completed, false);
  assert.equal(seen.length, start + 1, "request 2 and 3 are not sent");
  assert.match(result.log, /request 2 not sent: request 1's body has no data\.missing/);

  // Array prototype / non-digit property on an array must not resolve
  start = seen.length;
  result = await run({
    requests: [
      { method: "GET", path: "/resources" },
      { method: "GET", path: "/users/{{json:1:items.length}}" },
    ],
  });
  assert.equal(result.code, 1);
  assert.equal(seen.length, start + 1);
  assert.match(result.log, /request 2 not sent: request 1's body has no items\.length/);

  // Non-JSON response body
  start = seen.length;
  result = await run({
    requests: [
      { method: "GET", path: "/text" },
      { method: "GET", path: "/users/{{json:1:data.id}}" },
    ],
  });
  assert.equal(result.code, 1);
  assert.equal(JSON.parse(result.stdout).completed, false);
  assert.equal(seen.length, start + 1);
  assert.match(result.log, /request 2 not sent: request 1's response was not JSON/);

  // Object, array, boolean, and null values are refused at run time
  for (const field of ["data.obj", "items", "data.flag", "data.empty"]) {
    start = seen.length;
    result = await run({
      requests: [
        { method: "GET", path: "/resources" },
        { method: "GET", path: `/users/{{json:1:${field}}}` },
      ],
    });
    assert.equal(result.code, 1, field);
    assert.equal(JSON.parse(result.stdout).completed, false, field);
    assert.equal(seen.length, start + 1, field);
    assert.match(
      result.log,
      new RegExp(
        `request 2 not sent: request 1's ${field.replace(/\./g, "\\.")} is not a string or number`,
      ),
    );
  }
});

test("{{json:<n>:<path>}} shares values across Sessions without altering either Session's cookie jar", async () => {
  const start = seen.length;
  const result = await run({
    requests: [
      signIn("A"),
      { session: "A", method: "GET", path: "/api/v1/auth/csrf-token" },
      {
        session: "B",
        method: "POST",
        path: "/api/v1/protected",
        headers: { "X-CSRF-Token": "{{json:2:data.csrf_token}}" },
      },
      { session: "A", method: "GET", path: "/me" },
      { session: "B", method: "GET", path: "/me" },
    ],
  });
  assert.equal(result.code, 0, result.stdout + result.stderr);
  const [, , postB, meA, meB] = seen.slice(start);
  assert.equal(postB.csrf, "UNSIGNED");
  assert.equal(postB.cookie, null, "Session B sends no Session A cookies");
  assert.match(meA.cookie, /(?:^|; )sid=s3ss10n-value-\d+-abcdef/);
  assert.match(meA.cookie, /fastapi-csrf-token=SIGNED\.sig/);
  assert.equal(meB.cookie, null, "Session B's cookie jar stays empty");
  assert.match(
    result.log,
    /X-CSRF-Token from request 2, session A: \[redacted:request 2 data\.csrf_token\]/,
  );
});

test("a non-secret id copied into a path stays readable, while token-shaped or secret-ancestor values redact", async () => {
  const start = seen.length;
  const result = await run({
    requests: [
      { session: "A", method: "GET", path: "/resources" },
      { session: "A", method: "GET", path: "/users/{{json:1:data.id}}" },
      { session: "A", method: "GET", path: "/users/{{json:1:items.0.id}}" },
      {
        session: "A",
        method: "POST",
        path: "/echo",
        json: { note: "{{json:1:data.jwt}}", extra: "{{json:1:auth.code}}" },
      },
    ],
  });
  assert.equal(result.code, 0, result.stdout + result.stderr);
  const [, userReq, itemReq, echoReq] = seen.slice(start);
  assert.equal(userReq.path, "/users/42");
  assert.equal(itemReq.path, "/users/itm_99");
  assert.equal(JSON.parse(echoReq.body).extra, "s3cr3t-anc3stor");
  assert.match(result.log, /^## 2\. A GET \/users\/42$/m);
  assert.match(result.log, /^## 3\. A GET \/users\/itm_99$/m);
  assert.match(result.log, /path from request 1, session A: 42/);
  assert.match(result.log, /path from request 1, session A: itm_99/);
  assert.doesNotMatch(result.log, /eyJhbGciOiJIUzI1NiJ9|s3cr3t-anc3stor/);
  assert.match(result.log, /\[redacted:request 1 data\.jwt\]/);
  assert.match(result.log, /\[redacted:request 1 auth\.code\]/);
});

test("short secret-named JSON values neither corrupt unrelated log text nor leak in the using request", async () => {
  const start = seen.length;
  const result = await run({
    requests: [
      { session: "A", method: "GET", path: "/short-secret" },
      {
        session: "A",
        method: "POST",
        path: "/verify/{{json:1:data.pin}}",
        headers: { "X-Pin": "{{json:1:data.pin}}", "X-Otp": "{{json:1:data.otp}}" },
        json: { pin: "{{json:1:data.pin}}", otp: "{{json:1:data.otp}}" },
      },
      {
        session: "A",
        method: "GET",
        path: "/verify?code={{json:1:data.otp}}",
      },
    ],
  });
  assert.equal(result.code, 0, result.stdout + result.stderr);
  const [, verifyReq, queryReq] = seen.slice(start);
  assert.equal(verifyReq.path, "/verify/200");
  assert.equal(verifyReq.pin, "200");
  assert.equal(verifyReq.otp, "1");
  assert.deepEqual(JSON.parse(verifyReq.body), { pin: "200", otp: "1" });
  assert.equal(queryReq.path, "/verify?code=1");

  // Unrelated numbers in the log stay intact.
  assert.match(result.log, /^## 1\. A GET \/short-secret$/m);
  assert.equal(result.log.match(/^status: 200$/gm)?.length, 3);
  assert.match(result.log, /"note": "count 200 and step 1"/);
  assert.match(result.log, /"pin": "\[redacted\]"/);
  assert.match(result.log, /"otp": "\[redacted\]"/);

  // The short secrets are masked in the using requests' paths, fill lines, and stdout summary.
  assert.match(result.log, /^## 2\. A POST \/verify\/\[redacted:request 1 data\.pin\]$/m);
  assert.match(result.log, /^## 3\. A GET \/verify\?code=\[redacted:request 1 data\.otp\]$/m);
  assert.match(result.log, /path from request 1, session A: \[redacted:request 1 data\.pin\]/);
  assert.match(result.log, /X-Pin from request 1, session A: \[redacted:request 1 data\.pin\]/);
  assert.match(result.log, /X-Otp from request 1, session A: \[redacted:request 1 data\.otp\]/);
  assert.match(result.log, /json\.pin from request 1, session A: \[redacted:request 1 data\.pin\]/);
  assert.match(result.log, /json\.otp from request 1, session A: \[redacted:request 1 data\.otp\]/);
  assert.match(result.log, /path from request 1, session A: \[redacted:request 1 data\.otp\]/);

  const out = JSON.parse(result.stdout);
  assert.equal(out.requests[1].path, "/verify/[redacted:request 1 data.pin]");
  assert.equal(out.requests[2].path, "/verify?code=[redacted:request 1 data.otp]");
});

test("{{json:<n>:<path>}} preserves exact raw number text for 64-bit snowflake integers, 1.0, 1e3, and duplicate keys", async () => {
  const start = seen.length;
  const result = await run({
    requests: [
      { session: "A", method: "GET", path: "/snowflake" },
      {
        session: "A",
        method: "GET",
        path: "/users/{{json:1:id}}?ratio={{json:1:ratio}}&exp={{json:1:exp}}",
      },
      { session: "A", method: "GET", path: "/ids" },
      { session: "A", method: "GET", path: "/users/{{json:3:id}}?dup={{json:3:dup}}" },
    ],
  });
  assert.equal(result.code, 0, result.stdout + result.stderr);
  const [, snowflakeReq, , idsReq] = seen.slice(start);
  assert.equal(snowflakeReq.path, "/users/1234567890123456789?ratio=1.0&exp=1e3");
  assert.equal(idsReq.path, "/users/9007199254740993?dup=2");
  assert.match(result.log, /path from request 1, session A: 1234567890123456789/);
  assert.match(result.log, /path from request 3, session A: 9007199254740993/);
});
