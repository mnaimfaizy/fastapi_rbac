# Release Notes Agent (GitHub / Copilot)

Harness wrapper for GitHub Copilot coding agent / custom agents. **Behavior SSOT:** [`docs/agents/release-notes-agent.md`](../../docs/agents/release-notes-agent.md)

## Model

Set your preferred model for this sub-agent here (edit as needed):

```text
MODEL: <assign-github-copilot-model>
```

Configure the model in the Copilot / GitHub agent settings that load this file.

## How to invoke

When preparing a release:

1. Gather version, previous tag, commit list (`git log <prev>..HEAD`), and today’s date.
2. Run this agent with those inputs.
3. Instruct it: **Read and follow `docs/agents/release-notes-agent.md` exactly.** Return only the markdown section.

## Outputs

Save the section to a temp file and pass it to `scripts/deployment/release/create-release.sh --notes-file …` (or the PowerShell equivalent).
