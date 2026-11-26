/**
 * Contract suite for `suggest-run.mjs` (DESIGN.md §14): a run is suggested
 * exactly when an Ecosystem's installed Baseline has left the range its latest
 * committed report recorded, and every "cannot tell" case suggests nothing.
 *
 * Driven over a temporary repository, because the package resolver reads a
 * real install tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { suggestRuns, suggestionLine } from "./suggest-run.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

function repoWith({ installed, report, adapter = "ecosystems:\n  - lead: nx\n" }) {
  const repo = mkdtempSync(join(tmpdir(), "suggest-run-"));
  if (adapter !== null) writeFileSync(join(repo, "instruction-drift-audit.config.yml"), adapter);
  if (installed) {
    mkdirSync(join(repo, "node_modules", "nx"), { recursive: true });
    writeFileSync(
      join(repo, "node_modules", "nx", "package.json"),
      JSON.stringify({ version: installed }),
    );
  }
  if (report) {
    mkdirSync(join(repo, "docs", "research"), { recursive: true });
    writeFileSync(
      join(repo, "docs", "research", "2026-01-01-upstream-brief-nx.json"),
      JSON.stringify(report),
    );
  }
  return repo;
}

const reportAt = (baseline, holdsFor) => ({
  date: "2026-01-01",
  commit: "0123456789abcdef0123456789abcdef01234567",
  ecosystems: [
    {
      lead: "nx",
      baseline,
      checkedAndClear: [{ claim: "a claim", holdsFor, local: [] }],
    },
  ],
});

const withRepo = (setup, body) => {
  const repo = repoWith(setup);
  try {
    body(repo);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
};

test("a Baseline outside the recorded range suggests a run", () => {
  withRepo({ installed: "23.0.0", report: reportAt("22.7.7", "22.x") }, (repo) =>
    assert.deepEqual(suggestRuns(repo), ["nx"]),
  );
});

test("a Baseline still inside the recorded range suggests nothing", () => {
  withRepo({ installed: "22.7.12", report: reportAt("22.7.7", "22.x") }, (repo) =>
    assert.deepEqual(suggestRuns(repo), []),
  );
});

test("no adapter, no report, or an uninstalled lead suggests nothing", () => {
  withRepo({ installed: "23.0.0", report: reportAt("22.7.7", "22.x"), adapter: null }, (repo) =>
    assert.deepEqual(suggestRuns(repo), []),
  );
  withRepo({ installed: "23.0.0" }, (repo) => assert.deepEqual(suggestRuns(repo), []));
  withRepo({ report: reportAt("22.7.7", "22.x") }, (repo) =>
    assert.deepEqual(suggestRuns(repo), []),
  );
});

test("the CLI prints one suggestion line per Ecosystem and exits 0", () => {
  withRepo({ installed: "23.0.0", report: reportAt("22.7.7", "22.x") }, (repo) => {
    const result = spawnSync(process.execPath, [join(HERE, "suggest-run.mjs"), "--repo", repo], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), suggestionLine("nx"));
  });
});
