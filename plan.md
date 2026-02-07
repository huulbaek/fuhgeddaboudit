# Mnemosyne Protocol — Implementation Plan

## Context

Build the "Mnemosyne Protocol" digital therapeutic web application described in `feasibility.md`. The app helps users dampen unwanted memories through evidence-based neurocognitive protocols (RTM, TNT, Visuospatial Interference, EMDR). It acts as a triage system, routing users to the correct module based on symptom profile, with safety screening and grounding as first-class features.

**Stack**: Nuxt 3 + Nuxt UI v3 + Drizzle ORM + PostgreSQL (Docker)
**No Hasura** — Nuxt server routes (Nitro) handle all backend logic.

---

## Phase 1: Project Scaffolding & Infrastructure

### 1.1 Nuxt Project Init
- `npx nuxi@latest init .` in project root
- Install Nuxt UI v3: `@nuxt/ui`
- Install Drizzle: `drizzle-orm`, `drizzle-kit`, `pg` (node-postgres driver)
- Install dev deps: `@nuxt/test-utils`, `vitest`, `@vue/test-utils`
- Configure `nuxt.config.ts` with modules: `@nuxt/ui`

### 1.2 Docker Setup
- `docker-compose.yml` with single PostgreSQL 16 service
- Volume mount for data persistence
- `.env` for `DATABASE_URL`, `POSTGRES_PASSWORD`, etc.
- `docker-compose.dev.yml` override for dev conveniences (port mapping, pgAdmin optional)

### 1.3 Drizzle Schema & Migrations
- `server/database/schema.ts` — Drizzle schema definitions
- `server/database/drizzle.ts` — DB client singleton
- `drizzle.config.ts` — migration config
- npm scripts: `db:generate`, `db:migrate`, `db:push`, `db:studio`

### 1.4 Directory Structure

