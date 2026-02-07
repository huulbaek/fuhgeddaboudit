# specs.md

Mnemosyne Protocol: a web app that dampens unwanted memories through evidence-based neurocognitive protocols (RTM, TNT, Visuospatial Interference, EMDR), routing users to the correct module via triage with safety screening and grounding as first-class features.

## Notes / constraints

- Keep items small enough to finish in a single loop iteration.
- When an item is done, mark it `[x]` and add the next obvious item.
- Refer to `plan.md` for detailed architecture and `feasibility.md` for scientific rationale.
- No raw trauma content is ever stored server-side. Only scores, timestamps, encrypted blobs.
- Audio-critical: Web Audio API only. Timing-critical: `performance.now()` + `requestAnimationFrame` only.

---

## Phase 1 — Project Scaffolding

- [x] Initialize Nuxt 3 project (`npx nuxi@latest init`), install core deps (`@nuxt/ui`, `drizzle-orm`, `drizzle-kit`, `pg`), and configure `nuxt.config.ts` with the `@nuxt/ui` module.
- [x] Install dev deps (`vitest`, `@nuxt/test-utils`, `@vue/test-utils`), configure Vitest in `nuxt.config.ts`, and add a trivial passing test to verify the test runner works.
- [x] Create `docker-compose.yml` with a PostgreSQL 16 service (volume-mounted data, port 5432) and `.env.example` with `DATABASE_URL` and `POSTGRES_PASSWORD`.
- [x] Create `drizzle.config.ts` and `server/database/drizzle.ts` (DB client singleton using `pg` driver). Add npm scripts: `db:generate`, `db:push`, `db:studio`.
- [x] Create the directory structure skeleton: `app/layouts/`, `app/pages/`, `app/components/`, `app/composables/`, `server/api/`, `server/middleware/`, `server/utils/`, `public/audio/`, `tests/unit/`.
- [x] Verify the dev server starts cleanly (`npm run dev`) and the trivial test passes (`npx vitest run`).

## Phase 2 — Database Schema

- [x] Define all Drizzle tables in `server/database/schema.ts`: `users`, `screeningResults`, `userStatus`, `protocolSessions`, `sudsRatings`, `tntSessionData`, `groundingEvents`. Use UUIDs, proper foreign keys, and check constraints per `plan.md` Phase 2.
- [x] Generate the initial migration (`db:generate`) and push to the Docker PostgreSQL (`db:push`). Verify tables exist via `db:studio` or a quick query test.

## Phase 3 — Auth System

- [x] Create `server/utils/auth.ts` with bcrypt password hashing (`hashPassword`, `verifyPassword`) and JWT helpers (`signToken`, `verifyToken`). Write unit tests for both.
- [x] Create `server/api/auth/register.post.ts` — validate email/password with Zod, hash password, insert user, return JWT in httpOnly cookie. Write a test.
- [x] Create `server/api/auth/login.post.ts` — validate credentials, return JWT in httpOnly cookie. Create `server/api/auth/logout.post.ts` — clear the cookie. Write tests.
- [x] Create `server/middleware/auth.ts` — verify JWT from cookie on protected routes, attach `userId` to the event context. Write a test.
- [x] Create `app/pages/auth/login.vue` and `app/pages/auth/register.vue` with Nuxt UI form components. Create an auth composable (`useState`-based) to track login state client-side.
- [x] Create the `auth.vue` layout (minimal, centered card). Wire the auth pages to use it.

## Phase 4 — Grounding System (safety-first)

- [x] Create `app/composables/useGrounding.ts` — global state: `isGrounding`, `trigger()`, `dismiss()`, logs grounding events. Write unit tests.
- [x] Create `app/components/grounding/PanicButton.vue` — fixed-position button, always visible, calls `useGrounding().trigger()`. Style: prominent but not distracting.
- [x] Create `app/components/grounding/GroundingOverlay.vue` — fullscreen sage-green overlay with the 5-4-3-2-1 grounding text prompts (visual fallback). Dismisses via `useGrounding().dismiss()`. Write a component test.
- [x] Create `app/layouts/session.vue` — no nav, PanicButton always visible, slot for session content. Create `app/layouts/default.vue` — standard layout with nav and PanicButton.
- [x] Create `server/api/grounding/log.post.ts` — save a grounding event (userId, sessionId nullable, context). Write a test.

## Phase 5 — Audio Engine & Precision Timer

- [x] Create `app/composables/useAudioEngine.ts` — wraps Web Audio API `AudioContext`: `preload(src)`, `playImmediate(src)`, `scheduleSound(buffer, startTime)`, `createBinauralBeat(freq)`. Handle AudioContext suspension (require user gesture). Fallback to HTML5 `<audio>` with warning. Write unit tests.
- [x] Create `app/composables/usePrecisionTimer.ts` — uses `performance.now()` + `requestAnimationFrame`: `start()`, `stop()`, `onTick(callback)`, `scheduleAt(timestamp, callback)`, `elapsed()`. Write unit tests verifying timing accuracy.

