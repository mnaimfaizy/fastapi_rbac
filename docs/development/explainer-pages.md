# Keeping explainer pages current

The pages in `docs/explainers/` state facts about the code: setting defaults, status codes, Redis key shapes, and `file:line` citations for every step they show. A gate fails CI as soon as a change makes one of those facts wrong, and tells you which part of the page to update.

The gate is `scripts/docs/check_explainers.py`. It uses the standard library only.

## What it checks

| Check | Fails when | Source of truth |
| --- | --- | --- |
| **Manifest values** | A value in the page's manifest block no longer equals the value in source, or the rule can no longer find it. | `scripts/docs/explainer-rules/<page>.json`, `manifest` |
| **Cited code** | The code at any cited range changed, moved, or no longer exists. | The page's `citation-anchors` block: first line, last line, line count and a hash of each cited range |
| **Citations** | The page cites a range with no anchor, keeps an anchor nothing cites, or names a file it cannot resolve. | The page itself, plus `aliases` in the rules file |
| **Beat log** | A chapter title or beat caption in the data block is missing from the static beat log, so the no-JS page says less than the animated one. | The page's data block |
| **Registration** | A page in `docs/explainers/` has no rules file. | `scripts/docs/explainer-rules/` |

Citations are read from the page's markup, its data block, and its script, including the `P.token + ':38-48'` form the session-lifecycle script uses.

## Where it runs

- **Pull requests and pushes to `main`:** the `Docs Check` workflow (`.github/workflows/docs-check.yml`) runs on every pull request, not only docs changes, because a backend or frontend change is what makes a page stale. A failure annotates the changed source lines, and the job summary lists each problem with the diff inside the cited range, where on the page it is used, and the command that fixes it.
- **Docs deploy:** `.github/workflows/docs.yml` runs the check before `mkdocs build`, so a stale page is never published.
- **Before a commit:** the `explainer-drift` pre-commit hook runs when you change `backend/app/`, `react-frontend/src/`, `docs/explainers/` or `scripts/docs/`.

Run it yourself:

```bash
python scripts/docs/check_explainers.py
```

## When it fails

Read the report. Each problem says what changed, where the page uses it, and how to fix it.

**Cited code moved.** The code is unchanged but its line numbers shifted, for example after lines were added above it. Run:

```bash
python scripts/docs/check_explainers.py --fix
```

This rewrites the line numbers everywhere the page prints them (markup, data block and script) and moves the anchors with them. Review the diff and commit it.

**Cited code changed.** Someone edited code the page describes. This needs a person:

1. Open the page and go to each place the report lists ("chapter 7 (origin-mismatch), beat 8", "Refresh: every check, in order", "page script, line 6530").
2. Compare what the page says with the new code. Update the caption, inspector detail, stage label or reference text if it is now wrong. If the change moved the range's first or last line, `--fix` corrects the line numbers first.
3. Re-anchor the citation once the page is right:

   ```bash
   python scripts/docs/check_explainers.py --accept backend/app/api/v1/endpoints/auth.py:988-1014
   ```

   `--accept <file>` accepts every changed citation in that file, but refuses one whose first or last line changed. Accept that one by its full citation after checking the line numbers.

Do not accept a change without reading the page. Accepting re-anchors the page on whatever the code says now, so an unreviewed accept turns a stale page green.

**Manifest value no longer matches.** Update the manifest value, and every place the page states it (stage labels, captions, beat log, sandbox, reference). If the rule stopped finding the value because the code was refactored, update the rule in `scripts/docs/explainer-rules/<page>.json`.

**Citation with no anchor.** You added a citation. Check that the page's claim is true at those lines, then run:

```bash
python scripts/docs/check_explainers.py --stamp
```

`--stamp` also drops anchors that nothing on the page cites any more.

## Adding a page

1. Write the page to `docs/explainers/<slug>.html` (the `explainer` skill does this; its repository configuration is `docs/agents/explainer.md`).
2. Give it a manifest block (`<script type="application/json" id="<slug>-manifest">`) holding only values that exist in source.
3. Add `scripts/docs/explainer-rules/<slug>.json`: the manifest and data block ids, an `aliases` entry for every bare filename the page cites, `scriptPathMaps` if its script builds citations from a path map, and one rule per manifest key. Copy `session-lifecycle.json` for the rule types (`int`, `arith`, `bool`, `str`, `list`, `pairs`, `map`, `concat`, `present`).
4. Run `python scripts/docs/check_explainers.py --stamp` once every citation has been checked against the code.
5. Add the page to `docs/explainers/index.md` and to the `Explainers` section of `mkdocs.yml`.

## Tests

```bash
python -m unittest discover -s scripts/docs -p "test_*.py"
```
