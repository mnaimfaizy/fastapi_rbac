# The ledger: what a run remembers

The latest committed structured report for an Ecosystem is its **ledger**. A new run reads it
before any research hop spends a token: a checked-and-clear Instruction Claim that still holds is
carried forward, everything else is researched again, and the brief opens with a delta
([DESIGN.md](DESIGN.md)
item 11). The same file also owns declined Upstream Opportunities (item 12), because both are the
same thing — one run's decision, read by the next.

| File                 | What it is                                                                            |
| -------------------- | ------------------------------------------------------------------------------------- |
| `ledger.mjs`         | The decisions. Carry-forward, finding classification, declined Opportunities.         |
| `resolve-ledger.mjs` | The command: what the host's Ecosystems would carry forward, and what they would not. |

```bash
node "<skill>/resolve-ledger.mjs"
```

It asserts nothing about the ledger and exits 0, or 1 when the adapter cannot be read. The gate
is `check-reports.mjs`, which fails on a declined entry whose Ecosystem or path is gone.

## Carry-forward

A claim is carried forward when **both** hold:

- its `holdsFor` range covers the new Baseline, and
- every line it quotes still says what it said, read at the current commit.

Anything else goes back on the research list with a named reason:

| Reason                   | Meaning                                                                   |
| ------------------------ | ------------------------------------------------------------------------- |
| `baseline-outside-range` | the Baseline moved out of the range the claim was recorded as holding for |
| `unreadable-range`       | `holdsFor` is not a range this module parses                              |
| `no-local-evidence`      | the claim quotes no instruction text, so nothing can be shown unchanged   |
| `instruction-changed`    | a quoted line moved, changed, or its file is gone                         |

`no-local-evidence` is the one that is easy to read as too strict. The range says which upstream
versions the statement covers; it never says this repo still states what it stated. A claim
carrying no local citation has nothing that could be shown unchanged, so carrying it forward on
the range alone would carry a claim about a repository that nobody looked at.

An Ecosystem the ledger has never seen carries nothing and re-checks nothing: everything about it
is researched, and the delta is absent — which is exactly what an absent `delta` key means in the
report contract.

## The delta

After research, this run's findings are classified against the ledger's into `newFindings`,
`resolved`, and `stillPresent` — the shape the report contract validates and
[the renderer](REPORT.md) prints as the brief's first section.

Two findings are the same finding when their **type**, their **upstream URL**, and their **claim**
(whitespace collapsed, case folded) match. There is no finding id in the contract, and one a
worker writes would make "is this the same finding?" a thing a worker decides. The key errs
toward over-reporting: a re-worded claim reads as one resolved plus one new, where a looser key
would quietly merge two different findings about one page and report neither.

## Version ranges

Three forms, and nothing else:

| Form                   | Example            | Covers                          |
| ---------------------- | ------------------ | ------------------------------- |
| exact                  | `16.2.6`           | that version                    |
| wildcard tail          | `22.x`, `0.80.*`   | that line                       |
| comparator conjunction | `>=15.0.0 <17.0.0` | everything satisfying all terms |

A version on either side may carry a pre-release or build tail (`16.0.0-canary.3`). A pre-release
sorts below its release, and build metadata is ignored. A pre-release Baseline is covered by
semver's rule: only when the range names a pre-release of the same `major.minor.patch`. So
`>=16.0.0-canary.1 <17.0.0` and the exact `16.0.0-canary.3` cover `16.0.0-canary.3`, while
`>=15.0.0 <17.0.0` and `16.x` cover neither it nor `17.0.0-canary.1`. Ordering alone would let
`<17.0.0` cover `17.0.0-canary.1`, the pre-release of the next major where breaking changes land.
An uncovered claim is researched again and an uncovered decline resurfaces, which is the safe
side.

Caret and tilde are refused by name rather than approximated: `^0.2.3` means `>=0.2.3 <0.3.0`
while `^1.2.3` means `>=1.2.3 <2.0.0`, and the React Native Ecosystem sits on the 0.x line where
that difference decides the answer. A range read too wide carries a claim forward that should have
been researched again, which is the outcome the ledger exists to prevent.

## Declined Upstream Opportunities

The adapter records them under `declined_opportunities` ([ADAPTER.md](ADAPTER.md)). An entry is
identity (Ecosystem, upstream URL, local site path), a one-line reason, the Baseline range it was
declined at, and the upstream quote at the time.

- **Suppressed** while the Baseline is inside that range **and** the upstream quote is unchanged.
- **Resurfaces** when either moves — `baseline-left-range` or `quote-changed`. "No, not at 22" is
  not "no, forever".
- **Fails the gate** when its Ecosystem is no longer declared or its site path is not in the tree:
  the entry then silences nothing and records a decision about something that is not there.

An entry whose range nothing can read suppresses nothing. That is the opposite of the
carry-forward rule above, where an unreadable range means "research it again", and it is the same
rule underneath: when the ledger cannot say, the run does the work and the human sees the result.
