# Drift-proofing an Explainer Page

Reached from `SKILL.md` (the brief asks for it) and `BUILD.md` (the builder embeds it). Applies to
grounded pages unless the consumer configured `Drift-proofing: off`.

A grounded page starts going stale the day it is committed. Drift-proofing makes the page's claims
machine-readable so a check — the consumer's, not this skill's — can fail when the tree moves and
the page does not. It has two levels.

## Level 1 — the manifest (`manifest`)

One JSON block holding the facts the page asserts:

```html
<script type="application/json" id="<page-slug>-manifest">
  {
    "envelopeParseBytes": 10485760,
    "backendExportBytes": 1048576,
    "errorCodes": ["E_TRUNCATED", "E_VERSION", "E_MAC"]
  }
</script>
```

Rules:

- **One block, a stable `id`** naming the page.
- **Scope-qualified keys.** `envelopeParseBytes`, never `maxBytes`. An ambiguous key is how a
  wrong value survives review.
- **Only values that exist in source** as something a check can read — an exported constant, a
  config value, a schema enum. An entry nothing can compare is decoration.
- **The prose agrees with the manifest.** A number in the page text that is not in the manifest is
  a claim nothing backs; prefer stating less (see _Which facts go in_ in `SKILL.md`).

The skill cannot write the consumer's checker — reading source constants is specific to each
repository. If no checker asserts the manifest, the builder reports it under _Left for the caller_.

## Level 2 — citation anchors (`manifest+anchors`)

A `file:line` citation is a claim about a line, and a line number that still resolves is not a
citation that is still true. On one page, every one of 19 stale citations pointed at a line that
existed; one claimed `environment: production` over a line that read
`rm -f "$RUNNER_TEMP/host_apply_key"`. A range check catches none of that. An anchor records what
the page says is at each cited line, so a check can compare content, not just existence.

```html
<script type="application/json" id="citation-anchors">
  {
    "note": "Expected content at each cited line; verified against the tree on <date>.",
    "anchors": {
      "deploy.yml:128": {
        "file": ".github/workflows/deploy.yml",
        "start": "environment: production"
      },
      "deploy.yml:40-50": {
        "file": ".github/workflows/deploy.yml",
        "start": "- name: Validate release branch",
        "end": "exit 1"
      }
    }
  }
</script>
```

Rules:

- **One block per page, one entry per distinct citation.** The same `file:line` printed in four
  places is one claim; one entry keeps it from disagreeing with itself.
- **Key by the name the citation resolves to.** Pages often print bare continuations (`:181`,
  `:126-141`) that inherit the last file named; key them as `deploy.yml:181`, not as printed.
- **`file` is the repository-relative path.** Names like `package.json` match many files; "some
  file of that name has that line" is not the claim.
- **`start` is the literal text at the cited line; `end` the literal text at the last line of a
  range.** Both ends, so a range that grows or shrinks at either end is caught. Compare with
  whitespace normalised.
- **Prefer a range whose last line is distinctive.** A range ending on a bare `}` verifies against
  any neighbouring `}` too; where the source offers nothing better, the anchor is weaker than it
  looks — note it.
- **Write the anchor from the page's claim, not from the line.** Copying whatever the line says now
  turns a stale citation into a permanently green one. If the claim and the line disagree, the
  citation is wrong: fix the line number first, and say why.
- **No orphans.** An entry that keys no citation on the page is never compared with anything, yet
  reads as checked. Remove it.
- **Write continuations with their colon.** `main.ts:153, :205` is two citations;
  `main.ts:153, 205` is one citation followed by a bare number no check can read.
- **A citation in script data names its file in the same string.** A check reading a
  walkthrough's scene data cannot inherit a file named in the markup.

Why a block rather than an attribute per citation: citations cluster several to a text node and
inside SVG labels, so inline anchors mean splitting hand-tuned markup. One block is the same shape
whatever markup the citations use.

As with the manifest, the check that reads this block is the consumer's. A small one is easy to
write — parse the block, read each `file`, compare `start` and `end` at the cited lines, fail on an
unreadable file, a line past the end, a mismatch, an orphan entry, or a citation with no entry.
