/**
 * Behaviour suite for `config.mjs regate` and `config.mjs land`: the Chief of
 * Staff's re-gate and landing checks, which it used to type by hand. Each test
 * builds a temporary git repository and runs the command against it, so what
 * is pinned is what git ends up holding: the worktree gone, the integration
 * branch moved only when every check held, and each refusal named.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, test } from "node:test";

import { main } from "./config.mjs";

const made = [];
after(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@example.com",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@example.com",
};
const git = (cwd, ...args) =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", env: GIT_ENV }).trim();

/** A repository on `main` holding `files`, in a temporary folder; returns its real path. */
function repo(files = { "README.md": "hello\n" }) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "orchestrate-gate-")));
  made.push(dir);
  git(dir, "init", "-q", "-b", "main");
  commit(dir, files, "start");
  return dir;
}

/** Write `files` (a null value deletes), commit them, return the new commit. */
function commit(dir, files, message = "change") {
  for (const [path, text] of Object.entries(files)) {
    const file = join(dir, path);
    if (text === null) rmSync(file);
    else {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, text);
    }
  }
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "--allow-empty", "-m", message);
  return git(dir, "rev-parse", "HEAD");
}

const CONFIG = "orchestrate.config.json";
const configText = (regate) =>
  JSON.stringify({
    read_first: [],
    routes: { commit: "c", pull_request: "p" },
    regate,
  });

const run = (dir, ...argv) => main(argv, { cwd: dir });

