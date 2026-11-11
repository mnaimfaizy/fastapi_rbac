/**
 * Contract suite for the adapter reader. The claim under test: every
 * documented spelling reads, and every spelling outside the documented subset
 * is a named problem with a line number — never a silent default.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ADAPTER_FILES,
  parseAdapterJson,
  parseAdapterYaml,
  readAdapter,
  readIncidentalOwners,
} from "./adapter.mjs";

const yaml = (...lines) => parseAdapterYaml(lines.join("\n"));

// ── What reads ──────────────────────────────────────────────────────────────

test("the documented example reads with no problems", () => {
  const { config, problems } = yaml(
    "# a comment",
    "version_record:",
    "  path: TECH_STACK.md",
    "ecosystems:",
    "  - lead: nx",
    "  - lead: next",
    "    members:",
    "      add: [eslint-config-next]",
    "      remove: []",
    "instruction_globs:",
    "  - '**/AGENTS.md'",
    "  - CLAUDE.md",
    "brief_dir: docs/research # where briefs go",
    "incidental_owners: [Audit, ad-hoc-issue]",
    "issue:",
    "  tracker: github",
    "  labels:",
    "    research: research",
    "    hitl: 'type:hitl'",
  );
  assert.deepEqual(problems, []);
  assert.deepEqual(config, {
    version_record: { path: "TECH_STACK.md" },
    ecosystems: [
      { lead: "nx" },
      { lead: "next", members: { add: ["eslint-config-next"], remove: [] } },
    ],
    instruction_globs: ["**/AGENTS.md", "CLAUDE.md"],
    brief_dir: "docs/research",
    incidental_owners: ["Audit", "ad-hoc-issue"],
    issue: {
      tracker: "github",
      labels: { research: "research", hitl: "type:hitl" },
    },
  });
});

test("a sequence may sit at its key’s own indent", () => {
  const { config, problems } = yaml("ecosystems:", "- lead: nx", "- lead: next");
  assert.deepEqual(problems, []);
  assert.deepEqual(config.ecosystems, [{ lead: "nx" }, { lead: "next" }]);
});

test("inside declined_opportunities a value runs to the end of its line", () => {
  const { config, problems } = yaml(
    "declined_opportunities:",
    "  - ecosystem: nx",
    "    url: https://nx.dev/concepts/inferred-tasks#why",
    "    reason: see the #42 discussion",
  );
  assert.deepEqual(problems, []);
  assert.equal(config.declined_opportunities[0].url, "https://nx.dev/concepts/inferred-tasks#why");
  assert.equal(config.declined_opportunities[0].reason, "see the #42 discussion");
});

test("`key: []` and a bare `key:` both mean empty", () => {
  assert.deepEqual(yaml("declined_opportunities: []").config, {
    declined_opportunities: [],
  });
  const bare = readAdapter((p) =>
    p === ADAPTER_FILES[0] ? "declined_opportunities:\nbrief_dir: x" : null,
  );
  assert.deepEqual(bare.problems, []);
  assert.deepEqual(bare.config, { brief_dir: "x" });
});

// ── What is refused, by name ────────────────────────────────────────────────

test("entries under a `key: []` line are a problem, not silently dropped", () => {
  const { problems } = yaml("declined_opportunities: []", "  - ecosystem: nx");
  assert.match(problems.join("\n"), /line 2: unexpected indentation/);
});

test("an unknown top-level key is a problem that names the documented keys", () => {
  const { problems } = yaml("brief_directory: docs/x");
  assert.match(problems[0], /unknown key `brief_directory`/);
  assert.match(problems[0], /brief_dir/);
});

test("a value of the wrong shape is a problem", () => {
  assert.match(yaml("ecosystems: nx").problems[0], /`ecosystems`: expected a list/);
  assert.match(yaml("ecosystems:", "  - members: {}").problems.join("\n"), /flow mapping|`lead`/);
});

test("tabs, flow mappings, multi-line scalars, and duplicates are problems", () => {
  assert.match(yaml("issue:", "\ttracker: github").problems[0], /line 2: .*tab/);
  assert.match(yaml("issue: {tracker: github}").problems[0], /JSON instead/);
  assert.match(yaml("brief_dir: |").problems[0], /multi-line/);
  assert.match(yaml("brief_dir: a", "brief_dir: b").problems[0], /duplicate key/);
});

test("an unterminated quote and text after a closing quote are problems", () => {
  assert.match(yaml("brief_dir: 'docs").problems[0], /unterminated/);
  assert.match(yaml("brief_dir: 'docs' extra").problems[0], /after the closing quote/);
});

// ── JSON, and the lookup order ──────────────────────────────────────────────

test("a JSON adapter reads whole, and is checked for the same keys and shapes", () => {
  assert.deepEqual(parseAdapterJson('{"brief_dir": "x"}').problems, []);
  assert.match(parseAdapterJson('{"brief_dir": 3}').problems[0], /expected a string/);
  assert.match(parseAdapterJson('{"briefs": "x"}').problems[0], /unknown key/);
  assert.match(parseAdapterJson("[1]").problems[0], /JSON object/);
  assert.match(parseAdapterJson("{").problems[0], /not valid JSON/);
});

test("the first adapter file present wins, and no adapter is not an error", () => {
  const files = {
    "instruction-drift-audit.config.yaml": "brief_dir: from-yaml",
    "instruction-drift-audit.config.json": '{"brief_dir": "from-json"}',
  };
  const found = readAdapter((p) => files[p] ?? null);
  assert.equal(found.path, "instruction-drift-audit.config.yaml");
  assert.equal(found.config.brief_dir, "from-yaml");
  assert.deepEqual(
    readAdapter(() => null),
    { path: null, config: {}, problems: [] },
  );
});

test("readIncidentalOwners is the adapter’s list, or undefined for the default", () => {
  const read = (text) => (p) => (p === ADAPTER_FILES[0] ? text : null);
  assert.deepEqual(readIncidentalOwners(read("incidental_owners: [Audit]")), ["Audit"]);
  assert.equal(readIncidentalOwners(read("brief_dir: x")), undefined);
});

test("the older upstream-brief adapter names are still read, after the current ones", () => {
  const legacy = { "upstream-brief.config.yml": "brief_dir: from-legacy" };
  const found = readAdapter((p) => legacy[p] ?? null);
  assert.equal(found.path, "upstream-brief.config.yml");
  assert.equal(found.config.brief_dir, "from-legacy");
  assert.deepEqual(found.problems, []);

  const both = {
    ...legacy,
    "instruction-drift-audit.config.json": '{"brief_dir": "from-current"}',
  };
  const preferred = readAdapter((p) => both[p] ?? null);
  assert.equal(preferred.path, "instruction-drift-audit.config.json");
  assert.equal(preferred.config.brief_dir, "from-current");
  assert.deepEqual(ADAPTER_FILES.slice(0, 3), [
    "instruction-drift-audit.config.yml",
    "instruction-drift-audit.config.yaml",
    "instruction-drift-audit.config.json",
  ]);
});
