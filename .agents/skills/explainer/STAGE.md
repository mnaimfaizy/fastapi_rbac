# The system stage and the scene stepper

Reached from `SKILL.md` step 1 when the brief's shape is **system stage** or **scene stepper**, and
from `BUILD.md` for those builds. Both roles read it only for those two shapes; a static page never
needs it. The briefer reads it to know what the brief must give. The builder reads it for how the
page is built.

A shape example ships beside this file: [`examples/system-stage.html`](examples/system-stage.html).
Its subject, names, values and refs are invented. Read it for shape, never for facts.

## Terms

These terms belong to this guide. They are not in any glossary outside the skill.

- **System stage.** The page shape for a sequence that crosses two or more components. The
  components are drawn once, the story plays on them as moving messages and changing state, and
  the reference sits below on the same page.
- **Scene stepper.** The page shape for a sequence inside one component, such as a state machine
  or one algorithm. It is the stage contract with a single zone.
- **Zone.** One component drawn on the stage. It shows its live state in place.
- **Edge.** A drawn connection between two zones. A message travels only along an edge.
- **Chapter.** An ordered part of the story. It has a one-line title, the question it settles, and
  an expected state at its end.
- **Beat.** One step of a chapter: a message from one zone to another (`from`/`to`), or a local
  change inside one zone (`in`). It has a caption of 15 words or fewer, a state delta, and refs.
- **Halt.** A point where the real process waits on a person or an outside action. The page waits
  there too, until the reader takes the **gate action**.
- **Predict checkpoint.** A question asked at a decisive moment, before the stage shows the answer.
  It has three choices, one correct, and one line of why.
- **Inspector.** The drawer (desktop) or bottom sheet (phone) that shows the real shape of a
  message, state entry or record, with its refs.
- **Sandbox.** The same stage after the story, driven by the reader's own actions under the rules
  the brief gives. It is a model of the rules, not the system.
- **Beat log.** The list of every chapter and beat, rendered from the same data as the stage. It is
  static HTML, so it is what a reader without script, a screen-reader user, and a printed copy get.

## Design principles

These are what made an approved stage work. Each is a rule, with its source.

