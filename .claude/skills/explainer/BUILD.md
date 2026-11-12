# Building an Explainer Page

Reached from `SKILL.md` step 6. You are the builder: you turn a finished brief into one
self-contained HTML page, and you verify it.

You do not decide what the page is for. That is the brief's job. If you find yourself choosing the
audience, inventing the hero, or sourcing a fact nobody asked you to render, you have left this
role — say so and stop.

## Input

1. **The brief** — your specification. Everything below is how the page is built; the brief is
   what the page says.
2. **The consumer configuration**, if given (`docs/agents/explainer.md`). It can name a reference
   page, a font source, a gate command, and a register step.
3. **The reference page**, if configured. Read one, for shape: the pre-paint theme block, the notes
   surface, the manifest. Not every existing page — they share a convention, not content.

A brief is usable when it carries the audience-and-one-question sentence and states its branch,
grounded or ungrounded. If it does not, return at once:

```
Builder: BLOCKED — the brief has no audience-and-one-question sentence.
Finish the brief first (explainer skill, step 1); I do not invent the question.
```

A grounded brief carries `file:line` citations. Those are the facts you render. Spot-check them
against source (see _Contradictions are findings_); do not go looking for more.

**The shape is the brief's.** The brief states `Shape: system stage`, `Shape: scene stepper` or
`Shape: static`; a brief that states none is static. Build the shape it states and never change
it. For a system stage or a scene stepper, read `STAGE.md` (beside this file) and its shape
example, `examples/system-stage.html`, before you write anything. Read the example for shape,
never for facts.

## Steps

1. Read the brief, the configuration, and the reference page if any.
2. **Fonts.** If a `Font source` is configured, splice exactly what it yields — never retype or
   re-encode it. Otherwise use system font stacks. A font that is not a `data:` URI is a network
   fetch and breaks self-containment.
3. Write the page to the conventions below, at the target path. A system stage or scene stepper
   also meets every point of the stage contract in `STAGE.md`.
4. Do the `Register step` if one is configured. A page left out of whatever the consumer's checks
   enumerate is unchecked.
5. Embed drift-proofing as the brief requires (`ANCHORS.md`). If the brief asks for a manifest and
   the consumer has no checker that asserts it, list that under _Left for the caller_ — a manifest
   nothing reads asserts nothing.
6. Run the `Gate command` if one is configured and report its output verbatim. If none is, run the
   self-checks under _Verified how_. For a system stage or scene stepper, also run the _Stage
   checks_, gate or no gate.
7. Report in the format at the end.

## Conventions

These are the rules every earlier build had to be taught. Each is here because its absence
produced a specific failure.

**Self-contained.** No CDN, no `<link>`, no `@import`, no `fetch`, nothing loaded at open. Pages are
read from `file://`, from sandboxes, and from opaque origins. Fonts and images are `data:` URIs.
XML namespace URIs are declarations, not fetches, and are fine.

**Accessible naming without the tooltip.** A `<title>` as the first child of a root
`<svg role="img">` is textbook accessible-name practice and is wrong here: browsers also render it
as a native tooltip covering the whole canvas. One page shipped that way, over a 1264×1810 diagram,
with every shape showing the same generic sentence, and a user had to report it. Use `aria-label`
for the name and `aria-describedby` → `<desc>` for the long description; neither renders a
tooltip.

**Notes live in the document, not in the shapes (static shape).** Per-element explanations go in a static
"Diagram notes" list with `id="note-<key>"`. The shape carries `data-tip="<key>"` and
`aria-describedby="note-<key>"`. One shared popover surface (`popover="manual"`), opened by hover,
click, and `:focus-visible`, reads its text from that list and never holds a copy. The list is what
a reader with no pointer, a screen-reader user, and a reader printing the page actually get. A shape
with nothing specific to say carries no `data-tip`: a generic tooltip is the defect, not a smaller
version of it. Every `data-tip` has its note, and every note has its shape.

A system stage or scene stepper keeps the rule's aim, not its mechanics. Per-element detail lives in
the static HTML, never only in a shape or in script, but the inspector replaces the popover. The
static beat log and a static list of the state records stand in for the "Diagram notes" list, and
`data-tip` is not used. See `STAGE.md`, _No-JS and print_.

**Theme tokens in three states.** The viewer's setting has three states, so the palette does too:

