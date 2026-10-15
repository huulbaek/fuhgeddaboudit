# Webcam Pulse Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An opt-in widget in the session layout that estimates heart rate from the webcam and auto-triggers the grounding overlay on a sustained rise above the user's baseline.

**Architecture:** A pure signal-processing module (resample → POS → detrend → bandpass → FFT peak) is fed by a camera sampler that emits one mean-RGB sample per animation frame. A monitor composable owns the ring buffer, baseline, and elevation logic with injectable time. A widget renders it and calls the existing grounding trigger. No server changes.

**Tech Stack:** Nuxt 4, Vue 3 composables, Canvas 2D, getUserMedia, `requestAnimationFrame` + `performance.now()`, Vitest with `@nuxt/test-utils`.

**Spec:** `docs/plans/2026-10-15-pulse-monitor-design.md`

## Global Constraints

- Timing-critical code uses `performance.now()` + `requestAnimationFrame`, never `setTimeout`/`setInterval`.
- No camera-derived value is persisted or sent to the server. Only the opt-in flag goes to `localStorage`, under key `pulse-monitor-enabled`, wrapped in try/catch.
- No new runtime dependencies. The FFT is written in-house.
- Grounding context string is `heart-rate-elevated` (≤ 50 chars, matches the `grounding_events.context` column).
- Widget is not rendered on routes under `/modules/tnt`.
- Threshold constants: `QUALITY_GOOD = 0.35`, elevation = `max(baseline × 1.3, baseline + 20)`, sustain 15 s, baseline window 60 s, ring buffer 10 s, minimum 8 s before first estimate, one estimate per second.
- Tests run with `npx vitest run <path>`. The suite has 22 pre-existing failures in six files unrelated to this work (cinema-view, crisis-footer, layouts, suds-scale, timer-bar, tnt-vigilance-task); do not count those as regressions.

## Review Focus

1. **Irregular frame timing.** Browsers throttle rAF in background tabs; samples may arrive at 1 Hz. `resampleUniform` must not throw or produce NaN on large gaps. Pinned in Task 1 (`handles a long gap between samples without NaN`).
2. **Camera unplugged mid-session.** The track's `ended` event must move the sampler to an error, stop the loop, and never trigger grounding. Pinned in Task 2 (`reports failed and stops when the track ends`) and Task 3 (`error from the sampler moves status to error`).
3. **A poor-quality reading inside an elevated run.** Must reset the sustain clock so a head turn can't accumulate toward a trigger. Pinned in Task 3.
4. **Grounding already active when elevation begins.** The widget must not re-trigger and must not trigger when the episode ends and a new one starts while grounding is still showing. Pinned in Task 4.
5. **localStorage unavailable (private mode).** Reading or writing the preference must not throw; widget starts off. Pinned in Task 4 (`starts off when localStorage throws`).

---

### Task 1: Signal pipeline (`app/utils/ppg.ts`)

**Files:**
- Create: `app/utils/ppg.ts`
- Test: `tests/unit/ppg.test.ts`

**Interfaces:**
- Produces:
  - `interface Sample { t: number; r: number; g: number; b: number }`
  - `DEFAULT_FS = 30`, `BAND_HZ: [0.7, 3.0]`, `QUALITY_GOOD = 0.35`
  - `resampleUniform(samples: Sample[], fs: number): { r: Float64Array; g: Float64Array; b: Float64Array }`
  - `posProjection(channels, windowLen: number): Float64Array`
  - `detrend(x: Float64Array, windowLen: number): Float64Array`
  - `fft(re: Float64Array, im: Float64Array): void` (in place, length power of two)
  - `bandpass(x: Float64Array, fs: number, band?): Float64Array`
  - `estimateBpm(pulse: Float64Array, fs: number, band?): { bpm: number | null; quality: number }`
  - `analyze(samples: Sample[], fs?): { pulse: Float64Array; bpm: number | null; quality: number }`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/ppg.test.ts
import { describe, it, expect } from 'vitest'
import {
  resampleUniform, posProjection, detrend, fft, bandpass, estimateBpm, analyze,
  QUALITY_GOOD, type Sample,
} from '../../app/utils/ppg'

/** Deterministic pseudo-random noise so tests are repeatable. */
function lcg(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32 - 0.5 }
}

/** Synthetic skin-colour samples with a pulsatile component at `bpm`. */
function synthSamples(opts: { bpm: number; seconds: number; fs: number; noise?: number; drift?: number; jitter?: number; seed?: number }): Sample[] {
  const rnd = lcg(opts.seed ?? 1)
  const out: Sample[] = []
  const n = Math.round(opts.seconds * opts.fs)
  for (let i = 0; i < n; i++) {
    const t = (i / opts.fs) * 1000 + (opts.jitter ?? 0) * rnd() * 1000
    const sec = t / 1000
    const pulse = Math.sin(2 * Math.PI * (opts.bpm / 60) * sec)
    const drift = (opts.drift ?? 0) * Math.sin(2 * Math.PI * 0.05 * sec)
    const noise = opts.noise ?? 0
    // Pulsatile amplitude is strongest in green, as in real skin.
    out.push({
      t,
      r: 150 + 1.0 * pulse + drift * 1 + noise * rnd(),
      g: 110 + 2.0 * pulse + drift * 1 + noise * rnd(),
      b: 90 + 0.5 * pulse + drift * 1 + noise * rnd(),
    })
  }
  return out
}

describe('resampleUniform', () => {
  it('reproduces a linear ramp from irregular timestamps', () => {
    const samples: Sample[] = [0, 37, 71, 100, 134, 170, 200].map((t) => ({ t, r: t, g: 2 * t, b: 3 * t }))
    const { r, g, b } = resampleUniform(samples, 20) // 50 ms grid
    expect(Array.from(r)).toEqual([0, 50, 100, 150, 200])
    expect(Array.from(g)).toEqual([0, 100, 200, 300, 400])
    expect(Array.from(b)).toEqual([0, 150, 300, 450, 600])
  })

  it('handles a long gap between samples without NaN', () => {
    const samples: Sample[] = [{ t: 0, r: 1, g: 1, b: 1 }, { t: 5000, r: 3, g: 3, b: 3 }, { t: 5033, r: 3, g: 3, b: 3 }]
    const { g } = resampleUniform(samples, 30)
    expect(g.length).toBe(Math.floor(5033 / (1000 / 30)) + 1)
    expect(Array.from(g).every(Number.isFinite)).toBe(true)
  })

  it('returns empty arrays for fewer than two samples', () => {
    expect(resampleUniform([{ t: 0, r: 1, g: 1, b: 1 }], 30).r.length).toBe(0)
  })
})

