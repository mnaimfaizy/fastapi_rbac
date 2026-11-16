/**
 * Contract suite for the QA config reader. The claims under test: the lookup
 * order, the defaults, every documented spelling reads, and every spelling or
 * shape outside the documented contract is a named problem with its line,
 * never a silent default.
 */

import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";

import {
  CONFIG_FILES,
  DEFAULTS,
  PROJECT_SKILL_DIRS,
  effectiveConfig,
  globToRegExp,
  main,
  matchHazards,
  parseConfig,
  parseHazardPack,
  parseYamlSubset,
  pickDelivery,
  planReadiness,
  readQaConfig,
  renderConfigYaml,
  whichCopy,
  yamlCommentLines,
} from "./adapter.mjs";

const yaml = (...lines) => parseConfig("qa.config.yml", lines.join("\n"));
const reader = (files) => (path) => (Object.hasOwn(files, path) ? files[path] : null);

/** The spec's own example, verbatim. */
const SPEC_EXAMPLE = [
  "working_dir: tmp/qa                     # gitignored; plans and reports are composed here",
  "plan:",
  "  base_ref: origin/main",
  "  suites:",
  '    - { name: backend, command: "pytest --junitxml=reports/backend.xml", junit: reports/backend.xml, surfaces: ["backend/**"] }',
  "  publish:                              # first matching rule wins",
  "    - { when_label: prd, to: tracker-issue, label: qa }",
  "    - { default: true, to: working-copy }",
  "  tracker: github                       # github | none",
  "hazards:",
  "  - { pack: docs/agents/qa-hazards/auth.md }",
  "run:",
  "  target: stack                         # stack | url",
  "  surface: web                          # web | desktop | mobile | api",
  '  stack: { up: "...", migrate: "...", seed: "...", down: "..." }',
  "  accounts:",
  '    print: "..."',
  '    restore: "... --restore --account {id}"',
  '    roles: [{ id: admin, purpose: "..." }, { id: user, purpose: "..." }]',
  "  version_endpoint: /version            # optional; how a deployed build names its commit",
  "  evidence: { upload: none }            # none | gh-release:<tag>",
];

// ── Lookup order ────────────────────────────────────────────────────────────

test("the lookup order is yml, then yaml, then json", () => {
  assert.deepEqual(CONFIG_FILES, ["qa.config.yml", "qa.config.yaml", "qa.config.json"]);
});

test("the first file present wins, and the others are not read or merged", () => {
  const files = {
    "qa.config.yaml": "working_dir: from-yaml\n",
    "qa.config.json": '{"working_dir": "from-json", "plan": {"base_ref": "origin/main"}}',
  };
  const read = readQaConfig(reader(files));
  assert.equal(read.path, "qa.config.yaml");
  assert.deepEqual(read.config, { working_dir: "from-yaml" });
  assert.equal(effectiveConfig(read.config).plan.base_ref, null);

  files["qa.config.yml"] = "working_dir: from-yml\n";
  assert.equal(readQaConfig(reader(files)).path, "qa.config.yml");
  delete files["qa.config.yml"];
  delete files["qa.config.yaml"];
  assert.equal(readQaConfig(reader(files)).path, "qa.config.json");
});

test("no config file is not a problem", () => {
  assert.deepEqual(readQaConfig(reader({})), {
    path: null,
    config: {},
    problems: [],
    runProblems: [],
  });
});

// ── What reads ──────────────────────────────────────────────────────────────

test("the spec's example reads with no problems, `run:` accepted as it is", () => {
  const { config, problems } = yaml(...SPEC_EXAMPLE);
  assert.deepEqual(problems, []);
  assert.deepEqual(config.plan.suites, [
    {
      name: "backend",
      command: "pytest --junitxml=reports/backend.xml",
      junit: "reports/backend.xml",
      surfaces: ["backend/**"],
    },
  ]);
  assert.deepEqual(config.plan.publish, [
    { when_label: "prd", to: "tracker-issue", label: "qa" },
    { default: "true", to: "working-copy" },
  ]);
  assert.equal(config.working_dir, "tmp/qa");
  assert.deepEqual(config.run.accounts.roles, [
    { id: "admin", purpose: "..." },
    { id: "user", purpose: "..." },
  ]);
  assert.deepEqual(config.run.evidence, { upload: "none" });
});

test("block style reads the same as flow style", () => {
  const block = yaml(
    "plan:",
    "  suites:",
    "    - name: backend",
    '      command: "pytest --junitxml=reports/backend.xml"',
    "      junit: reports/backend.xml",
    "      surfaces:",
    "        - 'backend/**'",
    "  publish:",
    "  - when_label: prd",
    "    to: tracker-issue",
    "    label: qa",
    "  - default: true",
    "    to: working-copy",
    "  tracker: github",
  );
  const flow = yaml(...SPEC_EXAMPLE.slice(1, 9));
  assert.deepEqual(block.problems, []);
  assert.deepEqual(block.config.plan.suites, flow.config.plan.suites);
  assert.deepEqual(block.config.plan.publish, flow.config.plan.publish);
});

