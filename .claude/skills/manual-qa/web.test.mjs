/**
 * Contract suite for `web.mjs`, the `web` surface's driver (SKILL.md steps 4
 * and 6, ADAPTER.md "The web driver", ADR 0008): it carries out a step
 * sequence the runner wrote, in one browser context per Session, and records a
 * still, the element the step is about, its visible text, the Session and the
 * time at each step, plus a video per Session with `--video`. It asserts
 * nothing: its exit status says only whether every action completed.
 *
 * The sequence checks, the record shape and the missing-Playwright exit run
 * everywhere. The tests that drive a browser need Playwright with Chromium in
 * this repository; they skip without it, and fail instead when
 * `AGENT_KIT_REQUIRE_CHROMIUM=1` says it must be there.
 */

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import { WEB_NOTES, findPlaywright } from "./adapter.mjs";
import { STEP_KEYS, checkSequence, main, runSequence } from "./web.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const adapterDoc = readFileSync(join(HERE, "ADAPTER.md"), "utf8");
const skill = readFileSync(join(HERE, "SKILL.md"), "utf8");
const design = readFileSync(join(HERE, "DESIGN.md"), "utf8");

const PLAYWRIGHT = findPlaywright(ROOT);
const REQUIRED = process.env.AGENT_KIT_REQUIRE_CHROMIUM === "1";
/** Skip a browser test when Chromium is absent, unless the environment says it must be there. */
const NEEDS_CHROMIUM =
  PLAYWRIGHT.chromium || REQUIRED
    ? false
    : "Playwright with Chromium is not installed in this repository";

const PASSWORD = "Corr3ct-Horse-Battery";
const EMAIL = "admin@example.test";
const ENV = { QA_A_EMAIL: EMAIL, QA_A_PASSWORD: PASSWORD };

/** Each request the server saw: its path and Cookie header. */
const seen = [];
let server;
let base;
let port;
let sid = 0;
let dir;
/** A second host: the redirect tests assert it never sees a request. */
let other;
let otherBase;
const otherSeen = [];
/** What `/shadow` and `/shout` show, set by the test that drives them. */
let shownValue = "";

const page = (body, head = "") =>
  `<!doctype html><html><head><meta charset="utf-8"><title>t</title>${head}</head><body>${body}</body></html>`;

