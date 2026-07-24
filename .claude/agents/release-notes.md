# Release Notes Agent (Claude)

Harness wrapper for Claude Code / Claude agents. **Behavior SSOT:** [`docs/agents/release-notes-agent.md`](../../docs/agents/release-notes-agent.md)

## Model

Set your preferred model for this sub-agent here (edit as needed):

```text
MODEL: <assign-claude-model>
```

Examples (replace the placeholder): `claude-sonnet-4`, `claude-opus-4`, etc. — use whatever your Claude harness currently supports.

## How to invoke

When the release orchestrator (or a human) needs release notes:

1. Gather version, previous tag, commit list (`git log <prev>..HEAD`), and today’s date.
2. Launch this agent / Task with those inputs.
3. Instruct it: **Read and follow `docs/agents/release-notes-agent.md` exactly.** Return only the markdown section.
4. Do not restate categorization rules in the Task prompt beyond pointing at that file.

## Outputs

Pass the returned markdown section to the release skill / `Create-Release` scripts via `-NotesFile` / `--notes-file`.
