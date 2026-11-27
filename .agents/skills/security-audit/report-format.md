# Security audit report format

Emit **markdown only**, starting with exactly:

```markdown
## Security audit report
```

Then:

```markdown
- **Mode:** full | pr | deep
- **Scope:** <brief>
- **Date:** <YYYY-MM-DD>
- **Max severity:** none | medium | high | critical
- **Finding count:** <n>
```

If zero Medium+ findings:

```markdown
### Findings

None.
```

Otherwise, for each finding (severity descending):

```markdown
### F<n> — <short title>

- **Severity:** Critical | High | Medium
- **Evidence class:** dependency-advisory | code-path | missing-control
- **Asset:** <token | store | IPC | CI | dependency | ...>
- **Location:** `path/to/file.ext:line` (additional locations as bullets)
- **Attack path:** who -> how -> impact (no exploit payload)
- **Evidence:** what the code/config does wrong (quote or paraphrase briefly)
- **Preconditions:** what must be true for this to matter
- **Fix direction:** concrete remediation idea (not a full patch unless trivial)
- **Concept id:** `<kebab-case>` (stable id for a Consumer findings ledger)
```

For `dependency-advisory`, include the advisory id from a workspace grounding file.

Optional closing section:

```markdown
### Notes

- Scanner hits considered/discarded
- Existing ledger concepts skipped (if Consumer ledger available)
- Areas not covered (time/scope)
```

## `deep` additions

A `deep` report carries these too. `full` and `pr` reports never do.

Severity and the Medium floor are unchanged: reproduction is confidence, not severity. A reproduced Low is still dropped, and an unreproduced Medium+ finding is still reported.

In the header, after **Finding count**, only when a limit ended the run:

```markdown
- **Stopped:** wall clock | turns | tokens
```

The launcher adds it, outside the sandbox, naming the limit that fired. The agent never writes this line.

Each finding gains, after **Concept id**:

```markdown
- **Reproduced:** yes | no | not attempted
- **Observation:** <prose; only with `yes`>
- **Ledger:** reopens `rejected` | reopens `accepted-risk` | regression (only when the concept id matches such a ledger row)
```

- `yes`: the Observation follows. It names the location, the attacker's position, the kind of input in words and the effect seen. It never holds payload values, encoded strings, exact requests, command sequences or timing tricks: a maintainer can understand the finding and check a fix from it, but cannot paste it into anything.
- `no`: no Observation. Put a one-line reason on the same line, for example `no: the entry point rejected every input of this kind`.
- `not attempted`: no Observation. Put why not on the same line, for example `not attempted: no recipe entry point reaches it`.

**Location** is a `file:line` as in every mode. When tracing fails, it is the entry point that showed the bug, and `Notes` says the code site was not pinned down.

After the findings, always (write `None.` when empty):

```markdown
### Open questions

- <what the agent could not settle from its own knowledge and the repository, phrased so the maintainer can answer it by adding grounding>
```

In `### Notes`, each skipped open ledger concept says whether it reproduced.

## Verification-run variant

A Verification run re-attempts the findings in the file the launcher hands it, on a fix branch. Its report opens as above, with this Mode line:

```markdown
- **Mode:** deep (Verification run)
```

**Scope** names the ref, **Finding count** is the number of given findings that still reproduce, and **Max severity** is the highest severity among them (`none` when every fix holds). It has no new findings: one entry per given finding, in the order given, each:

```markdown
### <concept id>

- **Location:** `path/to/file.ext:line` (as given)
- **Reproduced:** yes | no
- **Reason:** <one line>
```

`yes` means the fix does not hold, and the reason is an Observation within the boundary above. `no` means the fix holds, and the reason says what now stops the input. A Verification run has no `Open questions` section unless something blocked an answer, and its report never leaves the maintainer's machine.