- bare `:root` — light;
- `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { … } }` — the system
  default;
- `:root[data-theme='dark']` — an explicit dark pin.

Skip the `:not([data-theme='light'])` guard and the system setting silently overrides an explicit
light pin. Give `body` an explicit background. Colours are tokens, never literals in rules.

**Storage always in `try`/`catch`.** `localStorage` throws `SecurityError` on an opaque origin, and
an uncaught throw in the pre-paint theme script kills the rest of that script — the page loads
unstyled. Falling back to the system theme is the right degradation; losing the page is not.

**Motion (static shape).** One entrance animation and one active-step marker are enough. Both
collapse fully under `@media (prefers-reduced-motion: reduce)`: nothing hidden, nothing animated,
every step visible. If the brief asks for a halt, the page stops at it and cannot be advanced
without an explicit action.

**Interactivity earns its place (static shape).** Add behaviour only where it settles something a
static picture cannot. A static page is smaller and has less to keep true.

**System stage and scene stepper.** These two rules apply to the static shape only. A stage or
stepper follows the stage contract in `STAGE.md` instead: its motion, transport, halts, inspector
and sandbox are the shape, not extras that have to earn a place.

**Layout.** Readable at phone width with no horizontal page scroll; a wide diagram scrolls inside
its own container.

**For humans.** Do not trade reading experience for machine consumption. The manifest is where
machines read.

## What you cannot verify — say so

Preview tools commonly serve `file://` pages as static snapshots on an opaque origin, and
screenshots of them are unreliable. Unless you have actually looked at a rendered page, **do not
claim a visual review.**

What you can do, and should: measure. Query the DOM, read computed styles and geometry, and assert
— that each label fits its box, that both themes resolve every token, that every `data-tip` has a
note and every note a shape, that no element references a remote URL, that the manifest parses.
Then name the checks you ran. A report that names its measurements is trustworthy; a report
claiming a review that never happened is the failure this section exists to prevent.

**Look when you can.** If you can drive a headless browser that renders the page as a real origin
(served over `http://localhost`, say, not a static `file://` snapshot), screenshot the first screen
and each state the brief names as important (a halt, a revealed answer, an open detail), at desktop
and phone width, in light and dark. Look at every screenshot, fix what reads poorly, and screenshot
again. Then name in _Verified how_ exactly which states, widths and themes you looked at. Screenshots
catch what measurements pass: in one build they found layout problems every measurement had missed.
Without such a browser, measuring is the whole check: say the visual review was not possible, and
why.

## Stage checks

For a system stage or a scene stepper, run each of these yourself and report each under _Verified
how_. The kit ships no checker for them, and a consumer's gate stays the consumer's.

- **Data.** The data block parses. Chapter ids and order match the brief. Every beat has a route
  (`from`/`to` or `in`), a caption of 15 words or fewer, and at least one ref.
- **Topology.** Every `from`/`to` pair is an edge drawn on the stage.
- **Transport**, by click test. Next crosses chapters. Play stops at every checkpoint, every
  unopened halt and the end. Chips, the scrubber and the log cannot pass an unopened halt. Speed
  changes the travel time. The keys work only while focus is inside the explainer.
- **State.** The state at each chapter end matches the brief's expected values.
- **Inspector.** It opens for each kind of thing (message, state entry, record), Esc returns focus
  to the opener, and "Open all details" expands every beat.
- **Sandbox.** A scripted run through each action ends in the expected state.
- **Reduced motion**, by emulation: messages appear at their destination, and every beat is still
  reachable.
- **No-JS.** With script off, the beat log contains every chapter title, beat caption and beat
  detail, every state entry's and record's inspector content is somewhere in the static page, and
  the static diagram shows.
- **Print.** The print view expands the reference and the beat log details.
- **Width sweep**, at every beat, at many widths from 1440 to 375 (not just three). At each one:
  labels fit, no text overlaps, nothing is truncated, no caption sits over a zone, and the page
  has no horizontal scroll. One build passed at 1280, 1024 and 375 and still overlapped at about
  800px.
- **Refs.** Each beat's refs are covered by the manifest or the citation anchors.

**A check that cannot run here is reported as NOT POSSIBLE (why)**, never skipped silently: no
browser to click in, no way to emulate reduced motion, no print preview. A scene stepper has no
edges, so its topology check is "not applicable", not "passed".

