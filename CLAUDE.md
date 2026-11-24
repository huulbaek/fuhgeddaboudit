# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mnemosyne Protocol** ("fuhgeddaboudit") — a web app for dampening unwanted memories through evidence-based neurocognitive protocols (RTM, TNT, Tetris visuospatial interference, EMDR). This is a symptom-management tool, not therapy replacement.

## Commands

```bash
bun run dev          # Start dev server (localhost:3000)
bun run build        # Production build
bun run test         # Run all tests (vitest; plain `bun test` runs Bun's own runner and fails)
npx vitest run <path>  # Run a single test file
bun run typecheck    # Typecheck (nuxt typecheck)
docker compose up -d # Start PostgreSQL
bun run db:push      # Push Drizzle schema to database
bun run db:generate  # Generate Drizzle migrations
bun run db:studio    # Open Drizzle Studio (DB browser)
```

## Architecture

**Nuxt 4** app with **Nuxt UI v4**, **Tailwind CSS v4**, **Drizzle ORM**, and **PostgreSQL** (Docker).

### Frontend (`app/`)
- **Pages** follow Nuxt file-based routing. User flow: auth → screening → preparation → triage → module session → progress dashboard.
- **Layouts**: `default` (header nav with the repository link, grounding overlay), `session` (minimal: grounding overlay, pulse monitor, inactivity-triggered grounding), `auth` (centered form).
- **Components** are organized by protocol module: `emdr/`, `rtm/`, `tnt/`, `tetris/`, plus `grounding/`, `screening/`, `preparation/`, `shared/`.
- **Composables**: `useAuth` (cookie-based JWT auth state), `useGrounding`/`useInactivityGrounding` (grounding overlay state), `useAudioEngine` (Web Audio API), `usePrecisionTimer` (requestAnimationFrame-based timing), `useEyeTracking` (WebGazer.js), `useSuds` (distress rating), `useAdaptiveDifficulty`, `useTetrisGame`, `useTrialSequence`.

### Backend (`server/`)
- **Nitro server routes** in `server/api/` — no separate backend framework.
- **Database**: Drizzle ORM with PostgreSQL. Schema at `server/database/schema.ts`, singleton client at `server/database/drizzle.ts`.
- **Auth**: JWT in httpOnly cookies. Middleware at `server/middleware/auth.ts` protects all `/api/` routes except login/register/logout. Utilities in `server/utils/auth.ts`. `JWT_SECRET` is required in production: `server/plugins/require-jwt-secret.ts` stops the server at boot without it (development falls back to a fixed, public dev secret).
- **Rate limiting**: In-memory per-IP rate limiter at `server/utils/rateLimit.ts`.
- **Tables**: `users`, `screening_results`, `user_status` (tracks user progress through phases), `protocol_sessions`, `suds_ratings`, `tnt_session_data`, `grounding_events`.

### Testing (`tests/unit/`)
- **Vitest** with `@nuxt/test-utils` and `happy-dom` environment.
- Tests run via `bun run test` or `npx vitest run`.

## Key Constraints

- **Audio-critical components** must use Web Audio API, not HTML5 `<audio>`.
- **Timing-critical components** must use `performance.now()` + `requestAnimationFrame`, never `setTimeout`/`setInterval`.
- **No raw trauma content** stored server-side — only scores, timestamps, and encrypted blobs. Memory descriptions stay in client-side localStorage.
- **CSP headers** are configured in `nuxt.config.ts` to block external scripts.
- **Screening can be toggled** via `NUXT_PUBLIC_SCREENING_ENABLED=true` runtime config (off by default).
- **Grounding** (5-4-3-2-1 overlay) has no manual trigger; it opens automatically after 5 min inactivity in the session layout, on sustained elevated pulse (optional pulse monitor), on an EMDR distress rating above 8, and on an RTM abort. Crisis-line details live on the screening-exclusion and terms pages.

## Environment

Requires `DATABASE_URL` and optionally `POSTGRES_PASSWORD` in `.env` (see `.env.example`); production also requires `JWT_SECRET`. Docker Compose maps PostgreSQL to host port **5434** (not default 5432).
