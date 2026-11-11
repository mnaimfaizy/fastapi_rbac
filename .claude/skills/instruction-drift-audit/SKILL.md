---
name: instruction-drift-audit
description: Write one Upstream Brief comparing repo-owned instructions to official docs for the Ecosystems and Horizons the human names.
disable-model-invocation: true
argument-hint: "ecosystem[@horizon] [ecosystem[@horizon] ...]"
metadata:
  agent-kit-scope: user
---

# Instruction Drift Audit

A user-invoked audit. The human names Ecosystems and, optionally, a Horizon for each. The run writes one **Upstream Brief**, commits the structured report the brief is rendered from, and proposes a HITL issue when there is something to decide. It bumps no package, applies no instruction edit, and starts no grill.

Load [ADAPTER.md](ADAPTER.md) when resolving the host adapter. Load [REPORT.md](REPORT.md) when writing or validating the structured report. Load [BRIEF.md](BRIEF.md) when naming and committing what the run leaves behind. Load [LEDGER.md](LEDGER.md) when reading the previous run — what carries forward, what the delta says, and which Upstream Opportunities were declined. Load [DESIGN.md](DESIGN.md) when a rule needs its reason, or before changing this skill.

`<skill>` in a command below is the absolute path of the folder this file is in, written with forward slashes (`C:/Users/me/...` on Windows). The folder may be inside the repository (for example `<repo>/.claude/skills/instruction-drift-audit`) or in your own skills directory outside it (for example `<home>/.claude/skills/instruction-drift-audit`). The commands keep `<skill>` inside double quotes, because the path may contain spaces. Every command runs from the root of the repository being audited.

## Guardrails

- Write the report and the brief. Leave instruction files, Skills, hygiene scripts, adapter config, and application code unchanged. The brief proposes; a human applies.
- **Every finding needs an upstream statement.** Primary sources only: official documentation, vendor release notes, or a spec. Documentation a package ships for its own version outranks the same vendor's website. The training corpus, blogs, and installed third-party skills are not sources.
- A local defect no upstream statement grounds is an **Incidental Observation**: recorded with an owner from the adapter's `incidental_owners`, never counted as a finding, never in the plan.
- **The proposed plan may touch exactly five things:** Instruction Files, Skills, hygiene and test scripts, the definition behind a command an instruction teaches, and the adapter config. An upstream-grounded finding about anything else — application code, an installed third-party skill — is **follow-on**. Never edit an installed third-party skill; propose a pin or a refresh instead.
- No package bumps. A version record disagreeing with a Baseline is a preflight note for the host's dependency-sync owner, never a plan item.
- File an issue only after the human confirms. Omit `ready-for-agent` and any dependencies role.

## Workflow

### 1. Parse the run

Require one or more Ecosystem names, each optionally followed by a Horizon (example: `next nx@23 react-native`). An Ecosystem named with no Horizon still looks at what its own Baseline documents call deprecated or scheduled for removal — nothing further is asked.

**Done when:** every named Ecosystem is recorded, with its Horizon if one was given.

### 2. Resolve the adapter

Read `instruction-drift-audit.config.yml` (also `.yaml` / `.json`; the older `upstream-brief.config.*` names are still read) from the repo root. Missing keys take the defaults in [ADAPTER.md](ADAPTER.md). A missing file is not an error. An adapter the reader reports **problems** in is: `resolve-baseline.mjs` prints each one with its line and exits 1. Show them to the human and stop — a run over a misread adapter audits the wrong files or forgets what was declined.

**Done when:** the adapter reads with no problems, and the Ecosystem declarations, the version-record path, declined Upstream Opportunities, instruction globs, brief directory, incidental owners, optional source/script globs, and optional issue map are known.

### 3. Resolve the Baselines and confirm membership

Run the Baseline resolver (`<skill>/resolve-baseline.mjs`, built on the dependency-free `baseline.mjs`) for each named Ecosystem: its lead's installed version is the Baseline, and its members are what the lead's scope prefix discovers, extended or trimmed by the adapter's declaration. An Ecosystem whose lead is not installed is a **failed hop** — record it with its reason and continue with the rest. Never invent a Baseline, and never read one from the version record or a declared range.

Then **ask once**, in a single question covering every Ecosystem: print each lead, its Baseline, its Horizon, its member list, and any drift notes, and have the human confirm or trim the membership before research starts. Research the membership the human confirms.

