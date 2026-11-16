/**
 * Contract suite for `review-response.json` (RESPONSE.md). The claims under
 * test: the schema in RESPONSE.md is the one `response.mjs` checks against;
 * every good file passes and every bad one fails with a named problem; and
 * RESPONSE.md's field table, example and summary agree with the schema.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { checkResponse, loadSchema, summarize, validate } from "./response.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures", "responses");
const RESPONSE_MD = readFileSync(join(HERE, "RESPONSE.md"), "utf8");
const fixture = (name) => readFileSync(join(FIXTURES, name), "utf8");
const fences = (lang) =>
  [...RESPONSE_MD.matchAll(new RegExp("```" + lang + "\\n([\\s\\S]*?)```", "g"))].map((m) => m[1]);

// ── The schema is RESPONSE.md's ─────────────────────────────────────────────

test("the schema is the first json block under RESPONSE.md's Schema heading", () => {
  const section = RESPONSE_MD.split("\n## Schema\n")[1].split("\n## ")[0];
  const block = /```json\n([\s\S]*?)```/.exec(section)[1];
  assert.deepEqual(loadSchema(), JSON.parse(block));
});

test("the schema requires thread_id, verdict and reply, and commit for fixed only", () => {
  const entry = loadSchema().properties.findings.items;
  assert.deepEqual(entry.required, ["thread_id", "verdict", "reply"]);
  assert.deepEqual(Object.keys(entry.properties), ["thread_id", "verdict", "reply", "commit"]);
  assert.deepEqual(entry.properties.verdict.enum, ["fixed", "addressed", "declined"]);
  assert.deepEqual(entry.if, { properties: { verdict: { const: "fixed" } } });
  assert.deepEqual(entry.then, { required: ["commit"] });
  assert.deepEqual(entry.else, { not: { required: ["commit"] } });
});

test("RESPONSE.md's field table names exactly the schema's fields", () => {
  const rows = [...RESPONSE_MD.matchAll(/^\| `([^`]+)` +\|/gm)].map((m) => m[1]);
  const entry = loadSchema().properties.findings.items;
  assert.deepEqual(rows, [
    ...Object.keys(loadSchema().properties),
    ...Object.keys(entry.properties).map((field) => `findings[].${field}`),
  ]);
});

test("RESPONSE.md's example passes, and its summary is what `summarize` prints", () => {
  const example = fences("json").find((text) => !text.includes('"$schema"'));
  assert.deepEqual(checkResponse(example).problems, []);
  assert.equal(summarize(JSON.parse(example)), fences("text")[0].trimEnd());
});

// ── Good and bad files ──────────────────────────────────────────────────────

const GOOD = readdirSync(FIXTURES).filter((name) => name.startsWith("good-"));

/** Each bad file, and the problem it must be refused with. */
const BAD = {
  "bad-not-json.txt": /^\$: not valid JSON/,
  "bad-not-an-object.json": /^\$: expected an object/,
  "bad-no-findings.json": /^\$: `findings` is required[\s\S]*\$\.results: not allowed/,
  "bad-extra-top-level.json": /^\$\.summary: not allowed/,
  "bad-missing-thread-id.json": /^\$\.findings\[0\]: `thread_id` is required/,
  "bad-empty-thread-id.json": /^\$\.findings\[0\]\.thread_id: must not be empty/,
  "bad-thread-id-not-string.json": /^\$\.findings\[0\]\.thread_id: expected a string/,
  "bad-unknown-verdict.json":
    /^\$\.findings\[0\]\.verdict: must be one of fixed, addressed, declined/,
  "bad-missing-reply.json": /^\$\.findings\[0\]: `reply` is required/,
  "bad-blank-reply.json": /^\$\.findings\[0\]\.reply: must not be empty/,
  "bad-fixed-without-commit.json": /^\$\.findings\[0\]: `commit` is required/,
  "bad-commit-on-declined.json": /^\$\.findings\[0\]: `commit` is not allowed here/,
  "bad-short-commit.json": /^\$\.findings\[0\]\.commit: must match/,
  "bad-extra-field.json": /^\$\.findings\[0\]\.resolve: not allowed/,
  "bad-duplicate-thread.json": /^\$\.findings\[1\]\.thread_id: `PRRT_a` already has an entry/,
};

test("every fixture is a good file or a bad file this suite names", () => {
  for (const name of readdirSync(FIXTURES))
    assert.ok(GOOD.includes(name) || Object.hasOwn(BAD, name), `${name} is not covered`);
  assert.ok(GOOD.length >= 3);
});

for (const name of GOOD)
  test(`${name} passes`, () => {
    assert.deepEqual(checkResponse(fixture(name)).problems, []);
  });

for (const [name, expected] of Object.entries(BAD))
  test(`${name} is refused with a named problem`, () => {
    const { problems } = checkResponse(fixture(name));
    assert.ok(problems.length > 0, `${name} passed`);
    assert.match(problems.join("\n"), expected);
  });

// ── The validator handles the schema keywords it claims ─────────────────────

test("validate reports every keyword the schema uses, and ignores annotations", () => {
  const schema = {
    $schema: "x",
    title: "t",
    type: "object",
    properties: { a: { const: "y" }, b: { type: "array", items: { type: "string" } } },
  };
  assert.deepEqual(validate(schema, { a: "y", b: ["s"] }), []);
  assert.deepEqual(validate(schema, { a: "n", b: [1] }), [
    "$.a: must be y",
    "$.b[0]: expected a string",
  ]);
  assert.throws(() => validate({ minimum: 1 }, 2), /unsupported schema keyword `minimum`/);
});

// ── The command ─────────────────────────────────────────────────────────────

const check = (...args) =>
  spawnSync(process.execPath, [join(HERE, "response.mjs"), ...args], { encoding: "utf8" });

test("`response.mjs check` prints the summary, or each problem and exit 1", () => {
  const good = check("check", join(FIXTURES, "good-all-verdicts.json"));
  assert.equal(good.status, 0, good.stderr);
  assert.match(good.stdout, /3 findings: 1 fixed, 1 addressed, 1 declined/);

  const bad = check("check", join(FIXTURES, "bad-fixed-without-commit.json"));
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /\$\.findings\[0\]: `commit` is required/);

  assert.equal(check().status, 2);
  assert.match(check().stderr, /usage: response\.mjs check <file>/);
  assert.equal(check("check", join(FIXTURES, "no-such-file.json")).status, 2);
});
