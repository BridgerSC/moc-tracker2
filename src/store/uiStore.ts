import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { Gesture } from '../timeline/gesture'
import { clampZoom } from '../timeline/geometry'

// View state: never synced, never undone.

const COLLAPSED_KEY = 'moc_collapsed_groups' // same key as v4.8, so collapsed groups carry over

function loadCollapsed(): ReadonlySet<string> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]')
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

function saveCollapsed(ids: ReadonlySet<string>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...ids]))
  } catch {
    // Storage unavailable (private window etc.); collapsing still works for this session.
  }
}

export type SelectMode = 'replace' | 'add' | 'toggle'

export interface UiState {
  zoom: number
  /** Viewport x (px from the timeline's left edge) to keep fixed on the next zoom change; null = centre. */
  zoomAnchorPx: number | null
  selection: ReadonlySet<string>
  editingTaskId: string | null
  collapsedGroups: ReadonlySet<string>
  gesture: Gesture | null
  /** Incremented to ask the timeline to scroll to today. */
  todayRequest: number
  shortcutsOpen: boolean
  /** One-line status shown in the header (import results etc.). */
  notice: string | null

  setZoom: (zoom: number, anchorPx?: number | null) => void
  select: (ids: Iterable<string>, mode?: SelectMode) => void
  clearSelection: () => void
  setEditing: (taskId: string | null) => void
  toggleGroup: (groupId: string) => void
  setGesture: (gesture: Gesture | null) => void
  requestToday: () => void
  setShortcutsOpen: (open: boolean) => void
  setNotice: (notice: string | null) => void
}

export const uiStore = createStore<UiState>()((set) => ({
  zoom: 1,
  zoomAnchorPx: null,
  selection: new Set(),
  editingTaskId: null,
  collapsedGroups: loadCollapsed(),
  gesture: null,
  todayRequest: 0,
  shortcutsOpen: false,
  notice: null,

  setZoom: (zoom, anchorPx = null) => set({ zoom: clampZoom(zoom), zoomAnchorPx: anchorPx }),
  select: (ids, mode = 'replace') =>
    set((s) => {
      const list = [...ids]
      if (mode === 'replace') return { selection: new Set(list) }
      const next = new Set(s.selection)
      for (const id of list) {
        if (mode === 'toggle' && next.has(id)) next.delete(id)
        else next.add(id)
      }
      return { selection: next }
    }),
  clearSelection: () => set((s) => (s.selection.size === 0 ? s : { selection: new Set() })),
  setEditing: (editingTaskId) => set({ editingTaskId }),
  toggleGroup: (groupId) =>
    set((s) => {
      const next = new Set(s.collapsedGroups)
      if (!next.delete(groupId)) next.add(groupId)
      saveCollapsed(next)
      return { collapsedGroups: next }
    }),
  setGesture: (gesture) => set({ gesture }),
  requestToday: () => set((s) => ({ todayRequest: s.todayRequest + 1 })),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setNotice: (notice) => set({ notice }),
}))

export function useUi<T>(selector: (state: UiState) => T): T {
  return useStore(uiStore, selector)
}
