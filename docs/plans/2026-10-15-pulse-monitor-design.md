# Webcam Pulse Monitor — Design

**Date:** 2026-10-15
**Status:** Approved

## Goal

An opt-in pulse monitor, shown during protocol sessions, that estimates heart rate from the webcam using remote photoplethysmography (rPPG) and automatically triggers the existing grounding overlay when heart rate stays elevated above the user's own baseline. It is a layout-level safeguard in the same spirit as the inactivity trigger: no session page changes, no server changes.

This is a portfolio feature. It must be visibly impressive (live BPM, waveform) and technically honest (signal quality shown, graceful degradation).

## Non-goals

- No face detection or tracking. A fixed central region of interest (ROI) is used; the UI asks the user to center their face.
- No logging of heart rate, baseline, or any camera-derived value. The only server-side effect is the grounding event the app already logs.
- No clinical claims. The widget copy calls it an estimate.

## Architecture

```
camera frames ──▶ useCameraSampler ──▶ {t, r, g, b} per frame
                                           │
                                           ▼
                              usePulseMonitor (10 s ring buffer)
                                           │  every 1 s
                                           ▼
                              ppg.ts: resample → POS → detrend → bandpass → FFT
                                           │
                                           ▼
                              { bpm, quality }  → baseline → elevated?
                                           │
                                           ▼
                        SharedPulseMonitor.vue (widget in session layout)
                                           │ elevated && !isGrounding
                                           ▼
                        useGrounding().trigger('heart-rate-elevated')
```

### 1. Signal pipeline — `app/utils/ppg.ts` (pure functions)

All functions are pure, dependency-free, and unit-tested with synthetic signals.

- `resampleUniform(samples, fs)` — linear interpolation of irregular `{t, r, g, b}` samples (timestamps from `performance.now()`) onto a uniform grid at `fs` Hz (default 30). Returns three `Float64Array`s.
- `posProjection(r, g, b, windowLen)` — the plane-orthogonal-to-skin method (Wang et al. 2017). For each sliding window of length `windowLen` (1.6 s at 30 Hz ≈ 48 samples): temporally normalize each channel by its window mean, project onto `S1 = G − B` and `S2 = −2R + G + B`, combine as `S1 + (σ(S1)/σ(S2))·S2`, subtract the window mean, and overlap-add into the output.
- `detrend(x, windowLen)` — subtract a moving average.
- `fft(re, im)` — in-place radix-2 Cooley–Tukey. Input length is zero-padded to the next power of two by the caller.
- `estimateBpm(pulse, fs, band = [0.7, 3.0])` — Hann window, zero-pad to ≥ 512 points, FFT, find the peak magnitude within the band. A peak within one bin of either band edge is rejected as out-of-band leakage. Returns `{ bpm, quality }` where `quality = (peak + two neighbours) / totalBandPower` in `[0, 1]`. A sharp single peak gives quality near 0.9; white noise typically scores 0.1–0.3 and occasionally crosses the threshold, which is why the monitor also requires agreement between consecutive readings.
- `QUALITY_GOOD = 0.35` — exported threshold used by the monitor and the widget.

### 2. Camera sampler — `app/composables/useCameraSampler.ts`

- `start()` requests `getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' }, audio: false })`, attaches the stream to a detached `<video>` element, and begins a `requestAnimationFrame` loop.
- Each frame: `drawImage` into an offscreen canvas (same small size), `getImageData` on the central ROI (central 40 % width × 40 % height), compute the mean R, G, B, and call `onSample({ t: performance.now(), r, g, b })`.
- `stop()` cancels the loop, stops all tracks, releases the video element.
- Reactive `error`: `'unsupported' | 'permission-denied' | 'failed' | null`.
- Nothing from a frame is retained after the mean is computed.
- Timing uses `performance.now()` + `requestAnimationFrame` (project constraint). The sampler accepts injectable `getUserMedia`, `createCanvas`, and `raf` for tests.

### 3. Pulse monitor — `app/composables/usePulseMonitor.ts`

Owns the ring buffer and the decision logic. Takes an injectable `now()` so tests drive time directly. Exposes:

```ts
{
  bpm: Ref<number | null>          // latest estimate, null until first good window
  quality: Ref<number>             // 0..1
  baseline: Ref<number | null>     // median of first 60 s of good readings
  elevated: Ref<boolean>
  waveform: Ref<Float64Array>      // last 10 s of pulse signal for the sparkline
  status: Ref<'off' | 'starting' | 'acquiring' | 'running' | 'error'>
  error: Ref<string | null>
  start(): Promise<void>
  stop(): void
  pushSample(s: Sample): void      // used by the sampler; public for tests
  tick(): void                     // re-estimate; called once per second by the rAF loop
}
```

