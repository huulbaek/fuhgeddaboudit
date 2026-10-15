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
      let r = 0
      let g = 0
      let b = 0
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