test("the same config reads the same from JSON, with booleans", () => {
  const json = parseConfig(
    "qa.config.json",
    JSON.stringify({
      plan: {
        base_ref: "origin/main",
        suites: [{ name: "api", command: "npm test" }],
        publish: [{ default: true, to: "working-copy" }],
      },
      run: { anything: [1, 2] },
    }),
  );
  assert.deepEqual(json.problems, []);
});

test("an empty key is absent, and takes its default", () => {
  const { config, problems } = yaml("working_dir:", "plan:", "hazards:");
  assert.deepEqual(problems, []);
  const effective = effectiveConfig(config);
  assert.equal(effective.working_dir, "tmp/qa");
  assert.deepEqual(effective.hazards, []);
});

// ── Defaults ────────────────────────────────────────────────────────────────

test("the defaults: tmp/qa, working copy, no tracker, nothing for base_ref or suites", () => {
  assert.deepEqual(effectiveConfig({}), {
    working_dir: "tmp/qa",
    plan: {
      base_ref: null,
      suites: [],
      publish: [{ default: true, to: "working-copy" }],
      tracker: "none",
    },
    hazards: [],
    run: null,
  });
  assert.equal(DEFAULTS.tracker, "none");
  assert.throws(() => DEFAULTS.publish.push({}), TypeError);
});

test("an empty `publish` list falls back to the working copy", () => {
  assert.deepEqual(effectiveConfig({ plan: { publish: [] } }).plan.publish, DEFAULTS.publish);
});

// ── Problems ────────────────────────────────────────────────────────────────

test("each problem in the YAML subset is named with its line", () => {
  const { problems } = yaml(
    "working_dir: tmp/qa",
    "\tplan:",
    "hazards: &packs",
    "run: |",
    "plan:",
    "  base_ref: 'origin/main",
    "  suites: [ { name: a",
    "  tracker: github",
    "  tracker: none",
    "    extra: indented",
    "not a key",
  );
  assert.deepEqual(problems.slice(0, 9), [
    "line 2: indented with a tab; use spaces",
    "line 3: `&` (anchor or alias) is outside the YAML subset ADAPTER.md documents — write the config as JSON instead",
    "line 4: multi-line scalars are outside the YAML subset ADAPTER.md documents",
    "line 6: unterminated ' quote",
    "line 7: a flow mapping must close on the same line with `}`",
    "line 7: a flow list must close on the same line with `]`",
    "line 9: duplicate key `tracker`",
    "line 10: unexpected indentation",
    "line 11: expected `key: value`, found `not a key`",
  ]);
});

test("a duplicate key inside a flow mapping is a problem", () => {
  assert.deepEqual(yaml("run: { a: 1, a: 2 }").problems, ["line 1: duplicate key `a`"]);
});

test("text after a closed flow collection is a problem; a comment is not", () => {
  assert.deepEqual(yaml("hazards: [] # none yet").problems, []);
  assert.deepEqual(yaml("hazards: [] extra").problems, [
    "line 1: unexpected text after the value: extra",
  ]);
});

test("a config that is a list, or not a JSON object, is a problem", () => {
  assert.deepEqual(yaml("- a").problems, ["line 1: the config must be a mapping, not a list"]);
  assert.deepEqual(parseConfig("qa.config.json", "[1]").problems, [
    "the config must be a JSON object",
  ]);
  assert.match(parseConfig("qa.config.json", "{").problems[0], /^not valid JSON: /);
});

test("unknown keys at every level are problems, with their line", () => {
  const { problems } = yaml(
    "working_dir: tmp/qa",
    "workdir: tmp/qa",
    "plan:",
    "  base: origin/main",
    "  suites:",
    "    - { name: a, command: x, junit_path: r.xml }",
    "  publish:",
    "    - { default: true, to: working-copy, when: always }",
    "hazards:",
    "  - { pack: p.md, globs: [x] }",
    "run: { anything: goes }",
  );
  assert.deepEqual(problems, [
    "line 2: `workdir`: unknown key (ADAPTER.md documents: working_dir, plan, hazards, run)",
    "line 4: `plan.base`: unknown key (ADAPTER.md documents: base_ref, suites, publish, tracker)",
    "line 6: `plan.suites[0].junit_path`: unknown key (ADAPTER.md documents: name, command, junit, surfaces, services)",
    "line 8: `plan.publish[0].when`: unknown key (ADAPTER.md documents: when_label, default, to, label)",
    "line 10: `hazards[0].globs`: unknown key (ADAPTER.md documents: pack)",
  ]);
});

