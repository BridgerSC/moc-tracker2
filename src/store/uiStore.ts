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
export type RightTab = 'inspector' | 'projects'

export interface MenuItem {
  label: string
  onSelect: () => void
  danger?: boolean
  /** Draw a divider above this item. */
  divider?: boolean
}

export interface ContextMenuState {
  x: number
  y: number
  items: MenuItem[]
}

export interface ConfirmState {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  /** 'danger' (default) for destructive choices, 'info' for neutral questions. */
  tone?: 'danger' | 'info'
  /** An optional middle choice. */
  secondary?: { label: string; onSelect: () => void }
  /** Label for the dismiss button (default "Cancel"). */
  cancelLabel?: string
  onCancel?: () => void
}

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
  rightPanelOpen: boolean
  rightTab: RightTab
  /** Project cards expanded in the Projects tab. */
  expandedProjects: ReadonlySet<string>
  /** Subtask board expanded (it only shows when one block is selected). */
  boardOpen: boolean
  contextMenu: ContextMenuState | null
  confirm: ConfirmState | null
  /** Group or step whose name is being edited in the row labels. */
  renamingRowId: string | null
  editingSubtaskId: string | null

  setZoom: (zoom: number, anchorPx?: number | null) => void
  select: (ids: Iterable<string>, mode?: SelectMode) => void
  clearSelection: () => void
  setEditing: (taskId: string | null) => void
  toggleGroup: (groupId: string) => void
  setGesture: (gesture: Gesture | null) => void
  requestToday: () => void
  setShortcutsOpen: (open: boolean) => void
  setNotice: (notice: string | null) => void
  setRightPanelOpen: (open: boolean) => void
  setRightTab: (tab: RightTab) => void
  /** Opens the Projects tab with that project's card expanded. */
  showProject: (projectId: string) => void
  toggleProjectExpanded: (projectId: string) => void
  setBoardOpen: (open: boolean) => void
  openContextMenu: (x: number, y: number, items: MenuItem[]) => void
  closeContextMenu: () => void
  /** Asks before running `onConfirm`. */
  askConfirm: (confirm: ConfirmState) => void
  closeConfirm: () => void
  setRenamingRow: (rowId: string | null) => void
  setEditingSubtask: (subtaskId: string | null) => void
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
  rightPanelOpen: true,
  rightTab: 'projects',
  expandedProjects: new Set(),
  boardOpen: true,
  contextMenu: null,
  confirm: null,
  renamingRowId: null,
  editingSubtaskId: null,

  setZoom: (zoom, anchorPx = null) => set({ zoom: clampZoom(zoom), zoomAnchorPx: anchorPx }),
  select: (ids, mode = 'replace') =>
    set((s) => {
      const list = [...ids]
      let next: Set<string>
      if (mode === 'replace') {
        next = new Set(list)
      } else {
        next = new Set(s.selection)
        for (const id of list) {
          if (mode === 'toggle' && next.has(id)) next.delete(id)
          else next.add(id)
        }
      }
      // Selecting something from nothing brings up the inspector.
      return s.selection.size === 0 && next.size > 0 ? { selection: next, rightTab: 'inspector' } : { selection: next }
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
  setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
  setRightTab: (rightTab) => set({ rightTab, rightPanelOpen: true }),
  showProject: (projectId) =>
    set((s) => ({
      rightPanelOpen: true,
      rightTab: 'projects',
      expandedProjects: new Set([...s.expandedProjects, projectId]),
    })),
  toggleProjectExpanded: (projectId) =>
    set((s) => {
      const next = new Set(s.expandedProjects)
      if (!next.delete(projectId)) next.add(projectId)
      return { expandedProjects: next }
    }),
  setBoardOpen: (boardOpen) => set({ boardOpen }),
  openContextMenu: (x, y, items) => set({ contextMenu: { x, y, items } }),
  closeContextMenu: () => set((s) => (s.contextMenu ? { contextMenu: null } : s)),
  askConfirm: (confirm) => set({ confirm, contextMenu: null }),
  closeConfirm: () => set({ confirm: null }),
  setRenamingRow: (renamingRowId) => set({ renamingRowId }),
  setEditingSubtask: (editingSubtaskId) => set({ editingSubtaskId }),
}))

export function useUi<T>(selector: (state: UiState) => T): T {
  return useStore(uiStore, selector)
}
