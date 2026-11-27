---
name: explainer
description: "Explainer Page for a complex part of a system — a diagram, animated walkthrough, or reference page a reader can learn from or review a change against. Writes a brief that fixes the audience, the one question, and every fact (cited to source when the subject is code, from an interview when it is not), then hands it to a builder that produces a self-contained HTML page. Use when someone asks to explain, diagram, map, visualise, or walk through how something works."
metadata:
  agent-kit-scope: user
---

# Explainer

An **Explainer Page** is a self-contained HTML page that lets a named reader answer one question
about a system from the page alone. This skill produces one in two roles, kept apart on purpose:

| Role                      | Who                            | Owns                                                      |
| ------------------------- | ------------------------------ | --------------------------------------------------------- |
| **Brief** — what it says  | You, following this file       | Audience, the one question, the hero, every fact, scope   |
| **Build** — how it's made | A builder following `BUILD.md` | Markup, theme, accessibility, motion, self-checks, report |

Write the brief. Do not write the design. If you find yourself choosing colours or laying out a
diagram while briefing, you have left the brief role. The split exists because each role fails
differently: a briefer who designs pads the brief with art direction, and a builder who sources its
own facts ships plausible numbers nobody checked.

## Consumer configuration

Read `docs/agents/explainer.md` in the repository if it exists. It may set:

| Key              | Meaning                                                                 | Default                      |
| ---------------- | ----------------------------------------------------------------------- | ---------------------------- |
| `Output dir`     | Where pages are written                                                 | `docs/explainers/`           |
| `Reference page` | An existing page the builder reads for house shape                      | none                         |
| `Gate command`   | A command that checks a page; `<path>` is replaced with the page path   | none                         |
| `Font source`    | A command or file that yields the canonical `@font-face` block          | none (system font stacks)    |
| `Drift-proofing` | `off`, `manifest`, or `manifest+anchors` — see `ANCHORS.md`             | `manifest` on grounded pages |
| `Builder agent`  | A named sub-agent that already carries `BUILD.md`'s conventions         | none                         |
| `Register step`  | Anything a new page must be added to (an index, an ignore file, a list) | none                         |

If the file does not exist, use the defaults and say so when you hand over. Do not create it
unasked.

## Use this skill when

- Someone wants a diagram, walkthrough, architecture map, or explainer page.
- Someone wants a brief for a visual rather than the visual itself (stop after step 5).
- An existing page came back thin, wrong, or confusing and needs a corrective brief.

## Core rules

- **A brief without a stated audience and one question is not finished.** See step 1.
- **Every factual claim is traceable.** Grounded: a `file:line`. Ungrounded: an assumption the user
  stated, labelled as one.
- **Run the collision check** on the grounded branch (`GROUNDING.md`). Skipping it is how a wrong
  constant reaches a page readers then trust.
- **Give the builder facts, constraints, and the one question — then get out of the way.** No
  visual instructions it is better placed to choose.
- **Anti-goals are where scope is bought back.** Do not let the brief grow a section per idea.
- **State no claim the page cannot back.** See _Which facts go in_ below.

## Workflow

### 1. Fix the audience, the one question and the page shape

Write this sentence before anything else:

> A **[reader]** should be able to answer **[question]** from the page alone.

Examples that worked: _"An engineer new to this repo should be able to answer: if I ask for a new
UI component with tests, which agents run and who can reject whom?"_ and _"A developer should be
able to answer: if I add this API call, does it cross the trust boundary?"_

The reader is a variable, not a fixed audience. Onboarding is one use; reviewing a pull request
against the page, and consulting it as a security or operations reference, are others. If you
cannot write the sentence, you have a topic, not a brief — ask for the missing half. Every later
decision is judged against this sentence.

Then choose the **page shape** from the one question:

- **System stage** — the question is about a sequence that crosses **two or more components** (a
  lifecycle, a request flow, a pipeline across services). The stage is the hero, and the reference
  sits below it on the same page.
- **Scene stepper** — the sequence happens inside **one component** (a state machine, one
  algorithm). It is the stage's single-zone variant.
- **Static** — the subject is a structure, not a sequence (a map, a trust boundary, a dependency
  graph).

The rule: a question about a sequence is a stage when the sequence crosses two or more components,
and a stepper when it stays inside one. A question about a structure is static. Write the choice in
the brief as `Shape: system stage`, `Shape: scene stepper` or `Shape: static`. Only the user may
override it; if they did, say so in the brief. The builder never changes it. For a stage or a
stepper, read `STAGE.md` (beside this file) before you draft.

### 2. Choose the branch

Ask: **is there a source of truth that could prove this brief wrong?**

