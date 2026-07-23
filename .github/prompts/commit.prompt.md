---
mode: agent
---

# Special Command: /commit

When the `/commit` command is invoked in chat, the agent must:

1. Assume there are staged or unstaged changes to commit.
2. Immediately begin the commit workflow:
   - Check git status.
   - Stage all relevant changes.
   - Prompt for or generate a commit message following **`docs/agents/commit-messages.md`** (mandatory SSOT).
   - Run pre-commit hooks and resolve any issues.
   - Repeat as needed until the commit is successful and clean.
3. Do NOT simply acknowledge these instructions—always proceed with the commit process.

This ensures that including `/commit` in chat will always trigger the full commit workflow automatically.

# Commit Message Instructions for Agents and LLMs

**Follow [`docs/agents/commit-messages.md`](../../docs/agents/commit-messages.md) strictly.** Do not invent alternate formats.

Summary (full rules live in the SSOT):

- Format: `<type>(<scope>): <subject>`
- **No emoji**
- Component/domain scopes (`auth`, `api`, `ui`, `docker`, `ci`, …) — not top-level directory names
- Imperative mood; breaking changes use `!` and/or `BREAKING CHANGE:` footer

### Examples

```
feat(auth): add two-factor authentication support
fix(api): resolve rate limiting bypass vulnerability
docs(release): update release notes for v1.2.3
chore(ci): update GitHub Actions workflow for CI
```

---

**Summary:** Always use the canonical commit-message SSOT. That keeps history consistent for automated release notes.