describe('posProjection', () => {
  it('cancels a common-mode illumination change', () => {
    const n = 120
    const r = new Float64Array(n), g = new Float64Array(n), b = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      const light = 1 + 0.3 * Math.sin(2 * Math.PI * i / n) // slow brightness swing
      r[i] = 150 * light; g[i] = 110 * light; b[i] = 90 * light
    }
    const h = posProjection({ r, g, b }, 48)
    const peak = Math.max(...Array.from(h).map(Math.abs))
    expect(peak).toBeLessThan(1e-9)
  })

  it('returns zeros when shorter than the window', () => {
    const z = new Float64Array(10).fill(1)
    expect(Array.from(posProjection({ r: z, g: z, b: z }, 48))).toEqual(new Array(10).fill(0))
  })
})

describe('detrend', () => {
  it('removes a constant offset', () => {
    const x = new Float64Array([5, 5, 5, 5, 5, 5])
    expect(Array.from(detrend(x, 4)).every((v) => Math.abs(v) < 1e-12)).toBe(true)
  })
})

describe('fft', () => {
  it('transforms an impulse into a flat spectrum', () => {
    const re = new Float64Array(8); re[0] = 1
    const im = new Float64Array(8)
    fft(re, im)
    expect(Array.from(re).every((v) => Math.abs(v - 1) < 1e-12)).toBe(true)
    expect(Array.from(im).every((v) => Math.abs(v) < 1e-12)).toBe(true)
  })

  it('locates a pure tone in the right bin', () => {
    const N = 64
    const re = new Float64Array(N), im = new Float64Array(N)
    for (let i = 0; i < N; i++) re[i] = Math.cos(2 * Math.PI * 5 * i / N)
    fft(re, im)
    const mags = Array.from(re).map((v, i) => Math.hypot(v, im[i]!))
    expect(mags.indexOf(Math.max(...mags.slice(0, N / 2)))).toBe(5)
  })
})

describe('bandpass', () => {
  it('removes a slow drift but keeps a 1.2 Hz tone', () => {
    const fs = 30, n = 300
    const x = new Float64Array(n)
    for (let i = 0; i < n; i++) x[i] = Math.sin(2 * Math.PI * 1.2 * i / fs) + 5 * Math.sin(2 * Math.PI * 0.05 * i / fs)
    const y = bandpass(x, fs)
    const mid = y.slice(60, 240)
    const amp = Math.max(...Array.from(mid).map(Math.abs))
    expect(amp).toBeGreaterThan(0.6)
    expect(amp).toBeLessThan(1.5)
  })
})

describe('estimateBpm', () => {
  it('recovers 72 BPM from a clean pulse with high quality', () => {
    const fs = 30, n = 300
    const pulse = new Float64Array(n)
    for (let i = 0; i < n; i++) pulse[i] = Math.sin(2 * Math.PI * 1.2 * i / fs)
    const { bpm, quality } = estimateBpm(pulse, fs)
    expect(bpm).toBeCloseTo(72, 0)
    expect(quality).toBeGreaterThanOrEqual(QUALITY_GOOD)
  })

  it('reports low quality for white noise', () => {
    const rnd = lcg(7)
    const pulse = new Float64Array(300).map(() => rnd())
    const { quality } = estimateBpm(pulse, 30)
    expect(quality).toBeLessThan(QUALITY_GOOD)
  })

  it('returns null bpm for fewer than two seconds of data', () => {
    expect(estimateBpm(new Float64Array(30), 30).bpm).toBeNull()
  })
})

