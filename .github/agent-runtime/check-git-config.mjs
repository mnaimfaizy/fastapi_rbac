#!/usr/bin/env node
// Check a checkout's git directory before credentialed code runs git in it:
// every repository config key must be on an allowlist, and .git/hooks must hold
// only git's own samples.
//
// Why an allowlist: git runs commands that many config keys name (core.fsmonitor,
// core.hooksPath, core.sshCommand, credential.helper, diff and filter drivers,
// aliases, remote upload/receive packs) and pulls in more config through
// include.path and includeIf. A list of dangerous keys would always be missing
// one; the keys a checkout and claude-code-action legitimately write are few.
//
// The config is read with `git config --file`, so git's own parser decides what
// a key is, includes are not followed, and nothing in the file is run. git runs
// from this script's directory, outside the checkout, with system and global
// config off.
//
// Usage: node check-git-config.mjs <path to .git>. Prints each problem and
// exits 1 when there are any; exits 0 silently when there are none.
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Names as `git config --name-only` prints them: section and key lowercased,
// subsection as written.
const ALLOWED = [
  // actions/checkout, including sparse and partial clones
  /^core\.(repositoryformatversion|filemode|bare|logallrefupdates|ignorecase|precomposeunicode|symlinks|sparsecheckout|sparsecheckoutcone)$/,
  /^extensions\.(objectformat|partialclone)$/,
  /^gc\.auto$/,
  /^remote\.origin\.(url|fetch|promisor|partialclonefilter)$/,
  // claude-code-action's identity and token-bearing remote URL; a push or a
  // checkout's tracking branch
  /^user\.(name|email)$/,
  /^branch\..+\.(remote|merge)$/,
];

/** The config names that are not on the allowlist. */
export function unexpectedConfigNames(names) {
  return names.filter((name) => !ALLOWED.some((pattern) => pattern.test(name)));
}

function configNames(gitDir) {
  const here = dirname(fileURLToPath(import.meta.url));
  const out = execFileSync(
    "git",
    ["config", "--file", join(gitDir, "config"), "--no-includes", "--name-only", "--list"],
    {
      cwd: here,
      encoding: "utf8",
      env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  return out.split("\n").filter(Boolean);
}

function unexpectedHooks(gitDir) {
  let entries;
  try {
    entries = readdirSync(join(gitDir, "hooks"));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  return entries.filter((name) => !name.endsWith(".sample"));
}

/** Problems with a git directory, as messages; empty when it is safe to use. */
export function checkGitDir(gitDir) {
  const problems = [];
  try {
    for (const name of unexpectedConfigNames(configNames(gitDir))) {
      problems.push(`git config key outside the allowlist: ${name}`);
    }
  } catch {
    problems.push(`could not read ${join(gitDir, "config")}`);
  }
  try {
    for (const name of unexpectedHooks(gitDir)) {
      problems.push(`unexpected git hook: hooks/${name}`);
    }
  } catch {
    problems.push(`could not list ${join(gitDir, "hooks")}`);
  }
  return problems;
}

function main() {
  const gitDir = process.argv[2];
  if (!gitDir) {
    console.error("usage: check-git-config.mjs <path to .git>");
    process.exit(1);
  }
  const problems = checkGitDir(gitDir);
  for (const problem of problems) console.log(problem);
  process.exit(problems.length ? 1 : 0);
}

const invoked = process.argv[1];
if (invoked && import.meta.url === pathToFileURL(invoked).href) {
  main();
}