before(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const url = new URL(req.url, "http://x");
      seen.push({ path: url.pathname, cookie: req.headers.cookie ?? null });
      const html = (text, headers = {}) => {
        res.writeHead(200, { "content-type": "text/html", ...headers });
        res.end(page(text));
      };
      if (url.pathname === "/set") {
        sid += 1;
        return html("<h1>Cookie set</h1>", {
          "set-cookie": `sid=session-${sid}-abcdef; Path=/; HttpOnly`,
        });
      }
      if (url.pathname === "/who") {
        const has = /(?:^|; )sid=/.test(req.headers.cookie ?? "");
        return html(`<h1>Who</h1><p id="who">${has ? "signed in" : "nobody"}</p>`);
      }
      if (url.pathname === "/users")
        return html('<label>Username <input name="username"></label><a href="/admin">Admin</a>');
      if (url.pathname === "/admin") return html("<h1>Admin</h1>");
      if (url.pathname === "/sign-in")
        return html(
          '<form method="post" action="/login">' +
            '<label>Email <input name="email"></label>' +
            '<label>Password <input name="password" type="password"></label>' +
            '<label>Note <input name="note"></label>' +
            '<label>Hidden <input name="hidden" type="password"></label>' +
            "<button>Sign in</button></form>",
        );
      if (url.pathname === "/login") {
        res.writeHead(303, { location: "/welcome" });
        return res.end();
      }
      if (url.pathname === "/welcome") return html('<h1>Welcome</h1><p role="status">Hello</p>');
      if (url.pathname === "/toast")
        return html(
          "<button onclick=\"setTimeout(() => { const d = document.createElement('p'); " +
            "d.setAttribute('role', 'status'); d.textContent = 'Saved the profile'; " +
            'document.body.append(d); }, 400)">Save</button>',
        );
      if (url.pathname === "/bounce302") {
        res.writeHead(302, { location: `${otherBase}/landed` });
        return res.end();
      }
      if (url.pathname === "/hop") {
        res.writeHead(302, { location: "/bounce302" });
        return res.end();
      }
      if (url.pathname === "/login307") {
        res.writeHead(307, { location: `${otherBase}/steal` });
        return res.end();
      }
      if (url.pathname === "/mask") {
        // A page style that turns masking off, and a re-render that replaces the field.
        res.writeHead(200, { "content-type": "text/html" });
        return res.end(
          page(
            '<label>Nick <input id="n"></label><script>' +
              "document.getElementById('n').addEventListener('input', (e) => {" +
              "  const fresh = document.createElement('input'); fresh.id = 'n'; fresh.value = location.search === '?lower' ? e.target.value.toLowerCase() : e.target.value;" +
              "  e.target.replaceWith(fresh);" +
              "  setTimeout(() => { const p = document.createElement('p'); p.setAttribute('role', 'status');" +
              "    p.textContent = getComputedStyle(document.getElementById('n')).webkitTextSecurity;" +
              "    document.body.append(p); }, 500);" +
              "}, { once: true });</script>",
            "<style>input { -webkit-text-security: none !important; }</style>",
          ),
        );
      }
      if (url.pathname === "/popup-form")
        return html(
          `<form method="post" action="${otherBase}/popup-steal" target="_blank">` +
            '<label>Password <input name="password" type="password"></label>' +
            "<button>Open</button></form>" +
            `<a href="${otherBase}/popup-link" target="_blank">New tab</a>`,
        );
      if (url.pathname === "/shadow")
        return html(
          `<sign-in-badge data-who="${shownValue}"></sign-in-badge><script>` +
            "customElements.define('sign-in-badge', class extends HTMLElement { connectedCallback() {" +
            "  const root = this.attachShadow({ mode: 'open' });" +
            "  root.innerHTML = '<p>Signed in as ' + this.dataset.who + '</p>';" +
            "  this.removeAttribute('data-who'); } });" +
            "</script>",
        );
      if (url.pathname === "/shout")
        return html(
          `<p style="text-transform: uppercase">Contact: ${shownValue.toLowerCase()}</p>`,
        );
      if (url.pathname === "/framed")
        return html(`<h1>Framed</h1><iframe src="${otherBase}/embedded"></iframe>`);
      if (url.pathname === "/late")
        return html(
          `<button onclick="setTimeout(() => window.open('${otherBase}/late-popup'), 50)">Later</button>`,
        );
      if (url.pathname === "/post-form")
        return html(
          '<form method="post" action="/login307">' +
            '<label>Password <input name="password" type="password"></label>' +
            "<button>Send</button></form>",
        );
      if (url.pathname === "/away") return html(`<a href="http://localhost:${port}/who">Leave</a>`);
      html("<h1>Home</h1>");
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  port = server.address().port;
  base = `http://127.0.0.1:${port}`;
  other = createServer((req, res) => {
    otherSeen.push(req.url);
    res.writeHead(200, { "content-type": "text/html" });
    res.end(page("<h1>Other host</h1>"));
  });
  await new Promise((done) => other.listen(0, "127.0.0.1", done));
  otherBase = `http://localhost:${other.address().port}`;
  dir = mkdtempSync(join(tmpdir(), "web-driver-"));
});

after(() => {
  server.close();
  other.close();
  rmSync(dir, { recursive: true, force: true });
});

let runs = 0;
/** Writes a sequence and runs the driver on it, in-process, loading Playwright from this repository. */
async function drive(actions, { env = ENV, video = false, cwd = ROOT, extra = [] } = {}) {
  runs += 1;
  const file = join(dir, `seq-${runs}.json`);
  const out = join(dir, `out-${runs}`);
  writeFileSync(file, JSON.stringify(Array.isArray(actions) ? { actions: inA(actions) } : actions));
  const argv = ["run", file, "--base", base, "--out", out, ...(video ? ["--video"] : []), ...extra];
  const { code, out: stdout } = await main(argv, { env, cwd });
  let summary = null;
  try {
    summary = JSON.parse(stdout);
  } catch {
    // usage text
  }
  const stepsFile = join(out, "steps.json");
  const steps = existsSync(stepsFile) ? JSON.parse(readFileSync(stepsFile, "utf8")) : null;
  return { code, stdout, summary, out, steps };
}

/** Every file the driver wrote, as text, for a search. */
const allText = (out) =>
  existsSync(out)
    ? readdirSync(out, { recursive: true })
        .map((f) => join(out, String(f)))
        .filter((f) => !f.endsWith(".png") && !f.endsWith(".webm") && existsSync(f))
        .map((f) => {
          try {
            return readFileSync(f, "utf8");
          } catch {
            return "";
          }
        })
        .join("\n")
    : "";

// ── The sequence is checked before anything runs ───────────────────────────

/** Gives each action Session A unless it names one: the tests below are about other fields. */
const inA = (actions) =>
  actions.map((a) => (isObject(a) && !("session" in a) ? { session: "A", ...a } : a));
const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const ok = (actions, env = ENV) => checkSequence({ actions: inA(actions) }, env);

