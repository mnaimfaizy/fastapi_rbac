# Orchestrate design

Why the skill is shaped the way it is. The skill carries this file so its rules keep their reasons in any repository it is copied into. Load it when changing the skill, or when a rule in [SKILL.md](SKILL.md), [SPEC.md](SPEC.md), [TEAM.md](TEAM.md), [BRIEF.md](BRIEF.md), [RUN.md](RUN.md), [HARNESSES.md](HARNESSES.md) or [CONFIG.md](CONFIG.md) needs its reason.

## Glossary

These are word for word the definitions in Agent-kit's root glossary, where a contract test keeps the two the same.

**Chief of Staff**: The session that runs `orchestrate`: it analyses the work, proposes the Dispatch Plan, hands out each Delegation, relays every Decision Request (or, in an autonomous run, makes a Ruling on those it may) and verifies every report, and never builds a Delegation's work or merges.

**Delegation**: One piece of a run, an issue to build, an issue to analyse, or a pull request head to QA, handed to one Executor with one brief.

**Executor**: What carries out a Delegation: a Live Session, a headless run, or a sub-agent in the Chief of Staff's own session.

**Harness**: The agent product a session runs in (Claude Code desktop, Claude Code CLI, Cursor, Codex CLI and the like), which decides how one session can start, message and wait for another; two versions of one product that behave differently are two harnesses.

**Support Level**: How far `orchestrate` has been proven on a harness or a tracker: verified (a full run passed), tried (a run happened, with known gaps) or documented (built from its documentation alone).

**Live Session**: A separate agent session the human can open, read and talk to while it works; always written in full, because a Session is a signed-in identity in a QA scenario.

**Brief Contract**: The eight items every Delegation's brief carries: what to read first, the goal and what done means, phases with explicit stop points, scope fences, the repository's command routes, the rules for writes, the Decision Request form, and the Delegation's report and log files.

**Decision Request**: A question a Delegation cannot settle from its brief, raised to the human through the Chief of Staff (or, in an autonomous run, answered by a Ruling), self-contained, with options, evidence and a recommendation.

**Ruling**: A Decision Request the Chief of Staff answers itself in an autonomous run, because the human handed it that kind at "go" and the evidence it cites picks one option; it stands until the Ruling Review.

**Ruling Ledger**: The ordered list of every Ruling in a run, each with its question, options, choice and evidence, kept in the run folder for the Ruling Review.

**Ruling Review**: The human's pass over a run's Ruling Ledger, in which each Ruling ends upheld or overturned; overturning one sends every Ruling that cited it back for review.

**Dispatch Plan**: The one table the Chief of Staff shows before any Delegation starts, giving each one's scope, Executor, model and wave, with the kinds of routine write the human may approve; one "go" approves it whole.

**Activity Log**: An append-only record of what was done in a run and why, kept by the Chief of Staff and by each Delegation in the run folder.

**Heartbeat**: A check on every Delegation the run waits on that comes again at a set interval, whatever happened since the last one, so that a run never waits on one signal alone.

**Foreground watch**: The Heartbeat on a harness with nothing to schedule it: the Chief of Staff keeps its turn open, waiting for a change in any Delegation or for a time cap, then waits again.

**Run Summary**: The account of a finished run, offered after the human merges, for the issue that groups the run's work.

**Ready to Merge**: A Delegation whose CI is green, whose review is settled, whose QA requirement is met on its current head, whose Rulings are upheld, and whose branch merges cleanly into the default branch as it now is, and is not behind it where the repository requires branches to be up to date, unless the human chose to merge it as it is; the only Delegations the closing list names.

**Team Run**: A spec run started with `--team`, in which each teammate runs their own Chief of Staff over the spec's tickets assigned to them alone, beside the others, and every one of them reads one Shared Board.

**Shared Board**: The board of a Team Run on the issue tracker: one row comment on each spec ticket, written only by its current assignee's Chief of Staff, and one state label mirroring its state; a published projection of each teammate's own run folder, never a store.