```
fuhgeddaboudit/
├── docker-compose.yml
├── .env.example
├── nuxt.config.ts
├── drizzle.config.ts
├── app/
│   ├── layouts/
│   │   ├── default.vue          # Standard layout with grounding button
│   │   ├── session.vue          # Protocol session layout (no nav, grounding always visible)
│   │   └── auth.vue             # Login/register layout
│   ├── pages/
│   │   ├── index.vue            # Landing / dashboard
│   │   ├── auth/
│   │   │   ├── login.vue
│   │   │   └── register.vue
│   │   ├── screening/
│   │   │   ├── index.vue        # PC-PTSD-5 + DES-Brief intake
│   │   │   └── results.vue      # Screening outcome / exclusion
│   │   ├── preparation/
│   │   │   ├── index.vue        # Safe place builder
│   │   │   └── readiness.vue    # 30-second calm-state test
│   │   ├── triage/
│   │   │   └── index.vue        # Symptom questionnaire → module routing
│   │   ├── modules/
│   │   │   ├── tnt/
│   │   │   │   ├── setup.vue    # Proxy cue selection & association training
│   │   │   │   └── session.vue  # Suppression gym (the core task)
│   │   │   ├── rtm/
│   │   │   │   ├── setup.vue    # Start/end image selection, SUDs baseline
│   │   │   │   └── session.vue  # Cinema visualization + rewind protocol
│   │   │   ├── tetris/
│   │   │   │   ├── setup.vue    # Reactivation + wait period
│   │   │   │   └── session.vue  # Block-rotation game
│   │   │   └── emdr/
│   │   │       ├── setup.vue    # Resource installation
│   │   │       └── session.vue  # Bilateral stimulation task
│   │   └── progress/
│   │       └── index.vue        # SUDs history, session log, streaks
│   ├── components/
│   │   ├── grounding/
│   │   │   ├── PanicButton.vue       # Persistent grounding trigger
│   │   │   └── GroundingOverlay.vue   # 5-4-3-2-1 fullscreen grounding
│   │   ├── screening/
│   │   │   ├── PcPtsd5.vue           # PC-PTSD-5 questionnaire
│   │   │   └── DesBrief.vue          # DES-Brief dissociation scale
│   │   ├── preparation/
│   │   │   ├── SafePlaceBuilder.vue
│   │   │   └── ReadinessTimer.vue    # 30-second calm test
│   │   ├── tnt/
│   │   │   ├── CueCard.vue           # Single cue display (green/red frame)
│   │   │   ├── TrialRunner.vue       # Orchestrates trial sequence with timing
│   │   │   └── VigilanceTask.vue     # Border-flicker detection overlay
│   │   ├── rtm/
│   │   │   ├── CinemaView.vue        # Theater visualization UI
│   │   │   ├── RewindAnimation.vue   # B→A rapid color animation
│   │   │   └── SudsRating.vue        # 0-10 distress scale input
│   │   ├── tetris/
│   │   │   ├── GameBoard.vue         # Block-rotation game canvas
│   │   │   └── AdaptiveEngine.vue    # Difficulty staircase logic
│   │   ├── emdr/
│   │   │   ├── BilateralDot.vue      # Moving stimulus
│   │   │   └── ResourceInstall.vue   # Safe memory tapping
│   │   ├── audio/
│   │   │   └── AudioEngine.vue       # Web Audio API wrapper component
│   │   └── shared/
│   │       ├── SudsScale.vue         # Reusable 0-10 rating
│   │       ├── TimerBar.vue          # Visual countdown/progress
│   │       └── PhaseIndicator.vue    # Shows current phase in protocol
│   └── composables/
│       ├── useAudioEngine.ts    # Web Audio API: schedule sounds, binaural beats
│       ├── usePrecisionTimer.ts # performance.now() + requestAnimationFrame timing
│       ├── useEyeTracking.ts    # WebGazer.js integration
│       ├── useGrounding.ts      # Grounding state + trigger logic
│       ├── useSuds.ts           # SUDs rating state management
│       ├── useTrialSequence.ts  # TNT trial orchestration (green/red, jittered ITI)
│       ├── useAdaptiveDifficulty.ts  # Staircase algorithm for Tetris
│       └── useEncryption.ts     # Client-side encryption for sensitive data
├── server/
│   ├── database/
│   │   ├── schema.ts            # Drizzle schema (all tables)
│   │   ├── drizzle.ts           # DB connection singleton
│   │   └── migrations/          # Generated migration files
│   ├── api/
│   │   ├── auth/
│   │   │   ├── register.post.ts
│   │   │   ├── login.post.ts
│   │   │   └── logout.post.ts
│   │   ├── screening/
│   │   │   ├── submit.post.ts   # Save screening results
│   │   │   └── status.get.ts    # Get user's screening status
│   │   ├── sessions/
│   │   │   ├── index.post.ts    # Create new protocol session
│   │   │   ├── [id].get.ts      # Get session details
│   │   │   └── [id].patch.ts    # Update session (SUDs, completion)
│   │   ├── progress/
│   │   │   └── index.get.ts     # Get user's progress data
│   │   └── triage/
│   │       └── recommend.post.ts # Return module recommendation
│   ├── middleware/
│   │   └── auth.ts              # JWT/session verification
│   └── utils/
│       ├── auth.ts              # Password hashing, JWT helpers
│       └── db.ts                # Re-export drizzle client
├── public/
│   └── audio/
│       ├── rewind-whoosh.mp3    # RTM rewind sound (~1.5s)
│       ├── grounding-track.mp3  # 5-4-3-2-1 grounding narration
│       ├── safe-place-induction.mp3
│       └── pmr-deepener.mp3     # Progressive muscle relaxation
└── tests/
    ├── unit/
    │   ├── composables/
    │   └── components/
    └── e2e/
```

---

## Phase 2: Database Schema (Drizzle)

File: `server/database/schema.ts`

