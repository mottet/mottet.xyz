---
name: wip-check
description: Check at the start of a session, or before starting a new task, whether this checkout already holds work in progress (uncommitted changes, untracked files, stashes) that has nothing to do with the current request, and sort it out before touching anything. Use when the SessionStart hook reports work in progress, when the user asks "what is going on here", or whenever git status is not clean and the new request is about something else.
---

# Work-in-progress check

Goal: never mix two pieces of work in one working tree. Before starting the
user's request, find out what is already in flight, decide whether the request
belongs to it, and if not, set the existing work aside cleanly.

## 1. Inventory what is in flight

Run, from the repository root:

```sh
git status --short
git stash list
git branch --show-current
git log --oneline -5
```

If everything is clean and there are no stashes, say so in one line and go
straight to the request. Otherwise continue.

## 2. Group the changes into workstreams

Do not treat the diff as one blob. Sort the modified and untracked files into
groups that would each make sense as a single commit:

- **Name prefix.** Files sharing a prefix (`glyphs-*`, `board.*`, `check-foo.cjs`)
  almost always belong together.
- **Cross-references.** Grep a new file's name inside the others. A page that
  loads a script, a server that `require`s a module, a test that opens a page:
  these tie files into the same stream.
- **Shared files.** `package.json`, `server.js`, a README, an index page often
  carry hunks from several streams. Read those hunks and assign each one.
- **Timestamps.** `ls -lt` on the changed files shows which were written in the
  same sitting.

For each stream, write one line: name, the files, and what it does. Flag any
hunk you could not attribute.

## 3. Compare with the request

Decide whether the user's current request is part of one of those streams.
Same feature, same files, a follow-up on what the latest commit started: it is
related, proceed. A different page, game, tool, or a bug elsewhere: it is not.

## 4. If the request is unrelated, stop and say so

Tell the user, briefly, what is already in progress (the stream list from
step 2) and that starting the new request on top of it would mix the two.
Offer the ways to set the existing work aside and let them choose:

1. **Commit it** as one commit per stream, if it is in a committable state.
   Split shared files by hunk; build intermediate versions of a shared file
   rather than using interactive `git add -p`, which is not available here.
2. **Stash it** (`git stash push -u -m "<stream name>"`) if it is half done.
3. **Work in a worktree** for the new request and leave the tree as it is.

Do not pick for them silently. If the session is autonomous and nobody can
answer, prefer option 1 when every stream is coherent and its checks pass,
otherwise option 3, and report what you did.

## 5. If the request is related, proceed

Say in one line which stream you are continuing, so the user knows the new
work will land alongside it.

## Conventions in this repository

- Browser checks live in `scripts/check-*.cjs` and are run through `npm run
  test:<name>` with `HOUSE_TEST_TOOLS` pointing at the Playwright install (see
  `scripts/README.md`).
- Each page or game has its own prefix under `public/` and its own section in
  `scripts/README.md`; a README hunk belongs to the stream whose section it
  edits.