## A core plus a config

The rules of running work through other sessions (the roles, the board, the Brief Contract, the loop, the authority limits) hold in any repository. The routes do not: one repository commits through a skill, another through a hook, a third by hand; one re-gates with a test suite, another has none. So the skill is a core that names no repository command, skill, label or path, and a config file that names them all. A rule in the core never has to be read around a repository's habits, and a repository adopts the skill by writing a file, not by editing it.

## The Chief of Staff never builds

A session that both builds and verifies a piece of work has a reason to believe its own report. Keeping the Chief of Staff to planning, delegating, relaying and checking means every report is read by someone who did not write it. It also keeps the Chief of Staff's context free for the whole run: a session deep in one Delegation's code loses track of the others. The rule holds most on a harness with no way to start another agent, where the easy path is to do the work in the same session.

## Authority

Merging, force-pushing, changing repository settings, and destroying a branch, worktree or checkpoint are the actions that cannot be taken back, or that change what other people see. They need the human's yes, one action at a time, because a run is long and a yes given early is easily stretched over work it was never about.

A Delegation may push its own branch, open its own pull request and reply on its own review because that is the work it was given, and its pull request is visibly the agent's. Any other write as the human (a comment on an issue, a new issue, a label, a closed issue) speaks for them in a place others read as theirs. So it is drafted and raised. Routine kinds can be approved once in the Dispatch Plan, because asking about every label change would bury the questions that matter.

## One plan, one go

The human approves scope, Executor, model and wave for every Delegation in one table, because that is the decision that commits the run's cost and the human's attention. A change to any row is a new plan, shown again: a "go" given to one plan is not a "go" to another. Adding `go` to the invocation skips the wait for a run the human already trusts, but never skips a Decision Request that analysis raised.

## Readiness by triage role

An issue built before its design is settled produces a pull request that answers the wrong question, and the review then argues about the design. So readiness comes from the triage role the repository already gives the issue, and only `ready-for-agent` is built. Every other role is analysed, listed, or skipped. The skill speaks in the five canonical roles and reads the labels from the repository's own mapping, because label strings differ between repositories and the mapping is already written down; restating it in the skill would make a second copy to drift.

## Waves, overlaps and blockers

Two Delegations that change the same files in parallel produce two branches that conflict, and the second to merge must redo work. Two that hold the same shared resource (a database, a port) break each other's runs in ways that look like flaky tests. So neither shares a wave. A Delegation that waits for another, by overlap or by a blocking issue, starts only once that one is merged, so it is built on the code it will merge into. The limit on concurrent building Delegations exists because each one asks for the human's attention, and attention does not scale with sessions.

## The Brief Contract

An Executor knows only its brief. Each of the eight items closes a gap a Delegation would otherwise fill by guessing: what to read, what done means, where to stop, what not to touch, how this repository commits and opens pull requests, what it may write as the human, how to ask, and where to put its report. Explicit stop points let the Chief of Staff check work at known places rather than at the end. Every building brief ends with a review of its own diff before the final commit, because a finding fixed before the pull request costs a commit, and one found after costs a round of review.

## Decision Requests are self-contained

The human answering a question is often away from the Delegation that asked it, and may answer from a phone. A question that says "see above" makes them open the session, read its context and reconstruct the choice. So a Decision Request carries its own context, options, evidence and a recommendation: the human can answer from it alone, and the recommendation means the answer can be one word. The answer is recorded where a reviewer of the pull request will see it, because a reviewer who cannot see why the work went one way will ask the same question again.

## Rulings, under review

A long run with the human away stalls on every question, and most of the questions are ones the evidence already answers: how to build within a settled issue, which branch merges first, whether a QA FAIL is the change or the stack. So in a run the human starts with `go autonomous`, the Chief of Staff answers those itself, as Rulings, and the human reviews each one before anything merges.

