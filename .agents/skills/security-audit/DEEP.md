# Deep scan procedure

Read this file only in `deep` mode. A Deep scan does everything `full` does, then builds, runs and probes the repository's own code inside a closed, disposable sandbox, to reproduce its Medium+ findings and to find more along the Threat pack's attack paths. The `agent-kit deep-scan` launcher starts that sandbox, puts you and a copy of the repository in it, and lets only the report out.

Report shape: [report-format.md](report-format.md), with its `deep` additions. Everything in [SKILL.md](SKILL.md) still holds: the evidence classes, the Medium floor, Private delivery and the contract rules.

## Hard rules

1. **Never deliver.** Inside the sandbox you may craft inputs and send them to the running code. Nothing runnable leaves it: no payload, script, request body or step-by-step recipe goes into the report or the draft advisory, not even privately. The test: a maintainer can understand the finding and check a fix from the report, but cannot paste any of it into anything.
2. **The Observation boundary.** A reproduced finding carries a prose Observation. It names the location, the attacker's position, the kind of input in words and the effect seen. It never holds payload values, encoded strings, exact requests, command sequences or timing tricks.
3. **Only the report leaves the sandbox.** Your transcript, shell history, app logs and scratch scripts stay inside it and are destroyed with it. Write nothing you want kept anywhere but the report.
4. **No web tools.** Do not use WebFetch or WebSearch, even where they seem available: a search query shaped by a finding discloses it before Private delivery. Your grounding is the Scan recipe's grounding sources, which the launcher copied in, or fetched on the host, before you entered, at `/agent-kit/grounding`, plus the repository at `/workspace`.
5. **Reproduction never changes severity.** The scale and the Medium floor mean what they mean in `full`. A reproduced Low is still dropped, and an unreproduced Medium+ finding is still reported.
6. **Probe only the Consumer's own code, running inside the sandbox.** Never a deployed, production or third-party system.
7. **No auto-fix.** As in every mode, do not open fix PRs.

## Scope

The whole repository at the default branch, optionally narrowed by path or attack path, like `full`. A scan runs on the trusted ref only, never a pull request head; the launcher copies that ref in, so scan what you were given. The one exception is a Verification run, which runs on a ref the maintainer chose (see [Verification run](#verification-run)).

## Procedure

1. Confirm you are inside the launcher's sandbox. The launcher starts the run in its sandbox and hands you this procedure, the Threat pack and the Scan recipe in its brief. If you have no such brief, for example because `deep` was invoked from an ordinary Claude Code session, you are on the host: build, run and probe nothing, say that a Deep scan runs only through `npx @mnaimfaizy/agent-kit deep-scan` (or the CI deep-scan workflow), and stop. Never trust a check of your own to decide you are sandboxed: what the target runs can fake it, and only the launcher, outside the sandbox, chooses the boundary.
2. Read the Threat pack and the Scan recipe. The Threat pack (threat model and findings ledger) is found as in `full`, and the brief may inline it. From the Scan recipe, read its entry points (each with its note), its fixtures (test users, roles and similar, with fake values), its grounding sources, already at `/agent-kit/grounding` (the brief names where each one is), and its notes on what stays static-only. Write the report to `/agent-kit/out/report.md`. The launcher has already run `setup`, `seed`, `start` and `ready`; do not run them again.
3. Run the `full` walk: the static procedure in SKILL.md, over the same scope, keeping every reachable Medium+ candidate. A Deep scan never sees less than `full`.
4. Attempt a Reproduction of each candidate, through the Scan recipe's entry points and fixtures. Record `Reproduced: yes` with an Observation, `no` with a one-line reason, or `not attempted` with why not (for example, no recipe entry point reaches it).
5. Probe further along the Threat pack's attack paths, only against the Scan recipe's entry points, for bugs the static walk missed. Never probe a deployed, production or third-party system, and nothing the recipe's notes keep static-only. A new Medium+ finding joins the report with its Reproduction.
6. Write the report early and update it as each finding lands. A limit may end the run at any time, and the launcher then delivers the report as it stands, so a finding that is not yet in the report is lost. Trace each finding to a `file:line` Location. When tracing fails, the Location is the entry point, and `Notes` says the code site was not pinned down. Put a question you could not settle from your own knowledge and the repository under `Open questions`, phrased so the maintainer can answer it by adding grounding. Never write the `Stopped:` line: the launcher adds it.

## Findings ledger

Deep and static runs share one concept-id space. A finding that matches a ledger row reuses that row's concept id.

- An open concept: skip it as a finding. Say in the report's `Notes` whether it reproduced, as evidence for the response under way.
- A `rejected` or `accepted-risk` concept: report it again only when reproduced, marked as reopening that decision.
- A fixed concept: report it again only when reproduced, as a regression.

The public findings ledger gains nothing from a Deep scan: no field or flag says which concept reproduced. Only triage updates the ledger, as in `full`.

## Verification run

The launcher may instead hand you a finding file, for a Verification run on the maintainer's fix branch. It is confirm-only. Run steps 1 and 2 of the procedure as written, so a Verification run never runs from the host either. Then, instead of steps 3 to 5 (no `full` walk and no exploration), for each finding in the file (concept id, Location, Observation), re-attempt its Reproduction and report `Reproduced: yes` (the fix does not hold) or `no` (it holds), each with a reason, in the Verification-run variant of the report format, written early as step 6 says. Report no new findings. The report stays on the maintainer's machine: no advisory, comment or ledger note.