1. **One fixed stage; motion only along its edges.** Components stay put. Work moves between them
   as visible units, and failures are visible events, not counters. _Source:_ Sam Rose,
   [Load balancing](https://samwho.dev/load-balancing/).
2. **Animate state transitions, not decoration.** Motion earns its place when it shows a change of
   state and its cause. _Source:_ Hohman et al.,
   [Communicating with Interactive Articles](https://distill.pub/2020/communicating-with-interactive-articles/),
   Distill 2020.
3. **Segmenting and learner-paced control.** Beats are short, and the reader controls the pace:
   step, play, pause, speed, replay. _Sources:_ Mayer's segmenting principle; Distill 2020.
4. **Temporal and spatial contiguity.** A hop's caption appears with the hop and next to it. The
   receiving zone changes only after the message lands, so cause precedes effect. _Source:_ Mayer's
   multimedia principles ([review](https://pmc.ncbi.nlm.nih.gov/articles/PMC7940870)).
5. **Signalling.** The active zone and edge are emphasised, and everything else recedes. One thing
   moves at a time, unless the story is about concurrency.
6. **Overview first, details on demand.** The stage shows that a request went from A to B. The
   inspector shows the real request line, headers, command and payload. An "Open all details"
   switch expands everything inline for readers who prefer reading. _Sources:_ Shneiderman's
   mantra, as cited in Distill 2020; the "Open All" control on
   [The Illustrated TLS 1.3 Connection](https://tls13.xargs.org/).
7. **Predict before reveal.** At a few decisive moments, ask what happens next, then show it.
   Never block on a wrong answer. _Sources:_ Nicky Case,
   ["Place your bets"](https://blog.ncase.me/explorable-explanations-4-more-design-patterns/);
   Distill's "You Draw It".
8. **Guided story first, then a sandbox.** At the end, the reader drives the same stage with their
   own actions. A sandbox without the story first drowns the reader (Nicky Case).
9. **Show the same value on both sides of a handoff.** When one zone writes an identifier that
   another later looks up, show the identical value in both places (the Illustrated TLS
   technique).
10. **State the simplifications openly.** A sandbox is a model of the rules, not the system. Say so
    on the page, as Sam Rose does.
11. **Responsive from the start.** Recompute the layout from the container size. On touch, replace
    hover with tap and pinned annotations. _Source:_ The Pudding,
    [Responsive scrollytelling](https://pudding.cool/process/responsive-scrollytelling/).

## Taste rules

- **The first screen** is the title, the one question in one line, and the stage ready at beat 1
  with a visible Play. No paragraphs above the stage.
- **No paragraphs on the stage.** A chapter has a one-line title and a one-line _settles_ question.
  Beat captions are **15 words or fewer**, placed beside what they describe, with a leader line
  when needed. Longer text lives in the inspector or the reference.
- **Ease, then settle.** A message travels in about 450–700 ms at 1× with natural easing, lands,
  and only then does the receiver react: a brief highlight, and the entry appears, strikes or
  vanishes. The response travels back along the same path, so a round trip reads as one gesture.
  No idle animation and no decorative particles.
- **Colour is a role.** One muted hue per zone, and one accent for "now". Outcome is encoded by
  **shape and glyph first**, colour second. For HTTP, for example: a circle ✓ for 2xx, a triangle !
  for 401, an octagon ✕ for 403. Terminal statuses get a ✕ glyph and a pattern. Everything must
  survive greyscale.
- **Whitespace over borders.** No boxes inside boxes.
- **Monospace for identifiers** (keys, headers, paths) on the stage, and the body face for
  captions.
- **Messages are compact capsules** with short badges (`Bearer A1`, `X-CSRF`, `no cookie`), routed
  through gutters so they never cover a zone's text.

## What the brief gives

The fields are in `SKILL.md`, _The brief anatomy_: zones, edges, chapters, beats, halts, inspector
content and expected state, plus predict checkpoints and a sandbox when the briefer decides on
them. Every beat fact is cited like any other fact.

- **Checkpoints are rare.** Put one only at a decisive moment, where a reader's guess shows whether
  they have the model. Most chapters have none.
- **A sandbox is optional.** Ask for one only when the rules are worth driving. Give its actions,
  the rule each follows, and the disclaimer text the page must show.
- **The builder never invents either.** A page with a checkpoint or sandbox the brief did not ask
  for is a builder error.

## The stage contract

The builder meets every point. The shape example meets them all; read it for how.

**Self-contained.** Vanilla JS and inline SVG. No runtime framework, no CDN, nothing fetched. The
rules in `BUILD.md` _Conventions_ still apply: theme tokens in three states, storage in
`try`/`catch`, and accessible naming without the tooltip. _Notes live in the document_ applies in
aim only. Per-element detail is in the static HTML, but the inspector replaces the `data-tip`
popover. The static beat log and a static list of the state records replace the "Diagram notes"
list.

**One data block.** One `<script type="application/json">` block holds zones, edges, chapters,
beats, checkpoints, halts, inspector content and the sandbox's actions. The stage, the beat log,
the inspector and the sandbox all render from it. The static beat log is prerendered from it when
the page is built, so it is in the HTML before any script runs. The example's key names are one
choice, not a schema:

```json
{
  "zones": [{ "id": "desk", "label": "Desk", "rows": 1, "refs": ["…"] }],
  "edges": [{ "id": "kiosk-desk", "a": "kiosk", "b": "desk" }],
  "chapters": [
    {
      "id": "place",
      "title": "…",
      "settles": "…",
      "end": { "desk.shelf": "empty" },
      "beats": [
        {
          "id": "place-1",
          "from": "kiosk",
          "to": "desk",
          "msg": "…",
          "caption": "…",
          "delta": [],
          "refs": ["…"]
        }
      ]
    }
  ],
  "checkpoints": [
    { "before": "<beat id>", "question": "…", "choices": ["…", "…", "…"], "correct": 1, "why": "…" }
  ],
  "halts": [{ "before": "<beat id>", "waitsOn": "…", "gate": "…" }],
  "sandbox": { "disclaimer": "…", "actions": [{ "id": "…", "label": "…", "rule": "…" }] }
}
```

**Stage.** An inline `<svg>` with `role="group"`, an `aria-label`, and `aria-describedby` pointing
at its `<desc>`. It has no `<title>`, for the tooltip reason in `BUILD.md`. Zones render their live
state in place. Messages travel along drawn edges only.

**Transport.**

- A chapter rail, with halt chapters marked ✋.
- Back, Play/Pause and Next.
- Speed 0.5×, 1× and 2×.
- A scrubber over the current chapter's beats, and Replay chapter.
- Keys, only while focus is inside the explainer: ← and → step a beat, Shift+← and Shift+→ step a
  chapter, and Space plays or pauses.

**Play stops.** Play flows across chapters. It stops at every predict checkpoint until it is
answered or skipped, at every unopened halt, and at the end.

**Halts cannot be skipped.** At an unopened halt, Next is disabled and its label says why. Chapter
chips, the scrubber and the beat log cannot jump past it. The gate action opens it, and an opened
gate stays open for that visit.

**Captions** are announced through one `aria-live="polite"` region.

**Beat log.** Every chapter and beat, rendered from the data, with linked highlighting: the current
beat is marked in the log, and choosing a log entry moves the stage there.

**Inspector.** Clicking or tapping any message, state entry or record opens it: a side drawer on
desktop, a bottom sheet on phones. It shows the real shape and its `file:line` refs. Esc closes it,
and focus returns to what opened it. "Open all details" expands every beat's inspector content
inline in the beat log.

**Predict checkpoints**, when the brief has them: the question, three choices and a Skip. Any
answer reveals the correct choice and its why. A wrong answer never blocks.

**Sandbox**, when the brief has one, after the story: the same stage, the brief's actions,
condensed animation, an event log, Reset, and the disclaimer on the page.

**Reduced motion.** Under `prefers-reduced-motion: reduce`, messages appear at their destination
instead of travelling. Play still steps on its own, and every beat stays reachable.

**No-JS and print.** The beat log, with every chapter, beat and detail, is static HTML in the DOM,
and the stage falls back to a static annotated diagram. Each state entry's and record's inspector
content is in a static list too, such as a "State records" list in the reference. No content is
script-only. Print shows the
log, the diagram and the reference expanded.

**Reference below the stage.** The story carries the narrative. Reference panels are bullets and
tables, one claim per sentence, collapsed by default under one "Expand all", and printed expanded.

**Layouts.** The stage recomputes from its container width: one row on wide screens, two rows at
tablet widths, stacked on phones. No horizontal page scroll at 375px, and touch targets of 40px or
more.

## The scene stepper

A scene stepper is the stage contract with one zone. It keeps the transport, captions, beat log,
inspector, data block, reduced-motion, no-JS and print rules. In place of a multi-zone diagram it
draws the one zone's state, large, and each beat is an `in` change to it. It has no edges, so the
topology check has nothing to assert; report it as not applicable, not as passed.

## Checking the build

`BUILD.md`, _Stage checks_, lists what the builder verifies for these shapes: data, topology,
transport, state, inspector, sandbox, reduced motion, no-JS, print, a width sweep, and refs.