```ts
// Core tables

users
  id            uuid PK default gen_random_uuid()
  email         varchar(255) unique not null
  password_hash varchar(255) not null
  created_at    timestamp default now()

screening_results
  id            uuid PK
  user_id       uuid FK → users.id
  instrument    varchar(50)       // 'PC-PTSD-5' | 'DES-Brief'
  score         integer
  result        varchar(20)       // 'admitted' | 'excluded'
  encrypted_responses  text       // AES-encrypted JSON of individual answers
  completed_at  timestamp

user_status
  id            uuid PK
  user_id       uuid FK → users.id unique
  screening_complete  boolean default false
  preparation_complete boolean default false
  active_module varchar(20)       // 'tnt' | 'rtm' | 'tetris' | 'emdr' | null
  last_triage_result varchar(20)
  updated_at    timestamp

protocol_sessions
  id            uuid PK
  user_id       uuid FK → users.id
  module        varchar(20)       // 'tnt' | 'rtm' | 'tetris' | 'emdr' | 'preparation'
  started_at    timestamp
  ended_at      timestamp nullable
  completed     boolean default false
  aborted       boolean default false
  abort_reason  varchar(50) nullable  // 'suds_no_change' | 'user_panic' | 'gaze_lost'

suds_ratings
  id            uuid PK
  session_id    uuid FK → protocol_sessions.id
  rating        integer check 0-10
  phase         varchar(20)       // 'pre' | 'post' | 'mid_loop_1' | 'mid_loop_2' ...
  recorded_at   timestamp

tnt_session_data
  id            uuid PK
  session_id    uuid FK → protocol_sessions.id
  total_trials  integer
  think_trials  integer
  no_think_trials integer
  gaze_compliance_pct  decimal   // % of time eyes on screen
  avg_reaction_time_ms integer

grounding_events
  id            uuid PK
  user_id       uuid FK → users.id
  session_id    uuid FK → protocol_sessions.id nullable
  triggered_at  timestamp
  duration_secs integer
  context       varchar(50)       // which page/module was active
```

**Note**: No raw trauma content is ever stored. Proxy cue associations and memory descriptions stay in client-side encrypted local storage only.

---

## Phase 3: Core Infrastructure (implement first)

### 3.1 Auth System
- Simple email/password with bcrypt + JWT stored in httpOnly cookie
- `server/middleware/auth.ts` validates JWT on protected routes
- Nuxt auth state via `useState` composable

### 3.2 Grounding System (safety-first)
- `useGrounding()` composable: global state, can be triggered from anywhere
- `PanicButton.vue`: fixed-position button in `session.vue` layout, always visible
- `GroundingOverlay.vue`: fullscreen sage-green overlay, plays 5-4-3-2-1 audio track
- Pressing grounding button during any module: pauses session, logs grounding event, shows overlay
- Must work even if audio context is suspended (visual fallback with text prompts)

### 3.3 Audio Engine
- `useAudioEngine()` composable wrapping Web Audio API `AudioContext`
- Methods: `scheduleSound(buffer, startTime)`, `playImmediate(src)`, `createBinauralBeat(freq)`
- Preload critical audio files on module entry (not on app boot)
- Handle AudioContext suspension (requires user gesture to resume)
- Fallback: if Web Audio unavailable, use HTML5 `<audio>` with warning about timing precision

### 3.4 Precision Timer
- `usePrecisionTimer()` composable using `performance.now()` + `requestAnimationFrame`
- Provides: `onTick(callback)`, `scheduleAt(timestamp, callback)`, `elapsed()`
- All timing-critical UI (TNT cue display, RTM rewind) must use this — never `setTimeout`/`setInterval`

---

## Phase 4: Screening & Preparation Modules

