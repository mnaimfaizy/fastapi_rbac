// The npm Package Resolver: how this skill learns what is installed.
//
// A Baseline is the version actually installed (DESIGN.md §1), and an
// Ecosystem's members are discovered by its lead's scope (DESIGN.md §2). Both
// questions are about one package manager's install tree, so both answers live
// behind this one interface:
//
//   installedVersion(name)      -> the installed version string, or null
//   discoverScopeMembers(prefix) -> every installed package under `@scope/`
//
// This is the only resolver the skill ships. It reads each package's own
// manifest under `node_modules`, which covers npm, Yarn with the node-modules
// linker, and pnpm. It does not cover Yarn Plug'n'Play, and it does not cover
// another ecosystem's install tree (pip, uv, Cargo, Go modules). An Ecosystem
// whose lead it cannot find is a failed hop with a reason, never a guessed
// Baseline. A resolver for another package manager implements the same two
// functions and is chosen by `resolverFor` below.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * @param {string} repo the repository root
 * @returns {{
 *   name: string,
 *   installedVersion: (name: string) => string | null,
 *   discoverScopeMembers: (prefix: string) => string[],
 * }}
 */
export function npmResolver(repo) {
  const modules = join(repo, "node_modules");
  return {
    name: "npm",
    installedVersion(name) {
      const manifest = join(modules, ...name.split("/"), "package.json");
      if (!existsSync(manifest)) return null;
      try {
        const parsed = JSON.parse(readFileSync(manifest, "utf8"));
        return typeof parsed.version === "string" ? parsed.version : null;
      } catch {
        return null;
      }
    },
    discoverScopeMembers(prefix) {
      // scopePrefixFor (baseline.mjs) always returns `@scope/`.
      const scope = prefix.replace(/\/$/, "");
      const dir = join(modules, scope);
      if (!existsSync(dir)) return [];
      return (
        readdirSync(dir, { withFileTypes: true })
          // pnpm, workspaces and `npm link` install a scope member as a
          // symbolic link (a junction on Windows), which a Dirent reports as a
          // link, not a directory: follow it, and drop one that leads nowhere.
          .filter(
            (entry) =>
              entry.isDirectory() ||
              (entry.isSymbolicLink() &&
                statSync(join(dir, entry.name), { throwIfNoEntry: false })?.isDirectory()),
          )
          .map((entry) => `${scope}/${entry.name}`)
      );
    },
  };
}

/**
 * The resolver for a repository. One today; the seam is where a second goes.
 *
 * @param {string} repo
 */
export const resolverFor = (repo) => npmResolver(repo);
