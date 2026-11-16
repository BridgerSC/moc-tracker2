import { uiStore } from '../store/uiStore'

// The pointer gesture currently in progress, tracked with window listeners so
// it keeps working when the pointer leaves the block or the canvas.

let cancelActive: (() => void) | null = null

export function runPointerSession(onMove: (e: PointerEvent) => void, onUp: (e: PointerEvent) => void) {
  cancelActive?.()
  const cleanup = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', cancel)
    cancelActive = null
  }
  const up = (e: PointerEvent) => {
    cleanup()
    onUp(e)
  }
  const cancel = () => {
    cleanup()
    document.body.style.cursor = ''
    uiStore.getState().setGesture(null)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', cancel)
  cancelActive = cancel
}

/** Abandons the gesture in progress without applying it. Returns false if there was none. */
export function cancelActiveGesture(): boolean {
  if (!cancelActive) return false
  cancelActive()
  return true
}
