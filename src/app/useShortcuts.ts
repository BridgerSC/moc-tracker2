import { useEffect } from 'react'
import { localToday, toDayNumber } from '../model/dates'
import { pasteTasks } from '../model/edits'
import { deleteBlocks, duplicateBlocks } from './actions'
import { docStore } from '../store/docStore'
import { uiStore } from '../store/uiStore'
import { clipboard, pointer } from '../timeline/clipboard'
import { cancelActiveGesture } from '../timeline/session'

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]') !== null

/** App-wide keyboard shortcuts. Ignored while typing in a field. */
export function useShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      const ui = uiStore.getState()
      const docs = docStore.getState()
      const doc = docs.history.present

      if (key === 'escape') {
        if (cancelActiveGesture()) return
        if (ui.confirm) {
          const { onCancel } = ui.confirm
          ui.closeConfirm()
          return onCancel?.()
        }
        if (ui.contextMenu) return ui.closeContextMenu()
        if (ui.shortcutsOpen) return ui.setShortcutsOpen(false)
        return ui.clearSelection()
      }
      if (ui.shortcutsOpen || ui.confirm) return
      ui.closeContextMenu()
      if (mod && key === 'z') {
        e.preventDefault()
        return e.shiftKey ? docs.redo() : docs.undo()
      }
      if (mod && key === 'y') {
        e.preventDefault()
        return docs.redo()
      }
      if (ui.gesture) return // no edits mid-drag

      const selected = doc.tasks.filter((t) => ui.selection.has(t.id))

      if (key === 'delete' || key === 'backspace') {
        if (selected.length === 0) return
        e.preventDefault()
        return deleteBlocks(ui.selection)
      }
      if (mod && key === 'c') {
        // Leave normal text copying alone (v4.8 blocked it everywhere).
        if (selected.length === 0 || window.getSelection()?.toString()) return
        e.preventDefault()
        clipboard.copy(selected)
        return ui.setNotice(`Copied ${selected.length} block${selected.length === 1 ? '' : 's'}`)
      }
      if (mod && key === 'v') {
        if (clipboard.tasks.length === 0) return
        e.preventDefault()
        let pasted: string[] = []
        docs.apply((d) => {
          const result = pasteTasks(d, clipboard.tasks, pointer.day ?? toDayNumber(localToday()))
          pasted = [...result.idMap.values()]
          return result.doc
        })
        return ui.select(pasted)
      }
      if (mod && key === 'd') {
        // Duplicate each selected block directly after itself.
        e.preventDefault()
        return duplicateBlocks(selected.map((t) => t.id))
      }
      if (mod && key === 'a') {
        e.preventDefault()
        const visibleSteps = new Set(
          doc.groups.filter((g) => !ui.collapsedGroups.has(g.id)).flatMap((g) => g.steps.map((s) => s.id)),
        )
        const archived = new Set(doc.projects.filter((p) => p.archived).map((p) => p.id))
        return ui.select(
          doc.tasks
            .filter((t) => visibleSteps.has(t.stepId) && !(t.projectId && archived.has(t.projectId)))
            .map((t) => t.id),
        )
      }
      if ((key === 'f2' || key === 'enter') && selected.length === 1) {
        e.preventDefault()
        return ui.setEditing(selected[0]!.id)
      }
      if (key === '?') ui.setShortcutsOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
