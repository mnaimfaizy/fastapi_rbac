#!/usr/bin/env bash
# Refresh the local graphify knowledge graph after a commit or a merge/pull.
#
# Called by the pre-commit framework at the post-commit and post-merge stages
# (see .pre-commit-config.yaml). The only argument says which event fired, and
# so how to name the set of files that just changed:
#
#   commit  the files in HEAD
#   merge   git diff ORIG_HEAD..HEAD (fallback HEAD@{1}). This is the hook that
#           covers `git pull`: git merge never fires post-commit, neither for a
#           fast-forward nor for the merge commit it writes itself.
#
# The rebuild is `graphify update .`: AST only, no LLM, no network. It runs
# detached in the background so the git command returns at once; progress goes
# to ~/.cache/graphify-rebuild-<repo folder>.log.
#
# Every guard below exits 0. A skipped refresh must never fail the git command
# that triggered it, and the whole script is a no-op for anyone who has not
# installed graphify and built the graph once, so it is safe to ship to every
# contributor. Opt out for one command with GRAPHIFY_SKIP_HOOK=1.
#
# Full guide: docs/agents/graphify.md

if [ "${GRAPHIFY_SKIP_HOOK:-0}" = "1" ]; then
  exit 0
fi

# Background worker: `--run <graphify binary>`, started detached by the hook
# body below.
#
# It re-parses only the queued changed files. `graphify update .` would
# re-parse the whole repo every time (minutes with one worker), so the worker
# calls graphify.watch._rebuild_code(changed_paths=...) directly, the same
# entry point graphify's own git hooks use. That is a private API, which is
# one reason graphify is pinned (docs/agents/graphify.md). When graphify's
# Python cannot be found, it falls back to the full `graphify update .`.
#
# graphify's own rebuild lock uses fcntl and is a no-op on Windows, so
# concurrent refreshes (two quick commits, a commit right after a pull) would
# race on graphify-out/. A mkdir lock serialises them: every hook appends its
# files to the pending queue, and whoever holds the lock drains the queue until
# it is empty, so no change is skipped.
if [ "${1:-}" = "--run" ]; then
  GRAPHIFY_BIN="$2"
  LOCK=graphify-out/.hook-refresh.lock
  PENDING=graphify-out/.hook-refresh.pending
  WORK=graphify-out/.hook-refresh.work

  # graphify's Python: the shebang of a pip/pipx/uv script on Unix, or the uv
  # tool environment (the only option on Windows, where graphify is an .exe).
  GRAPHIFY_PY=""
  _shebang=$(head -c 200 "$GRAPHIFY_BIN" 2>/dev/null | head -n 1 | tr -d '\r\000') || true
  case "$_shebang" in
    '#!'*python*) GRAPHIFY_PY="${_shebang#\#!}" ;;
  esac
  if [ -z "$GRAPHIFY_PY" ] || [ ! -x "$GRAPHIFY_PY" ]; then
    GRAPHIFY_PY=""
    _tooldir=$(uv tool dir 2>/dev/null | tr -d '\r') || true
    for _py in "$_tooldir/graphifyy/Scripts/python.exe" "$_tooldir/graphifyy/bin/python"; do
      if [ -n "$_tooldir" ] && [ -x "$_py" ]; then
        GRAPHIFY_PY="$_py"
        break
      fi
    done
  fi

  # A lock left behind by a killed refresh would block every later one.
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +30 2>/dev/null)" ]; then
    rmdir "$LOCK" 2>/dev/null || true
  fi

  # Only the lock holder writes to the log. Git for Windows does not make
  # appends from concurrent processes atomic, so a second writer's lines would
  # be overwritten anyway; a worker that finds the lock held just exits.
  while [ -s "$PENDING" ]; do
    if ! mkdir "$LOCK" 2>/dev/null; then
      exit 0
    fi
    while [ -s "$PENDING" ]; do
      mv -f "$PENDING" "$WORK"
      printf '\n=== %s  HEAD %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$(git rev-parse --short HEAD 2>/dev/null)"
      if [ -n "$GRAPHIFY_PY" ]; then
        "$GRAPHIFY_PY" -c '
import sys
from pathlib import Path
from graphify.watch import _rebuild_code
files = sorted({l.strip() for l in open(sys.argv[1], encoding="utf-8") if l.strip()})
print(f"[graphify] {len(files)} changed file(s): incremental rebuild", flush=True)
sys.exit(0 if _rebuild_code(Path("."), changed_paths=[Path(f) for f in files]) else 1)
' "$WORK" || echo "[graphify] incremental rebuild failed (exit $?)"
      else
        echo "[graphify] graphify's Python not found; running a full update"
        "$GRAPHIFY_BIN" update . || echo "[graphify] update failed (exit $?)"
      fi
      rm -f "$WORK"
    done
    rmdir "$LOCK" 2>/dev/null || true
    # Loop again if a hook queued files between the last check and rmdir.
  done
  echo "[graphify] done $(date '+%H:%M:%S')"
  exit 0
