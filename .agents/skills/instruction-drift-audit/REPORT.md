# Structured Upstream Brief report

A run writes a **structured report** and renders the Markdown brief from it. The report is the
checkable artifact; the brief is a view of it. Both are committed to the brief directory, and a
Wired Gate re-validates every committed report offline ([DESIGN.md](DESIGN.md)
items 3 and 10).

Three modules, none of which import anything outside this directory except Node built-ins — the
skill is portable, and a validator that needed a host repository's dependencies would not be:

| File                  | What it is                                                                  |
| --------------------- | --------------------------------------------------------------------------- |
| `report.mjs`          | The contract. Validates, checks local evidence, computes `unverified`.      |
| `render.mjs`          | The brief. Normalized report in, Markdown out, sections in one fixed order. |
| `validate-report.mjs` | The CLI over both.                                                          |

## Running it

```bash
node "<skill>/validate-report.mjs" <report.json> \
  --out <normalized.json> --render <brief.md>
```

Exit `0` when the report is a report — it may carry Unverified entries. Exit `1` when it is
invalid or unparseable. Exit `2` when the run could not happen, including a recorded commit this
clone does not have.

What gets committed is the file `--out` wrote, not the input: it is the one carrying the write-time Unverified list
and the counts the gate re-checks against.

## Shape

```text
report                date, commit, ecosystems[], scanned[], failedHops[], delta?
ecosystem             lead, members[], baseline, horizon?, driftNotes[],
                      findings[], checkedAndClear[], opportunities[], incidental[]
upstreamFinding       type, urgency, claim, evidence, source{url, quote, pageVersion},
                      local[{file, line, text}], executed?{command, exitCode}, disposition
checkedAndClear       claim, source{url, quote, pageVersion}, local[], holdsFor
upstreamOpportunity   technique, source{url, pageVersion}, benefitQuote, minVersion?, local[]
incidentalObservation summary, local[], owner
```

`schemaVersion` is `1`. `unverified` and `counts` are computed by the validator and rejected if a
report arrives carrying them: a derived field the author can forge is not derived.

## Domain rules

On top of the shape above, the validator enforces the parts of [DESIGN.md](DESIGN.md) that are about one
report's own entries. Everything that reads the _previous_ committed report — the carry-forward,
the delta, declined Upstream Opportunities — is [the ledger](LEDGER.md)'s, in `ledger.mjs`:

- **`absent` Evidence cannot support a `mismatch`** (item 3). The matching documents were read and
  say nothing, which on its own never proves the repo wrong — legal for `future-risk` or
  `missed-improvement`, refused as `absent-evidence-mismatch` for `mismatch`.
- **`broken-now` without `executed` Evidence is downgraded, not rejected** (item 5). A finding
  survives with its urgency forced to `advisory` — the floor, because nothing here licenses
  picking a specific timeline (`deprecated`, `removal-scheduled`) the finding never claimed — and
  two fields recording it: `downgradedFrom: "broken-now"` and a `downgradeReason` string. `advisory`
  is exported as `BROKEN_NOW_DOWNGRADE_URGENCY`.
- **At most three Upstream Opportunities per Ecosystem** (item 8, `MAX_OPPORTUNITIES_PER_ECOSYSTEM`).
  Counted against what survives its own citation check, in the order the worker wrote them — an
  Opportunity a citation already refused does not spend one of the three slots. The fourth and
  later that otherwise hold are Unverified as `too-many-opportunities`.
- **An Opportunity's `minVersion` above the Baseline needs a Horizon that reaches it** (item 8).
  Adoptable at the Baseline needs nothing further; above it without a covering Horizon is
  Unverified as `opportunity-beyond-horizon`. Versions compare segment by segment on `x.y.z`,
  with semver's pre-release rule: a Baseline read from an installed manifest can be a
  pre-release, and `16.0.0-canary.3` sorts below `16.0.0`. Build metadata is ignored. A
  `minVersion` that is not a version number (`Nx 22.1`) is `malformed`.
- **An Incidental Observation cannot carry a `disposition`** (item 7). `disposition` is an Upstream
  Finding field; one on an Incidental Observation would let it slip into the plan the same way a
  Finding does. Refused as `malformed`.

Closed vocabularies:

| Field         | Values                                                      |
| ------------- | ----------------------------------------------------------- |
| `type`        | `future-risk`, `mismatch`, `missed-improvement`             |
| `urgency`     | `broken-now`, `removal-scheduled`, `deprecated`, `advisory` |
| `evidence`    | `executed`, `cited`, `inferred`, `absent`                   |
| `disposition` | `plan`, `follow-on`                                         |
| `owner`       | the adapter's `incidental_owners`, default `ad-hoc-issue`   |

`delta` is `{newFindings[], resolved[], stillPresent[]}`, computed by [the ledger](LEDGER.md) from
the previous committed report and validated here like any other field. It is absent on the first
run for an Ecosystem, which has no ledger to carry forward.

An Ecosystem's own `lead`, `members`, `baseline`, and `driftNotes` are not authored by a worker —
they come from the Baseline resolver (`baseline.mjs`, and `resolve-baseline.mjs` over the host's
adapter), which turns an Ecosystem declaration and the installed package tree into exactly those
four fields before any research hop runs (DESIGN.md §1 and §2). This contract still validates
them as any other report field; it does not resolve them itself.

## Unverified

An entry the contract refuses moves to `unverified` with a named reason, and **the rest of the
report stands**. That is the one place this contract differs from the code-review contract, which
rejects a report whole: a review computes a verdict that one bad finding corrupts, while a brief
has no verdict, and losing an Ecosystem's good findings to one bad citation costs more than
listing the bad one.

Reasons: `missing-source-url`, `missing-source-quote`, `missing-page-version`, `malformed`, the four
citation reasons below, and the three domain-rule reasons above (`absent-evidence-mismatch`,
`too-many-opportunities`, `opportunity-beyond-horizon`).

The envelope is different. A report with no commit, no Baseline, or the wrong schema version is
rejected whole — there is nothing left for a reader to use.

## Local evidence

Every local citation is a `file`, a `line`, and the literal `text` at that line, checked against
the tree at the commit the report records — never against the working tree. That is what lets a
brief frozen at its date stay checkable after the tree moves on, and it is why the reader is
injected rather than imported.

| Reason              | Meaning                                                       |
| ------------------- | ------------------------------------------------------------- |
| `file-not-found`    | the file is not in the tree at the recorded commit            |
| `line-out-of-range` | the file has fewer lines than the citation names              |
| `text-differs`      | that line says something else                                 |
| `quotes-nothing`    | the quotation is whitespace, which would match any blank line |

Whitespace is presentation: a re-indented quote is the same quote. The four names are the review
pipeline's, copied as a rule rather than as code so both vocabularies read the same and the skill
stays portable.

## Sections

The brief emits every section, always, in one order, with `_None._` for an empty one. That order is
`BRIEF_SECTIONS` in `render.mjs`, and [BRIEF.md](BRIEF.md) is where it is written out — one copy,
asserted against the renderer by `render.test.mjs`. It is not repeated here: a second list nothing
checks is the drift the assertion exists to stop.

Upstream Findings are grouped by urgency, most urgent first, because urgency orders the plan. A
finding dispositioned `follow-on` renders under Follow-on and nowhere else.

## After the run

`check-reports.mjs` re-validates every committed report at the commit it records, along with the
adapter and its declined Upstream Opportunities. A host runs it as a gate; [ADAPTER.md](ADAPTER.md)
says where. `resolve-ledger.mjs` prints what the next run would carry forward.
