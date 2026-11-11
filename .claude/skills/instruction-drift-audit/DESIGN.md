# Instruction Drift Audit design

Why the skill is shaped the way it is. The skill carries this file so its rules keep their reasons in any repository it is copied into. Code comments cite it as `DESIGN.md §N`. A host repository may record the same decisions in its own decision log; for the skill, this file is the source.

Load it when changing the skill, or when a rule in [SKILL.md](SKILL.md), [REPORT.md](REPORT.md), [LEDGER.md](LEDGER.md), or [ADAPTER.md](ADAPTER.md) needs its reason.

## Boundary

The skill answers one question: _what do the official docs for what is installed say now, and which of our instructions are wrong?_

- **User-invoked and portable.** One skill, not one per framework. A per-framework skill that embeds "use X" becomes the stale sediment this skill exists to find. Everything host-specific is in the adapter ([ADAPTER.md](ADAPTER.md)); the scripts import only Node built-ins and each other.
- **Primary sources only.** Official documentation, vendor release notes, or a spec. The training corpus, blogs, and installed third-party skills are not sources: they go stale exactly like the instructions under audit.
- **The brief applies nothing.** It proposes; a human decides, then starts any design session. Writing instruction patches before that decision would make the human review theatre.
- **Not an upgrade plan, not a dependency audit, not a version-record writer.** "What is outdated or vulnerable" and "record the versions just installed" are other tools' jobs. A version record that disagrees with the Baseline is a note for that tool's owner.
- **Never edit an installed third-party skill.** That forks it. Record "update or pin" as follow-on.
- **A failed hop still yields a partial brief.** One Ecosystem failing costs that Ecosystem, not the run.

## Glossary

**Upstream Brief**: a dated, cited report comparing the host repository's instructions and usage to official upstream documentation for named Ecosystems, anchored to each Baseline and optionally looking ahead to a Horizon. Never a package upgrade plan.

**Ecosystem**: the unit a brief audits: one lead package plus the companions its upstream releases, documents, or defines compatibility against. An unrelated library that merely runs inside it is its own Ecosystem.

**Baseline**: the version of an Ecosystem actually installed, read from what is installed, never from a document that records versions and never from a declared range.

**Horizon**: a later version the human names so a brief can look ahead. Without one, a brief reports only what the Baseline's own documents call deprecated or scheduled for removal.

**Instruction Claim**: a version-sensitive assertion a repo-owned instruction file or skill makes about an Ecosystem: a command, an API, a file convention, or a version. Each one ends as an Upstream Finding or as checked and clear.

**Upstream Finding**: one claim about the host's instructions or usage, grounded in an upstream statement matched to the Baseline (or to the range up to the Horizon), with Evidence and an urgency.

**Evidence**: what a finding cites so a reader can check it without trusting the worker. `cited` (a page and its verbatim quote), `executed` (a command and its exit code), `inferred` (reasoning alone), or `absent` (the matching documents were read and do not say it, which on its own never proves the repo wrong).

**Upstream Opportunity**: a technique the upstream documents, or an alternative the upstream itself names, that would improve a named local site where nothing is wrong today. Never counted as a finding.

**Incidental Observation**: a local defect a brief notices that no upstream statement grounds. Recorded and routed to an owner, never counted, never in the plan.

**Independent Hop**: a worker job that needs no other worker's output. Only Independent Hops run in parallel.

## Principles

- **A derived field is computed, never written.** `unverified` and `counts` are rejected when a report arrives carrying them: a derived field the author can forge is not derived.
- **An artifact states no claim it does not assert.** A section that disappears when empty reads as a section nobody ran, so the renderer emits every section and says `_None._`. A test pins the documented section table to the renderer's.
- **A citation that does not match its source is a fact about the pipeline.** Local evidence is checked against the commit the report records. A commit this clone does not have is "could not run" (exit 2), never "fabricated" (exit 1): `git show` fails identically for a missing path and an unresolvable ref, and a shallow clone would otherwise accuse a worker who did nothing wrong. The four reasons a citation fails are named once, in `report.mjs`.
- **A fan-out over a closed vocabulary goes through one table.** Code that enumerates urgencies, Evidence kinds, or problem reasons reads one exported table, so adding a member cannot compile while silently skipping it.

## Decisions

