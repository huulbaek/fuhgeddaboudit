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
  const createSampler =
    options.createSampler ?? ((onSample: (s: Sample) => void) => useCameraSampler({ onSample }))

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