test("every action names its Session", () => {
  assert.match(
    checkSequence({ actions: [{ goto: "/" }] }, {}).join("\n"),
    /action 1: session must name the action's Session/,
  );
});

test("a well-formed sequence of every action reads with no problems", () => {
  assert.deepEqual(
    ok([
      { session: "A", goto: "/sign-in" },
      { session: "A", fill: { label: "Email" }, value: "{{env:QA_A_EMAIL}}" },
      { session: "A", fill: { label: "Password" }, value: "{{env:QA_A_PASSWORD}}" },
      { session: "A", fill: { label: "Note", exact: true }, value: "a plain note" },
      { session: "A", click: { role: "button", name: "Sign in" } },
      { session: "A", press: "Enter" },
      { session: "A", wait: { text: "Welcome" }, timeoutMs: 2000 },
      { session: "A", step: "Signed in", subject: { role: "status" }, timeoutMs: 3000 },
      { session: "B", step: "B sees the home page" },
    ]),
    [],
  );
});

test("an unknown key in the file or an action is refused, as http.mjs refuses one", () => {
  assert.match(
    checkSequence({ actions: [{ session: "A", goto: "/" }], extra: 1 }, {}).join("\n"),
    /unknown key "extra"/,
  );
  assert.match(ok([{ goto: "/", wait: { text: "x" } }]).join("\n"), /exactly one action/);
  assert.match(ok([{ goto: "/", selector: "#x" }]).join("\n"), /unknown key "selector"/);
  assert.match(ok([{ click: { css: "#x" } }]).join("\n"), /click: unknown key "css"/);
  assert.match(ok([{ step: "x", timeoutMs: 100 }]).join("\n"), /timeoutMs.*subject/);
});

test("a path to another host, or one that is not a path, is refused", () => {
  for (const path of [
    "https://evil.example/",
    "//evil.example/",
    "/\\evil.example",
    "evil",
    "/a b",
  ])
    assert.match(ok([{ goto: path }]).join("\n"), /action 1: goto/, path);
  assert.deepEqual(ok([{ goto: "/users?page=2#top" }]), []);
});

test("a sign-in value written inline is refused, and the problem never names the value", () => {
  const problems = [
    ...ok([{ fill: { label: "Password" }, value: PASSWORD }]),
    ...ok([{ fill: { label: "Email" }, value: EMAIL }]),
    ...ok([{ step: `typed ${PASSWORD}` }]),
    ...ok([{ fill: { label: "Note" }, value: encodeURIComponent(PASSWORD) }]),
    // A value the sequence fills is refused in any case.
    ...ok([
      { fill: { label: "Email" }, value: "{{env:QA_A_EMAIL}}" },
      { step: `Signed in as ${EMAIL.toUpperCase()}` },
    ]),
    ...ok([
      { fill: { label: "Password" }, value: "{{env:QA_A_PASSWORD}}" },
      { fill: { label: "Note" }, value: PASSWORD.toLowerCase() },
    ]),
  ];
  assert.equal(problems.length >= 6, true, problems.join("\n"));
  for (const problem of problems.slice(-2)) assert.match(problem, /holds the value of QA_A_/);
  assert.ok(!problems.join("\n").includes(PASSWORD));
  assert.ok(!problems.join("\n").includes(EMAIL));
  // A field named like a secret needs a placeholder, whatever the literal.
  assert.match(
    ok([{ fill: { label: "One-time code" }, value: "123456" }]).join("\n"),
    /names a secret; give it as \{\{env:QA_…\}\}/,
  );
  // A token shape anywhere.
  assert.match(
    ok([{ fill: { label: "Note" }, value: `eyJhbGciOi.${"x".repeat(10)}.sig` }]).join("\n"),
    /looks like a JWT/,
  );
  // A secret-named query parameter in a path.
  assert.match(ok([{ goto: "/reset?token=abc123" }]).join("\n"), /names a secret/);
});

test("a common word in an unrelated QA_ variable never refuses a label or caption", () => {
  const env = { ...ENV, QA_X: "admin", QA_B_NAME: "Alice" };
  assert.deepEqual(
    ok(
      [
        { goto: "/" },
        { click: { role: "link", name: "Admin" } },
        { step: "Alice sees the order" },
        { step: "the admin page" },
      ],
      env,
    ),
    [],
  );
  // A sign-in variable's value is still refused as written, filled or not.
  assert.match(
    ok([{ step: `typed ${PASSWORD}` }], { QA_B_PASSWORD: PASSWORD }).join("\n"),
    /holds the value of QA_B_PASSWORD inline/,
  );
  // A value the sequence fills is refused in any case.
  assert.match(
    ok(
      [{ fill: { label: "Name" }, value: "{{env:QA_B_NAME}}" }, { step: "ALICE signed in" }],
      env,
    ).join("\n"),
    /holds the value of QA_B_NAME inline/,
  );
});

