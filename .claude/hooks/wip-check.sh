#!/usr/bin/env bash
# SessionStart hook: report work already in progress in this checkout so the
# session can run the wip-check skill before starting anything unrelated.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 0
status=$(git status --short 2>/dev/null)
stashes=$(git stash list 2>/dev/null | head -5)
branch=$(git branch --show-current 2>/dev/null)
if [ -z "$status" ] && [ -z "$stashes" ]; then
  exit 0
fi
msg="Work in progress found in this checkout (branch: ${branch:-detached})."
[ -n "$status" ] && msg="$msg
Uncommitted changes:
$status"
[ -n "$stashes" ] && msg="$msg
Stashes:
$stashes"
msg="$msg
Before acting on the user's request, run the wip-check skill: group these changes into workstreams and, if the request is unrelated to them, tell the user and agree on how to set the existing work aside (commit, stash or worktree) so two pieces of work never mix."
WIP_MSG="$msg" node -e 'process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:process.env.WIP_MSG}}))'
