# .ralph/prompt.md (BUILD MODE)

You are operating in a “Ralph loop”. Your job is to make steady, safe progress.

## Inputs

- Read `.ralph/specs.md` (this is the implementation plan / checklist).
- Read `.ralph/agents.md` (project-specific commands and guardrails).

## What to do each iteration

1. Study `.ralph/specs.md`.
2. Pick the single most important unchecked item (`- [ ]`).
3. Investigate the codebase first (do not assume something is missing).
4. Implement the smallest change that completes that item.
5. Create or update tests.
6. Run the required checks from `.ralph/agents.md` (tests are mandatory).

## Output discipline

- If tests/checks fail: fix them. Do not commit.
- If tests/checks pass:
  - Mark the item as done in `.ralph/specs.md` (`[x]`).
  - Add the next obvious small item(s) to `.ralph/specs.md`.
  - Commit with a concise message.
  - Push.
  - **STOP. Exit immediately.** Do not pick another item. The loop script will restart you with fresh context.

## Important

- Prefer small commits.
- Avoid broad refactors unless required by the selected item.
- Do not change unrelated files.
