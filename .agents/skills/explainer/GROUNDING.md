# Grounding a brief in source

Reached from `SKILL.md` step 3a, when the subject has a source of truth that could prove the brief
wrong.

A grounded brief is worth more than a template because it names things a reader can check: not "a
high iteration count" but `310,000`; not "a size limit" but `10 MB, scoped to envelope parsing`.
Producing those names is the work. This file is that procedure.

## 1. Find the real source, not the description of it

Start from the subject and locate the files that _implement_ it. Documentation is a lead, never a
citation: it describes intent at the time of writing, and the brief must describe current
behaviour.

Where a doc and the source disagree, **the source wins and the disagreement is a finding**. Report
it to the user — a stale doc that contradicts the code is often worth more to them than the page
they asked for.

If locating the implementation would take several consecutive searches, delegate the search to a
sub-agent where one is available, with a one-sentence goal, and keep only its conclusions.

## 2. Read the implementation

Read the files — the bodies, in the order they execute, not the export list or the type signatures
alone. Collect as you go:

- **Constants** — iteration counts, byte lengths, caps, limits, timeouts, retries, versions.
- **Identifiers a reader will type or grep** — storage keys, table and column names, endpoint
  paths, scopes, header names, label vocabularies.
- **Enumerations** — error codes, status values, event names, type unions. Take the _whole_ list:
  a brief that names four of nine error codes invites a page that looks complete and is not.
- **Ordering** — the actual sequence of phases, guards, and commits. Order is usually what a
  diagram is _for_, and it is the thing most often assumed rather than read.
- **The invariant nobody wrote down** — what breaks badly if it drifts: a format two
  implementations must agree on, a constant duplicated across them, an ordering that looks
  arbitrary and is not.

Record `file:line` for every item as you collect it. Citations retrofitted later are how wrong
ones get written.

## 3. Run the collision check — mandatory

**For every constant you intend to cite, find every value the repository gives that quantity — by
concept, not only by the exact name.** One quantity is often set under several names, so search
three ways:

1. **The exact name** — every definition of it.
2. **Sibling names** — the cited constant's stem with other units or suffixes: `<STEM>_EXPIRE_*`,
   `<STEM>_TTL*`, `<STEM>_TIMEOUT*`, `<STEM>_LIMIT*`, `<STEM>_MAX*`, `<STEM>_SIZE*`, and the like,
   where `<STEM>` is the part that names the thing (`REFRESH_TOKEN` in
   `REFRESH_TOKEN_EXPIRE_MINUTES`). Keep the stem: a bare `*_EXPIRE_*` pulls in other quantities.
   Search case-insensitively, because code often reads the same setting under another spelling
   (`settings.refresh_token_expire_days`, `refreshTokenTtl`). A literal value used inline for the
   same quantity counts too.
3. **Every call site that sets or overrides the quantity** — where the token, cookie, session, or
   limit is actually issued or enforced, not only where the setting is defined.

```bash
rg -n "CONSTANT_NAME" --glob '!node_modules'
rg -n -i "refresh_?token_?(expire|ttl|timeout|lifetime)" --glob '!node_modules'
```

Together these give the **sibling set**: every name, literal, and call site that sets the quantity.
Write down every distinct value in it and the scope that value applies to.

This step exists because it has failed before:

- One export-size constant was defined three times — 10 MB in a core library, 1 MB in both the web
  client and the backend service — with a fourth, separate 10 MB cap on another endpoint. A brief
  written from the first definition stated "10 MB hard limit" as a flat fact, and the page rendered
  it faithfully as a security reference.
- A search for `REFRESH_TOKEN_EXPIRE_MINUTES` found one value, 100 days. It missed
  `REFRESH_TOKEN_EXPIRE_DAYS`, 7 days, which the change-password route uses to issue its session.
  The page printed "default 100 days" for every refresh token. The exact-name search worked as
  written; it was the wrong search.

Rules that follow, across the whole sibling set:

- A quantity with two values is **never** reported as one number, whether the values share a name
  or not. Report each, with its scope.
- If you cannot tell which value governs the path being drawn, trace the call chain until you can.
  "Probably the stricter one" is not a finding.
- Constants that set the same quantity to different values — duplicates or siblings — are worth
  surfacing to the user as a possible defect, separately from the page.

## 4. Verify enumerations are complete

For each list you plan to cite, find its canonical definition — the union type, `const` array, or
enum — and compare counts. A switch statement or a doc table is a copy that may have drifted.
Where the canonical list and a copy disagree, report it: that divergence is exactly what a page
either exposes or entrenches.

## 5. Write the facts into the brief

- **A constant becomes a claim with a scope.** Not "a 10 MB cap" but "10 MB, enforced on envelope
  text before parsing; the backend applies its own 1 MB cap to export payloads."
- **An ordering becomes a numbered sequence** with the guarantee it provides — for example, that
  nothing is written until a final atomic commit, so a failure leaves existing state untouched.
- **An invariant becomes the hero or a named panel**, with the consequence of breaking it in the
  reader's terms: not "the compatibility test fails" but "the mobile app can no longer open the
  vault the browser wrote."
- **An enumeration becomes the complete list**, or an explicit subset labelled as one.

## 6. Specify drift-proofing

Unless the consumer configured `Drift-proofing: off`, require the manifest described in
`ANCHORS.md`, and the citation anchors too when configured `manifest+anchors`. Name manifest keys by
scope — `envelopeParseBytes`, `backendExportBytes`, never `maxBytes`. The ambiguity a shared name
creates in code, it creates again in the manifest.

## Grounding completion criteria

- [ ] The implementation was read directly; no claim rests only on documentation.
- [ ] Every number, identifier, and error code has a `file:line`.
- [ ] Every cited constant was searched repo-wide by exact name, sibling names, and the call sites
      that set or override it; every distinct value in that set is recorded with its scope.
- [ ] Every cited enumeration was compared against its canonical definition.
- [ ] Execution order was read, not assumed.
- [ ] Contradictions — doc vs source, or constant vs constant — were surfaced to the user.
- [ ] Drift-proofing keys are scope-qualified and drawn from values that exist in source.