test("wrong shapes are problems, with their line", () => {
  const { problems } = yaml(
    "working_dir: ../outside",
    "plan:",
    "  base_ref: []",
    "  tracker: jira",
    "  suites:",
    "    - { command: x, junit: /abs/r.xml, surfaces: api, services: redis }",
    "    - { name: b, command: y }",
    "    - { name: b, command: z }",
    "    - just-a-string",
    "hazards: docs/hazards.md",
  );
  assert.deepEqual(problems, [
    "line 1: `working_dir`: expected a relative path inside the repository",
    "line 3: `plan.base_ref`: expected a git ref, such as `origin/main`",
    "line 4: `plan.tracker`: expected one of: github, none",
    "line 6: `plan.suites[0].name`: required: expected a string",
    "line 6: `plan.suites[0].junit`: expected a relative path inside the repository",
    "line 6: `plan.suites[0].surfaces`: expected a list of globs",
    "line 6: `plan.suites[0].services`: expected a list of service names",
    "line 8: `plan.suites[2].name`: duplicate suite name `b`",
    "line 9: `plan.suites[3]`: expected a mapping",
    "line 10: `hazards`: expected a list of `{ pack: <path> }`",
  ]);
});

test("`plan` that is not a mapping is a problem", () => {
  assert.deepEqual(yaml("plan: origin/main").problems, ["line 1: `plan`: expected a mapping"]);
});

test("each publish-rule problem is named", () => {
  const { problems } = yaml(
    "plan:",
    "  publish:",
    "    - { to: working-copy }",
    "    - { when_label: prd, default: true, to: tracker-issue }",
    "    - { when_label: x, to: slack }",
    "    - { default: yes, to: pr-comment, label: qa }",
    "    - { default: true, to: working-copy }",
    "    - { when_label: late, to: working-copy }",
  );
  assert.deepEqual(problems, [
    "line 3: `plan.publish[0]`: give a `when_label` or `default: true`",
    "line 4: `plan.publish[1]`: give one of `when_label` or `default: true`, not both",
    "line 4: `plan.publish[1].to`: `tracker-issue` needs `plan.tracker` set: `github`, or `none` to keep plans in the working copy",
    "line 5: `plan.publish[2].to`: required: expected one of: working-copy, tracker-issue, pr-comment",
    "line 6: `plan.publish[3].default`: expected `true`",
    "line 6: `plan.publish[3].label`: only a `tracker-issue` rule labels what it creates",
    "line 6: `plan.publish[3].to`: `pr-comment` needs `plan.tracker` set: `github`, or `none` to keep plans in the working copy",
    "line 8: `plan.publish[5]`: never reached: rule 4 is a `default` rule, and the first match wins",
  ]);
});

test("JSON problems carry their key path", () => {
  const { problems } = parseConfig(
    "qa.config.json",
    JSON.stringify({ plan: { suites: [{ name: "a" }] }, extra: 1 }),
  );
  assert.deepEqual(problems, [
    "`extra`: unknown key (ADAPTER.md documents: working_dir, plan, hazards, run)",
    "`plan.suites[0].command`: required: expected a string",
  ]);
});

// ── Readiness ───────────────────────────────────────────────────────────────

test("readiness with no config names exactly the base ref and the suites", () => {
  const readiness = planReadiness(readQaConfig(reader({})));
  assert.equal(readiness.ready, false);
  assert.equal(readiness.needs.length, 2);
  assert.match(readiness.needs[0], /^plan\.base_ref: /);
  assert.match(readiness.needs[1], /^plan\.suites: .*`junit`/);
  assert.match(readiness.notes[0], /^no qa\.config\.yml/);
});

test("readiness notes a suite without a JUnit path, and is ready", () => {
  const readiness = planReadiness(
    readQaConfig(
      reader({
        "qa.config.yml":
          "plan:\n  base_ref: origin/main\n  suites:\n    - { name: e2e, command: npm run e2e }\n",
      }),
    ),
  );
  assert.deepEqual(readiness.needs, []);
  assert.equal(readiness.ready, true);
  assert.match(readiness.notes[0], /suite `e2e` has no `junit` path.*\[reconstructed\]/);
});

test("readiness notes when a QA Stack exists and no suite lists `services`", () => {
  const config = (suite) =>
    "plan:\n  base_ref: origin/main\n  suites:\n" +
    `    - ${suite}\n` +
    "run:\n  stack: { up: a, migrate: b, seed: c, down: d }\n";
  const doubles = planReadiness(
    readQaConfig(reader({ "qa.config.yml": config("{ name: unit, command: x, junit: r.xml }") })),
  );
  assert.equal(doubles.ready, true);
  assert.match(doubles.notes[0], /no suite lists `services`.*Residue/);
  const live = planReadiness(
    readQaConfig(
      reader({
        "qa.config.yml": config("{ name: it, command: x, junit: r.xml, services: [postgres] }"),
      }),
    ),
  );
  assert.deepEqual(live.notes, []);
});

test("readiness is never ready over problems", () => {
  const readiness = planReadiness(readQaConfig(reader({ "qa.config.yml": "nope: 1\n" })));
  assert.equal(readiness.ready, false);
});

// ── Delivery ────────────────────────────────────────────────────────────────

test("the first matching publish rule wins", () => {
  const { config } = yaml(...SPEC_EXAMPLE);
  assert.deepEqual(pickDelivery(config, { labels: ["bug", "prd"] }), {
    to: "tracker-issue",
    label: "qa",
    rule: 0,
    why: "plan.publish[0]: label `prd`",
  });
  assert.equal(pickDelivery(config, { labels: ["bug"] }).to, "working-copy");
});