A correction belongs in the adapter's `members.add` / `members.remove` so the next run does not ask again — but it is not a plan item and cannot become one: a plan item is a finding, and a finding needs an upstream statement behind it. Offer the adapter edit to the human alongside the issue in step 9, and edit nothing here.

**Done when:** every named Ecosystem is resolved to a Baseline with a confirmed member list, or recorded as a failed hop, and the human has answered once.

### 4. Read the ledger

For each resolved Ecosystem, the latest structured report committed in the brief directory that carries it is its ledger. Run `node "<skill>/resolve-ledger.mjs"` to see, per Ecosystem: which checked-and-clear claims carry forward to the new Baseline, which go back on the research list and why, and which declined Upstream Opportunities are still suppressed. [LEDGER.md](LEDGER.md) is the rule for all three.

A carried-forward claim is **not researched again** — it is written into this run's report as checked and clear, with the citations it already carried. An Ecosystem with no ledger researches everything and its report carries no `delta`. Frozen briefs are read, never edited.

**Done when:** every resolved Ecosystem has a carry-forward list, a research list, and its suppressed Opportunities known.

### 5. Load the instruction set

Read files matching `instruction_globs`. Always exclude install and cache trees (`node_modules`, `.yarn`, `vendor`, `.git`, generated output). Those globs are repo-owned files only — third-party skill bodies are out of scope.

If `source_globs` or `script_globs` are set, _sample_ them for names a hop returns. Do not inventory the tree.

Record every path or glob actually read in the report's `scanned` list. "None in scanned files" is not an answer unless the scanned files are named.

**Done when:** instruction text is loaded, optional samples are ready, and `scanned` names what was read.

### 6. Research hops

Launch one **research worker per Ecosystem** — not per package. These are Independent Hops and may run in parallel. If the host has a Research specialist, use it as the worker. Otherwise the same agent fetches the pages. A failed hop is recorded; the run continues.

Hand each worker its Ecosystem's lead, members, Baseline, Horizon, the loaded instruction text, its research list, and its suppressed Opportunities, and require all of this back as one Ecosystem entry in the structured report ([REPORT.md](REPORT.md)):

**Audit in both directions.**

- Inventory **every Instruction Claim** the loaded instructions make about this Ecosystem — a command, an API, a file convention, a version literal. Each one ends as an Upstream Finding or as a checked-and-clear entry carrying the version range it `holdsFor`. An Instruction Claim nobody checked is the failure this inventory exists to prevent; a claim that held is a result, not silence.
- Read the Ecosystem's upstream documents for what changed, and report it against the instructions.

**Which documents may be cited.**

- **Baseline-matched documents** ground a `mismatch` or a `missed-improvement`. Prefer the documentation the installed package ships for its own version (under its install tree) over the vendor's website, which describes whatever version it was last written for.
- **Horizon-range documents** — above the Baseline, up to and including the Horizon — may be cited **only** for `future-risk`.
- With no Horizon, the only forward-looking source is a deprecation or removal statement in the Baseline's own documents.
- Record the version each page states as `source.pageVersion`, and quote it verbatim. A paraphrase is not a citation.

**Evidence.**

- `cited` is a page and its quote. `executed` is a command and its exit code. `inferred` is reasoning alone. `absent` means the matching documents were read and do not say it — which on its own never proves the repo wrong, so it can carry a `future-risk` or a `missed-improvement` and never a `mismatch`.
- **`executed` Evidence may come only from a command that writes no tracked file and installs nothing** — a `--version`, a `--dry-run`, a `--help`, a read-only checker, a type query against what is installed. Never an install, an upgrade, a migration, a codemod, a formatter, or anything that writes into the work tree. Record the command and its exit code.
- `broken-now` is the urgency that requires `executed` Evidence. Without it the validator downgrades the finding rather than dropping it.

**Local evidence.** Every citation into this repo is a `file`, a `line`, and the literal text at that line, quoted exactly as the file has it. The validator reads that line back at the commit the report records.

**Disposition.** `plan` for the five things the plan may touch; `follow-on` for an upstream-grounded finding about anything else. A local defect with no upstream statement behind it is not a finding at all — it is an Incidental Observation with an owner.

