# .ralph/agents.md

This file is the *backpressure* and operational knowledge for the loop.

## Required checks

- Tests (REQUIRED):
  - `npx vitest run`

- Typecheck (recommended):
  - `npx nuxi typecheck`

- Lint (recommended, once configured):
  - `npx eslint .`

## Commit / push rules

- Only commit when required checks pass.
- Prefer small, single-purpose commits.

## Repo safety

- Do not touch secrets (tokens, keys). Use `.env` (never committed).
- If unsure about a destructive command, stop and ask.
- Never store raw trauma content in the database — only scores, timestamps, and encrypted blobs.

## Project-specific knowledge

- Stack: Nuxt 4 + Nuxt UI v4 + Drizzle ORM + PostgreSQL (Docker)
- All backend logic lives in `server/` (Nitro server routes). No Hasura.
- Drizzle schema: `server/database/schema.ts`
- DB client singleton: `server/database/drizzle.ts`
- Audio-critical components must use Web Audio API, not HTML5 `<audio>`.
- Timing-critical components must use `performance.now()` + `requestAnimationFrame`, never `setTimeout`/`setInterval`.
- Refer to `docs/implementation-plan.md` for detailed architectural context and `docs/feasibility-study.md` for scientific rationale.
