# Instruction Drift Audit adapter

The adapter holds the host's facts; the skill body names no host. A repository may add `instruction-drift-audit.config.json` (or `.yml` / `.yaml`) at its root. A missing file, or a missing key, takes the default below. Every command reads it through one reader, `adapter.mjs`.

## Lookup order and dialects

The first file present is the adapter: `instruction-drift-audit.config.yml`, then `.yaml`, then `.json`. A key it does not carry takes the default; the search does not continue into another file.

**Older name.** The skill was first called `upstream-brief`, and its adapter `upstream-brief.config.{yml,yaml,json}`. Those names are still read, in the same order, after the three above, so a host that adopted it under the old name keeps working unchanged. A repository with both keeps only the new one: the old file is not read and not merged. Rename it when convenient; the keys are the same.

**JSON** is read whole and is the dialect for anything the YAML subset cannot say.

**YAML** is read in this subset only:

- block mappings and block sequences, indented with spaces; a sequence may sit at its key's own indent (`ecosystems:` then `- lead: nx`);
- plain, single-quoted, or double-quoted scalars, and flow lists of scalars (`[a, 'b']`, `[]`);
- full-line `#` comments anywhere, and a trailing ` # comment` after a value — except inside `declined_opportunities`, where a value runs to the end of its line, so a URL fragment or a `#` in a reason survives;
- every value is a string.

Tabs, anchors, aliases, flow mappings, multi-line scalars, duplicate keys, unknown top-level keys, and values of the wrong shape are **problems**. A problem is never a silent default: it is named with its line, `check-reports.mjs` fails on it, and `resolve-baseline.mjs` and `resolve-ledger.mjs` print it and exit 1.

## Keys