fi

TRIGGER="${1:-commit}"

# Locate graphify. `uv tool install` puts it in ~/.local/bin, which is not
# always on PATH for hooks launched from a GUI git client.
GRAPHIFY_BIN=$(command -v graphify 2>/dev/null) || true
if [ -z "$GRAPHIFY_BIN" ] && [ -x "$HOME/.local/bin/graphify" ]; then
  GRAPHIFY_BIN="$HOME/.local/bin/graphify"
fi
if [ -z "$GRAPHIFY_BIN" ]; then
  exit 0
fi

# Only the primary checkout owns graphify-out/. Linked worktrees (for example
# under .claude/worktrees/) share the same hooks, so without this guard a commit
# in a worktree would write a partial graph there and race the primary checkout.
# Both paths are made absolute first, because git can return an absolute git dir
# alongside a relative common dir, and a raw compare would then skip the primary.
_GFY_GITDIR=$(cd "$(git rev-parse --git-dir 2>/dev/null)" 2>/dev/null && pwd) || true
_GFY_COMMONDIR=$(cd "$(git rev-parse --git-common-dir 2>/dev/null)" 2>/dev/null && pwd) || true
if [ -n "$_GFY_COMMONDIR" ] && [ "$_GFY_GITDIR" != "$_GFY_COMMONDIR" ]; then
  exit 0
fi

# Never rebuild mid-rebase, mid-merge or mid-cherry-pick.
for _state in "$_GFY_GITDIR/rebase-merge" "$_GFY_GITDIR/rebase-apply"; do
  if [ -d "$_state" ]; then
    exit 0
  fi
done
for _state in "$_GFY_GITDIR/MERGE_HEAD" "$_GFY_GITDIR/CHERRY_PICK_HEAD"; do
  if [ -f "$_state" ]; then
    exit 0
  fi
done

# Refresh an existing graph only. The first build is a deliberate, manual
# opt-in step (scripts/development/graphify/build-graph.sh).
if [ ! -f graphify-out/graph.json ]; then
  exit 0
fi

case "$TRIGGER" in
  merge)
    if git rev-parse --verify --quiet ORIG_HEAD >/dev/null 2>&1; then
      CHANGED=$(git diff --name-only ORIG_HEAD HEAD 2>/dev/null) || true
    else
      CHANGED=$(git diff --name-only 'HEAD@{1}' HEAD 2>/dev/null) || true
    fi
    TRIGGER_TEXT="merge brought in code"
    ;;
  *)
    CHANGED=$(git diff-tree --no-commit-id --name-only -r HEAD 2>/dev/null) || true
    TRIGGER_TEXT="code changed"
    ;;
esac

# Only source files count. Docs and config changes never trigger a rebuild.
# .graphifyignore still applies on top of this inside graphify.
SOURCES=$(printf '%s\n' "$CHANGED" | grep -E '^(backend/.*\.py|react-frontend/src/.*\.(ts|tsx|js|jsx))$') || true
if [ -z "$SOURCES" ]; then
  exit 0
fi
# Queue them for the background worker, which may already be running.
printf '%s\n' "$SOURCES" >>graphify-out/.hook-refresh.pending

# networkx's louvain clustering iterates string-keyed sets whose order is
# randomised per process. Pinning the hash seed keeps community ids stable, so
# a no-op refresh does not churn the graph.
export PYTHONHASHSEED=0

# Git for Windows hooks can inherit fragile pipe handles from GUI clients and
# agent shells; keep the rebuild single-worker there unless told otherwise.
if [ -n "${WINDIR:-}" ] || [ -n "${MSYSTEM:-}" ]; then
  export GRAPHIFY_MAX_WORKERS="${GRAPHIFY_MAX_WORKERS:-1}"
fi

# Without this, Python buffers output written to a file and the log stays empty
# until the rebuild exits.
export PYTHONUNBUFFERED=1

# One log per repository, appended across refreshes. Trimmed when large, but
# only while no worker is running and writing to it.
GRAPHIFY_LOG="${HOME}/.cache/graphify-rebuild-$(basename "$PWD").log"
mkdir -p "$(dirname "$GRAPHIFY_LOG")"
if [ ! -d graphify-out/.hook-refresh.lock ] && [ -f "$GRAPHIFY_LOG" ] &&
  [ "$(wc -c <"$GRAPHIFY_LOG")" -gt 524288 ]; then
  : >"$GRAPHIFY_LOG"
fi

echo "[graphify] ${TRIGGER_TEXT} - refreshing graph in background (log: $GRAPHIFY_LOG)"
# Detached, with stdin and both output streams off the hook's pipes, so the
# triggering git command returns immediately instead of waiting on the rebuild.
nohup bash "$0" --run "$GRAPHIFY_BIN" >>"$GRAPHIFY_LOG" 2>&1 </dev/null &

exit 0