test("tracker none keeps the plan in the working copy, and says why", () => {
  const { config } = yaml(
    "plan:",
    "  tracker: none",
    "  publish:",
    "    - { default: true, to: pr-comment }",
  );
  const delivery = pickDelivery(config);
  assert.equal(delivery.to, "working-copy");
  assert.match(delivery.why, /`pr-comment`, but `plan\.tracker` is `none`/);
});

test("no publish rules, or none matching, means the working copy", () => {
  assert.equal(pickDelivery({}).to, "working-copy");
  const { config } = yaml(
    "plan:",
    "  tracker: github",
    "  publish:",
    "    - { when_label: prd, to: pr-comment }",
  );
  assert.deepEqual(pickDelivery(config, { labels: [] }), {
    to: "working-copy",
    label: null,
    rule: null,
    why: "no `plan.publish` rule matched",
  });
});

// ── Hazard packs ────────────────────────────────────────────────────────────

const PACK = [
  "---",
  'when: ["backend/auth/**", "**/login*"]',
  "---",
  "",
  "# Sign-in hazards",
  "",
  "## Rule out first",
  "",
  "- A stale session cookie.",
  "",
  "### Detail",
  "",
  "Still part of the list.",
  "",
  "## Capture rules",
  "",
  "- Never capture the password field.",
  "",
].join("\n");

test("globs: ** spans directories, * and ? stay in one, the whole path must match", () => {
  const cases = [
    ["backend/**", "backend/a/b.py", true],
    ["backend/**", "backend", false],
    ["**/login*", "login.tsx", true],
    ["**/login*", "web/src/login.tsx", true],
    ["**/login*", "web/src/relogin.tsx", false],
    ["*.md", "README.md", true],
    ["*.md", "docs/a.md", false],
    ["src/?.js", "src/a.js", true],
    ["src/?.js", "src/ab.js", false],
    ["a.b/c+d", "a.b/c+d", true],
    ["a.b/c+d", "aXb/c+d", false],
  ];
  for (const [glob, path, expected] of cases)
    assert.equal(globToRegExp(glob).test(path), expected, `${glob} vs ${path}`);
});

test("a Hazard pack reads its globs and both sections", () => {
  const pack = parseHazardPack(PACK);
  assert.deepEqual(pack.problems, []);
  assert.deepEqual(pack.when, ["backend/auth/**", "**/login*"]);
  assert.equal(
    pack.ruleOutFirst,
    "- A stale session cookie.\n\n### Detail\n\nStill part of the list.",
  );
  assert.equal(pack.captureRules, "- Never capture the password field.");
});

test("each Hazard pack problem is named", () => {
  assert.deepEqual(parseHazardPack("# no frontmatter").problems, [
    "line 1: expected `---` opening frontmatter with `when:` globs",
  ]);
  assert.deepEqual(parseHazardPack("---\nwhen: [a]\n").problems, [
    "the frontmatter opened on line 1 never closes with `---`",
  ]);
  assert.deepEqual(
    parseHazardPack("---\nglobs: [a]\n---\n## Rule out first\n\n## Other\nx\n").problems,
    [
      "line 2: `globs`: unknown key (ADAPTER.md documents: when)",
      "`when`: required: expected a non-empty list of globs",
      "line 4: the `Rule out first` section is empty",
      "no `## Capture rules` section",
    ],
  );
});

test("only packs whose globs match a changed path are returned", () => {
  const files = {
    "packs/auth.md": PACK,
    "packs/pay.md": PACK.replace('["backend/auth/**", "**/login*"]', '["billing/**"]'),
  };
  const config = { hazards: [{ pack: "packs/auth.md" }, { pack: "packs/pay.md" }] };
  const { packs, problems } = matchHazards(reader(files), config, [
    "web/src/login.tsx",
    "README.md",
    "",
    "backend\\auth\\x.py",
  ]);
  assert.deepEqual(problems, []);
  assert.deepEqual(
    packs.map((p) => [p.pack, p.matched]),
    [["packs/auth.md", ["web/src/login.tsx", "backend/auth/x.py"]]],
  );
});

test("a missing or malformed pack is a problem, named with its path", () => {
  const config = { hazards: [{ pack: "packs/gone.md" }, { pack: "packs/bad.md" }] };
  const { problems } = matchHazards(reader({ "packs/bad.md": "x" }), config, ["a"]);
  assert.deepEqual(problems, [
    "packs/gone.md: no such file (named in `hazards`)",
    "packs/bad.md: line 1: expected `---` opening frontmatter with `when:` globs",
  ]);
});

// ── Writing the config ──────────────────────────────────────────────────────

