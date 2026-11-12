# Explainer skill: repository configuration

Read by the `explainer` skill (`.claude/skills/explainer/SKILL.md`, *Consumer configuration*).

| Key | Value |
| --- | --- |
| `Output dir` | `docs/explainers/` |
| `Reference page` | `docs/explainers/session-lifecycle.html` |
| `Gate command` | `python scripts/docs/check_explainers.py` (it checks every page; `<path>` is not needed) |
| `Font source` | none (system font stacks) |
| `Drift-proofing` | `manifest+anchors` |
| `Builder agent` | none |
| `Register step` | Add `scripts/docs/explainer-rules/<slug>.json` (manifest rules, aliases, data block ids), then run `python scripts/docs/check_explainers.py --stamp` after checking every citation. Add the page to `docs/explainers/index.md` and to the `Explainers` section of `mkdocs.yml`. |

## Notes for the builder

- **Anchors.** The anchors block (`citation-anchors`) is written by `check_explainers.py --stamp`, not by hand. It records a hash of each whole cited range, so any edit inside a range fails CI.
- **Citations in script data.** These must name their file in the same string, or use a path map listed in the rules file's `scriptPathMaps`.
- **Manifest rules.** Every manifest key needs a rule in the rules file, or the gate fails.

The full workflow is in `docs/development/explainer-pages.md`.