describe("regate", () => {
  const OUT = "tmp/orchestrate/r/evidence/regate.json";
  const worktrees = (dir) =>
    git(dir, "worktree", "list", "--porcelain")
      .split("\n")
      .filter((l) => l.startsWith("worktree "));

  test("runs each command in a detached worktree at the sha, writes the results, and removes the worktree", () => {
    const dir = repo({ [CONFIG]: configText(["cat marker.txt", "git rev-parse HEAD"]) });
    const first = commit(dir, { "marker.txt": "one\n" });
    commit(dir, { "marker.txt": "two\n" });
    const { code, out } = run(dir, "regate", first, "--out", OUT);
    assert.equal(code, 0, out);
    const result = JSON.parse(readFileSync(join(dir, OUT), "utf8"));
    assert.equal(result.sha, first);
    assert.equal(result.ok, true);
    assert.deepEqual(
      result.results.map((r) => [r.command, r.code]),
      [
        ["cat marker.txt", 0],
        ["git rev-parse HEAD", 0],
      ],
    );
    assert.match(result.results[0].output, /one/);
    assert.match(result.results[1].output, new RegExp(first));
    assert.equal(worktrees(dir).length, 1, "only the main worktree is left");
    assert.ok(!existsSync(join(dir, "tmp/orchestrate/r/evidence", `regate-${first.slice(0, 12)}`)));
  });

  test("a command that fails with no test named fails the re-gate, and names the command", () => {
    const dir = repo({ [CONFIG]: configText(["exit 3"]) });
    const { code, out } = run(dir, "regate", "HEAD", "--out", OUT);
    assert.equal(code, 1);
    assert.match(out, /`exit 3`/);
    assert.match(out, /exit 3/);
    assert.equal(JSON.parse(readFileSync(join(dir, OUT), "utf8")).ok, false);
  });

  test("every command runs, and the worktree is removed, when an early one fails", () => {
    const dir = repo({ [CONFIG]: configText(["exit 1", "echo still-ran"]) });
    const { code } = run(dir, "regate", "HEAD", "--out", OUT);
    assert.equal(code, 1);
    const result = JSON.parse(readFileSync(join(dir, OUT), "utf8"));
    assert.equal(result.results.length, 2);
    assert.match(result.results[1].output, /still-ran/);
    assert.equal(worktrees(dir).length, 1);
  });

  const NODE_FAIL = (names, count = names.length) =>
    `printf '%s\\n' 'ℹ fail ${count}' '' '✖ failing tests:' '' ${names
      .map((n) => `'✖ ${n} (1.5ms)'`)
      .join(" ")}; exit 1`;
  const allowing = (...tests) =>
    tests.map((test) => ({ test, reason: "fails on main too, macOS" }));

  test("failures that are all on the allowed list pass the re-gate, and are reported as allowed", () => {
    const dir = repo({
      [CONFIG]: configText({
        commands: [NODE_FAIL(["checks the report in the sandbox", "another known one"])],
        allowed_failures: allowing("checks the report in the sandbox", "another known one"),
      }),
    });
    const { code, out } = run(dir, "regate", "HEAD", "--out", OUT);
    assert.equal(code, 0, out);
    assert.match(out, /allowed/);
    const result = JSON.parse(readFileSync(join(dir, OUT), "utf8"));
    assert.equal(result.ok, true);
    assert.deepEqual(result.results[0].allowed, [
      "checks the report in the sandbox",
      "another known one",
    ]);
    assert.deepEqual(result.results[0].unallowed, []);
  });

  test("a failure that is not on the list fails the re-gate, and is named", () => {
    const dir = repo({
      [CONFIG]: configText({
        commands: [NODE_FAIL(["a known one", "a new break"])],
        allowed_failures: allowing("a known one"),
      }),
    });
    const { code, out } = run(dir, "regate", "HEAD", "--out", OUT);
    assert.equal(code, 1);
    assert.match(out, /a new break/);
    assert.doesNotMatch(out, /^ {2}a known one/m);
    const result = JSON.parse(readFileSync(join(dir, OUT), "utf8"));
    assert.deepEqual(result.results[0].unallowed, ["a new break"]);
    assert.deepEqual(result.results[0].allowed, ["a known one"]);
  });

  test("a name is matched whole: a listed name does not allow a longer one", () => {
    const dir = repo({
      [CONFIG]: configText({
        commands: [NODE_FAIL(["a known one, and more"])],
        allowed_failures: allowing("a known one"),
      }),
    });
    const { code, out } = run(dir, "regate", "HEAD", "--out", OUT);
    assert.equal(code, 1);
    assert.match(out, /a known one, and more/);
  });

  test("a pytest FAILED line is matched by the test's name, or by its whole id", () => {
    const pytest = (id) =>
      `printf '%s\\n' '=== short test summary info ===' 'FAILED ${id} - AssertionError: x' '1 failed, 26 passed in 1.4s'; exit 1`;
    for (const listed of ["test_the_launcher", "scripts/a.test.py::test_the_launcher"]) {
      const dir = repo({
        [CONFIG]: configText({
          commands: [pytest("scripts/a.test.py::test_the_launcher")],
          allowed_failures: allowing(listed),
        }),
      });
      assert.equal(run(dir, "regate", "HEAD", "--out", OUT).code, 0, listed);
    }
    const dir = repo({ [CONFIG]: configText([pytest("scripts/a.test.py::test_other")]) });
    const { code, out } = run(dir, "regate", "HEAD", "--out", OUT);
    assert.equal(code, 1);
    assert.match(out, /test_other/);
  });

  test("a command that reports more failures than it names fails the re-gate", () => {
    const dir = repo({
      [CONFIG]: configText({
        commands: [NODE_FAIL(["a known one"], 2)],
        allowed_failures: allowing("a known one"),
      }),
    });
    const { code, out } = run(dir, "regate", "HEAD", "--out", OUT);
    assert.equal(code, 1);
    assert.match(out, /2 failed/);
  });

  test("a pytest tally of failures and errors counts both, so an unnamed error is not excused", () => {
    const dir = repo({
      [CONFIG]: configText({
        commands: [
          "printf '%s\\n' 'FAILED a.py::test_x - boom' '=== 1 failed, 1 error, 3 passed in 0.5s ===' ; exit 1",
        ],
        allowed_failures: allowing("test_x"),
      }),
    });
    const { code, out } = run(dir, "regate", "HEAD", "--out", OUT);
    assert.equal(code, 1);
    assert.match(out, /2 failed, but only 1 named/);
  });

  test("the same test name in two files is two failures: allowing one by its id does not excuse the other", () => {
    const dir = repo({
      [CONFIG]: configText({
        commands: [
          "printf '%s\\n' 'FAILED a.py::test_x - boom' 'FAILED b.py::test_x - boom' '2 failed in 0.5s'; exit 1",
        ],
        allowed_failures: allowing("a.py::test_x"),
      }),
    });
    const { code, out } = run(dir, "regate", "HEAD", "--out", OUT);
    assert.equal(code, 1);
    assert.match(out, /b\.py::test_x/);
  });

  test("failing tests named with no count of them are never allowed", () => {
    const dir = repo({
      [CONFIG]: configText({
        commands: ["printf '%s\\n' 'FAILED a.py::test_x - boom'; exit 1"],
        allowed_failures: allowing("test_x"),
      }),
    });
    const { code, out } = run(dir, "regate", "HEAD", "--out", OUT);
    assert.equal(code, 1);
    assert.match(out, /no count/);
  });

  test("a non-test failure beside an allowed test failure is not excused", () => {
    const named = "printf '%s\\n' 'FAILED a.py::test_x - boom' '1 failed in 0.5s'";
    const listed = allowing("test_x");
    const cases = [
      [
        "a coverage threshold",
        `${named}; echo 'FAIL Required test coverage of 90% not reached'; exit 1`,
        /coverage/,
      ],
      ["a pytest usage error (exit 2)", `${named}; exit 2`, /exited 2/],
      ["pytest's internal error (exit 3)", `${named}; exit 3`, /exited 3/],
    ];
    for (const [what, command, expected] of cases) {
      const dir = repo({ [CONFIG]: configText({ commands: [command], allowed_failures: listed }) });
      const { code, out } = run(dir, "regate", "HEAD", "--out", OUT);
      assert.equal(code, 1, what);
      assert.match(out, expected, what);
    }
    const plain = repo({
      [CONFIG]: configText({ commands: [`${named}; exit 1`], allowed_failures: listed }),
    });
    assert.equal(
      run(plain, "regate", "HEAD", "--out", OUT).code,
      0,
      "exit 1 with the named test alone",
    );
  });

  test("a command that passes is ok, whatever the allowed list holds", () => {
    const dir = repo({
      [CONFIG]: configText({ commands: ["true"], allowed_failures: allowing("never fails") }),
    });
    assert.equal(run(dir, "regate", "HEAD", "--out", OUT).code, 0);
  });

  test("the commands come from the repository's own config, never from the commit under test", () => {
    const dir = repo({ [CONFIG]: configText(["true"]) });
    const bad = commit(dir, { [CONFIG]: configText(["exit 1"]) });
    git(dir, "checkout", "-q", "main");
    // The working copy keeps `true`; the commit under test rewrote the config.
    writeFileSync(join(dir, CONFIG), configText(["true"]));
    assert.equal(run(dir, "regate", bad, "--out", OUT).code, 0);
  });

  test("an empty regate list passes: CI is left to CI", () => {
    const dir = repo({ [CONFIG]: configText([]) });
    const { code, out } = run(dir, "regate", "HEAD", "--out", OUT);
    assert.equal(code, 0);
    assert.match(out, /no re-gate commands/);
  });

  test("a config with no regate, or with problems, is refused before any worktree is made", () => {
    const dir = repo({ [CONFIG]: JSON.stringify({ read_first: [], routes: { commit: "c" } }) });
    assert.equal(run(dir, "regate", "HEAD", "--out", OUT).code, 2);
    assert.equal(worktrees(dir).length, 1);
    const bad = repo({ [CONFIG]: JSON.stringify({ nope: 1 }) });
    assert.equal(run(bad, "regate", "HEAD", "--out", OUT).code, 2);
  });

  test("--out outside the run folder, an unknown sha, and missing arguments are refused", () => {
    const dir = repo({ [CONFIG]: configText(["true"]) });
    const outside = run(dir, "regate", "HEAD", "--out", "elsewhere/regate.json");
    assert.equal(outside.code, 2);
    assert.match(outside.out, /run folder `tmp\/orchestrate`/);
    assert.ok(!existsSync(join(dir, "elsewhere")));
    const unknown = run(dir, "regate", "0123456789abcdef", "--out", OUT);
    assert.equal(unknown.code, 2);
    assert.match(unknown.out, /not a commit/);
    assert.equal(run(dir, "regate", "--out", OUT).code, 2);
    assert.equal(run(dir, "regate", "HEAD").code, 2);
    assert.equal(run(dir, "regate", "HEAD", "--out").code, 2);
    assert.equal(worktrees(dir).length, 1);
  });
});

