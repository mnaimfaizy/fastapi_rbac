// The filesystem seam every command in this skill reads the repository through.
//
// Each command's logic is pure over `{read, list, exists}` so its contract
// suite drives a file map instead of a tree; this is the one place those three
// functions are bound to a real directory. A second copy per command was three
// chances to disagree about what "absent" means — a directory, or a file this
// process cannot read, is absent to `read` and present to `exists`, and only
// `exists` is asked of a declined entry's site.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * @param {string} repo the repository root
 * @returns {{
 *   read: (path: string) => string | null,
 *   list: (dir: string) => string[] | null,
 *   exists: (path: string) => boolean,
 * }}
 */
export function repoIo(repo) {
  return {
    read(path) {
      const absolute = join(repo, path);
      if (!existsSync(absolute)) return null;
      try {
        return readFileSync(absolute, "utf8");
      } catch {
        return null;
      }
    },
    list(dir) {
      const absolute = join(repo, dir);
      if (!existsSync(absolute)) return null;
      try {
        return readdirSync(absolute, { withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => entry.name);
      } catch {
        return null;
      }
    },
    exists: (path) => existsSync(join(repo, path)),
  };
}

/** `--repo <dir>` out of argv, defaulting to the working directory. */
export function repoFromArgv(argv) {
  const index = argv.indexOf("--repo");
  return index === -1 ? process.cwd() : argv[index + 1] || process.cwd();
}
