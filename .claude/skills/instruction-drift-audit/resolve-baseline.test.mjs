/**
 * Contract suite for the Baseline resolver's CLI adapter: the narrow
 * `ecosystems:` / `version_record.path` config parsing, and the end-to-end
 * `run()` over a fixture repo tree (DESIGN.md §1 and §2).
 */

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  DEFAULT_VERSION_RECORD_PATH,
  parseEcosystemsFromConfig,
  resolveVersionRecordPath,
  run,
} from "./resolve-baseline.mjs";

// ── Config parsing ───────────────────────────────────────────────────────────

test("parseEcosystemsFromConfig reads a lead-only entry and one with add/remove", () => {
  const text = [
    "brief_dir: docs/research",
    "ecosystems:",
    "  - lead: nx",
    "  - lead: next",
    "    members:",
    "      add: [eslint-config-next]",
    "      remove: ['@next/env']",
    "issue:",
    "  tracker: github",
  ].join("\n");

  const ecosystems = parseEcosystemsFromConfig(text);

  assert.deepEqual(ecosystems, [
    { lead: "nx" },
    {
      lead: "next",
      addMembers: ["eslint-config-next"],
      removeMembers: ["@next/env"],
    },
  ]);
});

test("parseEcosystemsFromConfig returns an empty list when the key is absent", () => {
  assert.deepEqual(parseEcosystemsFromConfig("brief_dir: docs/research"), []);
});

test("resolveVersionRecordPath reads the configured path and defaults otherwise", () => {
  const configured = ["version_record:", "  path: TECH_STACK.md"].join("\n");
  assert.equal(resolveVersionRecordPath(configured), "TECH_STACK.md");
  assert.equal(resolveVersionRecordPath("brief_dir: docs/research"), DEFAULT_VERSION_RECORD_PATH);
});

// ── End to end over a fixture repo tree ──────────────────────────────────────

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value));
}

test("run() resolves a fixture repo tree: installed wins, drift note fires, absent member is quiet", () => {
  const repo = mkdtempSync(join(tmpdir(), "baseline-resolver-"));
  try {
    writeFileSync(
      join(repo, "instruction-drift-audit.config.yml"),
      ["ecosystems:", "  - lead: nx", "version_record:", "  path: TECH_STACK.md"].join("\n"),
    );
    writeFileSync(join(repo, "TECH_STACK.md"), "| `nx` | 22.3.3 | Monorepo build system |\n");
    mkdirSync(join(repo, "node_modules", "nx"), { recursive: true });
    writeJson(join(repo, "node_modules", "nx", "package.json"), {
      version: "22.7.7",
    });
    mkdirSync(join(repo, "node_modules", "@nx", "eslint-plugin"), {
      recursive: true,
    });
    writeJson(join(repo, "node_modules", "@nx", "eslint-plugin", "package.json"), {
      version: "22.7.7",
    });

    const lines = run({ repo });

    assert.ok(lines.some((line) => line.includes("Baseline 22.7.7")));
    assert.ok(lines.some((line) => line.includes("@nx/eslint-plugin")));
    assert.ok(lines.some((line) => line.includes("drift") && line.includes("22.3.3")));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("run() says so when no ecosystems are declared", () => {
  const repo = mkdtempSync(join(tmpdir(), "baseline-resolver-"));
  try {
    const lines = run({ repo });
    assert.equal(lines.length, 1);
    assert.match(lines[0], /nothing to resolve/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