describe("land", () => {
  const FENCE = ["--fence", "src/**", "docs/*.md"];

  /** A repo on `main`, an integration branch at the cut, and a ticket branch with `files` committed on it. */
  function landing(files = { "src/a.txt": "a\n" }) {
    const dir = repo({ "README.md": "hello\n" });
    git(dir, "branch", "orchestrate/spec-1", "main");
    git(dir, "switch", "-q", "-c", "ticket", "orchestrate/spec-1");
    const cut = git(dir, "rev-parse", "HEAD");
    const head = commit(dir, files, "ticket");
    git(dir, "switch", "-q", "main");
    return { dir, cut, head };
  }
  const land = (dir, cut, ...rest) =>
    run(dir, "land", "ticket", "--cut", cut, "--onto", "orchestrate/spec-1", ...rest);
  const ref = (dir, name) => git(dir, "rev-parse", `refs/heads/${name}`);

  test("moves the integration branch to the ticket's head, by update-ref alone", () => {
    const { dir, cut, head } = landing({ "src/a.txt": "a\n", "docs/b.md": "b\n" });
    const mainBefore = ref(dir, "main");
    const { code, out } = land(dir, cut, ...FENCE);
    assert.equal(code, 0, out);
    assert.equal(ref(dir, "orchestrate/spec-1"), head);
    assert.deepEqual(JSON.parse(out), {
      landed: true,
      branch: "ticket",
      onto: "orchestrate/spec-1",
      old: cut,
      new: head,
    });
    assert.equal(ref(dir, "ticket"), head, "the ticket branch is untouched");
    assert.equal(ref(dir, "main"), mainBefore, "no other branch moves");
    assert.equal(git(dir, "status", "--porcelain"), "", "no working copy changes");
  });

  test("takes a commit as well as a branch name: the pinned commit is what moves", () => {
    const { dir, cut, head } = landing();
    commit(dir, { "src/later.txt": "x\n" }); // on main: a stray commit, not the ticket's
    const moved = run(dir, "land", head, "--cut", cut, "--onto", "orchestrate/spec-1", ...FENCE);
    assert.equal(moved.code, 0, moved.out);
    assert.equal(ref(dir, "orchestrate/spec-1"), head);
  });

  const refused = (result, cause, dir, onto) => {
    assert.equal(result.code, 1, result.out);
    const body = JSON.parse(result.out);
    assert.equal(body.landed, false);
    assert.equal(body.refusal, cause);
    if (dir)
      assert.equal(ref(dir, "orchestrate/spec-1"), onto, "the integration branch did not move");
    return body;
  };

  test("refuses a branch that does not descend from the cut", () => {
    const { dir, head } = landing();
    const other = commit(dir, { "src/other.txt": "o\n" }); // on main, past the cut
    const before = ref(dir, "orchestrate/spec-1");
    const body = refused(land(dir, other, ...FENCE), "not-descended", dir, before);
    assert.match(body.cause, /does not descend from the cut/);
    assert.equal(ref(dir, "ticket"), head);
  });

  test("refuses a path outside the fence, and names each one", () => {
    const { dir, cut } = landing({
      "src/a.txt": "a\n",
      "lib/x.txt": "x\n",
      "docs/deep/c.md": "c\n",
    });
    const before = ref(dir, "orchestrate/spec-1");
    const body = refused(land(dir, cut, ...FENCE), "outside-fence", dir, before);
    assert.deepEqual(body.paths, ["docs/deep/c.md", "lib/x.txt"]);
    assert.match(body.cause, /lib\/x\.txt/);
  });

  test("a deleted or renamed path counts too: both sides are checked", () => {
    const dir = repo({ "README.md": "hello\n", "lib/old.txt": "o\n" });
    git(dir, "branch", "orchestrate/spec-1", "main");
    git(dir, "switch", "-q", "-c", "ticket", "orchestrate/spec-1");
    const cut = git(dir, "rev-parse", "HEAD");
    mkdirSync(join(dir, "src"));
    git(dir, "mv", "lib/old.txt", "src/new.txt");
    commit(dir, {}, "rename");
    git(dir, "switch", "-q", "main");
    const body = refused(land(dir, cut, ...FENCE), "outside-fence");
    assert.deepEqual(body.paths, ["lib/old.txt"]);
  });

  test("fence globs: ** crosses folders, * stays in one, a trailing / is the whole folder, ? is one character", () => {
    const { dir, cut } = landing({
      "a/b/c.txt": "1\n",
      "a/d.md": "2\n",
      "e/f/g.md": "3\n",
      "h1.x": "4\n",
    });
    const ok = land(dir, cut, "--fence", "a/**", "e/", "h?.x");
    assert.equal(ok.code, 0, ok.out);
    const second = landing({ "a/b/c.txt": "1\n" });
    const star = land(second.dir, second.cut, "--fence", "a/*");
    assert.equal(star.code, 1, "* does not cross a /");
    assert.deepEqual(JSON.parse(star.out).paths, ["a/b/c.txt"]);
  });

  test("what the integration branch already holds does not count when the branch merged it in", () => {
    const { dir, cut } = landing({ "src/a.txt": "a\n" });
    // An earlier ticket landed after the cut, outside this ticket's fence.
    git(dir, "switch", "-q", "-C", "earlier", "orchestrate/spec-1");
    const earlier = commit(dir, { "lib/earlier.txt": "e\n" }, "an earlier ticket");
    git(dir, "update-ref", "refs/heads/orchestrate/spec-1", earlier);
    git(dir, "switch", "-q", "ticket");
    git(dir, "merge", "-q", "--no-edit", "orchestrate/spec-1");
    git(dir, "switch", "-q", "main");
    const { code, out } = land(dir, cut, ...FENCE);
    assert.equal(code, 0, out);
    assert.equal(ref(dir, "orchestrate/spec-1"), ref(dir, "ticket"));
  });

  test("a merge that reverts an earlier ticket's path outside the fence is refused: the move changes it", () => {
    const { dir, cut } = landing({ "src/a.txt": "a\n" });
    // An earlier ticket lands lib/earlier.txt, outside this ticket's fence.
    git(dir, "switch", "-q", "-C", "earlier", "orchestrate/spec-1");
    commit(dir, { "lib/earlier.txt": "e\n" }, "an earlier ticket");
    git(dir, "update-ref", "refs/heads/orchestrate/spec-1", "earlier");
    // This ticket merges it in, then resolves the path back to its cut content (absent).
    git(dir, "switch", "-q", "ticket");
    git(dir, "merge", "-q", "--no-edit", "orchestrate/spec-1");
    git(dir, "rm", "-q", "lib/earlier.txt");
    commit(dir, {}, "revert the earlier ticket's file");
    git(dir, "switch", "-q", "main");
    const before = ref(dir, "orchestrate/spec-1");
    const body = refused(land(dir, cut, ...FENCE), "outside-fence", dir, before);
    assert.deepEqual(body.paths, ["lib/earlier.txt"]);
  });

  test("--fence takes several globs after it, or the flag repeated", () => {
    const { dir, cut } = landing({ "src/a.txt": "a\n", "docs/b.md": "b\n" });
    assert.equal(land(dir, cut, "--fence", "src/**", "--fence", "docs/*.md").code, 0);
  });

  test("refuses while a worktree has the integration branch checked out, and names the worktree", () => {
    const { dir, cut } = landing();
    const elsewhere = join(dir, "..", `wt-${Date.now()}`);
    made.push(elsewhere);
    git(dir, "worktree", "add", "-q", elsewhere, "orchestrate/spec-1");
    const before = ref(dir, "orchestrate/spec-1");
    const body = refused(land(dir, cut, ...FENCE), "checked-out", dir, before);
    assert.match(
      body.cause,
      new RegExp(realpathSync(elsewhere).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  });

  test("refuses when the integration branch is not an ancestor of the branch: it moved after the cut", () => {
    const { dir, cut } = landing();
    git(dir, "switch", "-q", "-C", "scratch", "orchestrate/spec-1");
    const moved = commit(dir, { "src/earlier.txt": "e\n" }, "an earlier ticket landed");
    git(dir, "switch", "-q", "main");
    git(dir, "update-ref", "refs/heads/orchestrate/spec-1", moved);
    const body = refused(land(dir, cut, ...FENCE), "not-fast-forward", dir, moved);
    assert.match(body.cause, /not an ancestor/);
  });

  test("a moved integration branch is refused as such, not as a path outside the fence", () => {
    const { dir, cut } = landing({ "src/a.txt": "a\n" });
    git(dir, "switch", "-q", "-C", "scratch", "orchestrate/spec-1");
    const moved = commit(dir, { "lib/earlier.txt": "e\n" }, "an earlier ticket landed");
    git(dir, "switch", "-q", "main");
    git(dir, "update-ref", "refs/heads/orchestrate/spec-1", moved);
    refused(land(dir, cut, ...FENCE), "not-fast-forward", dir, moved);
  });

  test("refuses an unknown branch, cut or integration branch, naming it", () => {
    const { dir, cut } = landing();
    const noBranch = run(
      dir,
      "land",
      "nope",
      "--cut",
      cut,
      "--onto",
      "orchestrate/spec-1",
      ...FENCE,
    );
    assert.equal(noBranch.code, 1);
    assert.match(JSON.parse(noBranch.out).cause, /`nope`/);
    const noCut = land(dir, "0123456789abcdef", ...FENCE);
    assert.equal(noCut.code, 1);
    assert.match(JSON.parse(noCut.out).cause, /0123456789abcdef/);
    const noOnto = run(dir, "land", "ticket", "--cut", cut, "--onto", "missing", ...FENCE);
    assert.equal(noOnto.code, 1);
    assert.match(JSON.parse(noOnto.out).cause, /`missing`/);
  });

  test("never merges, rebases or pushes: a branch that cannot fast-forward is refused, not merged", () => {
    const { dir, cut } = landing();
    const remote = realpathSync(mkdtempSync(join(tmpdir(), "orchestrate-gate-remote-")));
    made.push(remote);
    git(remote, "init", "-q", "--bare");
    git(dir, "remote", "add", "origin", remote);
    land(dir, cut, ...FENCE);
    assert.equal(git(remote, "for-each-ref", "refs/heads"), "", "nothing was pushed");
    assert.equal(git(dir, "rev-list", "--merges", "--count", "--all"), "0");
  });

  test("bad usage exits 2: no branch, no --cut, no --onto, no fence, an unknown option", () => {
    const { dir, cut } = landing();
    for (const argv of [
      ["land", "--cut", cut, "--onto", "orchestrate/spec-1", ...FENCE],
      ["land", "ticket", "--onto", "orchestrate/spec-1", ...FENCE],
      ["land", "ticket", "--cut", cut, ...FENCE],
      ["land", "ticket", "--cut", cut, "--onto", "orchestrate/spec-1"],
      ["land", "ticket", "--cut", cut, "--onto", "orchestrate/spec-1", "--fence"],
      ["land", "ticket", "--cut", cut, "--onto", "orchestrate/spec-1", "--force", ...FENCE],
    ])
      assert.equal(run(dir, ...argv).code, 2, argv.join(" "));
  });
});
