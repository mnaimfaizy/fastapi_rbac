/**
 * Contract suite for GROUNDING.md's collision check: it searches by concept
 * (sibling names and call sites), not only by exact constant name, and its
 * rules cover the whole sibling set (#151).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(HERE, name), "utf8").replace(/\r\n/g, "\n");
const grounding = read("GROUNDING.md");
const skill = read("SKILL.md");

const step =
  /## 3\. Run the collision check — mandatory\n([\s\S]*?)\n## 4\./.exec(grounding)?.[1] ?? "";
const flat = step.replace(/\s+/g, " ");

test("the collision check step is found", () => {
  assert.ok(step.length > 0, "GROUNDING.md has no step 3 collision check");
});

test("it searches by concept: exact name, sibling names with patterns, inline literals", () => {
  assert.match(flat, /by concept, not only by the exact name/);
  assert.match(flat, /\*\*The exact name\*\*/);
  assert.match(
    flat,
    /\*\*Sibling names\*\* — the cited constant's stem with other units or suffixes/,
  );
  for (const suffix of ["_EXPIRE_*", "_TTL*", "_TIMEOUT*", "_LIMIT*", "_MAX*", "_SIZE*"])
    assert.ok(step.includes(`\`<STEM>${suffix}\``), `missing sibling pattern <STEM>${suffix}`);
  assert.match(flat, /Keep the stem: a bare `\*_EXPIRE_\*` pulls in other quantities/);
  assert.match(flat, /A literal value used inline for the same quantity counts too/);
});

test("sibling search is case-insensitive, for other spellings of the same setting", () => {
  assert.match(flat, /Search case-insensitively/);
  assert.match(flat, /`settings\.refresh_token_expire_days`, `refreshTokenTtl`/);
  assert.match(step, /rg -n -i "refresh_\?token_\?\(expire\|ttl\|timeout\|lifetime\)"/);
});

test("it traces every call site that sets or overrides the quantity, each value with its scope", () => {
  assert.match(flat, /\*\*Every call site that sets or overrides the quantity\*\*/);
  assert.match(flat, /not only where the setting is defined/);
  assert.match(flat, /Write down every distinct value in it and the scope that value applies to/);
});

test("both failure examples are given: export size and refresh token", () => {
  assert.match(flat, /10 MB hard limit/);
  assert.match(flat, /`REFRESH_TOKEN_EXPIRE_MINUTES` found one value, 100 days/);
  assert.match(flat, /`REFRESH_TOKEN_EXPIRE_DAYS`, 7 days, which the change-password route uses/);
});

test("the rules cover the whole sibling set", () => {
  assert.match(flat, /Rules that follow, across the whole sibling set:/);
  assert.match(
    flat,
    /is \*\*never\*\* reported as one number, whether the values share a name or not/,
  );
  assert.match(flat, /trace the call chain until you can/);
  assert.match(
    flat,
    /duplicates or siblings — are worth surfacing to the user as a possible defect/,
  );
});

test("both completion criteria name the concept search", () => {
  const criterion =
    /Every cited constant was searched repo-wide by exact name, sibling names, and the call sites that set or override it/;
  assert.match(grounding.replace(/\s+/g, " "), criterion);
  assert.match(skill.replace(/\s+/g, " "), criterion);
});
