import { readTimelineFile, serializeTimelineFile, type ReadResult } from '../model/fileFormat'
import type { SyncMeta } from '../model/types'
import type { DocStore } from '../store/docStore'

// Autosaves the document to this browser so a reload never loses work
// (v4.8 kept everything in memory until uploaded).
//
// The saved copy is a normal v5 file whose `rev`/`savedAt`/`savedBy` describe
// the shared version it was based on, so sync (milestone 4) can tell what
// changed locally since then.

const KEY = 'moc_timeline_local_v5'
const DEBOUNCE_MS = 400

export function loadLocal(): ReadResult | null {
  try {
    const text = localStorage.getItem(KEY)
    return text ? readTimelineFile(JSON.parse(text)) : null
  } catch (err) {
    console.warn('Ignoring unreadable local save:', err)
    return null
  }
}

/** Starts saving on every change. Returns a function that stops it. */
export function startAutosave(store: DocStore, getBase: () => SyncMeta): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastSaved = store.getState().history.present

  const flush = () => {
    clearTimeout(timer)
    timer = undefined
    const doc = store.getState().history.present
    if (doc === lastSaved) return
    const base = getBase()
    try {
      localStorage.setItem(
        KEY,
        serializeTimelineFile(doc, { rev: base.rev, savedAt: base.savedAt ?? '', savedBy: base.savedBy ?? '' }),
      )
      lastSaved = doc
    } catch (err) {
      console.warn('Local autosave failed:', err)
    }
  }

  const unsubscribe = store.subscribe((state, prev) => {
    if (state.history.present === prev.history.present) return
    clearTimeout(timer)
    timer = setTimeout(flush, DEBOUNCE_MS)
  })
  // Don't lose the last few hundred ms of edits when the tab closes.
  window.addEventListener('pagehide', flush)

  return () => {
    flush()
    unsubscribe()
    window.removeEventListener('pagehide', flush)
  }
}
