# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mnemosyne Protocol** ("fuhgeddaboudit") — a web app for dampening unwanted memories through evidence-based neurocognitive protocols (RTM, TNT, Tetris visuospatial interference, EMDR). This is a symptom-management tool, not therapy replacement.

## Commands

```bash
bun run dev          # Start dev server (localhost:3000)
bun run build        # Production build
bun test             # Run all tests (vitest)
npx vitest run <path>  # Run a single test file
npx nuxi typecheck   # Typecheck
docker compose up -d # Start PostgreSQL
bun run db:push      # Push Drizzle schema to database
bun run db:generate  # Generate Drizzle migrations
bun run db:studio    # Open Drizzle Studio (DB browser)
```

## Architecture

**Nuxt 4** app with **Nuxt UI v3**, **Tailwind CSS v4**, **Drizzle ORM**, and **PostgreSQL** (Docker).

### Frontend (`app/`)
- **Pages** follow Nuxt file-based routing. User flow: auth → screening → preparation → triage → module session → progress dashboard.
- **Layouts**: `default` (nav + crisis footer + grounding button), `session` (minimal, adds inactivity-triggered grounding), `auth` (centered form).
- **Components** are organized by protocol module: `emdr/`, `rtm/`, `tnt/`, `tetris/`, plus `grounding/`, `screening/`, `preparation/`, `shared/`.
- **Composables**: `useAuth` (cookie-based JWT auth state), `useGrounding`/`useInactivityGrounding` (grounding overlay state), `useAudioEngine` (Web Audio API), `usePrecisionTimer` (requestAnimationFrame-based timing), `useEyeTracking` (WebGazer.js), `useSuds` (distress rating), `useAdaptiveDifficulty`, `useTetrisGame`, `useTrialSequence`.

### Backend (`server/`)
- **Nitro server routes** in `server/api/` — no separate backend framework.
- **Database**: Drizzle ORM with PostgreSQL. Schema at `server/database/schema.ts`, singleton client at `server/database/drizzle.ts`.
- **Auth**: JWT in httpOnly cookies. Middleware at `server/middleware/auth.ts` protects all `/api/` routes except login/register/logout. Utilities in `server/utils/auth.ts`.
- **Rate limiting**: In-memory per-IP rate limiter at `server/utils/rateLimit.ts`.
- **Tables**: `users`, `screening_results`, `user_status` (tracks user progress through phases), `protocol_sessions`, `suds_ratings`, `tnt_session_data`, `grounding_events`.

### Testing (`tests/unit/`)
- **Vitest** with `@nuxt/test-utils` and `happy-dom` environment.
- Tests run via `bun test` or `npx vitest run`.

### Ralph Loop
Automated development loop using `scripts/ralph-claude.sh`. Reads `specs.md` as the implementation checklist and `prompt.md` for build instructions. `.ralph/agents.md` defines required checks.

## Key Constraints

- **Audio-critical components** must use Web Audio API, not HTML5 `<audio>`.
- **Timing-critical components** must use `performance.now()` + `requestAnimationFrame`, never `setTimeout`/`setInterval`.
- **No raw trauma content** stored server-side — only scores, timestamps, and encrypted blobs. Memory descriptions stay in client-side localStorage.
- **CSP headers** are configured in `nuxt.config.ts` to block external scripts.
- **Screening can be toggled** via `NUXT_PUBLIC_SCREENING_ENABLED=true` runtime config.
- **Grounding** (5-4-3-2-1 overlay) is always available via panic button; auto-triggers after 5 min inactivity in session layout.

## Environment

Requires `DATABASE_URL` and optionally `POSTGRES_PASSWORD` in `.env` (see `.env.example`). Docker Compose maps PostgreSQL to host port **5434** (not default 5432).
