#!/usr/bin/env node
// Prepares the QA Stack before qa.config.yml's `run.stack.up` starts it.
//
// 1. Each dev env file the compose files read must exist. Both are gitignored,
//    so a git worktree starts without them. A missing one is copied from the
//    main checkout (found through `git rev-parse --git-common-dir`). An
//    existing file is never overwritten. With no copy to take, this exits 1
//    and names the file.
// 2. The external `fastapi_rbac_dev_network` network must exist.
//
// Node, not shell, so the same command runs in cmd.exe and /bin/sh. Run it from
// the repository root. It prints file names only, never their contents.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ENV_FILES = ["backend/.env.development", "react-frontend/.env.development"];
const NETWORK = "fastapi_rbac_dev_network";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

const root = resolve(git("rev-parse", "--show-toplevel"));
// --git-common-dir is the main checkout's .git, from any worktree.
const mainRoot = resolve(dirname(resolve(root, git("rev-parse", "--git-common-dir"))));

let missing = 0;
for (const file of ENV_FILES) {
  const target = join(root, file);
  if (existsSync(target)) continue;
  const source = join(mainRoot, file);
  if (mainRoot !== root && existsSync(source)) {
    copyFileSync(source, target);
    console.log(`prepare-stack: copied ${file} from the main checkout`);
  } else {
    console.error(
      `prepare-stack: ${file} is missing. Create it (it is gitignored) before starting the QA Stack.`,
    );
    missing += 1;
  }
}
if (missing > 0) process.exit(1);

try {
  execFileSync("docker", ["network", "inspect", NETWORK], { stdio: "ignore" });
} catch {
  execFileSync("docker", ["network", "create", NETWORK], { stdio: "inherit" });
}
