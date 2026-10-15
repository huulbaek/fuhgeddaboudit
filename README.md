# Mnemosyne Protocol

A web application that helps users dampen unwanted memories through evidence-based neurocognitive protocols. The app routes users to the appropriate module via triage, with safety screening and grounding as first-class features.

**This is a symptom-management tool, not a replacement for professional therapy.**

## Protocols

- **RTM (Reconsolidation of Traumatic Memories)** — Cinema visualization with rapid rewind technique. Optionally, the user narrates the movie once during setup and hears their own voice reversed and sped up during each rewind. The recording lives only in the tab's memory and is cleared when the session ends.
- **TNT (Think/No-Think)** — Suppression training with proxy cues, eye tracking, and vigilance monitoring
- **Visuospatial Interference** — Adaptive Tetris-style game played after memory reactivation
- **EMDR (Eye Movement Desensitization and Reprocessing)** — Bilateral stimulation with graded exposure

## User Flow

1. **Register/Login** — Email and password authentication
2. **Screening** — PC-PTSD-5 and DES-Brief validated instruments determine eligibility (high dissociation scores are excluded with crisis resources shown)
3. **Preparation** — Safe-place visualization and a 30-second calm-state readiness test
4. **Triage** — Symptom questionnaire routes to the recommended protocol module
5. **Protocol Session** — Guided session with precision timing, audio cues, and real-time distress monitoring
6. **Progress Dashboard** — SUDs trend charts, session history, streaks, and module-specific stats

A grounding button is always visible during sessions. It triggers a fullscreen 5-4-3-2-1 grounding overlay. Automatic grounding also activates after 5 minutes of inactivity (possible dissociation detection).

## Tech Stack

Nuxt 3 &middot; Nuxt UI &middot; Drizzle ORM &middot; PostgreSQL &middot; Web Audio API &middot; WebGazer.js

## Prerequisites

- Node.js 18+
- Docker & Docker Compose

## Setup

```bash
# Clone the repo
git clone https://github.com/huulbaek/fuhgeddaboudit.git
cd fuhgeddaboudit

# Copy env and adjust if needed
cp .env.example .env

# Start PostgreSQL
docker compose up -d

# Install dependencies
bun install

# Push the database schema
bun run db:push

# Start the dev server
bun run dev
```

The app will be available at `http://localhost:3000`.

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start development server |
| `bun run build` | Build for production |
| `bun run preview` | Preview production build |
| `bun test` | Run tests |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:push` | Push schema to database |
| `bun run db:studio` | Open Drizzle Studio (DB browser) |

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://mnemosyne:changeme@localhost:5432/mnemosyne` |
| `POSTGRES_PASSWORD` | Password for the Docker PostgreSQL instance | `changeme` |

## Safety Design

- No raw trauma content is ever stored server-side — only scores, timestamps, and encrypted blobs
- Memory descriptions and proxy cue associations stay in client-side localStorage only
- Crisis resources (988 Suicide & Crisis Lifeline, Crisis Text Line) are shown on exclusion screens and in the app footer
- CSP headers block external scripts from loading
- Auth endpoints are rate-limited
- All server inputs are validated with Zod