test("a rendered config reads back unchanged, with no problems", () => {
  const answers = {
    working_dir: "tmp/qa",
    plan: {
      base_ref: "origin/main",
      suites: [
        {
          name: "backend",
          command: "pytest --junitxml=reports/backend.xml",
          junit: "reports/backend.xml",
          surfaces: ["backend/**", "shared/*.py"],
          services: ["postgres", "redis"],
        },
        { name: "e2e", command: "npm run e2e -- --reporter=junit" },
      ],
      publish: [
        { when_label: "prd", to: "tracker-issue", label: "qa" },
        { default: true, to: "working-copy" },
      ],
      tracker: "github",
    },
    hazards: [{ pack: "docs/agents/qa-hazards/auth.md" }],
  };
  const text = renderConfigYaml(answers);
  const back = parseConfig("qa.config.yml", text);
  assert.deepEqual(back.problems, []);
  assert.deepEqual(back.config.plan.suites, answers.plan.suites);
  assert.deepEqual(back.config.plan.publish[1], { default: "true", to: "working-copy" });
  assert.deepEqual(back.config.hazards, answers.hazards);
  for (const line of text.split("\n"))
    assert.ok(line.length <= 80, `too long for a formatter: ${line}`);
});

test("render refuses answers with problems", () => {
  assert.throws(() => renderConfigYaml({ plan: { suites: [{ name: "a" }] } }), /problems/);
});

// ── CLI ─────────────────────────────────────────────────────────────────────

test("check --for plan prints problems and exits 1", () => {
  const { code, out } = main(["check", "--for", "plan"], {
    read: reader({ "qa.config.yml": "workdir: x\n" }),
  });
  assert.equal(code, 1);
  assert.match(JSON.parse(out).problems[0], /^line 1: `workdir`: unknown key/);
});

test("check --for plan prints the effective config and readiness", () => {
  const { code, out } = main(["check", "--for", "plan"], { read: reader({}) });
  const result = JSON.parse(out);
  assert.equal(code, 0);
  assert.equal(result.path, null);
  assert.equal(result.effective.working_dir, "tmp/qa");
  assert.equal(result.readiness.ready, false);
});

test("hazards reads changed paths from stdin", () => {
  const { code, out } = main(["hazards"], {
    read: reader({ "qa.config.yml": "hazards:\n  - { pack: p.md }\n", "p.md": PACK }),
    stdin: () => "backend/auth/a.py\nREADME.md\n",
  });
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(out).packs[0].matched, ["backend/auth/a.py"]);
});

test("delivery takes every --label", () => {
  const { out } = main(["delivery", "--label", "bug", "--label", "prd"], {
    read: reader({ "qa.config.yml": SPEC_EXAMPLE.join("\n") }),
  });
  assert.equal(JSON.parse(out).to, "tracker-issue");
});

test("bad usage exits 2", () => {
  assert.equal(main([], { read: reader({}) }).code, 2);
  assert.equal(main(["check"], { read: reader({}) }).code, 2);
});

test("the subset parser keeps a line for every block key", () => {
  const { lines } = parseYamlSubset("plan:\n  suites:\n    - name: a\n      command: b\n");
  assert.deepEqual(Object.fromEntries(lines), {
    plan: 1,
    "plan.suites": 2,
    "plan.suites[0]": 3,
    "plan.suites[0].name": 3,
    "plan.suites[0].command": 4,
  });
});

test("ADAPTER.md's examples read with no problems", async () => {
  const { readFileSync } = await import("node:fs");
  const doc = readFileSync(new URL("./ADAPTER.md", import.meta.url), "utf8");
  const [config, pack] = [...doc.matchAll(/```(?:yaml|markdown)\n([\s\S]*?)```/g)].map((m) => m[1]);
  assert.deepEqual(parseConfig("qa.config.yml", config).problems, []);
  assert.deepEqual(parseHazardPack(pack).problems, []);
});

// ── Review fixes ────────────────────────────────────────────────────────────

test("a backslash inside double quotes is a problem; inside single quotes it is literal", () => {
  assert.deepEqual(yaml('working_dir: "tmp\\qa"').problems, [
    'line 1: escapes inside "…" are outside the YAML subset ADAPTER.md documents — use single quotes, or write the config as JSON',
  ]);
  assert.match(yaml('run: { cmd: "printf \\n" }').problems[0], /^line 1: escapes inside/);
  const single = yaml("plan:", "  suites:", "    - { name: a, command: 'printf \\n' }");
  assert.deepEqual(single.problems, []);
  assert.equal(single.config.plan.suites[0].command, "printf \\n");
});

test("render quotes a backslash safely, and refuses a newline", () => {
  // A backslash and both quote kinds: no quoting reads back the same.
  const config = { plan: { suites: [{ name: "a", command: `printf 'x' "\\n"` }] } };
  assert.throws(() => renderConfigYaml(config), /cannot write/);
  const ok = { plan: { suites: [{ name: "a", command: "printf x\\n" }] } };
  assert.deepEqual(parseConfig("qa.config.yml", renderConfigYaml(ok)).config, ok);
  assert.throws(
    () => renderConfigYaml({ plan: { suites: [{ name: "a", command: "make\nmake test" }] } }),
    /cannot write/,
  );
});

