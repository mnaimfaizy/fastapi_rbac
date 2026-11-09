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

## Steps

1. Read the brief, the configuration, and the reference page if any.
2. **Fonts.** If a `Font source` is configured, splice exactly what it yields — never retype or
   re-encode it. Otherwise use system font stacks. A font that is not a `data:` URI is a network
   fetch and breaks self-containment.
3. Write the page to the conventions below, at the target path.
4. Do the `Register step` if one is configured. A page left out of whatever the consumer's checks
   enumerate is unchecked.
5. Embed drift-proofing as the brief requires (`ANCHORS.md`). If the brief asks for a manifest and
   the consumer has no checker that asserts it, list that under _Left for the caller_ — a manifest
   nothing reads asserts nothing.
6. Run the `Gate command` if one is configured and report its output verbatim. If none is, run the
   self-checks under _Verified how_.
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

**Notes live in the document, not in the shapes.** Per-element explanations go in a static
"Diagram notes" list with `id="note-<key>"`. The shape carries `data-tip="<key>"` and
`aria-describedby="note-<key>"`. One shared popover surface (`popover="manual"`), opened by hover,
click, and `:focus-visible`, reads its text from that list and never holds a copy. The list is what
a reader with no pointer, a screen-reader user, and a reader printing the page actually get. A shape
with nothing specific to say carries no `data-tip`: a generic tooltip is the defect, not a smaller
version of it. Every `data-tip` has its note, and every note has its shape.

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

**Motion.** One entrance animation and one active-step marker are enough. Both collapse fully under
`@media (prefers-reduced-motion: reduce)`: nothing hidden, nothing animated, every step visible.
If the brief asks for a halt, the page stops at it and cannot be advanced without an explicit
action.

**Interactivity earns its place.** Add behaviour only where it settles something a static picture
cannot. A static page is smaller and has less to keep true.

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

## Contradictions are findings

While spot-checking you may read source that disagrees with the docs describing it. Source wins,
and the disagreement is a deliverable: render the behaviour, and report both sides with their
`file:line` under _Contradictions found_. Silently copying the doc, or silently rendering the source
without saying the two disagree, is the failure. Do not fix the doc yourself — that is a separate
change.

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
- Visual review: <NOT POSSIBLE (why) | done, how>

### Contradictions found

- <source file:line vs doc file:line — what each says — or "none">

### Left for the caller

- <manifest assertions with no checker, register steps not possible, gaps in the brief, or "none">
```

## Constraints

- Do NOT invent facts. If the brief is missing one, leave a visible gap and report it.
- Do NOT decide the audience, the hero, or the anti-goals.
- Do NOT claim a visual review you did not perform.
- Do NOT retype a configured font block; splice it.
- Do NOT edit source files to make the page true. Report the contradiction instead.
- Do NOT run a formatter over the page unless the consumer's configuration says to; hand-tuned
  inline SVG does not survive reformatting.