| Key                      | Default                   | Meaning                                                                                                                                                                                                    |
| ------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version_record.path`    | `package.json`            | A file the host maintains that records versions for humans. The Baseline resolver only **compares** it with what is installed and names a drift note on disagreement; it is never a source (DESIGN.md §1). |
| `ecosystems`             | none                      | The Ecosystems a run may name. See below.                                                                                                                                                                  |
| `declined_opportunities` | none                      | Upstream Opportunities a human said no to, remembered between runs. See below.                                                                                                                             |
| `instruction_globs`      | see below                 | Repo-owned files that teach agents how to write code: the files a run audits.                                                                                                                              |
| `source_globs`           | unset                     | Application-code globs to _sample_ for evidence. Never inventoried.                                                                                                                                        |
| `script_globs`           | unset                     | Hygiene and test-script globs to _sample_.                                                                                                                                                                 |
| `brief_dir`              | `docs/research`           | Where the brief and its structured report are committed. Created if missing.                                                                                                                               |
| `incidental_owners`      | `[ad-hoc-issue]`          | Who an Incidental Observation may be routed to (DESIGN.md §7): the host's own owners, such as an audit agent or a dependency auditor. The validator refuses any other owner.                               |
| `issue`                  | unset: print, do not file | Where the proposed issue goes. See below.                                                                                                                                                                  |

### `ecosystems` entries

| Key              | Required | Meaning                                                                                           |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `lead`           | yes      | The lead package. Its installed version is the Ecosystem's Baseline.                              |
| `members.add`    | no       | Companions the lead's scope convention misses (an unscoped package such as `eslint-config-next`). |
| `members.remove` | no       | Companions to drop from the discovered set.                                                       |

Members are otherwise discovered by the lead's npm scope: `nx` names companions installed under `@nx/*`; a lead already scoped (`@remix-run/react`) names companions under its own scope. An Ecosystem whose lead is not installed fails closed with a reason, and the others still resolve.

**Package managers.** Installed versions come from the package resolver, `npm-resolver.mjs`, which reads each package's own manifest under `node_modules`. That covers npm, pnpm, and Yarn with the node-modules linker. It does not cover Yarn Plug'n'Play, or any other ecosystem's install tree (pip, uv, Cargo, Go modules): there, every lead fails closed. A resolver for another package manager implements the same two functions and is chosen in `resolverFor`.

### `declined_opportunities` entries

An Upstream Opportunity a human declined, remembered so the next run does not propose it again (DESIGN.md §12). Suppression and resurfacing are [the ledger](LEDGER.md)'s.

| Key              | Meaning                                                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| `ecosystem`      | The lead of the Ecosystem it was proposed for. Part of its identity.            |
| `url`            | The upstream page the Opportunity cited. Part of its identity.                  |
| `site`           | The local site path it named. Part of its identity.                             |
| `reason`         | One line: why not.                                                              |
| `baseline_range` | The Baseline range it was declined at: `22.x`, `16.2.6`, or `>=22.0.0 <23.0.0`. |
| `quote`          | The upstream statement at the time, so a page that changes its mind is noticed. |

All six are required. An entry is **suppressed** while the Baseline stays inside `baseline_range` and the upstream quote is unchanged, and **resurfaces** when either moves: a decline is about one suggestion at one version, not about the Ecosystem forever. An entry whose `ecosystem` is no longer declared, or whose `site` is gone from the tree, **fails** `check-reports.mjs`: it silences nothing and records a decision about something that is not there.

### `issue` map

| Key               | Meaning                                                      |
| ----------------- | ------------------------------------------------------------ |
| `tracker`         | `github`, `gitlab`, or `none`                                |
| `repository`      | `owner/name`, when the tracker needs it                      |
| `labels.research` | The label meaning "this came from an Upstream Brief"         |
| `labels.hitl`     | The label meaning a human decides before an agent implements |

Two labels, and no third ([DESIGN.md](DESIGN.md) §13). A third "quality" role once mapped to a label its host reserved for something else, so every brief issue arrived claiming to be something it was not. Map no dependencies role either, and add no "ready for agent" label: a human decides first.

### Default `instruction_globs`

```json
[
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  ".github/copilot-instructions.md",
  ".agents/skills/**/*.md",
  ".claude/skills/**/*.md",
  ".claude/commands/*.md"
]
```

Always excluded, even when a glob matches: `node_modules/**`, `.yarn/**`, `vendor/**`, `.git/**`, `**/generated/**`. Third-party skill install trees are not repo-owned; leave them out of `instruction_globs`. When a hop shows an installed third-party skill contradicting upstream, record **follow-on**: update or pin that skill.

## Example

```json
{
  "version_record": { "path": "package.json" },
  "ecosystems": [
    { "lead": "nx" },
    { "lead": "next", "members": { "add": ["eslint-config-next"] } }
  ],
  "brief_dir": "docs/research",
  "incidental_owners": ["ad-hoc-issue"],
  "issue": {
    "tracker": "github",
    "repository": "owner/name",
    "labels": { "research": "research", "hitl": "needs-human" }
  }
}
```

## Wiring a host

Every command takes `--repo <dir>` (default: the working directory) and needs Node 22 or later. Paths below are relative to this folder.

| Command                | What it does                                                        | Where a host runs it                                             |
| ---------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `check-reports.mjs`    | The gate: adapter, committed reports, declined entries. Exit 0/1/2. | CI, with full history (`fetch-depth: 0`); optionally pre-commit. |
| `suggest-run.mjs`      | One line per Ecosystem whose Baseline has moved. Always exit 0.     | A hook after any dependency install, upgrade, or removal.        |
| `resolve-baseline.mjs` | What a run would anchor to.                                         | By hand, before a run.                                           |
| `resolve-ledger.mjs`   | What a run would carry forward and re-research.                     | By hand, before a run.                                           |
| `validate-report.mjs`  | Validates and renders one report during a run (SKILL.md step 8).    | The run itself.                                                  |

**The gate and the hook need the skill installed in the repository.** This is a User-scope skill: a copy in your own skills directory (for example `~/.claude/skills/instruction-drift-audit/`) is enough to run the audit by hand from any repository. CI and a repository's hooks, though, can only run files committed in that repository. To wire `check-reports.mjs` or `suggest-run.mjs`, install the skill into the repository (for example `.claude/skills/instruction-drift-audit/`) and commit it.

The contract suites are every `*.test.mjs` in this folder: `node --test <this folder>/*.test.mjs`. `portability.test.mjs` among them copies the folder alone into an empty repository and runs everything there, and runs the commands from a repository with the folder installed outside it.
