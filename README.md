<p align="center">
  <img src="public/og-image.png" alt="Mnemosyne Protocol: evidence-based protocols for dampening unwanted memories" width="720">
</p>

# Mnemosyne Protocol

[![CI](https://github.com/huulbaek/fuhgeddaboudit/actions/workflows/ci.yml/badge.svg)](https://github.com/huulbaek/fuhgeddaboudit/actions/workflows/ci.yml)
[![License: GPL-3.0-or-later](https://img.shields.io/badge/license-GPL--3.0--or--later-blue.svg)](LICENSE)

A web app ("fuhgeddaboudit") that guides people through published neurocognitive protocols for taking the emotional charge out of an unwanted memory. It triages each user to the protocol that fits their symptoms, runs the session in the browser with millisecond timing and synthesised audio, and tracks distress ratings over time.

**Live:** [forgetaboutit.io](https://forgetaboutit.io)

> **This is a symptom-management tool, not a replacement for professional therapy, and not a medical device.** The protocols come from published research; this implementation has not been clinically trialled. If you are in crisis, contact your local emergency number or a crisis line.

## Protocols

| Module | What the user does | Mechanism |
|---|---|---|
| **RTM** (Reconsolidation of Traumatic Memories) | Watches the memory as a black-and-white film from a distance, then rewinds it at speed. Optionally narrates the film once and hears their own voice reversed and sped up on every rewind. | Prediction error during reconsolidation |
| **TNT** (Think/No-Think) | Practises recalling or suppressing memories on cue, using proxy cues, with gaze tracking and attention checks. | Inhibitory control training |
| **Visuospatial interference** | Briefly reactivates the memory, then plays an adaptive falling-block game. | Competes for the visual working memory that intrusive images need |
| **EMDR** (Eye Movement Desensitization and Reprocessing) | Follows a moving dot with matching left/right audio in graded sets. | Bilateral stimulation with graded exposure |

The scientific background and the reasoning behind this selection are in the [feasibility study](docs/feasibility-study.md).

## How a session flows

1. **Sign in, or continue as a guest.** A guest's sessions are stored in the browser only.
2. **Screening** (optional, off by default). PC-PTSD-5 and DES-Brief, two validated instruments. A high dissociation score leads to crisis resources instead of the next step.
3. **Preparation.** A safe-place visualisation and a 30-second calm-state readiness test.
4. **Triage.** A short symptom questionnaire recommends a module.
5. **Session.** Guided, timed, with distress (SUDs) ratings before, during and after.
6. **Progress.** Distress trends, session history and per-module statistics.

Three things watch over a session:

- **Grounding.** A full-screen 5-4-3-2-1 grounding exercise opens automatically after five minutes of inactivity (possible dissociation), when an EMDR distress rating goes above 8, when RTM is aborted because distress is not falling, and when the pulse monitor sees a sustained rise.
- **Pulse monitor** (optional, any session except TNT). Estimates heart rate from the webcam by remote photoplethysmography and opens grounding if it stays well above the user's own baseline for 15 seconds. Frames are processed in memory and discarded; only three colour averages per frame are kept, for ten seconds.
- **Reconsolidation clock.** A reactivated memory stays open to change for roughly four to six hours. Every session start, or a tap on "Memory just came up", anchors a six-hour countdown that nudges the user to finish interference work before the window closes and before sleep.

## Under the hood

- **Frame-accurate timing.** Every timed stimulus runs on `performance.now()` and `requestAnimationFrame` through one scheduler ([`usePrecisionTimer`](app/composables/usePrecisionTimer.ts)). TNT trials follow the laboratory cycle: 500 ms fixation, 3000 ms cue, jittered 500–1500 ms interval ([`useTrialSequence`](app/composables/useTrialSequence.ts)).
- **Audio built on the Web Audio API.** Binaural beats and the reversed, time-compressed narration for the RTM rewind are generated in the browser ([`useAudioEngine`](app/composables/useAudioEngine.ts)); the EMDR tone is panned left to right in step with the dot ([`BilateralDot`](app/components/emdr/BilateralDot.vue)).
- **Heart rate from a webcam, with no dependencies.** A pure-function rPPG pipeline (resampling, POS projection, band-pass, FFT peak with a quality score) in [`app/utils/ppg.ts`](app/utils/ppg.ts); the design is written up in [docs/plans](docs/plans/2026-10-15-pulse-monitor-design.md).
- **Adaptive difficulty.** A staircase algorithm holds the block game near a 70% success rate, because too easy lets the mind wander back and too hard makes people quit ([`useAdaptiveDifficulty`](app/composables/useAdaptiveDifficulty.ts)).
- **Gaze compliance.** WebGazer.js checks that the user keeps looking at the cue during no-think trials and pauses the trial when gaze is lost.
- **Tested.** More than 800 unit and component tests with Vitest.

## Privacy by architecture

The server never receives what a memory is about.

- Memory descriptions, proxy cues, safe-place details and the reconsolidation clock stay in the browser's `localStorage`. Narration recordings live only in the tab's memory and are cleared when the session ends.
- The database holds accounts, screening scores and outcomes, session timestamps, distress ratings, aggregate TNT trial statistics and grounding events. Individual screening answers are not stored. See the [schema](server/database/schema.ts).
- The one thing a guest session sends is an anonymous completion record (module name and time) for the counter on the landing page.
- Camera frames for the pulse monitor and gaze tracking are processed on the device and never uploaded.
- A Content Security Policy blocks third-party scripts; sessions use an httpOnly JWT cookie; login and registration are rate-limited; every server input is validated with Zod.

## Tech stack

Nuxt 4 &middot; Vue 3 &middot; Nuxt UI &middot; Tailwind CSS 4 &middot; Drizzle ORM &middot; PostgreSQL &middot; Web Audio API &middot; WebGazer.js &middot; Vitest

## Getting started

You need [Bun](https://bun.sh), Node.js 20.19+ or 22.12+, and Docker.

```bash
git clone https://github.com/huulbaek/fuhgeddaboudit.git
cd fuhgeddaboudit

cp .env.example .env     # defaults work for local development
docker compose up -d     # PostgreSQL on localhost:5434
bun install
bun run db:push          # create the tables
bun run dev              # http://localhost:3000
```

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://mnemosyne:changeme@localhost:5434/mnemosyne` |
| `POSTGRES_PASSWORD` | Password for the Docker PostgreSQL instance | `changeme` |
| `JWT_SECRET` | Signs login sessions. **Required in production**: the server refuses to start without it. Generate one with `openssl rand -base64 48`. | A fixed development secret, outside production only |
| `NUXT_PUBLIC_SCREENING_ENABLED` | Set to `true` to add the screening step before preparation | `false` |

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` | Start the development server |
| `bun run build` | Build for production |
| `bun run preview` | Serve the production build (needs `JWT_SECRET`) |
| `bun run test` | Run the test suite (Vitest). Plain `bun test` starts Bun's own runner, which cannot run these tests. |
| `bun run typecheck` | Typecheck the app and server |
| `bun run db:push` | Push the Drizzle schema to the database |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:studio` | Open Drizzle Studio |

## Deployment

`docker-compose.prod.yml` builds the app, applies the schema and runs it next to PostgreSQL:

```bash
export POSTGRES_PASSWORD="$(openssl rand -base64 24)"
export JWT_SECRET="$(openssl rand -base64 48)"
docker compose -f docker-compose.prod.yml up -d --build   # serves on port 3001
```

Keep both values somewhere durable: changing `JWT_SECRET` signs everyone out.

## Project layout

```
app/
  pages/          file-based routes: auth, screening, preparation, triage, modules, progress
  components/     one folder per protocol (rtm, tnt, tetris, emdr) plus grounding, screening, shared
  composables/    timing, audio, pulse monitor, eye tracking, session and guest storage
  utils/ppg.ts    the rPPG signal pipeline
server/
  api/            Nitro route handlers
  database/       Drizzle schema, client and migrations
  middleware/     JWT auth for /api
tests/unit/       Vitest suites
docs/             feasibility study, implementation plan, feature design notes
```

The falling-block module keeps `tetris` as its internal identifier in routes and the database.

## How it was built

The first version was built with an automated agent loop: an AI coding agent worked through a checklist one item at a time and had to pass the test suite before each commit. The documents it started from are kept in the repository as a record:

- [Feasibility study](docs/feasibility-study.md): the research review the design started from
- [Implementation plan](docs/implementation-plan.md): the build plan the checklist was drawn from
- [Feature design notes](docs/plans) for later additions

These are historical. Where they differ from the code, the code is right.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, conventions and the constraints that keep sessions safe and accurate. Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

Copyright © 2026 Thomas T

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed in the hope that it will be useful, but **without any warranty**; see [LICENSE](LICENSE) for the full text.

It is GPL because it bundles [WebGazer.js](https://webgazer.cs.brown.edu), which is licensed under GPL-3.0-or-later.

The visuospatial module is an original falling-block game. Tetris, the game used in the published interference research, is a trademark of its owner; this project is not affiliated with or endorsed by them.
