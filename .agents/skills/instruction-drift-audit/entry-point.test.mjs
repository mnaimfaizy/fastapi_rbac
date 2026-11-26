/**
 * Contract suite for `isEntryPoint`, the guard the three CLIs run `main` behind.
 *
 * The defect this guards against: on Windows the old inline comparison never
 * matched, so every CLI printed nothing and exited 0. The spawned cases are the
 * ones that would have caught it — they run the real files the way a human
 * does, and assert the CLI said something.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { isEntryPoint } from "./entry-point.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THIS_FILE = fileURLToPath(import.meta.url);

test("isEntryPoint is true for the module URL of the script path itself", () => {
  assert.equal(isEntryPoint(pathToFileURL(THIS_FILE).href, THIS_FILE), true);
});

test("isEntryPoint is false for a different script", () => {
  const other = join(HERE, "report.mjs");
  assert.equal(isEntryPoint(pathToFileURL(THIS_FILE).href, other), false);
});

test("isEntryPoint is false when there is no script path (a REPL or -e)", () => {
  assert.equal(isEntryPoint(pathToFileURL(THIS_FILE).href, ""), false);
});

const runCli = (file, args = []) =>
  spawnSync(process.execPath, [join(HERE, file), ...args], {
    encoding: "utf8",
  });

test("validate-report.mjs runs main when executed: no arguments is exit 2 with usage", () => {
  const result = runCli("validate-report.mjs");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /usage: validate-report\.mjs/);
});

test("resolve-baseline.mjs runs main when executed: it prints its resolution", () => {
  const result = runCli("resolve-baseline.mjs", ["--repo", HERE]);
  assert.equal(result.status, 0);
  assert.notEqual(result.stdout.trim(), "");
});

test("resolve-ledger.mjs runs main when executed: it prints the ledger status", () => {
  const result = runCli("resolve-ledger.mjs", ["--repo", HERE]);
  assert.equal(result.status, 0);
  assert.notEqual(result.stdout.trim(), "");
});