The line between what it may rule on and what stays the human's is reversibility. A Ruling's result is a commit on an unmerged branch, which an overturn undoes with another commit. A wider scope fence, an accepted FAIL, a write in the human's name, or a choice among an analysis Delegation's options cannot be taken back by the review, or changes what the human approved at "go". So those still wait for the human, and only their own Delegation waits with them.

A Ruling needs evidence that picks one option, cited so that it can still be checked after the branch has moved, because the review happens after the run and "it seemed reasonable" cannot be reviewed. The Ruling Review comes before Ready to Merge, because an overturn before the merge costs a commit, and after it a new issue. A Ruling that cited an overturned one is reviewed again, not overturned with it, because it may stand on other evidence. Authority is not ticked per kind, as routine writes are: one fixed split keeps the plan to one checklist until a run shows it needs more.

## Verify every report

A Delegation's report says what it believes it did. A branch that was never pushed, a check that is still running, a review comment marked handled that was not: each reads as done in a report and is not. So the Chief of Staff checks every claim against git, the tracker and CI before it tells the human anything, and re-gates in its own worktree, so a dirty working copy in the Delegation's cannot make a command pass.

## Stalls and crashes

A Delegation that has stopped making progress looks the same as one doing slow work, from outside. The Chief of Staff reads its Activity Log and branch before deciding which it is, nudges once, and raises it to the human if the nudge does not help: one nudge catches a Delegation waiting on something it forgot to ask for, and a second would only repeat it. A crashed Delegation's branch holds work no one else has, so it is kept as the handoff, and nothing about it is destroyed without the human's yes.

## Conflicts before the merge order

Two branches can each merge cleanly into the default branch and still conflict with each other. A merge order found only by merging would leave the human mid-sequence with a conflict to resolve. So the Chief of Staff test-merges the finished branches in the proposed order, without touching any checkout, and changes the order, or has one branch merge the default branch after the other lands, before it hands the order over. A merge, not a rebase: rebasing a pushed branch needs a force-push.

## QA on the head that merges

The first real run of this skill reached "almost Ready to Merge" with no QA at all: the readiness check only asked whether a QA Report existed, and nothing in the run made one. So QA is a stage of the run, not a precondition someone else meets.

It comes last, after review is settled, CI is green and the branch merges cleanly, because each of those can move the head, and a QA result is about one commit. A review fix that lands after QA leaves a report about code that will not merge. So any push voids the result, and the new head is QA'd again. Conflicts are found before QA for the same reason: the merge commit that resolves one is a new head.

QA is a Delegation of its own, not the building Delegation's last phase. A session that built a change has a reason to believe it works, as the Chief of Staff would about work it built itself. A separate Executor, in a working copy detached at the verified head, tests what the pull request holds, not what the builder's worktree holds. The QA skills (`qa-plan` and `manual-qa`) are named by the core, not the config, because the core reads what they produce: the plan's Head and the report's rows. A different skill would produce something the core cannot check.

Outside an autonomous run, those skills are invoked only by a person, and stay so: their rules ("the person has seen the draft", "post only on a yes") assume one, and making them model-invocable would undo that for every user, not only in a run. So a QA Delegation's session is sent each skill as a message where the harness runs that as the user's own invocation, and otherwise the human types it there, as the Dispatch Plan says up front, with the exact command. In an autonomous run the human has already handed the Chief of Staff the questions those rules wait on, so typing each command would keep a person at every QA step of a run meant to go on without them. There the QA brief carries each skill's `SKILL.md`, as the CI reviewer's brief carries `code-review`, and each skill's own "Run from an autonomous brief" section says what replaces each wait, since only the skill knows where it waits. A hosted (`url`) target stays on the typed route: its host and role test values must come from a person, and a brief cannot carry either.