## Phase 6 — Screening Module

- [x] Create `app/components/screening/PcPtsd5.vue` — the 5 yes/no questions of the validated PC-PTSD-5 instrument. Emits score on completion. Write a component test for scoring.
- [x] Create `app/components/screening/DesBrief.vue` — the 8-item DES-Brief dissociation scale. Emits score on completion. Write a component test for scoring.
- [x] Create `app/pages/screening/index.vue` — orchestrates PcPtsd5 then DesBrief, shows progress. On completion, posts results to server.
- [x] Create `server/api/screening/submit.post.ts` — saves screening results (instrument, score, result) and updates `userStatus.screeningComplete`. Create `server/api/screening/status.get.ts` — returns the user's screening status. Write tests.
- [x] Create `app/pages/screening/results.vue` — displays outcome: DES-Brief ≥ threshold → excluded (show crisis resources: 988 Lifeline, Crisis Text Line); PC-PTSD-5 ≥ 3 → admitted; below threshold → informational with professional help suggestion. Write a test for routing logic.

## Phase 7 — Preparation Module

- [x] Create `app/components/preparation/SafePlaceBuilder.vue` — guided safe-place visualization instructions, text input for description (stored in localStorage only, never sent to server). Write a component test.
- [x] Create `app/components/preparation/ReadinessTimer.vue` — 30-second calm-state timer with breathing pacer animation. User presses button, must hold for 30s. Pass → emit success; fail → emit retry. Write a component test.
- [x] Create `app/pages/preparation/index.vue` — safe place builder step. Create `app/pages/preparation/readiness.vue` — readiness test. On pass, update `userStatus.preparationComplete` via server endpoint. Write tests.
- [x] Create `server/api/preparation/complete.post.ts` — marks preparation as complete in `userStatus`. Write a test.

## Phase 8 — Shared Session Components

- [x] Create `app/components/shared/SudsScale.vue` — reusable 0-10 distress rating input (slider or button row). Emits selected rating. Write a component test.
- [x] Create `app/components/shared/TimerBar.vue` — visual countdown/progress bar driven by `usePrecisionTimer`. Props: `durationMs`, emits `complete`. Write a component test.
- [x] Create `app/components/shared/PhaseIndicator.vue` — shows current phase label in a protocol session (e.g., "Forward Pass 3/5"). Write a component test.
- [x] Create `server/api/sessions/index.post.ts` (create session), `server/api/sessions/[id].get.ts` (get session), `server/api/sessions/[id].patch.ts` (update session: SUDs, completion, abort). Write tests for all three.
- [x] Create `app/composables/useSuds.ts` — manages SUDs rating state for a session, posts ratings to `server/api/sessions/[id].patch.ts`. Write a unit test.

## Phase 9 — Tetris Module (safest protocol, implement first)

- [x] Create `app/pages/modules/tetris/setup.vue` — reactivation phase (10-min guided focus with timer + audio), then wait period (10-min gap with breathing pacer). Uses `TimerBar` and `PhaseIndicator`. Write a test for phase transitions.
- [x] Create `app/components/tetris/GameBoard.vue` — HTML5 Canvas falling-block game. Core mechanics: block spawning, rotation (arrow keys + touch), gravity, collision detection, line clearing. Write tests for collision and line-clearing logic.
- [x] Create `app/composables/useAdaptiveDifficulty.ts` — staircase algorithm: track lines/min and reaction time; speed up if performance high, slow down if failing; target ~70% success rate. Write unit tests.
- [x] Create `app/pages/modules/tetris/session.vue` — 20-minute session integrating GameBoard + AdaptiveDifficulty + TimerBar. Post-session SUDs rating via SudsScale. Save session data to server. Write a test for session completion flow.

## Phase 10 — RTM Rewind Module

- [x] Create `app/pages/modules/rtm/setup.vue` — SUDs baseline rating, start/end image labeling (text labels only, stored client-side), dissociation check ("Are you in the projection booth?"). Write a test.
- [x] Create `app/components/rtm/CinemaView.vue` — grayscale progress bar A→B over 45 seconds, film-grain CSS filter (`backdrop-filter` or canvas noise overlay), ambient projector audio via `useAudioEngine`. Write a component test.
- [x] Create `app/components/rtm/RewindAnimation.vue` — hard cut to color, plays rewind-whoosh.mp3 (1.5s) via `useAudioEngine` with sample-accurate timing, rapid B→A color animation in <2 seconds using `requestAnimationFrame`. Write a component test.
- [x] Create `app/components/rtm/SudsRating.vue` — post-loop SUDs check with logic: SUDs ≤ 3 → success (offer end or another set); SUDs > 3 → repeat; unchanged after 3 full sets → abort + trigger grounding + log abort reason. Write a test for the branching logic.
- [x] Create `app/pages/modules/rtm/session.vue` — orchestrates the core loop: CinemaView (forward) → RewindAnimation (rewind) → repeat 5x → SudsRating. Integrates `usePrecisionTimer` for all timing. Write a test for the full loop.

