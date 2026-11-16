import { addDays } from '../model/dates'
import { duplicateTasks, moveTasks, resizeTasks, type ResizeEdge, type ResizeMode } from '../model/edits'
import { updateProject } from '../model/structure'
import type { TimelineDoc } from '../model/types'

// An in-progress pointer gesture. The timeline renders `applyGesture(doc, gesture)`
// as a live preview and commits the very same function on release.

export interface MoveGesture {
  kind: 'move'
  ids: ReadonlySet<string>
  days: number
  rowDelta: number
  ripple: boolean
  /** Alt+drag: original id → clone id. The clones move; the originals stay. */
  cloneIds: ReadonlyMap<string, string> | null
}

export interface ResizeGesture {
  kind: 'resize'
  ids: ReadonlySet<string>
  edge: ResizeEdge
  days: number
  mode: ResizeMode
}

export interface MarqueeGesture {
  kind: 'marquee'
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface PanGesture {
  kind: 'pan'
}

/** Dragging a project's deadline flag. */
export interface DeadlineGesture {
  kind: 'deadline'
  projectId: string
  days: number
}

export type Gesture = MoveGesture | ResizeGesture | MarqueeGesture | PanGesture | DeadlineGesture

export function applyGesture(doc: TimelineDoc, g: Gesture, visibleStepIds: readonly string[]): TimelineDoc {
  switch (g.kind) {
    case 'move': {
      if (g.cloneIds) {
        const withClones = duplicateTasks(doc, g.cloneIds)
        const ids = new Set(g.cloneIds.values())
        return moveTasks(withClones, { ids, days: g.days, rowDelta: g.rowDelta, visibleStepIds, ripple: g.ripple })
      }
      return moveTasks(doc, { ids: g.ids, days: g.days, rowDelta: g.rowDelta, visibleStepIds, ripple: g.ripple })
    }
    case 'resize':
      return resizeTasks(doc, { ids: g.ids, edge: g.edge, days: g.days, mode: g.mode })
    case 'deadline': {
      const deadline = doc.projects.find((p) => p.id === g.projectId)?.deadline
      return deadline && g.days !== 0 ? updateProject(doc, g.projectId, { deadline: addDays(deadline, g.days) }) : doc
    }
    case 'marquee':
    case 'pan':
      return doc
  }
}