The readiness question is asked once, in the Dispatch Plan, because otherwise each QA session asks it: in one run, the human answered it six times. Its answers are facts about the repository, which only the human knows, so they are never a Ruling. They hold for the base branch they were given for, since an answer can name the base the plan is composed against. The QA Plan's delivery is always a Decision Request carrying the draft, because the plan is a judgement about what CI does not prove, and the human is the one to agree with it before anyone runs it. Posting the report can be approved once for the run, because by then the judgement has been made and the report only records it.

A FAIL goes to the human, never straight back to the builder: a FAIL can be the QA Stack, not the change, which is why QA Plans list red herrings. A scenario left for a person stays the human's to pass, because only a person can pass one. The QA Stack is one per machine, with fixed names and ports, so it has one holder at a time whether or not the config names it.

## The scope fence binds every change

In the first run, a fix for a review finding, relayed by an automated fixer, was committed outside the Delegation's scope fence without a question, and was found only by diffing the new head. A fence that holds for the Delegation's own plan but not for what a reviewer asks for is no fence: reviewers ask for exactly the changes nobody planned. So the fence covers every change on the branch, and step 7 checks the diff against it.

## Ready to Merge, and no further

The closing list means something only if every item on it can be merged now: green CI, a settled review, the QA the repository requires, and a clean merge into the default branch as it now is. The skill stops there and prints the merge order and, when the config names one, the merge command, because merging is the human's act: it is the point where the work becomes theirs, and a merge train that merges on their behalf takes that from them.

## The default branch, checked on the human's return

A row verified against the default branch can stop being Ready to Merge without anything in the run changing: a merge from outside the run, or the human's own merge of the row before it, moves the tip. Under a rule that requires branches to be up to date, the row is then behind, and GitHub will not merge it; without that rule, it may still merge into code it was never tested with. In the first run that met this, the default branch moved three times while rows waited, and the Chief of Staff caught each case by hand. So a row is checked against the tip as it is now, and the merge result is re-gated whenever the tip has moved, strict rule or not, because two changes that each pass can fail together.

The check runs when someone is about to act on the list: at close-out, on `--status`, on `--resume`, and when the human says they merged a pull request. It is not kept on a heartbeat. While only the human's merges are left, the tip moves when the human, or someone outside the run, merges, and a heartbeat would spend a turn every few minutes, for hours, finding nothing the human is not about to look at. Checking on the human's return catches every move that matters, since a stale row matters only when someone reads the list. For the same reason, when more than one row is listed, the merge order asks the human to merge one at a time and say so, so the next row is checked against the tip their merge made: waiting to see a row `BEHIND` first would mean the first merge is already done.

Whether the repository requires branches to be up to date is read from the pull request's `mergeStateStatus`, not from its rulesets or branch protection: GitHub has already applied whichever of them holds, and reading them would mean knowing every way a rule can be set. A behind row gets two options, and the cheaper one, merging as it is with the admin bypass, stays the human's even in an autonomous run, because it sets a repository rule aside.

## The run folder

A run outlives a session: usage limits end it, laptops close, and a run with blockers pauses for merges. So everything the run knows is in files in a gitignored folder: the board, both kinds of Activity Log, each brief and each report. `--resume` rebuilds the run from them, and checks every Delegation against the source first, because a board written before an interruption may be out of date. The board is rewritten whole and renamed into place, so an interruption mid-write leaves the last whole board. The folder is gitignored because briefs and logs quote issue text and command output the human has not chosen to publish. When it is not ignored yet, the skill offers to add it to `.gitignore` rather than write there first: adding the line is a change to the repository, so it waits for the human's yes, and the human commits it.

## Four verbs, three tiers

