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
      const tr = re[i]!
      re[i] = re[j]!
      re[j] = tr
      const ti = im[i]!
      im[i] = im[j]!
      im[j] = ti
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
        const ur = re[a]!
        const ui = im[a]!
        const vr = re[bIdx]! * cr - im[bIdx]! * ci
        const vi = re[bIdx]! * ci + im[bIdx]! * cr
        re[a] = ur + vr
        im[a] = ui + vi
        re[bIdx] = ur - vr
        im[bIdx] = ui - vi
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
    if (f < lo || f > hi) {
      re[k] = 0
      im[k] = 0
    }
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
    if (p > peakP) {
      peakP = p
      peakK = k
    }
  }
  if (peakK < 0 || total === 0) return { bpm: null, quality: 0 }
  // A peak at or next to the band edge is out-of-band energy (drift, gaps) piling up, not a pulse.
  if (peakK <= kLo + 1 || peakK >= kHi - 1) return { bpm: null, quality: 0 }
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
