#!/usr/bin/env node
// Prints the Baseline resolution for the declared Ecosystems (DESIGN.md §1
// and §2), so a developer can see what an Upstream Brief would anchor to
// before any research hop runs.
//
//   node "<skill>/resolve-baseline.mjs" [--repo <dir>]
//
// Reads `ecosystems` and `version_record.path` through the adapter reader
// (`adapter.mjs`, ADAPTER.md). Installed versions come from the package
// resolver (`npm-resolver.mjs`). The version record is read only to name a
// drift note; DESIGN.md §1 forbids reading it as a source.
//
// It asserts nothing about the Ecosystems and exits 0. The one exception is
// an adapter it cannot read: those problems print first, and the command
// exits 1, because a resolution from a misread adapter is not a resolution.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ADAPTER_FILES, parseAdapterYaml, readAdapter } from "./adapter.mjs";
import { findVersionInText, resolveEcosystemBaselines } from "./baseline.mjs";
import { isEntryPoint } from "./entry-point.mjs";
import { resolverFor } from "./npm-resolver.mjs";

const LABEL = "upstream-baseline";
/** ADAPTER.md's default: compare against package.json when nothing is configured. */
export const DEFAULT_VERSION_RECORD_PATH = "package.json";

function readRepoFile(repo, path) {
  const absolute = join(repo, path);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : null;
}

/** The adapter's `ecosystems`, in the shape `baseline.mjs` takes. */
const toEcosystems = (config) =>
  (Array.isArray(config.ecosystems) ? config.ecosystems : [])
    .filter((eco) => typeof eco?.lead === "string" && eco.lead.trim())
    .map((eco) => {
      const ecosystem = { lead: eco.lead.trim() };
      if (Array.isArray(eco.members?.add)) ecosystem.addMembers = eco.members.add;
      if (Array.isArray(eco.members?.remove)) ecosystem.removeMembers = eco.members.remove;
      return ecosystem;
    });

const toVersionRecordPath = (config) =>
  typeof config.version_record?.path === "string" && config.version_record.path.trim()
    ? config.version_record.path.trim()
    : DEFAULT_VERSION_RECORD_PATH;

/**
 * `ecosystems:` out of a YAML adapter: a list of `{lead, members: {add,
 * remove}}` mappings, read by the one adapter reader.
 */
export const parseEcosystemsFromConfig = (text) => toEcosystems(parseAdapterYaml(text).config);

/** `version_record.path` out of a YAML adapter, defaulting to `package.json`. */
export const resolveVersionRecordPath = (text) =>
  toVersionRecordPath(parseAdapterYaml(text).config);

/**
 * Every declared Ecosystem, resolved against what this repo has installed.
 *
 * Separated from `run` below because the ledger command
 * (`resolve-ledger.mjs`) and the run suggestion (`suggest-run.mjs`) need the
 * resolution itself, not a printed line: a carry-forward decision is made
 * against a **new Baseline**, so a second copy of "how this repo finds
 * installed versions" is a second place to disagree about what the Baseline is.
 *
 * @param {{repo?: string}} [options]
 * @returns {{results: object[], ecosystems: object[], versionRecordPath: string, adapterPath: string | null, problems: string[]}}
 */
export function resolveDeclaredEcosystems({ repo = process.cwd() } = {}) {
  const adapter = readAdapter((path) => readRepoFile(repo, path));
  const ecosystems = toEcosystems(adapter.config);
  const versionRecordPath = toVersionRecordPath(adapter.config);
  const base = {
    ecosystems,
    versionRecordPath,
    adapterPath: adapter.path,
    problems: adapter.problems,
  };
  if (ecosystems.length === 0) return { ...base, results: [] };

  const recordText = readRepoFile(repo, versionRecordPath);
  const recordedVersion =
    recordText === null ? () => null : (name) => findVersionInText(recordText, name);
  const resolver = resolverFor(repo);

  return {
    ...base,
    results: resolveEcosystemBaselines(
      ecosystems,
      {
        installedVersion: resolver.installedVersion,
        discoverScopeMembers: resolver.discoverScopeMembers,
        recordedVersion,
      },
      { recordSourceLabel: versionRecordPath },
    ),
  };
}

/** The adapter's problems as printable lines; empty when it read cleanly. */
export const adapterProblemLines = (label, adapterPath, problems) =>
  problems.map((problem) => `${label}: ${adapterPath}: ${problem}`);

/** The printed lines, and the exit code `main` sets: 1 only for adapter problems. */
export function runWithStatus({ repo = process.cwd() } = {}) {
  const { results, ecosystems, adapterPath, problems } = resolveDeclaredEcosystems({ repo });
  const lines = adapterProblemLines(LABEL, adapterPath, problems);
  const exitCode = problems.length ? 1 : 0;
  if (ecosystems.length === 0) {
    lines.push(
      `${LABEL}: no ecosystems declared in ${adapterPath ?? `${ADAPTER_FILES[0]} (or .yaml/.json)`} — nothing to resolve`,
    );
    return { lines, exitCode };
  }

  for (const result of results) {
    if (!result.ok) {
      lines.push(`${LABEL}: ${result.lead} — FAILED: ${result.reason}`);
      continue;
    }
    lines.push(
      `${LABEL}: ${result.lead} — Baseline ${result.baseline}, ` +
        `${result.members.length} member(s): ${result.members.join(", ")}`,
    );
    for (const note of result.driftNotes) lines.push(`  drift: ${note}`);
  }
  return { lines, exitCode };
}

export const run = (options) => runWithStatus(options).lines;

function main(argv) {
  const flagIndex = argv.indexOf("--repo");
  const repo = flagIndex === -1 ? process.cwd() : argv[flagIndex + 1] || process.cwd();
  const { lines, exitCode } = runWithStatus({ repo });
  for (const line of lines) (exitCode ? console.error : console.log)(line);
  process.exitCode = exitCode;
}

if (isEntryPoint(import.meta.url)) main(process.argv.slice(2));
