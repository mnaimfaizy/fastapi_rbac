---
mode: agent
---

# Commit Message Instructions for Agents and LLMs

When making commits in this project, always follow these rules:

## 1. Use Angular Commit Message Standards with Emojis

- Start every commit message with a relevant emoji.
- Use the Angular commit type (feat, fix, chore, docs, refactor, test, perf, ci, build, style, etc.).
- If the change is in a specific directory (e.g., backend, react-frontend, docs, scripts), include the directory in parentheses after the type.
- For root-level or global changes (e.g., .github, LICENSE, README.md), use the directory or file name in parentheses.

### Examples

- For root-level or global changes:

  - 🛠️ chore(github): update GitHub Actions workflow for CI
  - 📄 docs(README): update project overview and usage instructions
  - 📝 chore(LICENSE): update copyright

- For changes in subdirectories:
  - 🐍 fix(backend): correct user role assignment logic
  - ⚛️ feat(react-frontend): add user profile page
  - 📝 docs(docs): add API usage section to documentation
  - 🛠️ chore(scripts): update deployment script for production

## 2. Commit Message Structure

- **Title:**
  `<emoji> <type>(<scope>): <short summary>`
- **Body (optional):**
  Add a longer description if needed, explaining what and why.

## 3. Scopes

- Use the directory or file name as the scope, e.g.:
  - backend
  - react-frontend
  - docs
  - scripts
  - .github
  - LICENSE
  - README

## 4. Best Practices

- Be concise and clear.
- Use imperative mood (“add”, “fix”, “update”, not “added”, “fixed”, “updated”).
- Always include an emoji at the start.
- If multiple directories are affected, use a general scope or list the main ones.

---

**Example Commit Messages:**

- 🐛 fix(backend): resolve permission deletion bug in API
- ✨ feat(react-frontend): implement dark mode toggle
- 📝 docs(docs): add troubleshooting guide for Docker Compose
- 🛠️ chore(scripts): update test runner for new test structure
- 📄 docs(README): clarify environment setup instructions
- 🧹 chore(.github): update issue templates

---

**Summary:**
Always use Angular commit standards with emojis, specify the directory or file in the scope, and write clear, concise messages. This ensures easy release note generation and maintainable commit history.
