---
applyTo: "**"
---

# Commit Workflow Instructions for Agents

When performing a commit in this project, always follow this workflow:

1. **Check Git Status and Stage Changes**

   - Run `git status` to see changed files.
   - Add all relevant changed files to staging with `git add <files>`.
   - Run `git status` again to confirm files are properly staged.

2. **Commit Message**

   - Use the commit message format and rules from the commit prompt (which will be provided at commit time).
   - Ensure the commit message follows the Angular standard with emojis and correct scope.

3. **Pre-commit Hook Enforcement**

   - When the pre-commit hook runs, carefully check its output for any issues (linting, formatting, sorting, type errors, etc.).
   - If the pre-commit hook reports any issues:
     - Fix all reported issues (e.g., run linters, formatters, sorters, or address errors as required).
     - Repeat the process: re-stage the files, re-check status, and re-run the commit.
   - Only proceed if the pre-commit hook passes with no errors or warnings.

4. **Repeat Until Success**

   - Continue this process until the commit is accepted and the pre-commit hook passes cleanly.

5. **Best Practices**
   - Never skip or bypass the pre-commit hook.
   - Always ensure the working directory is clean and all issues are resolved before finalizing the commit.
   - If unsure about a reported issue, consult the relevant project documentation or configuration files.

---

**Summary:**

- Always stage, check, and commit using the provided commit prompt.
- Strictly follow and resolve all pre-commit hook issues before completing the commit.
- Repeat as needed until the commit is successful and clean.
