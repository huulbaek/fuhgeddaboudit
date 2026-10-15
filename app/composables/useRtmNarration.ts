/**
 * In-memory holder for the user's reversed RTM narration.
 *
 * The buffer lives only in this module's scope: it is never written to
 * localStorage, IndexedDB, or the server. A page refresh drops it, and the
 * rewind falls back to the whoosh sound alone.
 */
let narration: AudioBuffer | null = null

export function useRtmNarration() {
  function set(buffer: AudioBuffer) {
    narration = buffer
  }

  function get(): AudioBuffer | null {
    return narration
  }

  function has(): boolean {
    return narration !== null
  }

  function clear() {
    narration = null
  }

  return { set, get, has, clear }
}