### 4.1 Screening Flow
- `PcPtsd5.vue`: 5 yes/no questions per the validated instrument
- `DesBrief.vue`: 8-item brief dissociation scale
- Scoring logic in component (client-side) + results saved to server
- Routing logic:
  - DES-Brief score ≥ threshold → excluded, show crisis resources (988 Suicide & Crisis Lifeline, Crisis Text Line)
  - PC-PTSD-5 score ≥ 3 → admitted
  - Below threshold → informational, suggest professional help

### 4.2 Preparation Module
- Guided safe-place visualization with audio narration
- User types a short description of their safe place (stored client-side only)
- Readiness test: "Close your eyes, go to your safe place. Press the button when you feel calm."
  - Timer starts on button press, must hold calm state for 30 seconds
  - Optional: use simple heart-rate-like breathing pacer animation
- Pass → unlock trauma modules; Fail → repeat preparation

---

## Phase 5: Protocol Modules

### 5.1 TNT Suppression Gym (`modules/tnt/`)

**Setup page:**
- User uploads or selects from library neutral "proxy cue" images
- Association training: show cue, user confirms it triggers the target memory (binary yes/no)
- Minimum 6 cues needed to run a session

**Session page:**
- Uses `useTrialSequence()` composable to orchestrate:
  - Fixation cross (500ms, centered `+`)
  - Cue card with colored frame (green=think, red=no-think) for exactly 3000ms
  - ITI: blank screen 500-1500ms (randomized per trial)
- Trial order: pseudo-randomized, equal green/red split
- Minimum 12 repetitions per cue item
- `useEyeTracking()`: initialize WebGazer.js, check gaze every 100ms during no-think trials
  - If gaze lost >200ms → pause trial, show "Please look at the screen"
- Vigilance task: random border flicker every ~15s, user presses spacebar to confirm attention
- Session data logged: compliance %, reaction times, trial counts
- Post-session: brief SUDs check

### 5.2 RTM Rewind Protocol (`modules/rtm/`)

**Setup page:**
- SUDs baseline rating
- User mentally identifies Start Image (A: safe moment before) and End Image (B: safe moment after)
- App does NOT collect explicit trauma descriptions — just labels like "Before" and "After"
- Dissociation check: guided instruction to "enter the projection booth"

**Session page (the core loop):**
1. Forward pass: grayscale progress bar A→B, 45 seconds, film-grain CSS filter, ambient projector audio
2. Hard cut: screen flashes to color, plays rewind-whoosh.mp3 (1.5s)
3. Rewind: rapid color animation B→A in <2 seconds
4. Loop steps 1-3 for 5 iterations
5. Post-loop: SUDs rating
   - SUDs ≤ 3 → success, offer to end or do another set
   - SUDs > 3 → repeat loop
   - SUDs unchanged after 3 full sets → abort, trigger grounding, log abort reason

**Technical:**
- `RewindAnimation.vue`: CSS transitions + requestAnimationFrame for the 2-second reverse
- `useAudioEngine()` schedules the whoosh with sample-accurate timing
- Film grain: CSS `backdrop-filter` or canvas overlay with noise shader

### 5.3 Visuospatial Interference / Tetris (`modules/tetris/`)

**Setup page:**
- Reactivation: 10-minute guided focus on memory hotspot (audio-guided, timer displayed)
- Wait period: 10-minute gap with breathing pacer animation + calming audio
- Both timed with clear phase indicators

**Session page:**
- Block-rotation puzzle game on HTML5 Canvas (or could use a lightweight engine)
- Core mechanics: falling blocks, rotation (arrow keys / touch), line clearing
- `useAdaptiveDifficulty()`: staircase algorithm
  - Track: lines cleared per minute, reaction time to rotate
  - Speed up if performance high (user not engaged enough)
  - Slow down if user is failing rapidly (frustrated, mind wandering)
  - Target: ~70% success rate = flow state
- 20-minute session timer with progress indicator
- Post-session: SUDs rating

### 5.4 Digital EMDR (`modules/emdr/`)