Harnesses differ in how one agent starts another: some start sessions the human can open, some start background runs to poll, some cannot start one at all. The skill body speaks only of `spawn`, `message`, `await` and `report`, and HARNESSES.md says how each works on each harness, so the body does not change when a harness does. Reports travel as files on every harness, so the verbs only carry signals. And no signal is trusted alone. A harness's wake-up is a turn-end, not a finished report: it comes at most once per turn, which can be before the report is final. It does not come for a Delegation stuck on a prompt, or for a wait on CI that ends with nothing found. In one run, the Chief of Staff sat idle in each of those ways while the human was away. So `await` pairs the harness's event with a heartbeat that re-arms itself, every wake-up is read as "something may have changed", and a report says whether it is final. The cost is a short turn every few minutes; the alternative is a run that stops without anyone knowing. Facts about a harness are dated and marked when unconfirmed, because a harness changes faster than the skill, and a guessed flag fails at the worst moment of a run.

Each harness has a file of its own, and a run loads only the one it is on, so a run on one harness carries none of the others' facts. The run finds its harness, from the environment and its own tools, rather than trusting the config alone: the same repository is opened in one harness one day and another the next, so a config value goes stale, while a guess sends every Delegation down the wrong route. So the config may pin the harness, and a disagreement is a question, never a choice the run makes. Each harness carries a **Support Level** because "documented" and "proven" fail differently: the first Cursor run followed a harness description no run had tried, and invented what it lacked. Below `verified`, the human sees the level and the harness's limits before the "go", and a level rises only on a run's evidence. Executors may run on another harness because one harness's headless run can carry a run whose own harness cannot yet; it is not the default, because it needs a second CLI signed in and a second set of model names.

## The config reader

The skill imports only Node built-ins, and Node ships no YAML parser, so `config.mjs` reads JSON whole and YAML in a small documented subset. Anything outside the subset, any unknown key, any key written with no value, and any wrong shape is a **problem**, named with its line in either dialect, never a silent default: a typo in a route would otherwise send every Delegation down the default one, and nothing would say so. A document the brief sends every Delegation to must be there, for the same reason. Missing values are asked for, not assumed, and the answers are kept in the run folder so a resumed run reads the same ones.

## Spec mode is a file of its own

Most runs are a set of issues, and an agent reads every line it loads. So spec mode lives in SPEC.md, loaded only for `--spec`, and a run on issues carries none of it.

A spec arrives in one of three shapes, and each is planned from what is already written. Tickets under a spec, with their blocking edges, are a breakdown the human has published and reviewed, so the waves follow the edges and nothing is re-planned. Phases in a spec's body are a breakdown too, but only in prose: they run in the order written, because that order is the only dependency the author stated, and a phase's own text is its spec, because rewriting it into a brief would be a second spec to drift from the first. Publishing the phases as tickets makes the tracker show the breakdown the run uses, but it is a set of new issues in the human's name, so it is drafted and asked for. A spec with neither has no breakdown at all, and inventing one would be building on an unsettled design: so it gets a Decision Request and no Delegations.

## Two landings

A spec's tickets can land two ways, and neither is right for every repository, so the plan asks, or the config says which.

**An integration branch** suits a spec whose parts only make sense together, or a repository that reviews a feature whole. Every ticket is built on the tickets before it without waiting for the human to merge, and the human reviews one pull request. Each ticket branch is cut from the integration branch so it is built on the work it lands into, and fast-forwarded back in plan order so the branch's history is the plan, and so a ticket that finished early never lands before the one it builds on. A fast-forward that is not one would mean rewriting a branch, so a ticket that no longer descends merges the integration branch first. The branch is re-gated at each fast-forward because two tickets that each pass can fail together, and finding that at the ticket that caused it is cheaper than finding it in the final pull request. The re-gate runs on the ticket's head before the branch moves: a fast-forward makes that commit the new head, so it is the same check, and a ticket that fails never enters the branch, so nothing has to be moved back, a resumed run can trust that every ticket in the branch passed, and a pushed branch never needs a force-push. The cost is that CI sees nothing until that pull request, so the re-gate commands are the only check on each ticket, and the review at the end is large.