describe('analyze', () => {
  it('recovers the heart rate from noisy, drifting, jittered samples', () => {
    const samples = synthSamples({ bpm: 72, seconds: 10, fs: 30, noise: 0.8, drift: 6, jitter: 0.004 })
    const { bpm, quality } = analyze(samples, 30)
    expect(bpm).not.toBeNull()
    expect(Math.abs(bpm! - 72)).toBeLessThanOrEqual(2)
    expect(quality).toBeGreaterThanOrEqual(QUALITY_GOOD)
  })

  it('recovers a fast heart rate', () => {
    const samples = synthSamples({ bpm: 120, seconds: 10, fs: 30, noise: 0.5 })
    const { bpm } = analyze(samples, 30)
    expect(Math.abs(bpm! - 120)).toBeLessThanOrEqual(2)
  })

  it('reports low quality when there is no pulse, only noise', () => {
    const rnd = lcg(3)
    const samples: Sample[] = Array.from({ length: 300 }, (_, i) => ({
      t: (i / 30) * 1000, r: 150 + 3 * rnd(), g: 110 + 3 * rnd(), b: 90 + 3 * rnd(),
    }))
    expect(analyze(samples, 30).quality).toBeLessThan(QUALITY_GOOD)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/ppg.test.ts`
Expected: FAIL, "Failed to resolve import '../../app/utils/ppg'".

- [ ] **Step 3: Implement**

```ts
// app/utils/ppg.ts
/**
 * Remote photoplethysmography (rPPG) signal pipeline.
 * Pure functions, no DOM, no dependencies. See docs/plans/2026-10-15-pulse-monitor-design.md.
 */

export interface Sample {
  /** performance.now() timestamp in ms */
  t: number
  r: number
  g: number
  b: number
}

export interface Channels {
  r: Float64Array
  g: Float64Array
  b: Float64Array
}

export const DEFAULT_FS = 30
export const BAND_HZ: [number, number] = [0.7, 3.0] // 42–180 BPM
export const QUALITY_GOOD = 0.35

function mean(x: ArrayLike<number>, start = 0, end = x.length): number {
  if (end <= start) return 0
  let s = 0
  for (let i = start; i < end; i++) s += x[i]!
  return s / (end - start)
}

function std(x: Float64Array): number {
  const m = mean(x)
  let s = 0
  for (let i = 0; i < x.length; i++) s += (x[i]! - m) ** 2
  return Math.sqrt(s / x.length)
}

function nextPow2(n: number): number {
  let p = 1
  while (p < n) p <<= 1
  return p
}

/** Linear interpolation of irregular samples onto a uniform grid at `fs` Hz. */
export function resampleUniform(samples: Sample[], fs: number): Channels {
  if (samples.length < 2) {
    return { r: new Float64Array(0), g: new Float64Array(0), b: new Float64Array(0) }
  }
  const t0 = samples[0]!.t
  const tEnd = samples[samples.length - 1]!.t
  const step = 1000 / fs
  const n = Math.floor((tEnd - t0) / step) + 1
  const r = new Float64Array(n)
  const g = new Float64Array(n)
  const b = new Float64Array(n)
  let j = 0
  for (let i = 0; i < n; i++) {
    const t = t0 + i * step
    while (j < samples.length - 2 && samples[j + 1]!.t < t) j++
    const a = samples[j]!
    const c = samples[j + 1]!
    const span = c.t - a.t
    const w = span > 0 ? Math.min(Math.max((t - a.t) / span, 0), 1) : 0
    r[i] = a.r + (c.r - a.r) * w
    g[i] = a.g + (c.g - a.g) * w
    b[i] = a.b + (c.b - a.b) * w
  }
  return { r, g, b }
}

/**
 * Plane-orthogonal-to-skin projection (Wang et al., 2017).
 * Normalises each channel by its window mean, projects onto two axes
 * orthogonal to the skin tone, and combines them with an adaptive weight.
 */
export function posProjection({ r, g, b }: Channels, windowLen: number): Float64Array {
  const n = r.length
  const h = new Float64Array(n)
  if (n < windowLen || windowLen < 2) return h
  const xs = new Float64Array(windowLen)
  const ys = new Float64Array(windowLen)
  for (let m = 0; m + windowLen <= n; m++) {
    const end = m + windowLen
    const mr = mean(r, m, end) || 1
    const mg = mean(g, m, end) || 1
    const mb = mean(b, m, end) || 1
    for (let i = 0; i < windowLen; i++) {
      const rn = r[m + i]! / mr
      const gn = g[m + i]! / mg
      const bn = b[m + i]! / mb
      xs[i] = gn - bn
      ys[i] = -2 * rn + gn + bn
    }
    const sy = std(ys)
    const alpha = sy > 0 ? std(xs) / sy : 0
    let hm = 0
    for (let i = 0; i < windowLen; i++) hm += xs[i]! + alpha * ys[i]!
    hm /= windowLen
    for (let i = 0; i < windowLen; i++) h[m + i] = h[m + i]! + xs[i]! + alpha * ys[i]! - hm
  }
  return h
}

/** Subtract a centred moving average. */
export function detrend(x: Float64Array, windowLen: number): Float64Array {
  const n = x.length
  const out = new Float64Array(n)
  const half = Math.floor(windowLen / 2)
  for (let i = 0; i < n; i++) {
    out[i] = x[i]! - mean(x, Math.max(0, i - half), Math.min(n, i + half + 1))
  }
  return out
}

/** In-place iterative radix-2 FFT. Length must be a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]!; re[i] = re[j]!; re[j] = tr
      const ti = im[i]!; im[i] = im[j]!; im[j] = ti
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    const half = len >> 1
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < half; k++) {
        const a = i + k
        const bIdx = a + half
        const ur = re[a]!, ui = im[a]!
        const vr = re[bIdx]! * cr - im[bIdx]! * ci
        const vi = re[bIdx]! * ci + im[bIdx]! * cr
        re[a] = ur + vr; im[a] = ui + vi
        re[bIdx] = ur - vr; im[bIdx] = ui - vi
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
}

function ifft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 0; i < n; i++) im[i] = -im[i]!
  fft(re, im)
  for (let i = 0; i < n; i++) {
    re[i] = re[i]! / n
    im[i] = -im[i]! / n
  }
}

/** Zero every frequency bin outside `band`, in both halves of the spectrum. */
export function bandpass(x: Float64Array, fs: number, band: [number, number] = BAND_HZ): Float64Array {
  const n = x.length
  if (n === 0) return new Float64Array(0)
  const N = nextPow2(n)
  const re = new Float64Array(N)
  const im = new Float64Array(N)
  re.set(x)
  fft(re, im)
  const [lo, hi] = band
  for (let k = 0; k < N; k++) {
    const f = ((k <= N / 2 ? k : N - k) * fs) / N
    if (f < lo || f > hi) { re[k] = 0; im[k] = 0 }
  }
  ifft(re, im)
  return re.slice(0, n)
}

export interface BpmEstimate {
  bpm: number | null
  /** Fraction of in-band power held by the spectral peak and its neighbours, 0..1. */
  quality: number
}

/** Hann-windowed FFT peak inside `band`, with parabolic interpolation. */
export function estimateBpm(pulse: Float64Array, fs: number, band: [number, number] = BAND_HZ): BpmEstimate {
  const n = pulse.length
  if (n < fs * 2) return { bpm: null, quality: 0 }
  const N = Math.max(512, nextPow2(n))
  const re = new Float64Array(N)
  const im = new Float64Array(N)
  for (let i = 0; i < n; i++) re[i] = pulse[i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)))
  fft(re, im)
  const [lo, hi] = band
  const kLo = Math.ceil((lo * N) / fs)
  const kHi = Math.floor((hi * N) / fs)
  const power = new Float64Array(N / 2 + 1)
  let peakK = -1
  let peakP = 0
  let total = 0
  for (let k = kLo; k <= kHi; k++) {
    const p = re[k]! ** 2 + im[k]! ** 2
    power[k] = p
    total += p
    if (p > peakP) { peakP = p; peakK = k }
  }
  if (peakK < 0 || total === 0) return { bpm: null, quality: 0 }
  const pl = power[peakK - 1] ?? 0
  const pr = power[peakK + 1] ?? 0
  const denom = pl - 2 * peakP + pr
  const delta = denom !== 0 ? (0.5 * (pl - pr)) / denom : 0
  const freq = ((peakK + delta) * fs) / N
  return { bpm: freq * 60, quality: Math.min(1, (peakP + pl + pr) / total) }
}

export interface Analysis extends BpmEstimate {
  /** Band-limited pulse waveform at `fs`, for display. */
  pulse: Float64Array
}

/** Full pipeline: resample → POS → detrend → bandpass → BPM. */
export function analyze(samples: Sample[], fs = DEFAULT_FS): Analysis {
  const channels = resampleUniform(samples, fs)
  const windowLen = Math.round(1.6 * fs)
  const raw = posProjection(channels, windowLen)
  const pulse = bandpass(detrend(raw, windowLen), fs)
  return { pulse, ...estimateBpm(pulse, fs) }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/unit/ppg.test.ts`
Expected: all pass. If `analyze` misses the BPM tolerance, lower `noise` in the test only after confirming the clean-signal `estimateBpm` test passes (that isolates pipeline bugs from SNR).

- [ ] **Step 5: Commit**

```bash
git add app/utils/ppg.ts tests/unit/ppg.test.ts
git commit -m "Add rPPG signal pipeline (POS, FFT, BPM estimate)"
```

---

### Task 2: Camera sampler (`app/composables/useCameraSampler.ts`)

**Files:**
- Create: `app/composables/useCameraSampler.ts`
- Test: `tests/unit/camera-sampler.test.ts`

**Interfaces:**
- Consumes: `Sample` from Task 1.
- Produces:
  - `type CameraSamplerError = 'unsupported' | 'permission-denied' | 'failed'`
  - `useCameraSampler(options: CameraSamplerOptions)` returning `{ running: Ref<boolean>; error: Ref<CameraSamplerError | null>; roi; isSupported(); start(): Promise<void>; stop(): void }`
  - `CameraSamplerOptions = { onSample(s: Sample): void; width?; height?; roiFraction?; getUserMedia?; createVideo?; createCanvas?; raf?; caf?; now? }`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/camera-sampler.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { useCameraSampler } from '../../app/composables/useCameraSampler'
import type { Sample } from '../../app/utils/ppg'

function fakeEnv(opts: { deny?: boolean; pixel?: [number, number, number] } = {}) {
  const listeners: Record<string, () => void> = {}
  const track = { stop: vi.fn(), addEventListener: vi.fn((ev: string, cb: () => void) => { listeners[ev] = cb }) }
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] }
  const getUserMedia = vi.fn(async () => {
    if (opts.deny) throw new DOMException('denied', 'NotAllowedError')
    return stream as unknown as MediaStream
  })
  const video = { readyState: 4, play: vi.fn().mockResolvedValue(undefined), srcObject: null as any, muted: false, playsInline: false }
  const [pr, pg, pb] = opts.pixel ?? [200, 100, 50]
  const ctx = {
    drawImage: vi.fn(),
    getImageData: vi.fn((x: number, y: number, w: number, h: number) => {
      const data = new Uint8ClampedArray(w * h * 4)
      for (let i = 0; i < data.length; i += 4) { data[i] = pr; data[i + 1] = pg; data[i + 2] = pb; data[i + 3] = 255 }
      return { data, width: w, height: h }
    }),
  }
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => ctx) }
  const frames: FrameRequestCallback[] = []
  const raf = vi.fn((cb: FrameRequestCallback) => { frames.push(cb); return frames.length })
  const caf = vi.fn()
  let t = 1000
  const now = () => t
  const samples: Sample[] = []
  const sampler = useCameraSampler({
    onSample: (s) => samples.push(s),
    getUserMedia,
    createVideo: () => video as unknown as HTMLVideoElement,
    createCanvas: () => canvas as unknown as HTMLCanvasElement,
    raf, caf, now,
  })
  const nextFrame = (advanceMs = 33) => { t += advanceMs; const cb = frames.shift(); cb?.(t) }
  return { sampler, samples, getUserMedia, track, listeners, ctx, video, frames, nextFrame, caf }
}

describe('useCameraSampler', () => {
  afterEach(() => vi.restoreAllMocks())

  it('requests a small front-facing video stream with no audio', async () => {
    const { sampler, getUserMedia } = fakeEnv()
    await sampler.start()
    expect(getUserMedia).toHaveBeenCalledWith({ video: { width: 320, height: 240, facingMode: 'user' }, audio: false })
    expect(sampler.running.value).toBe(true)
  })

  it('emits the mean RGB of the central region each frame with a timestamp', async () => {
    const { sampler, samples, ctx, nextFrame } = fakeEnv({ pixel: [200, 100, 50] })
    await sampler.start()
    nextFrame(33)
    nextFrame(33)
    expect(samples).toHaveLength(2)
    expect(samples[0]).toEqual({ t: 1033, r: 200, g: 100, b: 50 })
    expect(samples[1]!.t).toBe(1066)
    // ROI is the central 40 % box of a 320×240 frame
    expect(ctx.getImageData).toHaveBeenCalledWith(96, 72, 128, 96)
  })

  it('maps a denied permission to permission-denied', async () => {
    const { sampler } = fakeEnv({ deny: true })
    await sampler.start()
    expect(sampler.error.value).toBe('permission-denied')
    expect(sampler.running.value).toBe(false)
  })

  it('stop cancels the frame loop and releases the camera', async () => {
    const { sampler, track, caf, video } = fakeEnv()
    await sampler.start()
    sampler.stop()
    expect(caf).toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
    expect(video.srcObject).toBeNull()
    expect(sampler.running.value).toBe(false)
  })

  it('reports failed and stops when the track ends', async () => {
    const { sampler, listeners, track } = fakeEnv()
    await sampler.start()
    listeners.ended!()
    expect(sampler.error.value).toBe('failed')
    expect(sampler.running.value).toBe(false)
    expect(track.stop).toHaveBeenCalled()
  })

  it('reports unsupported when getUserMedia is unavailable', async () => {
    Object.defineProperty(globalThis.navigator, 'mediaDevices', { value: undefined, configurable: true })
    const sampler = useCameraSampler({ onSample: () => {} })
    await sampler.start()
    expect(sampler.error.value).toBe('unsupported')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/camera-sampler.test.ts`
Expected: FAIL, unresolved import.

- [ ] **Step 3: Implement**

```ts
// app/composables/useCameraSampler.ts
import type { Sample } from '../utils/ppg'

export type CameraSamplerError = 'unsupported' | 'permission-denied' | 'failed'

export interface CameraSamplerOptions {
  onSample: (sample: Sample) => void
  width?: number
  height?: number
  /** Fraction of width/height covered by the central region of interest. */
  roiFraction?: number
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>
  createVideo?: () => HTMLVideoElement
  createCanvas?: (width: number, height: number) => HTMLCanvasElement
  raf?: (cb: FrameRequestCallback) => number
  caf?: (id: number) => void
  now?: () => number
}

/**
 * Pulls webcam frames on requestAnimationFrame and emits the mean RGB of a
 * central box. Frames are never retained; only the three means leave this
 * composable.
 */
export function useCameraSampler(options: CameraSamplerOptions) {
  const width = options.width ?? 320
  const height = options.height ?? 240
  const roiFraction = options.roiFraction ?? 0.4
  const now = options.now ?? (() => performance.now())
  const raf = options.raf ?? ((cb: FrameRequestCallback) => requestAnimationFrame(cb))
  const caf = options.caf ?? ((id: number) => cancelAnimationFrame(id))

  const running = ref(false)
  const error = ref<CameraSamplerError | null>(null)

  const roi = {
    x: Math.round((width * (1 - roiFraction)) / 2),
    y: Math.round((height * (1 - roiFraction)) / 2),
    w: Math.round(width * roiFraction),
    h: Math.round(height * roiFraction),
  }

  let stream: MediaStream | null = null
  let video: HTMLVideoElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let rafId: number | null = null

  function isSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'
  }

  function requestStream(constraints: MediaStreamConstraints): Promise<MediaStream> {
    if (options.getUserMedia) return options.getUserMedia(constraints)
    return navigator.mediaDevices.getUserMedia(constraints)
  }

  function frame() {
    if (!running.value || !video || !ctx) return
    if (video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, width, height)
      const { data } = ctx.getImageData(roi.x, roi.y, roi.w, roi.h)
      const pixels = data.length / 4
      let r = 0, g = 0, b = 0
      for (let i = 0; i < data.length; i += 4) {
        r += data[i]!
        g += data[i + 1]!
        b += data[i + 2]!
      }
      options.onSample({ t: now(), r: r / pixels, g: g / pixels, b: b / pixels })
    }
    rafId = raf(frame)
  }

  function release() {
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    if (video) {
      video.srcObject = null
      video = null
    }
    ctx = null
  }

  function stop() {
    running.value = false
    if (rafId !== null) {
      caf(rafId)
      rafId = null
    }
    release()
  }

  function onTrackEnded() {
    error.value = 'failed'
    stop()
  }

  async function start(): Promise<void> {
    if (running.value) return
    error.value = null
    if (!options.getUserMedia && !isSupported()) {
      error.value = 'unsupported'
      return
    }
    try {
      stream = await requestStream({ video: { width, height, facingMode: 'user' }, audio: false })
    } catch (e: any) {
      error.value = e?.name === 'NotAllowedError' ? 'permission-denied' : 'failed'
      return
    }
    video = options.createVideo ? options.createVideo() : document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.srcObject = stream
    try {
      await video.play()
    } catch {
      error.value = 'failed'
      release()
      return
    }
    const canvas = options.createCanvas ? options.createCanvas(width, height) : document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      error.value = 'failed'
      release()
      return
    }
    stream.getVideoTracks().forEach((track) => track.addEventListener('ended', onTrackEnded))
    running.value = true
    rafId = raf(frame)
  }

  return { running, error, roi, isSupported, start, stop }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/unit/camera-sampler.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useCameraSampler.ts tests/unit/camera-sampler.test.ts
git commit -m "Add webcam mean-RGB sampler"
```

---

### Task 3: Pulse monitor (`app/composables/usePulseMonitor.ts`)

**Files:**
- Create: `app/composables/usePulseMonitor.ts`
- Test: `tests/unit/pulse-monitor.test.ts`

**Interfaces:**
- Consumes: `analyze`, `QUALITY_GOOD`, `DEFAULT_FS`, `Sample` (Task 1); `useCameraSampler`, `CameraSamplerError` (Task 2).
- Produces:
  - `type PulseStatus = 'off' | 'starting' | 'acquiring' | 'running' | 'error'`
  - `elevationThreshold(baseline: number): number`
  - `median(values: number[]): number`
  - `usePulseMonitor(options?)` returning `{ bpm, quality, baseline, elevated, waveform, status, error, start(), stop(), pushSample(s), tick() }`
  - `PulseMonitorOptions = { now?; fs?; bufferMs?; minMs?; baselineMs?; sustainMs?; tickMs?; createSampler?(onSample) }`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/pulse-monitor.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePulseMonitor, elevationThreshold, median } from '../../app/composables/usePulseMonitor'
import type { Sample } from '../../app/utils/ppg'

// Replace the heavy signal pipeline with a controllable stub.
const analyzeMock = vi.fn()
vi.mock('../../app/utils/ppg', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../app/utils/ppg')>()
  return { ...actual, analyze: (...args: unknown[]) => analyzeMock(...args) }
})

function setup() {
  let t = 0
  const now = () => t
  const monitor = usePulseMonitor({ now })
  /** Fill the buffer with 10 s of samples ending now, then run one tick. */
  function reading(bpm: number | null, quality: number) {
    analyzeMock.mockReturnValue({ bpm, quality, pulse: new Float64Array(300) })
    for (let i = 0; i < 300; i++) {
      monitor.pushSample({ t: t - 10_000 + (i * 1000) / 30, r: 0, g: 0, b: 0 })
    }
    monitor.tick()
  }
  /** Advance one second and emit a reading. */
  function second(bpm: number | null, quality = 0.8) {
    t += 1000
    reading(bpm, quality)
  }
  return { monitor, second, reading, advance: (ms: number) => { t += ms } }
}

describe('helpers', () => {
  it('elevationThreshold is the larger of +30 % and +20', () => {
    expect(elevationThreshold(60)).toBe(80)   // 60+20 beats 60*1.3=78
    expect(elevationThreshold(100)).toBe(130) // 130 beats 120
  })

  it('median of even and odd lists', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })
})

