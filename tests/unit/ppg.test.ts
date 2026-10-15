import { describe, it, expect } from 'vitest'
import {
  resampleUniform, posProjection, detrend, fft, bandpass, estimateBpm, analyze,
  QUALITY_GOOD, type Sample,
} from '../../app/utils/ppg'

/** Deterministic pseudo-random noise in [-0.5, 0.5) so tests are repeatable. */
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
      r: 150 + 1.0 * pulse + drift + noise * rnd(),
      g: 110 + 2.0 * pulse + drift + noise * rnd(),
      b: 90 + 0.5 * pulse + drift + noise * rnd(),
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
    // Drift completes one full cycle over the window, so there is no edge step.
    for (let i = 0; i < n; i++) x[i] = Math.sin(2 * Math.PI * 1.2 * i / fs) + 2 * Math.sin(2 * Math.PI * 0.1 * i / fs)
    const y = bandpass(x, fs)
    const mid = y.slice(60, 240)
    const amp = Math.max(...Array.from(mid).map(Math.abs))
    expect(amp).toBeGreaterThan(0.5)
    expect(amp).toBeLessThan(1.6)
  })
})

describe('estimateBpm', () => {
  it('recovers 72 BPM from a clean pulse with high quality', () => {
    const fs = 30, n = 300
    const pulse = new Float64Array(n)
    for (let i = 0; i < n; i++) pulse[i] = Math.sin(2 * Math.PI * 1.2 * i / fs)
    const { bpm, quality } = estimateBpm(pulse, fs)
    expect(Math.abs(bpm! - 72)).toBeLessThan(1)
    expect(quality).toBeGreaterThanOrEqual(QUALITY_GOOD)
  })

  it('reports low quality for white noise', () => {
    const rnd = lcg(7)
    const pulse = new Float64Array(300).map(() => rnd())
    const { quality } = estimateBpm(pulse, 30)
    expect(quality).toBeLessThan(QUALITY_GOOD)
  })

  it('rejects a peak within a bin of the band edge, where out-of-band energy piles up', () => {
    const fs = 30, n = 300
    const pulse = new Float64Array(n)
    for (let i = 0; i < n; i++) pulse[i] = Math.sin(2 * Math.PI * (44 / 60) * i / fs) // 44 BPM, on the edge
    const { bpm, quality } = estimateBpm(pulse, fs)
    expect(bpm).toBeNull()
    expect(quality).toBe(0)
  })

  it('still accepts a slow but in-band pulse', () => {
    const fs = 30, n = 300
    const pulse = new Float64Array(n)
    for (let i = 0; i < n; i++) pulse[i] = Math.sin(2 * Math.PI * (52 / 60) * i / fs)
    const { bpm } = estimateBpm(pulse, fs)
    expect(Math.abs(bpm! - 52)).toBeLessThan(1)
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
