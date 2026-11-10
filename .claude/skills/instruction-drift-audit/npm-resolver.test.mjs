/**
 * Contract suite for the npm Package Resolver: scope members are found
 * however the package manager laid them out (ADAPTER.md, Package managers).
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { npmResolver } from "./npm-resolver.mjs";

const repo = mkdtempSync(join(tmpdir(), "instruction-drift-audit-resolver-"));
after(() => rmSync(repo, { recursive: true, force: true }));

const writePackage = (dir, name, version) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version }));
};

test("a scope member installed as a symbolic link is a member, as pnpm installs them", (t) => {
  const scope = join(repo, "node_modules", "@nx");
  writePackage(join(scope, "js"), "@nx/js", "22.7.7");
  // pnpm's layout: the scope entry links into its content-addressed store.
  const store = join(repo, "node_modules", ".pnpm", "@nx+web@22.7.7", "node_modules", "@nx", "web");
  writePackage(store, "@nx/web", "22.7.7");
  try {
    // A junction needs no privilege on Windows; the type is ignored elsewhere.
    symlinkSync(store, join(scope, "web"), "junction");
    symlinkSync(join(repo, "gone"), join(scope, "dangling"), "junction");
  } catch {
    return t.skip("symbolic links unavailable on this machine");
  }
  writeFileSync(join(scope, "README.md"), "not a package");

  const resolver = npmResolver(repo);
  assert.deepEqual(resolver.discoverScopeMembers("@nx/").sort(), ["@nx/js", "@nx/web"]);
  assert.equal(resolver.installedVersion("@nx/web"), "22.7.7");
});