- **Yes — grounded.** Code, schema, config, logs, an API contract. The failure mode is _wrong_
  facts. Go to 3a.
- **No — ungrounded.** A concept, a pitch, a process nobody has written down. The failure mode is
  _vague_ facts. Go to 3b.

Mixed subjects are grounded: if any part can be checked against a file, check it.

### 3a. Grounded — do the legwork

Read `GROUNDING.md` (beside this file) and follow it. It is the long half of this skill and the
reason a grounded page is worth more than a template.

Documentation is a lead, never a citation. Docs describe intent; the page must describe behaviour.
Where they disagree, the source wins and the disagreement is a finding for the user.

### 3b. Ungrounded — interview until the abstractions have edges

The user is the only source of truth, so the brief is only as sharp as their answers. Push on:

- **The one question** — who reads this, and what does it settle?
- **The concrete referent** — what is each element a picture _of_? "The user journey" is not an
  answer; "signup through first successful invoice" is.
- **The failure it prevents** — what does someone get wrong today, and what does it cost?
- **What it is not** — the fastest way to find the edges of a fuzzy request.
- **Scale and shape** — how many things, steps, states. "Seven scenes" or "nineteen agents" lets the
  builder compose; silence makes it guess.

Record the answers as **stated assumptions**. Nothing here can be cited; say so plainly.

### 4. Draft the brief

Use the anatomy below. Cut any section that would be empty.

### 5. Verify the brief

Run the completion criteria at the end of this file. Hand-over without them is not hand-over.

### 6. Hand to the builder

Pick the first that applies:

1. **The consumer named a `Builder agent`** — dispatch the brief to it.
2. **Sub-agents are available** — spawn one with this prompt, filled in:

   > Read `<this skill's directory>/BUILD.md` and follow it exactly; for a system stage or a scene
   > stepper, also read `STAGE.md` there. Consumer configuration:
   > `<contents of docs/agents/explainer.md, or "none — use BUILD.md defaults">`. Target path:
   > `<output dir>/<slug>.html`. The brief follows. ⟨brief⟩

3. **Neither** — build it yourself from `BUILD.md`, after the brief is finished and verified. Do
   not revise the brief's facts while building; if one turns out wrong, stop, fix the brief, and
   say so.

The builder's conventions live in `BUILD.md` rather than in the brief so they arrive whole every
time instead of being re-derived per dispatch — re-derivation is how a correct-everywhere pattern
that is wrong for these pages (see the tooltip rule in `BUILD.md`) ships unnoticed.

### 7. Read the builder's report

Check its **Gate**, **Verified how**, **Contradictions found**, and **Left for the caller**
sections. Relay contradictions and anything left open to the user. A contradiction marked as a
brief error means a fact in your brief is wrong and the page renders source instead. Either fix the
brief and rebuild, or accept the source rendering. Either way, tell the user which fact was wrong,
what source says, and which you chose. A brief error against a platform rule (a browser, protocol
or runtime rule, not a line of source) is handled the same way: fix the brief and rebuild, or accept
the platform-correct rendering, and tell the user which fact was wrong, the rule it breaks with the
builder's citation, and which you chose. A rule the builder marked **unverified** reaches the user
as unverified, never as settled, and the page marks it unverified too; if you accept the rendering,
that mark stays. A report claiming a visual review the builder could not
perform is a defect in the report — say so.

## The brief anatomy

In order. Cut any section that is empty; never invent filler.

**What I want.** The page, its shape from step 1 (`Shape: …`, and who chose it), and its hard
constraints. Default contract: one self-contained HTML file, no CDN, no external assets, no network
at load, correct in light and dark. On a static page, interactivity has to earn its place; a static
page is smaller and easier to keep true. A system stage or scene stepper is interactive by shape,
under the stage contract in `STAGE.md`.

**Why this exists.** The concrete failure the page prevents, not the topic it covers. "An engineer
adds a convenience endpoint and quietly moves plaintext across a line they could not see" produces
a far better page than "document the vault architecture". This is what makes the builder choose
the right hero.

**The system in one sentence.** If it takes two, it is probably two pages.

**The hero.** What must be visually obvious above everything else, and why it is the spine rather
than one element among many.

**Supporting panels.** One idea each. Name what each panel settles. On a system stage or scene
stepper these are the reference panels below the story; see the readability rule under _Splitting
one brief into two_.

**The stage (system stage and scene stepper only).** On a stage, the hero is the stage itself.
These sections give the builder everything it draws and plays. Every beat fact is cited like any
other fact.

- **Components (zones):** for each, an id, a label, a shape idea, the live state shown inside it,
  and citations. A scene stepper has one.
- **Edges:** which zones talk to which, and any edge a message must pass through (for example, SPA
  to API always through the HTTP edge).