test("render merges the answers into the config found, and keeps its dialect", () => {
  const yml =
    "working_dir: tmp/qa\nhazards:\n  - { pack: p.md }\nrun: { target: stack }\nplan:\n  tracker: github\n";
  const answers = JSON.stringify({ plan: { base_ref: "origin/main" } });
  const fromYml = main(["render"], {
    read: reader({ "qa.config.yml": yml }),
    stdin: () => answers,
  });
  assert.equal(fromYml.code, 0);
  assert.deepEqual(parseConfig("qa.config.yml", fromYml.out).config, {
    working_dir: "tmp/qa",
    plan: { tracker: "github", base_ref: "origin/main" },
    hazards: [{ pack: "p.md" }],
    run: { target: "stack" },
  });

  const written = {};
  const fromJson = main(["render", "--write"], {
    read: reader({ "qa.config.json": '{"run": {"target": "url"}}' }),
    stdin: () => answers,
    write: (path, text) => (written[path] = text),
  });
  assert.equal(fromJson.out, "wrote qa.config.json\n");
  assert.deepEqual(JSON.parse(written["qa.config.json"]), {
    run: { target: "url" },
    plan: { base_ref: "origin/main" },
  });

  const fresh = {};
  main(["render", "--write"], {
    read: reader({}),
    stdin: () => answers,
    write: (p, t) => (fresh[p] = t),
  });
  assert.deepEqual(Object.keys(fresh), ["qa.config.yml"]);
});

