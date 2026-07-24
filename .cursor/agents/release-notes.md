# Release Notes Agent (Cursor)

Harness wrapper for Cursor agents. **Behavior SSOT:** [`docs/agents/release-notes-agent.md`](../../docs/agents/release-notes-agent.md)

## Model

Set your preferred model for this sub-agent here (edit as needed):

```text
MODEL: <assign-cursor-model>
```

Pick a model in Cursor’s agent / Task UI for this sub-agent when invoking it.

## How to invoke

When the release orchestrator (`.claude/skills/release`) or a human needs release notes:

1. Gather version, previous tag, commit list (`git log <prev>..HEAD`), and today’s date.
2. Use the Task tool (`generalPurpose` or equivalent) with those inputs.
3. Instruct it: **Read and follow `docs/agents/release-notes-agent.md` exactly.** Return only the markdown section.
4. Do not duplicate commit→section rules in the prompt; link the canonical file.

## Outputs

Pass the returned markdown section to the release skill / scripts via `-NotesFile` / `--notes-file`.