Numbered so code can cite them. The history behind each is in [Lessons](#lessons).

1. **Baseline and Horizon replace a single target version.** Mismatch and Missed improvement cite documents matching the Baseline. Future-risk cites documents between Baseline and Horizon, or, with no Horizon, only deprecation and removal statements in the Baseline's own documents. Documentation a package ships for its own version outranks the vendor website. The skill never decides what "latest" is: "latest" is as stale as the training corpus, and the human sometimes wants a major that is not the newest.
2. **The unit is an Ecosystem.** Discovered by the lead's scope prefix, extended or trimmed in the adapter. The run lists each Ecosystem's members and asks once before research starts. One research worker per Ecosystem, because upstreams release in trains: a per-package unit produced runs of seventeen subjects.
3. **Workers write structured findings, and a validator accepts them before anything is rendered.** Each carries a URL, a verbatim quote, the version the page states, an urgency, and Evidence. Local evidence is `file` + `line` + literal text, checked against the recorded commit. A rejected finding moves to **Unverified** with its reason; the rest of the report stands. Rejecting the whole report on one bad finding was rejected: a brief has no verdict to corrupt, and losing an Ecosystem's valid findings costs more than naming the bad one. Sending errors back to the worker for a retry was rejected too: it opens a loop for a report that already records what failed.
4. **A skeptic hop tries to disprove every `absent` and `inferred` finding** before the brief is written: run the command, read the installed types, re-read the page. Disproved findings become checked and clear. `cited` findings are already checked by the validator.
5. **Urgency is `broken-now`, `removal-scheduled`, `deprecated`, or `advisory`, and orders the plan.** `broken-now` needs `executed` Evidence or is downgraded to `advisory`, the floor, since nothing licenses a timeline the finding never claimed. `executed` Evidence comes only from commands that write no tracked file and install nothing. That limit is stated, not mechanically enforced.
6. **The audit runs in both directions.** Workers read upstream for what changed, and also inventory every Instruction Claim the instruction globs make. Each ends as a finding or as checked and clear, and the brief lists what it scanned. Without the inventory, an instruction nobody checked stays invisible, and "none in scanned files" names no files.
7. **A finding needs an upstream statement.** A local defect with none is an Incidental Observation, routed to an owner from the adapter's `incidental_owners`. Follow-on keeps one meaning: upstream-grounded items about something the plan may not touch.
8. **At most three Upstream Opportunities per Ecosystem.** Adoptable at the Baseline, or by the Horizon with its minimum version; at least one checked local site; the benefit is the upstream's quoted sentence, never an estimate. Zero is allowed and says what was considered. A quota was rejected: it fills quiet runs with suggestions nobody acts on.
9. **The proposed plan may touch** instruction files, skills, hygiene and test scripts, the definition behind a command an instruction teaches, and the adapter config. Nothing else.
10. **The structured report is committed beside the Markdown brief**, and a gate re-validates every committed report offline (`check-reports.mjs`). Because local evidence is checked at the recorded commit, a frozen brief stays valid however far the tree moves. The validator ships inside the skill; a host wires it through whatever its gate runner sees.
11. **The latest committed report per Ecosystem is the ledger.** A checked-and-clear claim whose range still covers the new Baseline, and whose quoted instruction text is unchanged, is carried forward without new research. The brief opens with a delta: new, resolved, still present. Frozen briefs are read, never edited. A separate living claim ledger was rejected: it would restate the instructions and need its own drift gate.
12. **Declined Opportunities are remembered in the adapter**: identity (Ecosystem, URL, site), a reason, the Baseline range, and the upstream quote. An entry resurfaces when the Baseline leaves that range or the quote changes, and fails the gate when its Ecosystem or site is gone.
13. **Any finding or Opportunity proposes one human-decision issue**, filed only on confirm, with the adapter's two mapped labels. No third label, no "ready for agent" label, no dependencies role.
14. **A dependency-change hook may suggest a run** when an Ecosystem's Baseline leaves the range its latest brief recorded (`suggest-run.mjs`). It prints a line and never invokes the skill.

## Lessons

The first three briefs (one Next.js, one Nx, one React Native) were free Markdown against a named target version. Each found real drift that landed, and each showed a gap the decisions above close:

- **"Target" meant three things**: a major the repo was not on, a version already installed, and the current version handed to fifteen unrelated libraries. The source rule also required every citation to describe the target, which no Future-risk finding can satisfy (§1).
- **Versions came from a document that drifts.** The version record listed an older version than was installed and omitted an installed companion, so that companion failed closed (§1).
- **Nothing accepted or rejected a claim.** One brief carried two correction blocks for three wrong claims: absence from a CLI reference read as removal, a miscount, a rename called deliberate that was not. Citations were paraphrased in one brief and quoted in another, and local evidence cited `file:line` with no commit (§3, §4).
- **Scope leaked.** Real defects with no upstream statement were filed as follow-on until follow-on meant anything (§7).
- **Runs were amnesic and coverage unauditable.** Two briefs invented a "checked and clear" section the template lacked, and a plan item asked the next audit not to re-derive something the skill could not read (§6, §11).
- **The issue map was wrong.** A third "quality" label mapped to a label the host reserved for something else (§13).