test("render --write refuses to drop YAML comments unless --drop-comments", () => {
  const yml =
    "# QA settings for this repo\nworking_dir: tmp/qa # gitignored\nplan:\n  tracker: github\n";
  const answers = JSON.stringify({ plan: { base_ref: "origin/main" } });
  const run = (argv, files) => {
    const written = {};
    const result = main(argv, {
      read: reader(files),
      stdin: () => answers,
      write: (path, text) => (written[path] = text),
    });
    return { ...result, written };
  };

  // Commented YAML: refused with exit 3, nothing written, the agent told why.
  const refused = run(["render", "--write"], { "qa.config.yml": yml });
  assert.equal(refused.code, 3);
  assert.deepEqual(refused.written, {});
  assert.match(refused.out, /qa\.config\.yml has YAML comments \(line 1, 2\)/);
  assert.match(refused.out, /nothing was written/);
  assert.match(refused.out, /--write --drop-comments/);

  // Confirmed: written as before, comments gone.
  const confirmed = run(["render", "--write", "--drop-comments"], { "qa.config.yml": yml });
  assert.equal(confirmed.code, 0);
  assert.equal(confirmed.out, "wrote qa.config.yml\n");
  assert.doesNotMatch(confirmed.written["qa.config.yml"], /#/);

  // No --write: the preview is unchanged, comment or not.
  const preview = run(["render"], { "qa.config.yml": yml });
  assert.equal(preview.code, 0);
  assert.equal(preview.out, run(["render"], { "qa.config.yml": yml.replace(/ ?#.*/g, "") }).out);
  assert.deepEqual(preview.written, {});

  // Uncommented YAML (a `#` inside quotes is not a comment), JSON, a new file:
  // written with --write alone, as before.
  const plain = run(["render", "--write"], {
    "qa.config.yml": "working_dir: 'tmp/#qa'\nplan:\n  tracker: github\n",
  });
  assert.equal(plain.code, 0);
  assert.deepEqual(Object.keys(plain.written), ["qa.config.yml"]);
  const json = run(["render", "--write"], { "qa.config.json": '{"working_dir": "tmp/qa"}' });
  assert.equal(json.code, 0);
  assert.deepEqual(Object.keys(json.written), ["qa.config.json"]);
  const fresh = run(["render", "--write"], {});
  assert.equal(fresh.code, 0);
  assert.deepEqual(Object.keys(fresh.written), ["qa.config.yml"]);
});

test("yamlCommentLines finds full-line and trailing comments, not `#` in a value", () => {
  assert.deepEqual(
    yamlCommentLines(
      [
        "# top",
        "a: b # trailing",
        'c: "x # y"',
        "d: 'p #q' # real",
        "e: f#g",
        "  # indented",
        "h: [i, j] # flow",
        "      purpose: the reviewer's account # don't reuse it",
        "p: o'neil's # it's",
        'size: 12" screen # the "big" one',
        "- 'q #r'",
        "k: ['s #t', \"u #v\"]",
      ].join("\n"),
    ),
    [1, 2, 4, 6, 7, 8, 9, 10],
  );
});

test("render refuses over a config with problems", () => {
  const { code, out } = main(["render"], {
    read: reader({ "qa.config.yml": "nope: 1\n" }),
    stdin: () => "{}",
  });
  assert.equal(code, 1);
  assert.match(out, /has problems/);
});

test("a `#` line inside a fenced block does not end a Hazard pack section", () => {
  const pack = parseHazardPack(
    [
      "---",
      "when: [a]",
      "---",
      "## Rule out first",
      "~~~sh",
      "## not a heading",
      "~~~",
      "- Cookie.",
      "## Capture rules",
      "```sh",
      "# clear the session first",
      "```",
      "- Never capture the password field.",
      "",
    ].join("\n"),
  );
  assert.deepEqual(pack.problems, []);
  assert.match(pack.ruleOutFirst, /- Cookie\.$/);
  assert.match(pack.captureRules, /- Never capture the password field\.$/);
});

test("a heading inside a fence is not taken for a section", () => {
  const { problems } = parseHazardPack(
    "---\nwhen: [a]\n---\n```\n## Rule out first\n```\n## Capture rules\nx\n",
  );
  assert.deepEqual(problems, ["no `## Rule out first` section"]);
});

test("labels match without regard to case", () => {
  const { config } = yaml(...SPEC_EXAMPLE);
  assert.equal(pickDelivery(config, { labels: ["PRD"] }).to, "tracker-issue");
});

// ── Out-of-subset inputs read silently before (#174) ────────────────────────

const QUOTE =
  /^line 1: a `: ` inside an unquoted value is outside the YAML subset ADAPTER.md documents — quote the value$/;
const FLOW_COMMENT =
  "line 1: a `#` comment inside a flow collection is outside the YAML subset ADAPTER.md documents";

test("a list item that is only a comment has no value, never the comment's text", () => {
  for (const text of ["suites:\n  - # disabled\n", "suites:\n  -  # disabled\n"]) {
    const { value, problems } = parseYamlSubset(text);
    assert.deepEqual(value, { suites: [null] });
    assert.deepEqual(problems, []);
  }
  assert.deepEqual(yaml("hazards:", "  - # disabled").problems, [
    "line 2: `hazards[0]`: expected a mapping with a `pack` path",
  ]);
  assert.deepEqual(yaml("plan:", "  suites:", "    - # disabled").problems, [
    "line 3: `plan.suites[0]`: expected a mapping",
  ]);
});

test("a ` #` inside a one-line flow collection is a problem; inside quotes it is not", () => {
  assert.deepEqual(parseYamlSubset("a: { name: api # note }\n").problems, [FLOW_COMMENT]);
  assert.deepEqual(parseYamlSubset("a: [x # note]\n").problems, [FLOW_COMMENT]);
  assert.deepEqual(parseYamlSubset('a: { name: "api # note" }\n').problems, []);
  assert.deepEqual(parseYamlSubset("a: ['x # note']\n").problems, []);
});

test("a `: ` inside an unquoted value is a problem that says to quote it", () => {
  for (const text of ["command: npm test: unit\n", "a: [x: y]\n", "a: { k: a: b }\n"]) {
    const { problems } = parseYamlSubset(text);
    assert.equal(problems.length, 1, text);
    assert.match(problems[0], QUOTE, text);
  }
});

test("quoted `: ` and `#`, a colon with no space, and a trailing comment still read clean", () => {
  const clean = {
    'command: "npm test: unit"': { command: "npm test: unit" },
    "a: ['x: y']": { a: ["x: y"] },
    "url: http://localhost:3000": { url: "http://localhost:3000" },
    "a: a:b": { a: "a:b" },
    'a: { name: "api # note" }': { a: { name: "api # note" } },
    "key: value # trailing comment": { key: "value" },
  };
  for (const [text, value] of Object.entries(clean))
    assert.deepEqual(parseYamlSubset(`${text}\n`), {
      value,
      problems: [],
      lines: new Map([[Object.keys(value)[0], 1]]),
    });
});

test("check exits 1 and names the line for each out-of-subset input", () => {
  const bad = {
    "hazards:\n  - # disabled\n": /^line 2: `hazards\[0\]`: expected a mapping/,
    "run: { name: api # note }\n": /^line 1: a `#` comment inside a flow collection/,
    "run: [x # note]\n": /^line 1: a `#` comment inside a flow collection/,
    "working_dir: npm test: unit\n": QUOTE,
    "run: [x: y]\n": QUOTE,
    "run: { k: a: b }\n": QUOTE,
  };
  for (const [text, problem] of Object.entries(bad)) {
    const { code, out } = main(["check", "--for", "plan"], {
      read: reader({ "qa.config.yml": text }),
    });
    assert.equal(code, 1, text);
    assert.ok(
      JSON.parse(out).problems.some((p) => problem.test(p)),
      text,
    );
  }
});

// ── Which copy runs ─────────────────────────────────────────────────────────

/** A home folder and a repository side by side, each with the files named. */
function layout(files) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "which-copy-")));
  after(() => rmSync(root, { recursive: true, force: true }));
  for (const path of files) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), "");
  }
  return root;
}

test("a user-level copy gives way to the repository's own copy", () => {
  const root = layout([
    "home/skills/qa-plan/SKILL.md",
    "repo/.git/HEAD",
    "repo/.claude/skills/qa-plan/SKILL.md",
  ]);
  const result = whichCopy("qa-plan", {
    skillDir: join(root, "home/skills/qa-plan"),
    cwd: join(root, "repo"),
  });
  assert.equal(result.use, "repository");
  assert.equal(result.repository, join(root, "repo"));
  assert.deepEqual(result.repository_copies, [".claude/skills/qa-plan"]);
  assert.equal(result.load, join(root, "repo/.claude/skills/qa-plan/SKILL.md"));
});

