// Is this module the script Node was asked to run?
//
// The three CLIs in this directory (`resolve-baseline.mjs`, `resolve-ledger.mjs`,
// `validate-report.mjs`) are also imported by tests and by host checkers, so each
// runs `main` only when it is the entry point. The old inline test,
// `import.meta.url === \`file://${process.argv[1]}\``, is never true on Windows:
// argv[1] is `D:\…\x.mjs` while the URL is `file:///D:/…/x.mjs`. The CLI then
// did nothing and exited 0 — which is how a validator that never ran read as a
// validator that passed.
//
// Both sides are compared as real paths, so a run through a symlinked skill
// directory (`.claude/skills` → `.agents/skills`) still counts as the entry point.
//
// The skill is portable (DESIGN.md, Boundary): Node built-ins only.
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const real = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

/**
 * @param {string} moduleUrl the caller's `import.meta.url`
 * @param {string | undefined} [scriptPath] defaults to `process.argv[1]`
 * @returns {boolean}
 */
export const isEntryPoint = (moduleUrl, scriptPath = process.argv[1]) =>
  Boolean(scriptPath) && real(fileURLToPath(moduleUrl)) === real(scriptPath);