**One pull request per ticket** suits a repository that reviews in small pieces, or a spec whose tickets stand alone. Each ticket is reviewed and merged on its own, with CI on each. A later wave waits until its blockers are merged, for the same reason a blocked issue does: it is built on the code it will merge into. The cost is the human's time between waves, which is why the run parks and continues with `--resume` instead of keeping the Chief of Staff's session open.

## The integration branch stays local

An integration branch holds unreviewed work from several Delegations. Pushed, it is public to everyone who can read the repository until someone deletes it, and a deleted branch can still have been fetched. Executors in worktrees of the same repository share its branches without a push, so most runs never need one. An Executor that works from a clone does, and that is the human's choice to make, knowing what becomes public, not the Chief of Staff's: so it is a Decision Request that says so, and the yes covers that branch only. Opening the final pull request pushes the branch too, so it is asked for in the same way.

## Team Run

A team that splits a spec's tickets wants each person to run their own, side by side, and to see where everyone's tickets stand. A single-person run cannot give that: its board lives in a gitignored folder on one machine. So a Team Run is federated. Each teammate runs their own Chief of Staff, on their own machine and harness, over the tickets assigned to them alone, and no session drives another person's machine. There is nothing to join, and the tracker's assignee is the only sign of whose ticket it is, because it is already where the team decides that. A Chief of Staff never sets it.

The Shared Board is one row comment per ticket, written only by the Chief of Staff of that ticket's current assignee, with a state label mirroring the row. Neither GitHub nor GitLab locks a comment, an issue body or a label against a second writer: the last write wins, with no error to the loser. A board in one place would lose rows silently whenever two teammates wrote within one read and write, so the board is cut so that no two teammates ever write the same value ([ADR 0014](https://github.com/mnaimfaizy/agent-kit/blob/main/docs/adr/0014-a-team-runs-shared-board-is-one-single-writer-row-per-ticket.md)).

The board is a projection of each teammate's run folder, not a store that replaces it. The run folder is gitignored because briefs and logs quote issue text and command output nobody chose to publish, and on a public repository the Shared Board is the open web. So a row carries only fields and text written for publication, and the run's state stays where `--resume` and verification already read it ([ADR 0015](https://github.com/mnaimfaizy/agent-kit/blob/main/docs/adr/0015-the-shared-board-is-a-published-projection-of-each-local-run-folder.md)). Writing it is one routine write, approved at "go" for the teammate's own tickets, and the plan says when the repository is public, so nobody publishes to the open web without seeing that first.

A Team Run lands one pull request per ticket. An integration branch would have to be pushed and shared between teammates to hold their work together, and a ticket that blocks a teammate's would have nowhere to land for them. A pull request per ticket gives each teammate's ticket its own merge, which is the one event every other teammate can read: a ticket blocked by a teammate's waits for that merge, as a blocked issue waits in any run.

A ticket with no assignee, or with two, is run by nobody. Guessing an owner would put two Chief of Staff sessions on one branch, or none on a ticket somebody thought was theirs, and the fix is one click on the tracker by the people who know.

The tracker is reached through a short list of operations, named in TRACKERS.md and each mapped in its own file under `trackers/`, as HARNESSES.md names the verbs and each harness has its file under `harnesses/`. Only the Team Run's parts speak of them; the rest of the skill stays bound to `gh`, since a tracker-neutral core is more than a Team Run needs. Detection reads the git remote's host because that is where the tickets live, and a pin that disagrees is a question: either could be the mistake, and a run on the wrong tracker reads the wrong tickets.

Like spec mode, the Team Run is a file of its own, TEAM.md, loaded only for a Team Run (`--team`, and `--status` or `--resume` of one) and for `--status --spec <n>`, so a single-person run reads none of it.

## Seams

The config reader checks each top-level key with its own function in one table, `SECTIONS`. A mode that needs keys of its own adds its section there, and its own reference file beside SKILL.md, loaded only when that mode is invoked, as spec mode adds `spec` and SPEC.md. An argument this version does not know stops the run before anything is read, so a newer invocation never runs on an older skill as if it were a set of issues.
