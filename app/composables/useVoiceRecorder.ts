import { useAudioEngine } from './useAudioEngine'

export type VoiceRecorderError = 'unsupported' | 'permission-denied' | 'failed'

/**
 * Captures microphone audio with MediaRecorder and decodes it into an
 * AudioBuffer. Nothing is persisted; the caller owns the returned buffer.
 */
export function useVoiceRecorder() {
  const isRecording = ref(false)
  const error = ref<VoiceRecorderError | null>(null)

  let mediaRecorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let chunks: Blob[] = []

  function isSupported(): boolean {
    return (
      typeof MediaRecorder !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function'
    )
  }

  function releaseStream() {
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
  }

  async function start(): Promise<void> {
    error.value = null
    if (!isSupported()) {
      error.value = 'unsupported'
      return
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e: any) {
      error.value = e?.name === 'NotAllowedError' ? 'permission-denied' : 'failed'
      return
    }
    chunks = []
    mediaRecorder = new MediaRecorder(stream)
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    mediaRecorder.start()
    isRecording.value = true
  }

  async function stop(): Promise<AudioBuffer | null> {
    const recorder = mediaRecorder
    if (!recorder || !isRecording.value) return null

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
      recorder.stop()
    })
    isRecording.value = false
    mediaRecorder = null
    releaseStream()

    const ctx = useAudioEngine().getAudioContext()
    if (!ctx) {
      error.value = 'unsupported'
      return null
    }
    try {
      return await ctx.decodeAudioData(await blob.arrayBuffer())
    } catch {
      error.value = 'failed'
      return null
    }
  }

  function cancel() {
    if (mediaRecorder && isRecording.value) {
      mediaRecorder.onstop = null
      mediaRecorder.stop()
    }
    mediaRecorder = null
    isRecording.value = false
    releaseStream()
  }

  return { isSupported, isRecording, error, start, stop, cancel }
}