test("a sign-in value written in place of its placeholder is refused in any case", () => {
  // No placeholder names QA_A_EMAIL, so nothing would mask or withhold it at run time.
  assert.match(
    ok([{ fill: { label: "Email" }, value: "ada@example.test" }], {
      QA_A_EMAIL: "Ada@Example.test",
    }).join("\n"),
    /holds the value of QA_A_EMAIL inline/,
  );
});

test("a variable is a sign-in one only by a whole word of its name", () => {
  const env = { QA_SHIPPING_CITY: "London", QA_FOOTPRINT: "Small-Footprint" };
  assert.deepEqual(ok([{ step: "London is shown" }, { step: "small-footprint chosen" }], env), []);
});

test("a username is looked for only as written", () => {
  const env = { QA_A_USERNAME: "admin" };
  assert.deepEqual(
    ok([{ click: { role: "link", name: "Admin" } }, { step: "the admin page" }], env),
    [],
  );
  assert.deepEqual(ok([{ step: "Admin is shown" }], env), []);
  assert.match(
    ok([{ fill: { label: "Username" }, value: "admin" }], env).join("\n"),
    /value of QA_A_USERNAME inline/,
  );
  assert.match(ok([{ goto: "/sign-in?user=admin" }], env).join("\n"), /QA_A_USERNAME inline/);
  // Filled through its placeholder, as a sign-in does, it is still looked for only as written.
  const signIn = [
    { session: "A", fill: { label: "Username" }, value: "{{env:QA_A_USERNAME}}" },
    { session: "A", click: { role: "link", name: "Admin" } },
  ];
  assert.deepEqual(checkSequence({ actions: signIn }, env), []);
});

test("a secret or email word in a username's name keeps it any-case", () => {
  const env = { QA_A_LOGIN_PASSWORD: "Hunter2!x", QA_A_USER_EMAIL: "Ada@Example.test" };
  assert.match(
    ok([{ step: "type hunter2!x then submit" }], env).join("\n"),
    /value of QA_A_LOGIN_PASSWORD inline/,
  );
  assert.match(
    ok([{ fill: { label: "Note" }, value: "pw: Hunter2!x" }], env).join("\n"),
    /value of QA_A_LOGIN_PASSWORD inline/,
  );
  assert.match(
    ok([{ step: "ADA@EXAMPLE.TEST is shown" }], env).join("\n"),
    /value of QA_A_USER_EMAIL inline/,
  );
});

test(
  "a filled value named both a username and a secret or email is withheld in any case",
  { skip: NEEDS_CHROMIUM },
  async () => {
    shownValue = "ada@example.test";
    const { code, steps, stdout } = await drive(
      [
        { session: "A", goto: "/sign-in" },
        { session: "A", fill: { label: "Note" }, value: "{{env:QA_A_USER_EMAIL}}" },
        { session: "A", fill: { label: "Email" }, value: "{{env:QA_A_LOGIN_PASSWORD}}" },
        { session: "A", step: "Filled" },
        { session: "A", goto: "/shout" },
        { session: "A", step: "Shouted" },
      ],
      { env: { QA_A_USER_EMAIL: "ada@example.test", QA_A_LOGIN_PASSWORD: "Hunter2!x" } },
    );
    shownValue = "";
    assert.equal(code, 0, stdout);
    const [filled, shouted] = steps.steps;
    assert.match(filled.withheld, /a field holds a sign-in value/);
    assert.equal(shouted.still, null);
    assert.match(shouted.withheld, /sign-in value is on the screen/);
  },
);

test(
  "a filled username does not withhold a still where the page shows it in another case",
  { skip: NEEDS_CHROMIUM },
  async () => {
    const { code, steps, stdout } = await drive(
      [
        { session: "A", goto: "/users" },
        { session: "A", fill: { label: "Username" }, value: "{{env:QA_A_USERNAME}}" },
        { session: "A", click: { role: "link", name: "Admin" } },
        { session: "A", step: "The admin page" },
      ],
      { env: { QA_A_USERNAME: "admin" } },
    );
    assert.equal(code, 0, stdout);
    const [shown] = steps.steps;
    assert.equal(shown.withheld, null);
    assert.ok(shown.still);
  },
);