**Setup page:**
- Device check: warn if screen width < 768px (insufficient visual angle)
- Resource installation: guide user to recall a safe/happy memory, bilateral tapping while holding it
- Breathing stabilization

**Session page:**
- `BilateralDot.vue`: smooth dot moving left↔right across full screen width
  - Speed: configurable (default ~1 second per pass)
  - Uses `requestAnimationFrame` for smooth 60fps animation
  - Optional: bilateral audio tones (left/right channel alternating via Web Audio API panning)
- Set structure: 30 seconds of bilateral stimulation → pause → brief check-in ("What do you notice?") → repeat
- Graded exposure: first sets use resource memory, later sets transition to target memory
- Abreaction monitor: if user reports SUDs spike >8 mid-session → auto-trigger grounding

---

## Phase 6: Triage System

`pages/triage/index.vue`:
- 3-5 question symptom checklist (rule-based, no NLP needed for v1):
  - "I keep seeing unwanted images pop into my head" → Tetris module
  - "Thinking about it causes intense fear/pain" → RTM module
  - "I can't stop thinking/obsessing about it" → TNT module
  - "I feel generally distressed but can't pinpoint how" → EMDR module
- Server endpoint `triage/recommend.post.ts` logs the recommendation
- User can override and choose a different module

---

## Phase 7: Progress Dashboard

`pages/progress/index.vue`:
- SUDs trend chart (line graph over sessions) — use a lightweight chart library or Nuxt UI Pro charts
- Session history list: module, date, duration, completed/aborted
- Current streak / session count
- Module-specific stats (TNT: compliance %, RTM: loops to reach SUDs ≤ 3)

---

## Phase 8: Polish & Safety Hardening

- Terms of Service: "Symptom Management" disclaimer, not "Forensic Erasure"
- Legal warning for users in active legal proceedings
- Crisis resource links on exclusion screens and in app footer
- Content Security Policy headers (no external scripts loading trauma data)
- Rate limiting on auth endpoints
- Input validation on all server routes (zod schemas)
- Automated grounding trigger if user is inactive >5 minutes during a session (possible dissociation)

---

## Implementation Order

| Priority | Phase | Scope |
|----------|-------|-------|
| 1 | Phase 1: Scaffolding + Docker + Drizzle | Project setup |
| 2 | Phase 2: Database schema | Schema + migrations |
| 3 | Phase 3.1-3.2: Auth + Grounding | Core safety infrastructure |
| 4 | Phase 3.3-3.4: Audio + Timer composables | Technical foundation |
| 5 | Phase 4: Screening + Preparation | User onboarding flow |
| 6 | Phase 5.3: Tetris module | Safest module, good first protocol |
| 7 | Phase 5.2: RTM module | Highest-impact protocol |
| 8 | Phase 5.1: TNT module | Most technically complex (eye tracking) |
| 9 | Phase 5.4: EMDR module | Requires careful safety work |
| 10 | Phase 6: Triage | Routes users to modules |
| 11 | Phase 7: Progress dashboard | Tracking and motivation |
| 12 | Phase 8: Safety hardening | Final polish |

---

## Verification Plan

1. **Docker**: `docker compose up` → PostgreSQL accessible on localhost:5432
2. **Migrations**: `npm run db:push` → tables created, `npm run db:studio` → inspect
3. **Dev server**: `npm run dev` → app loads at localhost:3000
4. **Auth flow**: register → login → protected routes require auth
5. **Screening**: complete PC-PTSD-5 + DES-Brief → correct routing (admit/exclude)
6. **Grounding**: panic button visible on every session page → overlay appears with audio
7. **TNT timing**: verify cue displays for exactly 3000ms using browser DevTools Performance tab
8. **RTM rewind**: verify whoosh audio fires within 50ms of visual transition
9. **Tetris**: verify adaptive difficulty adjusts within 3-5 completed lines
10. **E2E test**: full user journey — register → screen → prepare → triage → complete one module → view progress