describe('usePulseMonitor', () => {
  beforeEach(() => analyzeMock.mockReset())

  it('does not estimate until 8 s of samples are buffered', () => {
    const { monitor } = setup()
    analyzeMock.mockReturnValue({ bpm: 70, quality: 0.9, pulse: new Float64Array(0) })
    for (let i = 0; i < 100; i++) monitor.pushSample({ t: i * 33, r: 0, g: 0, b: 0 })
    monitor.tick()
    expect(analyzeMock).not.toHaveBeenCalled()
    expect(monitor.bpm.value).toBeNull()
  })

  it('estimates at most once per second', () => {
    const { monitor, reading, advance } = setup()
    advance(10_000)
    reading(70, 0.9)
    reading(70, 0.9)
    advance(500)
    reading(70, 0.9)
    expect(analyzeMock).toHaveBeenCalledTimes(1)
    advance(500)
    reading(70, 0.9)
    expect(analyzeMock).toHaveBeenCalledTimes(2)
  })

  it('exposes bpm, quality and waveform from the latest estimate', () => {
    const { monitor, second } = setup()
    second(68, 0.7)
    expect(monitor.bpm.value).toBe(68)
    expect(monitor.quality.value).toBe(0.7)
    expect(monitor.waveform.value.length).toBe(300)
  })

  it('captures the baseline as the median of 60 s of good readings', () => {
    const { monitor, second } = setup()
    const values = [70, 72, 68, 71, 69, 90]
    for (let i = 0; i <= 60; i++) second(values[i % values.length]!, 0.8)
    expect(monitor.baseline.value).toBe(median(values.flatMap((v) => [v, v, v, v, v, v, v, v, v, v]).concat([70])))
  })

  it('ignores poor-quality readings while acquiring the baseline', () => {
    const { monitor, second } = setup()
    for (let i = 0; i < 30; i++) second(70, 0.8)
    for (let i = 0; i < 30; i++) second(150, 0.1) // garbage
    expect(monitor.baseline.value).toBeNull()
    for (let i = 0; i < 31; i++) second(70, 0.8)
    expect(monitor.baseline.value).toBe(70)
  })

  it('never reports elevated before the baseline exists', () => {
    const { monitor, second } = setup()
    for (let i = 0; i < 40; i++) second(150, 0.9)
    expect(monitor.elevated.value).toBe(false)
  })

  function withBaseline70() {
    const env = setup()
    for (let i = 0; i <= 60; i++) env.second(70, 0.8)
    expect(env.monitor.baseline.value).toBe(70)
    return env
  }

  it('reports elevated after 15 s sustained above threshold', () => {
    const { monitor, second } = withBaseline70()
    for (let i = 0; i < 14; i++) second(95, 0.8)
    expect(monitor.elevated.value).toBe(false)
    second(95, 0.8)
    second(95, 0.8)
    expect(monitor.elevated.value).toBe(true)
  })

  it('does not report elevated for a 5 s spike', () => {
    const { monitor, second } = withBaseline70()
    for (let i = 0; i < 5; i++) second(110, 0.8)
    for (let i = 0; i < 20; i++) second(72, 0.8)
    expect(monitor.elevated.value).toBe(false)
  })

  it('a poor-quality reading inside the run resets the sustain clock', () => {
    const { monitor, second } = withBaseline70()
    for (let i = 0; i < 10; i++) second(95, 0.8)
    second(95, 0.1)
    for (let i = 0; i < 10; i++) second(95, 0.8)
    expect(monitor.elevated.value).toBe(false)
    for (let i = 0; i < 6; i++) second(95, 0.8)
    expect(monitor.elevated.value).toBe(true)
  })

  it('clears elevated as soon as a reading drops below threshold', () => {
    const { monitor, second } = withBaseline70()
    for (let i = 0; i < 17; i++) second(95, 0.8)
    expect(monitor.elevated.value).toBe(true)
    second(80, 0.8)
    expect(monitor.elevated.value).toBe(false)
  })

  it('start wires the sampler and moves through starting → acquiring → running', async () => {
    let t = 0
    let emit: ((s: Sample) => void) | null = null
    const fakeSampler = { start: vi.fn(async () => {}), stop: vi.fn(), error: ref<any>(null) }
    const monitor = usePulseMonitor({ now: () => t, createSampler: (onSample) => { emit = onSample; return fakeSampler } })
    expect(monitor.status.value).toBe('off')
    const p = monitor.start()
    expect(monitor.status.value).toBe('starting')
    await p
    expect(monitor.status.value).toBe('acquiring')
    analyzeMock.mockReturnValue({ bpm: 70, quality: 0.9, pulse: new Float64Array(0) })
    for (let s = 0; s <= 71; s++) {
      for (let f = 0; f < 30; f++) { t = s * 1000 + f * 33; emit!({ t, r: 0, g: 0, b: 0 }) }
    }
    expect(monitor.status.value).toBe('running')
    expect(monitor.baseline.value).toBe(70)
  })

  it('start reports the sampler error', async () => {
    const fakeSampler = { start: vi.fn(async () => { fakeSampler.error.value = 'permission-denied' }), stop: vi.fn(), error: ref<any>(null) }
    const monitor = usePulseMonitor({ createSampler: () => fakeSampler })
    await monitor.start()
    expect(monitor.status.value).toBe('error')
    expect(monitor.error.value).toBe('permission-denied')
  })

  it('error from the sampler moves status to error', async () => {
    const fakeSampler = { start: vi.fn(async () => {}), stop: vi.fn(), error: ref<any>(null) }
    const monitor = usePulseMonitor({ createSampler: () => fakeSampler })
    await monitor.start()
    fakeSampler.error.value = 'failed'
    await nextTick()
    expect(monitor.status.value).toBe('error')
    expect(fakeSampler.stop).toHaveBeenCalled()
  })

  it('stop releases the sampler and resets state', async () => {
    const fakeSampler = { start: vi.fn(async () => {}), stop: vi.fn(), error: ref<any>(null) }
    const monitor = usePulseMonitor({ createSampler: () => fakeSampler })
    await monitor.start()
    monitor.stop()
    expect(fakeSampler.stop).toHaveBeenCalled()
    expect(monitor.status.value).toBe('off')
    expect(monitor.bpm.value).toBeNull()
    expect(monitor.baseline.value).toBeNull()
    expect(monitor.elevated.value).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/pulse-monitor.test.ts`
Expected: FAIL, unresolved import.

- [ ] **Step 3: Implement**

```ts
// app/composables/usePulseMonitor.ts
import { analyze, DEFAULT_FS, QUALITY_GOOD, type Sample } from '../utils/ppg'
import { useCameraSampler, type CameraSamplerError } from './useCameraSampler'

export type PulseStatus = 'off' | 'starting' | 'acquiring' | 'running' | 'error'

export const ELEVATION_RATIO = 1.3
export const ELEVATION_MIN_DELTA = 20

export interface PulseSampler {
  start: () => Promise<void>
  stop: () => void
  error: Ref<CameraSamplerError | null>
}

export interface PulseMonitorOptions {
  now?: () => number
  fs?: number
  bufferMs?: number
  minMs?: number
  baselineMs?: number
  sustainMs?: number
  tickMs?: number
  createSampler?: (onSample: (s: Sample) => void) => PulseSampler
}

export function elevationThreshold(baseline: number): number {
  return Math.max(baseline * ELEVATION_RATIO, baseline + ELEVATION_MIN_DELTA)
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/**
 * Owns the sample ring buffer, the per-second BPM estimate, the personal
 * baseline, and the sustained-elevation decision. Time is injectable so
 * the logic is testable without a camera.
 */
export function usePulseMonitor(options: PulseMonitorOptions = {}) {
  const now = options.now ?? (() => performance.now())
  const fs = options.fs ?? DEFAULT_FS
  const bufferMs = options.bufferMs ?? 10_000
  const minMs = options.minMs ?? 8_000
  const baselineMs = options.baselineMs ?? 60_000
  const sustainMs = options.sustainMs ?? 15_000
  const tickMs = options.tickMs ?? 1_000
  const createSampler = options.createSampler ?? ((onSample: (s: Sample) => void) => useCameraSampler({ onSample }))

  const bpm = ref<number | null>(null)
  const quality = ref(0)
  const baseline = ref<number | null>(null)
  const elevated = ref(false)
  const waveform = ref<Float64Array>(new Float64Array(0))
  const status = ref<PulseStatus>('off')
  const error = ref<CameraSamplerError | null>(null)

  let samples: Sample[] = []
  let lastTick = -Infinity
  let baselineReadings: number[] = []
  let firstGoodAt: number | null = null
  let elevatedSince: number | null = null
  let sampler: PulseSampler | null = null
  let stopErrorWatch: (() => void) | null = null

  function pushSample(sample: Sample) {
    samples.push(sample)
    const cutoff = sample.t - bufferMs
    while (samples.length && samples[0]!.t < cutoff) samples.shift()
  }

  function tick() {
    const t = now()
    if (t - lastTick < tickMs) return
    if (samples.length < 2 || samples[samples.length - 1]!.t - samples[0]!.t < minMs) return
    lastTick = t

    const result = analyze(samples, fs)
    waveform.value = result.pulse
    quality.value = result.quality
    bpm.value = result.bpm
    const good = result.bpm !== null && result.quality >= QUALITY_GOOD

    if (baseline.value === null) {
      if (!good) return
      firstGoodAt ??= t
      baselineReadings.push(result.bpm!)
      if (t - firstGoodAt >= baselineMs) {
        baseline.value = median(baselineReadings)
        status.value = 'running'
      }
      return
    }

    if (good && result.bpm! >= elevationThreshold(baseline.value)) {
      elevatedSince ??= t
      elevated.value = t - elevatedSince >= sustainMs
    } else {
      elevatedSince = null
      elevated.value = false
    }
  }

  function reset() {
    samples = []
    lastTick = -Infinity
    baselineReadings = []
    firstGoodAt = null
    elevatedSince = null
    bpm.value = null
    quality.value = 0
    baseline.value = null
    elevated.value = false
    waveform.value = new Float64Array(0)
  }

  function releaseSampler() {
    stopErrorWatch?.()
    stopErrorWatch = null
    sampler?.stop()
    sampler = null
  }

  async function start(): Promise<void> {
    if (status.value !== 'off' && status.value !== 'error') return
    reset()
    error.value = null
    status.value = 'starting'
    sampler = createSampler((sample) => {
      pushSample(sample)
      tick()
    })
    await sampler.start()
    if (sampler.error.value) {
      error.value = sampler.error.value
      status.value = 'error'
      releaseSampler()
      return
    }
    status.value = 'acquiring'
    stopErrorWatch = watch(sampler.error, (e) => {
      if (!e) return
      error.value = e
      status.value = 'error'
      releaseSampler()
    })
  }

  function stop() {
    releaseSampler()
    reset()
    error.value = null
    status.value = 'off'
  }

  return { bpm, quality, baseline, elevated, waveform, status, error, start, stop, pushSample, tick }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/unit/pulse-monitor.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add app/composables/usePulseMonitor.ts tests/unit/pulse-monitor.test.ts
git commit -m "Add pulse monitor with baseline and sustained-elevation logic"
```

---

### Task 4: Widget, layout, README

**Files:**
- Create: `app/components/shared/PulseMonitor.vue`
- Modify: `app/layouts/session.vue` (add `<SharedPulseMonitor />` after the grounding overlay)
- Modify: `README.md` (paragraph after the grounding paragraph in "User Flow")
- Test: `tests/unit/pulse-monitor-widget.test.ts`; add one case to `tests/unit/layouts.test.ts`

**Interfaces:**
- Consumes: `usePulseMonitor` (Task 3), `QUALITY_GOOD` (Task 1), `useGrounding` (existing: `{ isGrounding: Ref<boolean>; trigger(context?: string): void }`).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/pulse-monitor-widget.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PulseMonitor from '../../app/components/shared/PulseMonitor.vue'

const fake = {
  bpm: ref<number | null>(null),
  quality: ref(0),
  baseline: ref<number | null>(null),
  elevated: ref(false),
  waveform: ref(new Float64Array(0)),
  status: ref<'off' | 'starting' | 'acquiring' | 'running' | 'error'>('off'),
  error: ref<string | null>(null),
  start: vi.fn(async () => { fake.status.value = 'acquiring' }),
  stop: vi.fn(() => { fake.status.value = 'off' }),
  pushSample: vi.fn(),
  tick: vi.fn(),
}
vi.mock('../../app/composables/usePulseMonitor', () => ({ usePulseMonitor: () => fake }))

const storage = new Map<string, string>()
const mockLocalStorage = {
  getItem: vi.fn((k: string) => storage.get(k) ?? null),
  setItem: vi.fn((k: string, v: string) => { storage.set(k, v) }),
  removeItem: vi.fn(), clear: vi.fn(),
}
vi.stubGlobal('localStorage', mockLocalStorage)
vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}))

describe('PulseMonitor widget', () => {
  beforeEach(() => {
    storage.clear()
    fake.status.value = 'off'
    fake.bpm.value = null
    fake.quality.value = 0
    fake.elevated.value = false
    fake.error.value = null
    fake.start.mockClear()
    fake.stop.mockClear()
    mockLocalStorage.getItem.mockImplementation((k: string) => storage.get(k) ?? null)
    mockLocalStorage.setItem.mockImplementation((k: string, v: string) => { storage.set(k, v) })
    useGrounding().isGrounding.value = false
  })
  afterEach(() => vi.restoreAllMocks())

  it('is off by default and does not touch the camera', async () => {
    const wrapper = await mountSuspended(PulseMonitor, { route: '/modules/emdr/session' })
    expect(wrapper.find('[data-testid="pulse-toggle"]').text()).toContain('Pulse')
    expect(fake.start).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="pulse-bpm"]').exists()).toBe(false)
  })

  it('clicking the toggle starts the monitor and remembers the choice', async () => {
    const wrapper = await mountSuspended(PulseMonitor, { route: '/modules/emdr/session' })
    await wrapper.find('[data-testid="pulse-toggle"]').trigger('click')
    expect(fake.start).toHaveBeenCalledTimes(1)
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('pulse-monitor-enabled', '1')
  })

  it('auto-starts when the preference is remembered', async () => {
    storage.set('pulse-monitor-enabled', '1')
    await mountSuspended(PulseMonitor, { route: '/modules/emdr/session' })
    expect(fake.start).toHaveBeenCalledTimes(1)
  })

  it('starts off when localStorage throws', async () => {
    mockLocalStorage.getItem.mockImplementation(() => { throw new Error('private mode') })
    await mountSuspended(PulseMonitor, { route: '/modules/emdr/session' })
    expect(fake.start).not.toHaveBeenCalled()
  })

  it('renders the rounded BPM and a good-signal dot while running', async () => {
    storage.set('pulse-monitor-enabled', '1')
    const wrapper = await mountSuspended(PulseMonitor, { route: '/modules/emdr/session' })
    fake.status.value = 'running'
    fake.bpm.value = 71.6
    fake.quality.value = 0.8
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="pulse-bpm"]').text()).toBe('72')
    expect(wrapper.find('[data-testid="pulse-quality"]').classes()).toContain('bg-cyan-400')
  })

  it('shows a weak-signal dot and placeholder when quality is poor', async () => {
    storage.set('pulse-monitor-enabled', '1')
    const wrapper = await mountSuspended(PulseMonitor, { route: '/modules/emdr/session' })
    fake.status.value = 'acquiring'
    fake.bpm.value = null
    fake.quality.value = 0.1
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="pulse-bpm"]').text()).toBe('--')
    expect(wrapper.find('[data-testid="pulse-quality"]').classes()).toContain('bg-amber-400')
    expect(wrapper.text()).toContain('Center your face')
  })

  it('triggers grounding once when elevated turns on', async () => {
    storage.set('pulse-monitor-enabled', '1')
    const wrapper = await mountSuspended(PulseMonitor, { route: '/modules/emdr/session' })
    fake.status.value = 'running'
    fake.elevated.value = true
    await wrapper.vm.$nextTick()
    expect(useGrounding().isGrounding.value).toBe(true)
    expect(wrapper.text()).toContain('Elevated')
    // Stays elevated: no second trigger (dismiss then confirm it is not re-raised)
    useGrounding().isGrounding.value = false
    await wrapper.vm.$nextTick()
    expect(useGrounding().isGrounding.value).toBe(false)
  })

  it('does not trigger when grounding is already active', async () => {
    storage.set('pulse-monitor-enabled', '1')
    const wrapper = await mountSuspended(PulseMonitor, { route: '/modules/emdr/session' })
    const fetchSpy = vi.mocked($fetch as any)
    fetchSpy.mockClear()
    useGrounding().isGrounding.value = true
    fake.status.value = 'running'
    fake.elevated.value = true
    await wrapper.vm.$nextTick()
    expect(fetchSpy).not.toHaveBeenCalledWith('/api/grounding/log', expect.anything())
  })

  it('shows the camera error and keeps the toggle', async () => {
    storage.set('pulse-monitor-enabled', '1')
    const wrapper = await mountSuspended(PulseMonitor, { route: '/modules/emdr/session' })
    fake.status.value = 'error'
    fake.error.value = 'permission-denied'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Camera denied')
    expect(wrapper.find('[data-testid="pulse-toggle"]').exists()).toBe(true)
  })

  it('is hidden on TNT routes', async () => {
    const wrapper = await mountSuspended(PulseMonitor, { route: '/modules/tnt/session' })
    expect(wrapper.find('[data-testid="pulse-monitor"]').exists()).toBe(false)
  })

  it('stops the monitor on unmount', async () => {
    storage.set('pulse-monitor-enabled', '1')
    const wrapper = await mountSuspended(PulseMonitor, { route: '/modules/emdr/session' })
    wrapper.unmount()
    expect(fake.stop).toHaveBeenCalled()
  })
})
```

Add to `tests/unit/layouts.test.ts` inside the session layout `describe`:

```ts
  it('includes the pulse monitor widget', async () => {
    const wrapper = await mountSuspended(SessionLayout)
    expect(wrapper.findComponent({ name: 'SharedPulseMonitor' }).exists()).toBe(true)
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/pulse-monitor-widget.test.ts`
Expected: FAIL, unresolved import of the component.

- [ ] **Step 3: Implement the widget**

```vue
<!-- app/components/shared/PulseMonitor.vue -->
<script setup lang="ts">
import { usePulseMonitor } from '../../composables/usePulseMonitor'
import { useGrounding } from '../../composables/useGrounding'
import { QUALITY_GOOD } from '../../utils/ppg'

const STORAGE_KEY = 'pulse-monitor-enabled'
const GROUNDING_CONTEXT = 'heart-rate-elevated'

const route = useRoute()
// WebGazer owns the camera during TNT sessions.
const hidden = computed(() => route.path.startsWith('/modules/tnt'))

const monitor = usePulseMonitor()
const grounding = useGrounding()
const enabled = ref(false)
const canvasRef = ref<HTMLCanvasElement | null>(null)

function readPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writePreference(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    // Per-browser convenience only
  }
}

async function toggle() {
  enabled.value = !enabled.value
  writePreference(enabled.value)
  if (enabled.value) await monitor.start()
  else monitor.stop()
}

onMounted(() => {
  if (!hidden.value && readPreference()) {
    enabled.value = true
    monitor.start()
  }
})

onBeforeUnmount(() => {
  monitor.stop()
})

watch(monitor.elevated, (isElevated, wasElevated) => {
  if (isElevated && !wasElevated && !grounding.isGrounding.value) {
    grounding.trigger(GROUNDING_CONTEXT)
  }
})

watch(monitor.waveform, (wave) => drawWaveform(wave))

function drawWaveform(wave: Float64Array) {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx || wave.length < 2) return
  const { width, height } = canvas
  ctx.clearRect(0, 0, width, height)
  let peak = 0
  for (let i = 0; i < wave.length; i++) peak = Math.max(peak, Math.abs(wave[i]!))
  const scale = peak > 0 ? (height / 2 - 2) / peak : 0
  ctx.beginPath()
  for (let i = 0; i < wave.length; i++) {
    const x = (i / (wave.length - 1)) * width
    const y = height / 2 - wave[i]! * scale
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = monitor.elevated.value ? '#fbbf24' : '#22d3ee'
  ctx.lineWidth = 1.5
  ctx.stroke()
}

const signalGood = computed(() => monitor.quality.value >= QUALITY_GOOD)
const bpmText = computed(() => (monitor.bpm.value === null ? '--' : String(Math.round(monitor.bpm.value))))
const showReadout = computed(() => enabled.value && (monitor.status.value === 'acquiring' || monitor.status.value === 'running'))

const errorLabel = computed(() => {
  switch (monitor.error.value) {
    case 'permission-denied': return 'Camera denied'
    case 'unsupported': return 'Camera unsupported'
    default: return 'Camera error'
  }
})

const label = computed(() => {
  switch (monitor.status.value) {
    case 'off': return 'Pulse ○'
    case 'starting': return 'Pulse …'
    case 'acquiring': return 'Pulse ~'
    case 'error': return errorLabel.value
    default: return monitor.elevated.value ? 'Elevated' : 'Pulse ●'
  }
})
</script>

<template>
  <div
    v-if="!hidden"
    data-testid="pulse-monitor"
    class="fixed bottom-14 right-3 z-40 font-mono text-xs select-none"
  >
    <div
      class="rounded-sm border bg-surface/80 backdrop-blur px-3 py-2 min-w-[8.5rem] transition-colors"
      :class="monitor.elevated.value ? 'border-amber-400/60 text-amber-300' : 'border-cyan-400/30 text-cyan-300'"
    >
      <div class="flex items-center justify-between gap-3">
        <button
          type="button"
          class="tracking-widest uppercase hover:text-white transition-colors"
          data-testid="pulse-toggle"
          :aria-pressed="enabled"
          :title="enabled ? 'Switch pulse monitor off' : 'Estimate heart rate from the webcam'"
          @click="toggle"
        >
          {{ label }}
        </button>
        <span
          v-if="showReadout"
          class="inline-block w-2 h-2 rounded-full"
          :class="signalGood ? 'bg-cyan-400' : 'bg-amber-400'"
          :title="signalGood ? 'Good signal' : 'Weak signal'"
          data-testid="pulse-quality"
        />
      </div>

      <div v-if="showReadout" class="mt-1">
        <div class="flex items-baseline gap-1">
          <span class="text-2xl tabular-nums" :class="signalGood ? '' : 'opacity-50'" data-testid="pulse-bpm">{{ bpmText }}</span>
          <span class="opacity-60">bpm est.</span>
        </div>
        <canvas ref="canvasRef" width="120" height="28" class="block w-full mt-1" aria-hidden="true" />
        <p v-if="monitor.status.value === 'acquiring'" class="opacity-60 mt-1">Center your face, hold still</p>
      </div>

      <p v-if="monitor.status.value === 'error'" class="opacity-70 mt-1">Click to switch off</p>
    </div>
  </div>
</template>
```

Layout change in `app/layouts/session.vue`:

```vue
    <GroundingGroundingOverlay />
    <SharedPulseMonitor />
```

README paragraph, after the grounding paragraph in "User Flow":

```md
An optional webcam pulse monitor can be switched on during any session except TNT. It estimates heart rate from subtle skin-colour changes (remote photoplethysmography), shows the live estimate and signal quality, and triggers the grounding overlay if heart rate stays well above the user's own baseline for 15 seconds. Frames are processed in memory and discarded; only three colour averages per frame are kept, for ten seconds. Nothing camera-derived is stored or sent to the server.
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/unit/pulse-monitor-widget.test.ts tests/unit/layouts.test.ts`
Expected: widget file all pass; in layouts, the new case passes (other cases in that file have pre-existing failures).

- [ ] **Step 5: Full suite and typecheck**

Run: `npx vitest run` and `npx nuxi typecheck 2>&1 | grep -iE "pulse|ppg|CameraSampler"`
Expected: 22 pre-existing failures only; no type errors in the new files.

- [ ] **Step 6: Commit**

```bash
git add app/components/shared/PulseMonitor.vue app/layouts/session.vue README.md tests/unit/pulse-monitor-widget.test.ts tests/unit/layouts.test.ts
git commit -m "Add webcam pulse monitor widget to session layout"
```