- **Chapters**, in order: an id, a title, the question it settles, and its end state.
- **Beats** for each chapter: `from` and `to` zone (or `in` for a local change), a caption of 15
  words or fewer, the state delta, refs, and `derived: true` for a beat inferred from code rather
  than read directly.
- **Halts:** where the real process waits on a person or an outside action, and the gate action's
  label.
- **Inspector content:** what each message, state entry and record shows when opened.
- **Expected state** at each chapter end, so the builder can assert it.
- **Predict checkpoints** _(optional)_: only at decisive moments. Where, the question, three
  choices, the correct one, and one line of why.
- **Sandbox** _(optional)_: only when the rules are worth driving. The actions, the rule each
  follows, and the disclaimer text, which the page must show.

You decide whether there are checkpoints and a sandbox. The builder never invents them.

**Visual guidance.** Only what carries meaning: what must be distinguishable from what, what must
dominate, what must not rely on colour or motion alone. Do not art-direct.

**Anti-goals.** What this is not. Always include: the page is for human readers; machines read
the manifest, and reading experience is never traded for machine consumption.

**Facts (grounded).** Each claim with its scope and `file:line`, in the form `GROUNDING.md` step 5
produces. Complete enumerations, or subsets labelled as subsets.

**Assumptions (ungrounded).** Each stated assumption, labelled.

**Drift-proofing (grounded).** Unless the consumer turned it `off`: the manifest requirement, and
the citation-anchor requirement if configured. See `ANCHORS.md` for what to ask for.

### Which facts go in

A page states no claim it does not back. The test is whether a fact is _assertable_ — could a
check read it from the tree? If yes and it matters, the manifest carries it. If it is assertable
but not worth checking, **do not print it unchecked — state less.**

Prefer a universal claim to a counted one: _"every CI job pins Node `22`"_ beats _"14 CI jobs pin
Node `22`"_. The universal is the stronger claim and stays true as jobs are added; the count is the
half that drifts — one page said 14 while the tree held 18, for two weeks, with nothing noticing.
A count the brief asks for is a count someone has to keep true.

## Two devices worth requesting

**The reading test.** One line that turns the page from a poster into a review tool: _"if your
change adds an arrow leaving Zone A, it may carry ciphertext or metadata — nothing else."_ Ask for
one in every brief. It is what makes a page usable in a pull request.

**The halt.** If the page steps through a process that pauses for a human in real life, the page
pauses too and cannot advance past that point without an explicit action. An animation that
glides through a blocking gate teaches the opposite of the truth.

## Splitting one brief into two

A story on top and its reference below is **one** page: that is the system stage's shape. Split
only when the story cannot be read without the reference first, or when the two answer different
questions. Symptoms: the hero needs a legend before it can be read; the page opens with a wall of
constants before any narrative; one column has to show two opposite directions of flow.

When you split, propose two pages and say which is which. Do not write one brief that tries to
answer both questions.

**Reference panels are for reading.** The story carries the narrative. Reference panels are
bullets and tables, one claim per sentence, collapsed by default under one "Expand all", and
printed expanded.

## Completion criteria

State the branch you took when handing over.

Both branches:

- [ ] The audience-and-one-question sentence is written and appears in the brief.
- [ ] The brief states its shape (system stage, scene stepper or static), chosen by the step 1
      rule or by the user, and says which.
- [ ] Every anatomy section is present or deliberately cut.
- [ ] Anti-goals are stated.
- [ ] The brief specifies the page, not the aesthetics.

System stage and scene stepper, additionally:

- [ ] Zones, edges, chapters, beats, halts, inspector content and the expected state at each
      chapter end are present.
- [ ] Every beat has a route (`from`/`to` or `in`), a caption of 15 words or fewer, a state delta
      and at least one ref, and every `from`/`to` pair is a listed edge.
- [ ] Predict checkpoints and a sandbox are present only where you decided on them, and a sandbox
      has its actions, their rules and the disclaimer text.
- [ ] Reference panels follow the readability rule.

Grounded, additionally:

- [ ] Every number, identifier, and error code is traced to a `file:line`.
- [ ] Every cited constant was searched repo-wide by exact name, sibling names, and the call sites
      that set or override it, and each distinct value is reported with its scope.
- [ ] Source was read directly; no claim rests only on documentation.
- [ ] The drift-proofing requirement is included unless configured `off`, with scope-qualified key
      names.
- [ ] Contradictions between docs and source, or between constants, were surfaced to the user.

Ungrounded, additionally:

- [ ] Every element has a concrete referent, not a category.
- [ ] Assumptions are labelled as assumptions.
- [ ] Scale and shape are stated.