## Phase 11 — TNT Suppression Module

- [ ] Create `app/pages/modules/tnt/setup.vue` — proxy cue selection (upload images or select from library), association training (show cue → user confirms it triggers memory, binary yes/no). Minimum 6 cues required. Write a test.
- [ ] Create `app/components/tnt/CueCard.vue` — displays a single cue image with colored frame (green = think, red = no-think). Write a component test.
- [ ] Create `app/composables/useTrialSequence.ts` — orchestrates trial cycle: fixation cross (500ms) → cue with frame (3000ms) → ITI (500-1500ms jittered). Pseudo-randomized order, equal green/red split, minimum 12 reps per item. Uses `usePrecisionTimer`. Write unit tests for timing and randomization.
- [ ] Create `app/components/tnt/TrialRunner.vue` — renders the trial sequence using `useTrialSequence`, shows fixation cross / CueCard / blank screen. Logs reaction times and compliance per trial. Write a component test.
- [ ] Create `app/composables/useEyeTracking.ts` — integrates WebGazer.js: initialize, check gaze every 100ms during no-think trials, pause trial if gaze lost >200ms with "Please look at the screen" prompt. Write unit tests (mock WebGazer).
- [ ] Create `app/components/tnt/VigilanceTask.vue` — random border-flicker overlay every ~15s, user presses spacebar to confirm attention. Logs response times. Write a component test.
- [ ] Create `app/pages/modules/tnt/session.vue` — integrates TrialRunner + EyeTracking + VigilanceTask. Post-session SUDs check. Saves session data (compliance %, avg reaction time, trial counts) to server via `tntSessionData`. Write a test.

## Phase 12 — EMDR Module

- [ ] Create `app/pages/modules/emdr/setup.vue` — device check (warn if screen < 768px), resource installation (guide user to recall safe memory with bilateral tapping), breathing stabilization. Write a test.
- [ ] Create `app/components/emdr/BilateralDot.vue` — smooth dot moving left↔right across full screen width at ~1s per pass, using `requestAnimationFrame` for 60fps. Configurable speed. Write a component test.
- [ ] Add bilateral audio tones to BilateralDot — left/right channel alternating via Web Audio API `StereoPannerNode`. Write a test verifying panning.
- [ ] Create `app/components/emdr/ResourceInstall.vue` — guided safe memory visualization with bilateral tapping (using BilateralDot). Write a component test.
- [ ] Create `app/pages/modules/emdr/session.vue` — set structure: 30s bilateral stimulation → pause → check-in ("What do you notice?") → repeat. Graded exposure: first sets use resource memory, later sets transition to target. Abreaction monitor: SUDs > 8 → auto-trigger grounding. Write a test for session flow and abreaction trigger.

## Phase 13 — Triage System

- [ ] Create `app/pages/triage/index.vue` — 3-5 symptom questions with rule-based routing: intrusive images → Tetris; intense fear/pain → RTM; can't stop thinking → TNT; general distress → EMDR. User can override recommendation. Write a test for routing logic.
- [ ] Create `server/api/triage/recommend.post.ts` — accepts symptom answers, returns module recommendation, logs to `userStatus.lastTriageResult`. Write a test.

## Phase 14 — Progress Dashboard

- [ ] Create `server/api/progress/index.get.ts` — aggregates user's session data: SUDs history, session list, streaks, module-specific stats (TNT compliance %, RTM loops to SUDs ≤ 3). Write a test.
- [ ] Create `app/pages/progress/index.vue` — SUDs trend line chart (use a lightweight chart library), session history list (module, date, duration, completed/aborted), streak and session count. Write a test.
- [ ] Add module-specific stats cards to the progress page (TNT: compliance %, RTM: avg loops, Tetris: lines/min, EMDR: sets completed). Write a test.

## Phase 15 — Landing Page & Navigation

- [ ] Create `app/pages/index.vue` — landing/dashboard page: if not logged in, show hero + CTA to register; if logged in, show current status (screening → preparation → triage → active module), quick-start button for next step, recent session summary.
- [ ] Wire up navigation in `default.vue` layout: links to dashboard, progress, active module. Show user status badges (screening complete, preparation complete, etc.).

## Phase 16 — Safety Hardening & Polish

- [ ] Add Terms of Service page with "Symptom Management" disclaimer (not "Forensic Erasure") and legal warning for users in active legal proceedings.
- [ ] Add crisis resource links (988 Suicide & Crisis Lifeline, Crisis Text Line) on exclusion screens and in the app footer on every page.
- [ ] Add Content Security Policy headers in `nuxt.config.ts` (no external scripts loading trauma data). Add rate limiting on auth endpoints (e.g., 5 attempts per minute).
- [ ] Add Zod input validation schemas on all server API routes that don't have them yet.
- [ ] Add automated grounding trigger: if user is inactive >5 minutes during an active session, auto-trigger the grounding overlay (possible dissociation detection).
- [ ] End-to-end smoke test: register → complete screening → complete preparation → triage → complete one Tetris session → view progress dashboard. Verify the full flow works.