test("a placeholder must name a set QA_ variable, and goes only in a fill's value", () => {
  assert.match(
    ok([{ fill: { label: "x" }, value: "{{env:HOME}}" }]).join("\n"),
    /only QA_ variables/,
  );
  assert.match(ok([{ fill: { label: "x" }, value: "{{env:QA_NOPE}}" }]).join("\n"), /not set/);
  assert.match(ok([{ goto: "/{{env:QA_A_EMAIL}}" }]).join("\n"), /only in a fill's value/);
  assert.match(ok([{ step: "{{env:QA_A_EMAIL}}" }]).join("\n"), /only in a fill's value/);
});

test("sessions, keys, targets and bounds are checked", () => {
  assert.match(ok([{ session: "a", goto: "/" }]).join("\n"), /single capital letter/);
  assert.match(ok([{ press: "Enter\n" }]).join("\n"), /press/);
  assert.match(ok([{ wait: { text: "x" }, timeoutMs: 999_999 }]).join("\n"), /timeoutMs/);
  assert.match(ok([{ click: { role: "button", label: "x" } }]).join("\n"), /one of/);
  assert.match(ok([{ click: { label: "x", name: "y" } }]).join("\n"), /name.*role/);
  assert.match(ok([{ step: "" }]).join("\n"), /caption/);
  assert.match(checkSequence({ actions: [] }, {}).join("\n"), /one or more/);
});

test("a refused sequence exits 1 with its problems, and nothing runs or is written", async () => {
  const { code, summary, out } = await drive([
    { goto: "https://evil.example/" },
    { fill: { label: "Password" }, value: PASSWORD },
  ]);
  assert.equal(code, 1);
  assert.equal(summary.completed, false);
  assert.ok(summary.problems.length >= 2);
  assert.ok(!JSON.stringify(summary).includes(PASSWORD));
  assert.equal(existsSync(out), false);
});

test("usage errors exit 2", async () => {
  for (const argv of [
    [],
    ["run"],
    ["run", "x.json", "--base", "http://127.0.0.1:1"],
    ["run", "x.json", "--out", "o"],
    ["run", "x.json", "--base", "http://127.0.0.1:1/app", "--out", "o"],
    ["run", "x.json", "--base", "ftp://127.0.0.1", "--out", "o"],
    ["run", "x.json", "--base", "http://u:p@127.0.0.1", "--out", "o"],
    ["run", "x.json", "--base", "http://127.0.0.1", "--out", "o", "--log", "x"],
  ])
    assert.equal((await main(argv, { env: {}, cwd: ROOT })).code, 2, argv.join(" "));
});

test("with Playwright missing, the driver exits 2 naming what to install, and runs nothing", async () => {
  const empty = mkdtempSync(join(tmpdir(), "no-playwright-"));
  try {
    const { code, stdout, out } = await drive([{ goto: "/" }], { cwd: empty });
    assert.equal(code, 2);
    assert.match(stdout, /npm install --save-dev playwright/);
    assert.match(stdout, /npx playwright install chromium/);
    assert.match(stdout, /harness's browser/);
    assert.equal(existsSync(out), false);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

test("the step record's keys are the documented ones", () => {
  assert.deepEqual(STEP_KEYS, [
    "session",
    "index",
    "caption",
    "still",
    "subject",
    "text",
    "atMs",
    "withheld",
  ]);
  for (const key of STEP_KEYS) assert.ok(adapterDoc.includes(`| \`${key}\``), key);
});

// ── Driving Chromium ────────────────────────────────────────────────────────

test(
  "Chromium is here when AGENT_KIT_REQUIRE_CHROMIUM says it must be",
  { skip: !REQUIRED },
  () => {
    assert.ok(PLAYWRIGHT.chromium, "AGENT_KIT_REQUIRE_CHROMIUM=1, but no Playwright with Chromium");
  },
);

test("two Sessions keep their cookies apart", { skip: NEEDS_CHROMIUM }, async () => {
  seen.length = 0;
  const { code, steps } = await drive([
    { session: "A", goto: "/set" },
    { session: "B", goto: "/who" },
    { session: "A", goto: "/who" },
    { session: "A", step: "A is signed in", subject: { text: "signed in" } },
    { session: "B", goto: "/who" },
    { session: "B", step: "B is nobody", subject: { text: "nobody" } },
  ]);
  assert.equal(code, 0);
  const who = seen.filter((s) => s.path === "/who");
  assert.equal(who.length, 3);
  assert.equal(who[0].cookie, null, "B before A signed in");
  assert.match(who[1].cookie ?? "", /sid=session-/, "A sends its cookie");
  assert.equal(who[2].cookie, null, "B never sends A's cookie");
  assert.deepEqual(
    steps.steps.map((s) => [s.session, s.text]),
    [
      ["A", "signed in"],
      ["B", "nobody"],
    ],
  );
});

test(
  "each step writes a still and one record, and the times rise",
  { skip: NEEDS_CHROMIUM },
  async () => {
    const { code, summary, out, steps } = await drive([
      { goto: "/welcome" },
      { step: "The welcome page" },
      { step: "The status line", subject: { role: "status" } },
      { session: "B", goto: "/" },
      { session: "B", step: "B's home", subject: { role: "heading", name: "Home" } },
    ]);
    assert.equal(code, 0);
    assert.equal(summary.completed, true);
    const records = steps.steps;
    assert.equal(records.length, 3);
    for (const [i, record] of records.entries()) {
      assert.deepEqual(Object.keys(record), STEP_KEYS);
      assert.equal(record.index, i + 1);
      assert.equal(record.withheld, null);
      assert.ok(existsSync(join(out, record.still)), record.still);
      assert.equal(typeof record.atMs, "number");
      if (i) assert.ok(record.atMs > records[i - 1].atMs, "times rise");
    }
    assert.equal(records[0].subject, null);
    assert.equal(records[0].text, null);
    assert.equal(records[1].text, "Hello");
    for (const key of ["x", "y", "width", "height"])
      assert.equal(typeof records[1].subject[key], "number");
    assert.equal(records[2].session, "B");
    assert.equal(records[2].caption, "B's home");
    assert.equal(records[2].still, "step-03-b.png");
  },
);

test(
  "a wait-then-step waits for its subject up to the bound, then takes the still",
  { skip: NEEDS_CHROMIUM },
  async () => {
    const { code, steps } = await drive([
      { goto: "/toast" },
      { click: { role: "button", name: "Save" } },
      { step: "The toast", subject: { role: "status" }, timeoutMs: 5000 },
    ]);
    assert.equal(code, 0);
    assert.equal(steps.steps[0].text, "Saved the profile");
    assert.ok(steps.steps[0].still);
  },
);

test(
  "a subject that never appears exits 1, and the step file keeps the earlier steps",
  { skip: NEEDS_CHROMIUM },
  async () => {
    const { code, summary, steps } = await drive([
      { goto: "/" },
      { step: "Home" },
      { step: "A toast that never comes", subject: { role: "status" }, timeoutMs: 300 },
      { step: "Never reached" },
    ]);
    assert.equal(code, 1);
    assert.equal(summary.completed, false);
    assert.equal(summary.error.action, 3);
    assert.deepEqual(
      steps.steps.map((s) => s.caption),
      ["Home"],
    );
  },
);

test(
  "a navigation off the checked address does not complete",
  { skip: NEEDS_CHROMIUM },
  async () => {
    seen.length = 0;
    const { code, summary } = await drive([{ goto: "/away" }, { click: { text: "Leave" } }]);
    assert.equal(code, 1);
    assert.match(summary.error.why, /left the checked address/);
    assert.equal(
      seen.filter((s) => s.path === "/who").length,
      0,
      "the other host was never reached",
    );
  },
);

test(
  "a redirect off the checked address is stopped before the request leaves",
  { skip: NEEDS_CHROMIUM },
  async () => {
    otherSeen.length = 0;
    for (const path of ["/bounce302", "/hop"]) {
      const { code, summary } = await drive([{ session: "A", goto: path }]);
      assert.equal(code, 1, path);
      assert.match(summary.error.why, /left the checked address/, path);
    }
    // A 307 after a sign-in POST would carry the form, password included, to the other host.
    const posted = await drive([
      { session: "A", goto: "/post-form" },
      { session: "A", fill: { label: "Password" }, value: "{{env:QA_A_PASSWORD}}" },
      { session: "A", click: { role: "button", name: "Send" } },
    ]);
    assert.equal(posted.code, 1);
    assert.match(posted.summary.error.why, /left the checked address/);
    assert.deepEqual(otherSeen, [], "the other host never saw a request");
  },
);

test(
  "a sign-in value that appears while the still is taken drops the still",
  { skip: NEEDS_CHROMIUM },
  async () => {
    const out = mkdtempSync(join(tmpdir(), "web-recheck-"));
    try {
      const sequence = {
        actions: [
          { session: "A", goto: "/sign-in" },
          { session: "A", fill: { label: "Note" }, value: "{{env:QA_A_EMAIL}}" },
          { session: "A", fill: { label: "Note" }, value: "" },
          { session: "A", step: "Shown during the still" },
          { session: "A", step: "Still shown" },
        ],
      };
      // A script that renders the email just as the still is taken, after the first check.
      const screenshot = async (pageHandle, path) => {
        await pageHandle.screenshot({ path });
        await pageHandle.evaluate((text) => {
          document.body.append(Object.assign(document.createElement("p"), { textContent: text }));
        }, EMAIL);
      };
      const result = await runSequence(sequence, {
        base,
        env: ENV,
        out,
        video: false,
        playwright: PLAYWRIGHT.module,
        screenshot,
      });
      assert.equal(result.completed, true, JSON.stringify(result.error));
      const [during, after] = result.steps;
      assert.equal(during.still, null);
      assert.match(during.withheld, /sign-in value is on the screen/);
      assert.equal(existsSync(join(out, "step-01-a.png")), false, "the still was deleted");
      assert.equal(after.still, null);
      assert.match(after.withheld, /sign-in value is on the screen/);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  },
);

test(
  "a field filled from a sign-in value stays masked over page styles and a re-render",
  { skip: NEEDS_CHROMIUM },
  async () => {
    const { code, steps, stdout } = await drive([
      { session: "A", goto: "/mask" },
      { session: "A", fill: { label: "Nick" }, value: "{{env:QA_A_EMAIL}}" },
      { session: "A", step: "Masked", subject: { role: "status" }, timeoutMs: 3000 },
    ]);
    assert.equal(code, 0, stdout);
    assert.equal(steps.steps[0].text, "disc");
  },
);

test(
  "a tab a click opens never sends its first request, and the action does not complete",
  { skip: NEEDS_CHROMIUM },
  async () => {
    otherSeen.length = 0;
    const posted = await drive([
      { session: "A", goto: "/popup-form" },
      { session: "A", step: "The form" },
      { session: "A", fill: { label: "Password" }, value: "{{env:QA_A_PASSWORD}}" },
      { session: "A", click: { role: "button", name: "Open" } },
      { session: "A", step: "Never reached" },
    ]);
    assert.equal(posted.code, 1, posted.stdout);
    assert.equal(posted.summary.completed, false);
    assert.equal(posted.summary.error.action, 4);
    assert.match(posted.summary.error.why, /a tab or window was opened during or after action \d+/);
    assert.deepEqual(posted.steps.error, posted.summary.error, "the step file says why too");
    assert.deepEqual(
      posted.steps.steps.map((s) => s.caption),
      ["The form"],
    );
    const linked = await drive([
      { session: "A", goto: "/popup-form" },
      { session: "A", click: { role: "link", name: "New tab" } },
    ]);
    assert.equal(linked.code, 1);
    assert.match(linked.summary.error.why, /a tab or window was opened during or after action \d+/);
    assert.deepEqual(otherSeen, [], "the other host never saw a request");
  },
);

test(
  "a tab opened after the last action returned still stops the run, named by that action",
  { skip: NEEDS_CHROMIUM },
  async () => {
    otherSeen.length = 0;
    const { code, summary, steps } = await drive([
      { session: "A", goto: "/late" },
      { session: "A", click: { role: "button", name: "Later" } },
    ]);
    assert.equal(code, 1);
    assert.equal(summary.completed, false);
    assert.equal(summary.error.action, 2);
    assert.match(summary.error.why, /a tab or window was opened during or after action 2/);
    assert.deepEqual(steps.error, summary.error);
    assert.deepEqual(otherSeen, []);
  },
);

test(
  "a frame on another host still loads: only a page's own address is guarded",
  { skip: NEEDS_CHROMIUM },
  async () => {
    otherSeen.length = 0;
    const { code, stdout } = await drive([
      { session: "A", goto: "/framed" },
      { session: "A", wait: { role: "heading", name: "Framed" } },
    ]);
    assert.equal(code, 0, stdout);
    // The frame's request may land a moment after the page reports loaded.
    for (let i = 0; i < 20 && !otherSeen.length; i++) await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(otherSeen, ["/embedded"]);
  },
);

test(
  "a sign-in value in an open shadow root, or shown in another case, withholds the still",
  { skip: NEEDS_CHROMIUM },
  async () => {
    shownValue = EMAIL;
    const { code, steps, out, stdout } = await drive([
      { session: "A", goto: "/sign-in" },
      // A fill names the value, so the driver knows to look for it.
      { session: "A", fill: { label: "Note" }, value: "{{env:QA_A_EMAIL}}" },
      { session: "A", goto: "/shadow" },
      { session: "A", step: "Badge in a shadow root" },
      { session: "A", goto: "/shout" },
      { session: "A", step: "Shouted", subject: { text: "Contact" } },
    ]);
    shownValue = "";
    assert.equal(code, 0, stdout);
    const [badge, shouted] = steps.steps;
    assert.equal(badge.still, null);
    assert.match(badge.withheld, /sign-in value is on the screen/);
    assert.equal(shouted.still, null);
    assert.match(shouted.withheld, /sign-in value is on the screen/);
    assert.match(shouted.text, /^CONTACT: \[redacted:QA_A_EMAIL\]$/);
    assert.ok(!allText(out).toLowerCase().includes(EMAIL));
  },
);

test(
  "a field the page lower-cases and re-renders stays masked",
  { skip: NEEDS_CHROMIUM },
  async () => {
    const { code, steps, stdout } = await drive(
      [
        { session: "A", goto: "/mask?lower" },
        { session: "A", fill: { label: "Nick" }, value: "{{env:QA_A_NICK}}" },
        { session: "A", step: "Masked", subject: { role: "status" }, timeoutMs: 3000 },
      ],
      { env: { ...ENV, QA_A_NICK: "Mixed-Case-Nick" } },
    );
    assert.equal(code, 0, stdout);
    assert.equal(steps.steps[0].text, "disc");
  },
);

test(
  "no still while a password field holds a value, and no sign-in value in any file",
  { skip: NEEDS_CHROMIUM },
  async () => {
    const { code, out, steps, stdout } = await drive(
      [
        { goto: "/sign-in" },
        { step: "The empty form" },
        { fill: { label: "Password" }, value: "{{env:QA_A_PASSWORD}}" },
        { step: "Password typed" },
        { fill: { label: "Password" }, value: "" },
        { fill: { label: "Email" }, value: "{{env:QA_A_EMAIL}}" },
        { step: "Email typed", subject: { label: "Email" } },
        { fill: { label: "Password" }, value: "{{env:QA_A_PASSWORD}}" },
        { click: { role: "button", name: "Sign in" } },
        { wait: { role: "heading", name: "Welcome" } },
        { step: "Signed in" },
      ],
      { video: true },
    );
    assert.equal(code, 0, stdout);
    const [empty, typed, email, signedIn] = steps.steps;
    assert.ok(empty.still);
    assert.equal(typed.still, null);
    assert.match(typed.withheld, /password field holds a value/);
    assert.equal(email.still, null);
    assert.match(email.withheld, /sign-in value/);
    assert.ok(signedIn.still);
    assert.equal(signedIn.withheld, null);
    assert.equal(existsSync(join(out, "step-02-a.png")), false);
    assert.equal(email.subject === null, false, "the subject is still recorded");
    const text = allText(out) + stdout;
    assert.ok(!text.includes(PASSWORD));
    assert.ok(!text.includes(EMAIL));
    // Literal text into a password field is refused at run time.
    const literal = await drive([
      { goto: "/sign-in" },
      { fill: { label: "Note" }, value: "fine" },
      { fill: { role: "textbox", name: "Note" }, value: "still fine" },
      { fill: { label: "Hidden" }, value: "letmein-but-literal" },
    ]);
    assert.equal(literal.code, 1);
    assert.match(literal.summary.error.why, /password field/);
  },
);

test(
  "each Session's video is kept with --video, and none without it",
  { skip: NEEDS_CHROMIUM },
  async () => {
    const actions = [
      { session: "A", goto: "/" },
      { session: "A", step: "A" },
      { session: "B", goto: "/who" },
      { session: "B", step: "B" },
    ];
    const recorded = await drive(actions, { video: true });
    assert.equal(recorded.code, 0);
    assert.deepEqual(recorded.summary.videos.sort(), ["video-a.webm", "video-b.webm"]);
    for (const file of ["video-a.webm", "video-b.webm"])
      assert.ok(existsSync(join(recorded.out, file)), file);
    assert.equal(recorded.steps.sessions.A.video, "video-a.webm");
    const plain = await drive(actions);
    assert.equal(plain.code, 0);
    assert.deepEqual(plain.summary.videos, []);
    assert.deepEqual(
      readdirSync(plain.out).filter((f) => f.endsWith(".webm")),
      [],
    );
    assert.equal(plain.steps.sessions.B.video, null);
  },
);

test("the driver adds no Chromium switch, so Playwright's own `--disable-features` list stands", () => {
  const source = readFileSync(join(HERE, "web.mjs"), "utf8");
  assert.match(source, /chromium\.launch\(\{ headless: true \}\)/);
  assert.doesNotMatch(source, /--disable-features|--enable-features/);
});

// ── The docs ────────────────────────────────────────────────────────────────

test("ADAPTER.md documents the CLI, and words the readiness notes as readiness does", () => {
  const flat = adapterDoc.replace(/\s+/g, " ");
  assert.match(
    flat,
    /node "<skill>\/web\.mjs" run <sequence\.json> --base <address> --out <dir> \[--video\]/,
  );
  for (const note of Object.values(WEB_NOTES)) assert.ok(flat.includes(note), note);
  assert.match(design, /## A driver for the web surface/);
  assert.match(skill.replace(/\s+/g, " "), /`web\.mjs`/);
});
