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
    expect(elevationThreshold(60)).toBe(80) // 60+20 beats 60*1.3=78
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
    const { reading, advance } = setup()
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
    for (let i = 0; i < 60; i++) second(values[i % values.length]!, 0.8)
    expect(monitor.baseline.value).toBeNull()
    second(70, 0.8) // 61st reading, 60 s after the first good one
    // 10 of each value plus one extra 70: the 31st of 61 sorted values is 70
    expect(monitor.baseline.value).toBe(70)
  })

  it('ignores poor-quality readings while acquiring the baseline', () => {
    const { monitor, second } = setup()
    for (let i = 0; i < 30; i++) second(70, 0.8)
    for (let i = 0; i < 30; i++) second(150, 0.1) // garbage
    expect(monitor.baseline.value).toBeNull()
    second(70, 0.8)
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
    expect(env.monitor.status.value).toBe('running')
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
      for (let f = 0; f < 30; f++) {
        t = s * 1000 + f * 33
        emit!({ t, r: 0, g: 0, b: 0 })
      }
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
