/**
 * Contract suite for the QA config reader. The claims under test: the lookup
 * order, the defaults, every documented spelling reads, and every spelling or
 * shape outside the documented contract is a named problem with its line,
 * never a silent default.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CONFIG_FILES,
  DEFAULTS,
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
    "line 6: `plan.suites[0].junit_path`: unknown key (ADAPTER.md documents: name, command, junit, surfaces)",
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
    "    - { command: x, junit: /abs/r.xml, surfaces: api }",
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