Rules:

- Ring buffer holds 10 s of samples. `tick()` runs when at least 8 s are buffered, at most once per second.
- A window is **unreliable** when any gap between consecutive frames exceeds 150 ms or the effective frame rate is below 15 Hz (hidden tab, camera stall). It yields `bpm = null`, `quality = 0`.
- A reading is **good** when `quality ≥ QUALITY_GOOD` **and** it agrees with the previous non-null estimate within 8 BPM.
- **Baseline** = median of good readings, captured once there are at least 30 of them and 60 s have passed since the first. Until then, `status` is `'acquiring'` and `elevated` is always false.
- **Elevated threshold** = `max(baseline × 1.3, baseline + 20)`.
- `elevated` becomes true only after consecutive good readings ≥ threshold, with no poor or missing readings, spanning 15 s. A poor reading, a reading below threshold, or a gap of more than 2 s between ticks resets the clock. It returns to false as soon as a reading falls below threshold.
- `stop()` resets everything. A `stop()` that lands while the camera is still starting releases the stream when it arrives.

### 4. Widget — `app/components/shared/PulseMonitor.vue`

Fixed to the bottom-right of the session layout, above the crisis footer, styled to the existing mono/cyan aesthetic.

States:

- **Off** (default): a small "Pulse ○" pill. Click → starts the monitor. The opt-in is remembered in `localStorage` under `pulse-monitor-enabled` (per-browser convenience only; wrapped in try/catch).
- **Starting / permission prompt**: pill shows "Pulse …".
- **Acquiring**: pill shows "Pulse ~" with hint text "Center your face, hold still" and the sparkline.
- **Running**: BPM in large mono digits, quality dot (cyan = good, amber = weak), sparkline canvas of `waveform` redrawn on each tick.
- **Elevated**: pill turns amber with "Elevated" label.
- **Error**: short message ("Camera denied", "Camera unsupported") and the toggle to retry or switch off.

Behavior: a `watch` on `elevated` that, on a false→true transition, calls `useGrounding().trigger('heart-rate-elevated')` if `isGrounding` is false. It never triggers while grounding is already active, never triggers twice for the same elevated episode, and after one trigger waits a 3-minute cooldown before it may interrupt again.

The widget is **not rendered** on routes under `/modules/tnt` because WebGazer owns the camera there.

### 5. Layout — `app/layouts/session.vue`

Renders `<SharedPulseMonitor />` alongside the grounding overlay.

## Privacy

- Frames exist only inside the sampler for the duration of one `getImageData` call.
- The ring buffer holds mean colour values, not images.
- Nothing is persisted except the opt-in flag. Nothing camera-derived reaches the server.
- The README gains a short paragraph stating this.

## Error handling

- No `mediaDevices` / `getUserMedia` → `'unsupported'`, widget shows message, toggle stays available.
- `NotAllowedError` → `'permission-denied'`.
- Track ends unexpectedly (camera unplugged, tab backgrounded by the OS) → monitor goes to `'error'` with `'failed'`, no grounding trigger.
- Poor lighting → quality stays low, `bpm` is shown dimmed with the weak-signal dot, baseline is never captured, so `elevated` can never fire. This is the intended fail-safe direction.

## Testing

- `tests/unit/ppg.test.ts`: synthetic RGB at 72 BPM (plus a slow illumination drift and white noise) → `estimateBpm` within ±2 BPM and `quality ≥ QUALITY_GOOD`; white noise alone → `quality < QUALITY_GOOD`; `resampleUniform` on irregular timestamps reproduces a known ramp; `fft` of an impulse is flat; `posProjection` cancels a common-mode illumination change.
- `tests/unit/camera-sampler.test.ts`: injected fake canvas whose ROI pixels are known → emitted means are correct; `stop()` stops tracks; permission errors map to the right codes.
- `tests/unit/pulse-monitor.test.ts`: drive `pushSample`/`tick` with injected `now`; assert `acquiring` until 60 s, baseline equals the median, elevated after 15 s sustained at +30 %, not elevated for a 5 s spike, not elevated when a window contains a poor-quality reading, elevated clears when BPM drops.
- `tests/unit/pulse-monitor-widget.test.ts`: off by default; click enables and persists; renders BPM; elevated transition triggers grounding once; no trigger while grounding active; hidden on TNT routes.
- `tests/unit/layouts.test.ts`: session layout includes the widget (added to the existing, currently failing-for-other-reasons file; the new assertion is independent).

## Out of scope / follow-ups

- Using the pulse baseline to adapt protocol pacing.
- Marking the session as aborted when grounding fires from the layout (the inactivity trigger has the same gap today).
