# RALPH.md — How to use this template

## Files

- `specs.md`
  - Your living checklist / implementation plan.
  - Keep tasks small: 1 checkbox ≈ 1 loop iteration.

- `prompt.md` (BUILD mode)
  - Implements the most important unchecked item.
  - Must add/run tests.
  - When green: update `specs.md`, commit, push.

- `.ralph/prompt.planning.md` (PLANNING mode)
  - Rewrites/prioritizes `specs.md` only.
  - No code changes, no tests, no commits.

- `.ralph/agents.md`
  - Backpressure: the exact commands to run for tests/lint/build.
  - Edit this per repo.

## Typical workflow

1. Copy the template:

```bash
cp -R ~/projects/ralph-wiggum-template ~/projects/my-new-thing
cd ~/projects/my-new-thing
```

2. Initialize git + set remote:

```bash
git init
git remote add origin <YOUR_REMOTE>
```

3. Edit `specs.md` and `.ralph/agents.md`.

4. Run PLANNING once (optional but useful on messy repos):

```bash
./scripts/ralph-claude.sh .ralph/prompt.planning.md
```

5. Run BUILD loop:

```bash
./scripts/ralph-claude.sh
# or
./scripts/ralph-codex.sh
```

## Guard rail: clean working tree required

The loop scripts refuse to run unless:

- you are inside a git repo, and
- `git status` is clean

Why: it prevents the agent from piling changes on top of unknown local edits.

If you *want* to run dirty sometimes, remove the `require_clean_git` function.

## Stopping / recovery

- Stop the loop: `Ctrl+C`
- If the agent made a mess:
  - `git restore .` (discard changes) or
  - `git reset --hard HEAD` (more forceful)

(Use with care.)
