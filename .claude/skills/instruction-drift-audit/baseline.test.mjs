/**
 * Contract suite for the Baseline resolver (DESIGN.md §1 and §2).
 *
 * What it proves:
 *   - the Baseline is the installed version, never a declared range or a
 *     version record (the Nx fixture the issue names: record 22.3.3,
 *     installed 22.7.7, `@nx/eslint-plugin` absent from the record);
 *   - a member missing from the version record resolves normally;
 *   - a disagreement produces a drift note naming both values;
 *   - members are discovered by the lead's scope prefix, and an adapter
 *     Ecosystem declaration can add or remove members;
 *   - an Ecosystem whose lead is not installed fails closed with a reason,
 *     and that failure does not stop the rest from resolving.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { findVersionInText, resolveEcosystemBaselines, scopePrefixFor } from "./baseline.mjs";

// ── scopePrefixFor ──────────────────────────────────────────────────────────

test("scopePrefixFor derives the companion scope from an unscoped lead", () => {
  assert.equal(scopePrefixFor("nx"), "@nx/");
  assert.equal(scopePrefixFor("next"), "@next/");
});

test("scopePrefixFor keeps a scoped lead in its own scope", () => {
  assert.equal(scopePrefixFor("@remix-run/react"), "@remix-run/");
});

// ── findVersionInText ────────────────────────────────────────────────────────

test("findVersionInText reads the first semver-looking token on the line naming the package", () => {
  const text = [
    "| `@nx/eslint-plugin`          | 22.7.7  | Nx ESLint rules |",
    '"nx": "22.7.7",',
  ].join("\n");
  assert.equal(findVersionInText(text, "@nx/eslint-plugin"), "22.7.7");
  assert.equal(findVersionInText(text, "nx"), "22.7.7");
});

test("findVersionInText does not match a name that is only a substring", () => {
  // "nx" must not match inside "@nx/eslint-plugin"'s own line when asked
  // about a different, unrelated package.
  const text = "| `@nx/eslint-plugin` | 22.7.7 | Nx ESLint rules |";
  assert.equal(findVersionInText(text, "eslint-plugin"), null);
});

test("findVersionInText returns null when no line names the package", () => {
  const text = "| `next` | 16.3.4 | App framework |";
  assert.equal(findVersionInText(text, "nx"), null);
});

// ── resolveEcosystemBaselines ────────────────────────────────────────────────

/** Fixture I/O, keyed the way node_modules and a version record would answer. */
function fixtureIo({ installed, discovered, recorded }) {
  return {
    installedVersion: (name) => installed[name] ?? null,
    discoverScopeMembers: (prefix) => discovered[prefix] ?? [],
    recordedVersion: (name) => recorded[name] ?? null,
  };
}

test("replays the Nx case: record 22.3.3, installed 22.7.7, plugin absent from the record", () => {
  const io = fixtureIo({
    installed: { nx: "22.7.7", "@nx/eslint-plugin": "22.7.7" },
    discovered: { "@nx/": ["@nx/eslint-plugin"] },
    recorded: { nx: "22.3.3" }, // '@nx/eslint-plugin' is absent from the record
  });

  const [result] = resolveEcosystemBaselines([{ lead: "nx" }], io, {
    recordSourceLabel: "TECH_STACK.md",
  });

  assert.equal(result.ok, true);
  // The Baseline is the installed version, not the version record.
  assert.equal(result.baseline, "22.7.7");
  // The plugin is resolved via scope-prefix discovery.
  assert.deepEqual(result.members, ["@nx/eslint-plugin", "nx"]);
  // One drift note, naming both values, and nothing for the absent plugin.
  assert.equal(result.driftNotes.length, 1);
  assert.match(result.driftNotes[0], /TECH_STACK\.md/);
  assert.match(result.driftNotes[0], /22\.3\.3/);
  assert.match(result.driftNotes[0], /22\.7\.7/);
});

test("a member missing from the version record resolves normally, with no drift note", () => {
  const io = fixtureIo({
    installed: { nx: "22.7.7", "@nx/eslint-plugin": "22.7.7" },
    discovered: { "@nx/": ["@nx/eslint-plugin"] },
    recorded: {}, // nothing recorded at all
  });

  const [result] = resolveEcosystemBaselines([{ lead: "nx" }], io);

  assert.equal(result.ok, true);
  assert.deepEqual(result.driftNotes, []);
});

test("an Ecosystem whose lead is not installed fails closed with a reason; others still resolve", () => {
  const io = fixtureIo({
    installed: { nx: "22.7.7" },
    discovered: { "@nx/": [] },
    recorded: {},
  });

  const [ghost, nx] = resolveEcosystemBaselines([{ lead: "ghost-package" }, { lead: "nx" }], io);

  assert.equal(ghost.ok, false);
  assert.match(ghost.reason, /ghost-package/);
  assert.equal(nx.ok, true);
  assert.equal(nx.baseline, "22.7.7");
});

test("an adapter Ecosystem declaration can add an unscoped member and remove a discovered one", () => {
  const io = fixtureIo({
    installed: {
      next: "16.3.4",
      "@next/env": "16.3.4",
      "eslint-config-next": "16.3.4",
    },
    discovered: { "@next/": ["@next/env"] },
    recorded: {},
  });

  const [result] = resolveEcosystemBaselines(
    [
      {
        lead: "next",
        addMembers: ["eslint-config-next"],
        removeMembers: ["@next/env"],
      },
    ],
    io,
  );

  assert.deepEqual(result.members, ["eslint-config-next", "next"]);
});

test("an added member that is not actually installed is skipped for drift, not fabricated", () => {
  const io = fixtureIo({
    installed: { next: "16.3.4" }, // 'eslint-config-next' is not installed
    discovered: { "@next/": [] },
    recorded: { "eslint-config-next": "15.0.0" },
  });

  const [result] = resolveEcosystemBaselines(
    [{ lead: "next", addMembers: ["eslint-config-next"] }],
    io,
  );

  assert.ok(result.members.includes("eslint-config-next"));
  assert.deepEqual(result.driftNotes, []);
});