**Upstream Opportunities.** At most three per Ecosystem, strongest first. Each is a technique the upstream documents or an alternative the upstream itself names, at a place where nothing is wrong today. Each must be adoptable at the Baseline — or by the Horizon, with its `minVersion` stated — must name at least one local site as a checked citation, and must state its benefit as the upstream's own quoted sentence, never an estimate. Do not propose one the ledger reports as suppressed; do propose a resurfaced one, with the reason it came back.

**Zero is a legal answer, and the run says what it considered.** The report has no field for a candidate that was weighed and dropped, so it goes in `scanned` — the list of what the run read — as one entry per candidate, naming the Ecosystem, the page, and in one clause why nothing was proposed from it: `nx — https://nx.dev/… — already adopted at scripts/check-hygiene.ts`. An empty Opportunities section beside a `scanned` list that names no candidate reads as a run that never looked.

**Done when:** every resolved Ecosystem has a report entry or a failure note.

### 7. Skeptic hop

Before anything is validated or rendered, challenge **every `absent` and every `inferred` finding** — these are the two kinds nothing else checks. Try to disprove each one: run the command (under the `executed` Evidence limit above), read the installed types or the shipped documents, or re-read the cited page.

- **Disproved** → drop the finding and write it into that Ecosystem's checked-and-clear list instead, with its citation and the range it holds for, so the next run's ledger carries it rather than re-deriving it.
- **Survives, and the attempt ran a command** → upgrade the Evidence to `executed` and record the command and its exit code.
- **Survives otherwise** → leave it as written.

`cited` findings are already checked by the validator. Re-fetching each cited URL to confirm its quote is optional and advisory — do it when the run has the budget, and say so in the brief when it was skipped.

**Done when:** no `absent` or `inferred` finding remains unchallenged.

### 8. Compute the delta, validate, render, and commit

Write the report as JSON. For every Ecosystem that had a ledger, set the report's `delta` first — the brief opens with it, and nothing else computes it:

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const [ledgerModule, ...reports] = process.argv.slice(1);
const { classifyFindings } = await import(pathToFileURL(ledgerModule).href);
const [draft, ledger] = reports.map((p) => JSON.parse(readFileSync(p, 'utf8')));
console.log(JSON.stringify(classifyFindings({ previous: ledger, ecosystems: draft.ecosystems }), null, 2));
" "<skill>/ledger.mjs" <draft-report.json> <the ledger report step 4 named>
```

It returns `{newFindings, resolved, stillPresent}` to assign to `delta`, or `null` when no named Ecosystem had a ledger — `null` means **omit the key**, which is what a first run's absent delta means. Then run the validator, which validates before it renders:

```bash
node "<skill>/validate-report.mjs" <report.json> \
  --out <normalized.json> --render <brief.md>
```

Exit `1` means the report is not a report — fix the envelope and run it again; nothing downstream can use it. Exit `0` may still carry Unverified entries: an entry the contract refused is listed with its reason and the rest of the report stands.

Commit the **normalized** report — the `--out` file, not the input — beside the rendered brief in the brief directory, named as [BRIEF.md](BRIEF.md) says. The committed report is what the host's gate re-validates offline and what the next run reads as its ledger.

**Done when:** the delta is set or deliberately absent, the validator exits `0`, and the normalized report and the brief are both committed in the brief directory.

### 9. Propose the HITL issue

If the brief carries **at least one Upstream Finding or one Upstream Opportunity**, propose exactly one issue: title, body linking the brief, and the adapter's two mapped labels — the research label and the HITL label. Nothing else. Wait for confirm. On yes, file it with the host tracker. On no, stop; the brief and the report stay. With no issue map, print the same proposal and stop.

If the brief carries neither — only Incidental Observations, Unverified entries, or nothing at all — do not propose an issue. Say so and point at the brief. Route each Incidental Observation to the owner it names.

Two adapter edits are offered here rather than planned, because neither is a finding and the plan is made of findings: a **membership correction** from step 3, and a **`declined_opportunities` entry** for any Upstream Opportunity the human turns down now (identity, one-line reason, the Baseline range, the upstream quote), so the next run stays quiet about it until the Baseline or the quote moves. Print both for the human to apply. The brief and the report are already committed and are not rewritten to carry them.

**Done when:** the issue is filed, declined, or printed, and this skill has not started a grilling session.