test("a repository copy in any harness's folder counts, the first one is loaded", () => {
  const root = layout([
    "home/qa-plan/SKILL.md",
    "repo/.git",
    "repo/.agents/skills/qa-plan/SKILL.md",
    "repo/.github/skills/qa-plan/SKILL.md",
  ]);
  const result = whichCopy("qa-plan", {
    skillDir: join(root, "home/qa-plan"),
    cwd: join(root, "repo/src"),
  });
  assert.equal(result.use, "repository", "a `.git` file (a worktree) marks the root too");
  assert.deepEqual(result.repository_copies, [".agents/skills/qa-plan", ".github/skills/qa-plan"]);
  assert.equal(result.load, join(root, "repo/.agents/skills/qa-plan/SKILL.md"));
});

test("the repository's own copy, or a user-level one with no repository copy, runs", () => {
  const root = layout([
    "home/qa-plan/SKILL.md",
    "repo/.git/HEAD",
    "repo/.claude/skills/qa-plan/SKILL.md",
  ]);
  const own = whichCopy("qa-plan", {
    skillDir: join(root, "repo/.claude/skills/qa-plan"),
    cwd: join(root, "repo"),
  });
  assert.equal(own.use, "this");
  assert.equal(own.load, null);
  const other = whichCopy("other-skill", {
    skillDir: join(root, "home/qa-plan"),
    cwd: join(root, "repo"),
  });
  assert.equal(other.use, "this");
  assert.deepEqual(other.repository_copies, []);
  // Look no higher than the temp root: TMPDIR may sit inside a checkout.
  const none = whichCopy("qa-plan", {
    skillDir: join(root, "home/qa-plan"),
    cwd: join(root, "home"),
    exists: (path) => path.startsWith(root) && existsSync(path),
  });
  assert.equal(none.repository, null);
  assert.equal(none.use, "this");
});

test("a repository copy that links outside the repository is still the repository's", () => {
  const root = layout(["shared/qa-plan/SKILL.md", "repo/.git/HEAD"]);
  mkdirSync(join(root, "repo/.claude/skills"), { recursive: true });
  symlinkSync(join(root, "shared/qa-plan"), join(root, "repo/.claude/skills/qa-plan"), "dir");
  const result = whichCopy("qa-plan", {
    skillDir: join(root, "shared/qa-plan"),
    cwd: join(root, "repo"),
  });
  assert.equal(result.use, "this");
});

test("on Windows, a repository copy linked to this copy matches whatever its case", () => {
  // Drive letters dropped and slashes forward, so the same paths read on any platform.
  const norm = (path) => path.replace(/^[A-Za-z]:/, "").replaceAll("\\", "/");
  const files = new Set(["/C/Repo/.git", "/C/Repo/.claude/skills/qa-plan/SKILL.md"]);
  const links = new Map([["/C/Repo/.claude/skills/qa-plan", "/D/Shared/qa-plan"]]);
  const at = {
    cwd: "/C/Repo",
    skillDir: "/d/shared/qa-plan",
    exists: (path) => files.has(norm(path)),
    real: (path) => links.get(norm(path)) ?? norm(path),
  };
  assert.equal(whichCopy("qa-plan", { ...at, platform: "win32" }).use, "this");
  assert.equal(whichCopy("qa-plan", { ...at, platform: "linux" }).use, "repository");
});

test("`where` names the skill it checks, and refuses any other argument", () => {
  const root = layout([
    "home/qa-plan/SKILL.md",
    "repo/.git/HEAD",
    "repo/.claude/skills/qa-plan/SKILL.md",
    "other/.git/HEAD",
  ]);
  const io = { skillDir: join(root, "home/qa-plan"), cwd: join(root, "repo"), read: () => null };
  const ran = main(["where", "qa-plan"], io);
  assert.equal(ran.code, 0);
  assert.equal(JSON.parse(ran.out).use, "repository");
  assert.equal(main(["where", "qa-plan", "--repo", "."], io).code, 0);
  assert.equal(
    main(["where", "qa-plan", "--repo", join(root, "other")], io).out.includes('"use": "this"'),
    true,
  );
  for (const argv of [
    ["where"],
    ["where", "../qa-plan"],
    ["where", "Upper"],
    ["where", "qa-plan", "extra"],
    ["where", "qa-plan", "--repo"],
    ["where", "qa-plan", "--repo", ".", "extra"],
  ])
    assert.equal(main(argv, io).code, 2, argv.join(" "));
});

test("SKILL.md checks which copy runs before its first step", () => {
  const skill = readFileSync(new URL("./SKILL.md", import.meta.url), "utf8");
  const check = skill.indexOf('adapter.mjs" where qa-plan');
  assert.ok(check > 0, "SKILL.md runs `where qa-plan`");
  assert.ok(check < skill.indexOf("## Workflow"), "before the workflow");
  for (const dir of PROJECT_SKILL_DIRS) assert.ok(skill.includes(dir), `SKILL.md names ${dir}`);
});
