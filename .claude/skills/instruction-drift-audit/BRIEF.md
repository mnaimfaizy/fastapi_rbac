# Upstream Brief file

A run leaves two files in `brief_dir`: the **normalized structured report** and the **Markdown brief rendered from it**. Both are committed, and both are frozen at their date — a later run reads them and never edits them.

The brief is not written by hand. `render.mjs` turns a normalized report into Markdown, and [REPORT.md](REPORT.md) is what a worker fills in. This file says what the two artifacts are called and what a reader finds in them.

## Filenames

```text
YYYY-MM-DD-upstream-brief-<leads>.json   the normalized report (validate-report.mjs --out)
YYYY-MM-DD-upstream-brief-<leads>.md     the brief (validate-report.mjs --render)
```

`<leads>` is the lead package name of each Ecosystem in the run, lowercased, in the order the human named them, joined with hyphens: `nx next react-native` becomes `2026-09-17-upstream-brief-nx-next-react-native`. One stem for both files, so a reader holding either finds the other.

## Sections

The renderer emits **every** section, always, in this order, and an empty one says `_None._` rather than disappearing — a section that vanishes when it has nothing in it reads as a section nobody ran.

| #   | Section                   | What lands there                                                                                                                     |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `Delta`                   | What changed since this Ecosystem's last brief: new findings, earlier findings resolved, earlier findings still present.             |
| 2   | `Upstream Findings`       | **The proposed plan.** Findings dispositioned `plan`, grouped by urgency, most urgent first, because urgency orders the plan.        |
| 3   | `Checked and clear`       | Instruction Claims that held, each with the version range it holds for. The other half of the two-directional audit, and the ledger. |
| 4   | `Upstream Opportunities`  | At most three per Ecosystem, each with its upstream benefit quote, its local sites, and its minimum version when above the Baseline. |
| 5   | `Incidental Observations` | Real local defects no upstream statement grounds. Routed to an owner, never counted as findings, never in the plan.                  |
| 6   | `Follow-on`               | Findings dispositioned `follow-on` — upstream-grounded, but about something the plan may not touch. Same urgency grouping.           |
| 7   | `Unverified`              | Entries the contract refused, each with its reason. The rest of the report stands; a refused entry is named, never silently dropped. |
| 8   | `Failed hops`             | An Ecosystem whose lead is not installed, or whose research hop failed. A failed hop still yields a partial brief.                   |
| 9   | `Scanned`                 | Every path, glob, and page the run actually read. "None in scanned files" means nothing until the scanned files are named.           |

The order above is `BRIEF_SECTIONS` in `render.mjs`, and `render.test.mjs` asserts this table against it — a heading added, removed, or reordered in either place fails there rather than drifting.

Above the first section the brief records its date, the commit every local citation was checked against, and one line per Ecosystem: the Baseline, the Horizon or `no Horizon`, the members, and any drift notes.

## Finding types

| Type                   | What grounds it                                                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Future-risk**        | A Horizon-range document, or a deprecation or removal statement in the Baseline's own documents, about something the instructions still teach. |
| **Mismatch**           | A Baseline-matched document disagrees with what the repo-owned instructions or sampled usage say. Never carried by `absent` Evidence alone.    |
| **Missed improvement** | A Baseline-matched document shows a better practice than the instructions teach; nothing is broken today.                                      |

A finding without a primary-source URL is not a finding. When two official pages disagree, record both and do not pick a winner.

## Briefs with no report

A host may already hold briefs written as free Markdown before the report contract, with no structured report beside them. They are read like any other frozen brief and are not migrated, and none of them can be a ledger: only a committed report is. A rule requiring a report beside every brief would fail on documents nobody intends to change.