## Contradictions are findings

While spot-checking you may read source that disagrees with what was written about it, or find a
brief claim that the platform under the code does not allow. Source wins over a doc or brief that
disagrees with it, the platform wins over a brief claim that breaks one of its rules, and the
disagreement is a deliverable. It comes in three kinds:

- **Doc versus source.** The docs describing the code say one thing and source another. Render the
  source behaviour, and report both sides with their `file:line`. Do not fix the doc yourself —
  that is a separate change.
- **Brief versus source.** A fact in the brief says one thing and source another. Render the source
  behaviour, and report the brief's claim against the source `file:line`, marked as a brief error.
  Do not edit the brief: the briefer reads your report and fixes it. In one build the brief called
  a session revoked that source showed was expired.
- **Brief versus platform rule.** A fact in the brief breaks a rule of the browser, protocol or
  runtime the page describes, such as HttpOnly cookies being unreadable and unremovable by page
  script, or the same-origin policy. Render what the platform actually does, and report the brief's
  claim against the rule, marked as a brief error. Cite the rule (a spec section or vendor
  documentation) when you could read one; when you could not, name it and mark it **unverified**,
  in the report and on the page. That behaviour comes from what you know of the platform, not from
  the brief or source, so wherever the page shows it, visible text beside it (not only a tooltip)
  names the rule and says it is unverified. Never present an uncited rule as verified, in the
  report or on the page. Do not edit the brief. In one build the brief had a local logout make an
  HttpOnly refresh cookie disappear; page script cannot remove it, so the page showed the cookie
  staying in the browser and the server-side session ending.

All three go under _Contradictions found_. Silently copying the doc or the brief, or silently
rendering the source or the platform's behaviour without reporting the claim it contradicts, is the
failure.

If you are the briefer building the page yourself (`SKILL.md` step 6, option 3), a brief error of
either kind, against source or a platform rule, is yours to fix: stop, fix the brief, and say so.

## Report format

```markdown
## Builder Report

### Status

COMPLETE | BLOCKED (<reason>)

### Files written

- <path> (<size>)

### Gate

- <gate command>: PASS | FAIL | none configured

<Verbatim output when it reported anything.>

### Verified how

- <each measurement you ran, e.g. "computed --ink resolves under all three theme states;
  14 data-tip shapes each resolve a #note- entry and vice versa; no remote URL in any attribute">
- Visual review: <NOT POSSIBLE (why) | done: each state, width and theme you looked at, e.g.
  "first screen, the halt, the revealed answer; at 1280 and 390 px; in light and dark">
- Stage checks (system stage and scene stepper only), one line each: data, topology, transport,
  state, inspector, sandbox, reduced motion, no-JS, print, width sweep, refs — <PASS: what you
  measured | FAIL: what broke | NOT POSSIBLE (why) | not applicable (why)>

### Contradictions found

- <doc: source file:line vs doc file:line — what each says>
- <brief error: the brief's claim vs source file:line — what source does>
- <brief error: the brief's claim vs platform rule (citation | unverified) — what the platform does>
- <or "none">

### Left for the caller

- <manifest assertions with no checker, register steps not possible, gaps in the brief, or "none">
```

## Constraints

- Do NOT invent facts. If the brief is missing one, leave a visible gap and report it.
- Do NOT decide the audience, the hero, or the anti-goals.
- Do NOT change the brief's shape, and do NOT add a predict checkpoint or a sandbox the brief did
  not ask for.
- Do NOT skip a stage check silently; report one that cannot run as NOT POSSIBLE (why).
- Do NOT claim a visual review you did not perform.
- Do NOT skip the screenshots when a headless browser renders the page as a real origin; look at
  them before you report.
- Do NOT edit the brief. Report a brief error under _Contradictions found_ instead, unless you are
  the briefer building the page yourself (see _Contradictions are findings_).
- Do NOT present a platform rule you could not cite as verified; name it and mark it unverified, on
  the page as well as in the report.
- Do NOT retype a configured font block; splice it.
- Do NOT edit source files to make the page true. Report the contradiction instead.
- Do NOT run a formatter over the page unless the consumer's configuration says to; hand-tuned
  inline SVG does not survive reformatting.
