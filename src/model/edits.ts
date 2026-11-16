// Pure edit operations on the timeline document. Each returns a new document
// (or the same object when nothing changes, which the history treats as a no-op).
// Gestures use these both for the live preview and for the final commit, so
// what you see while dragging is exactly what you get on release.

import { fromDayNumber, toDayNumber } from './dates'
import { newId } from './ids'
import type { Subtask, Task, TimelineDoc } from './types'

type Ids = ReadonlySet<string>

const startDay = (t: Task) => toDayNumber(t.start)
/** Day number just after the block's last day. */
const endDayExclusive = (t: Task) => startDay(t) + t.duration
const shifted = (t: Task, days: number): Task => (days === 0 ? t : { ...t, start: fromDayNumber(startDay(t) + days) })

function mapTasks(doc: TimelineDoc, fn: (t: Task) => Task): TimelineDoc {
  let changed = false
  const tasks = doc.tasks.map((t) => {
    const next = fn(t)
    if (next !== t) changed = true
    return next
  })
  return changed ? { ...doc, tasks } : doc
}

// --- simple edits -------------------------------------------------------------

export function addTask(doc: TimelineDoc, task: Task): TimelineDoc {
  return { ...doc, tasks: [...doc.tasks, task] }
}

export function updateTask(doc: TimelineDoc, id: string, patch: Partial<Omit<Task, 'id'>>): TimelineDoc {
  return mapTasks(doc, (t) => {
    if (t.id !== id) return t
    const keys = Object.keys(patch) as (keyof typeof patch)[]
    return keys.some((k) => patch[k] !== t[k]) ? { ...t, ...patch } : t
  })
}

export function deleteTasks(doc: TimelineDoc, ids: Ids): TimelineDoc {
  const tasks = doc.tasks.filter((t) => !ids.has(t.id))
  return tasks.length === doc.tasks.length ? doc : { ...doc, tasks }
}

// --- moving -------------------------------------------------------------------

export interface MoveSpec {
  ids: Ids
  /** Whole days to move by. */
  days: number
  /** Rows to move by, counted in `visibleStepIds`. Ignored when rippling. */
  rowDelta: number
  /** The steps currently shown, top to bottom. */
  visibleStepIds: readonly string[]
  /** Also shift every later block in the moved blocks' rows (Shift+drag). */
  ripple: boolean
}

/** Limits a row move so every moved block stays on a visible row. */
export function clampRowDelta(doc: TimelineDoc, ids: Ids, rowDelta: number, visibleStepIds: readonly string[]): number {
  let lo = -Infinity
  let hi = Infinity
  for (const t of doc.tasks) {
    if (!ids.has(t.id)) continue
    const index = visibleStepIds.indexOf(t.stepId)
    if (index < 0) continue
    lo = Math.max(lo, -index)
    hi = Math.min(hi, visibleStepIds.length - 1 - index)
  }
  if (lo === -Infinity) return 0
  return Math.min(hi, Math.max(lo, rowDelta)) || 0 // `|| 0` turns -0 into 0
}

export function moveTasks(doc: TimelineDoc, spec: MoveSpec): TimelineDoc {
  const { ids, days, visibleStepIds, ripple } = spec
  const rowDelta = ripple ? 0 : clampRowDelta(doc, ids, spec.rowDelta, visibleStepIds)
  if (days === 0 && rowDelta === 0) return doc

  // Ripple: in each row that has a moved block, everything from the earliest moved block on shifts too.
  const rippleFrom = new Map<string, number>()
  if (ripple) {
    for (const t of doc.tasks) {
      if (!ids.has(t.id)) continue
      rippleFrom.set(t.stepId, Math.min(rippleFrom.get(t.stepId) ?? Infinity, startDay(t)))
    }
  }

  return mapTasks(doc, (t) => {
    if (ids.has(t.id)) {
      const index = visibleStepIds.indexOf(t.stepId)
      const stepId = rowDelta !== 0 && index >= 0 ? (visibleStepIds[index + rowDelta] ?? t.stepId) : t.stepId
      const moved = shifted(t, days)
      return stepId === t.stepId ? moved : { ...moved, stepId }
    }
    const from = rippleFrom.get(t.stepId)
    return from !== undefined && startDay(t) >= from ? shifted(t, days) : t
  })
}

// --- resizing -----------------------------------------------------------------

export type ResizeEdge = 'start' | 'end'

/**
 * normal  – resize the blocks only.
 * ripple  – also shift neighbours in the same row: blocks after (end edge) or before (start edge). (Shift+edge)
 * rolling – move the shared edge with the touching neighbour, which shrinks or grows to match. (Alt+edge)
 */
export type ResizeMode = 'normal' | 'ripple' | 'rolling'

export interface ResizeSpec {
  ids: Ids
  edge: ResizeEdge
  days: number
  mode: ResizeMode
}

/** For rolling resizes: the block in the same row that touches `t` on that edge. */
function touchingNeighbour(doc: TimelineDoc, t: Task, edge: ResizeEdge, ids: Ids): Task | undefined {
  return doc.tasks.find(
    (n) =>
      !ids.has(n.id) &&
      n.stepId === t.stepId &&
      (edge === 'end' ? startDay(n) === endDayExclusive(t) : endDayExclusive(n) === startDay(t)),
  )
}

/** Limits a resize so no block (or rolled neighbour) ends up shorter than one day. */
export function clampResizeDays(doc: TimelineDoc, spec: ResizeSpec): number {
  let { days } = spec
  for (const t of doc.tasks) {
    if (!spec.ids.has(t.id)) continue
    // end edge: duration + days >= 1;  start edge: duration - days >= 1
    if (spec.edge === 'end') days = Math.max(days, 1 - t.duration)
    else days = Math.min(days, t.duration - 1)
    if (spec.mode === 'rolling') {
      const n = touchingNeighbour(doc, t, spec.edge, spec.ids)
      if (n) {
        // end edge: neighbour.duration - days >= 1;  start edge: neighbour.duration + days >= 1
        if (spec.edge === 'end') days = Math.min(days, n.duration - 1)
        else days = Math.max(days, 1 - n.duration)
      }
    }
  }
  return days
}

export function resizeTasks(doc: TimelineDoc, spec: ResizeSpec): TimelineDoc {
  const days = clampResizeDays(doc, spec)
  if (days === 0) return doc
  const { ids, edge, mode } = spec
  const resized = doc.tasks.filter((t) => ids.has(t.id))

  const rolled = new Set<string>()
  if (mode === 'rolling') {
    for (const t of resized) {
      const n = touchingNeighbour(doc, t, edge, ids)
      if (n) rolled.add(n.id)
    }
  }

  return mapTasks(doc, (t) => {
    let next = t
    if (ids.has(t.id)) {
      next = edge === 'end'
        ? { ...t, duration: t.duration + days }
        : { ...t, start: fromDayNumber(startDay(t) + days), duration: t.duration - days }
    } else if (rolled.has(t.id)) {
      return edge === 'end'
        ? { ...t, start: fromDayNumber(startDay(t) + days), duration: t.duration - days }
        : { ...t, duration: t.duration + days }
    }
    if (mode !== 'ripple') return next
    // Every resized block in this row that lies wholly before (end edge) or after (start edge)
    // this one pushes it by `days`. Counting them makes several resizes in one row cascade.
    const pushes = resized.filter(
      (r) =>
        r.id !== t.id &&
        r.stepId === t.stepId &&
        (edge === 'end' ? endDayExclusive(r) <= startDay(t) : startDay(r) >= endDayExclusive(t)),
    ).length
    return shifted(next, pushes * days)
  })
}

// --- duplicating and pasting --------------------------------------------------------

const cloneSubtasks = (subtasks: Subtask[]): Subtask[] => subtasks.map((s) => ({ ...s, id: newId('st') }))

export interface CloneResult {
  doc: TimelineDoc
  /** Original id → clone id. */
  idMap: Map<string, string>
}

/**
 * Appends copies of the given tasks. `ids` supplies the clone ids (so a live
 * preview and the final commit agree); `dayShift` offsets each copy.
 */
export function duplicateTasks(
  doc: TimelineDoc,
  idMap: ReadonlyMap<string, string>,
  dayShift: (t: Task) => number = () => 0,
): TimelineDoc {
  const clones = doc.tasks
    .filter((t) => idMap.has(t.id))
    .map((t) => ({ ...shifted(t, dayShift(t)), id: idMap.get(t.id)!, subtasks: cloneSubtasks(t.subtasks) }))
  return clones.length === 0 ? doc : { ...doc, tasks: [...doc.tasks, ...clones] }
}

export function makeCloneIds(ids: Iterable<string>): Map<string, string> {
  return new Map([...ids].map((id) => [id, newId('t')]))
}

/**
 * Pastes copies of `clipboard` so that the earliest one starts on `targetDay`.
 * Tasks whose row no longer exists are skipped rather than pasted as invisible orphans.
 */
export function pasteTasks(doc: TimelineDoc, clipboard: readonly Task[], targetDay: number): CloneResult {
  const stepIds = new Set(doc.groups.flatMap((g) => g.steps.map((s) => s.id)))
  const usable = clipboard.filter((t) => stepIds.has(t.stepId))
  const idMap = new Map<string, string>()
  if (usable.length === 0) return { doc, idMap }
  const offset = targetDay - Math.min(...usable.map(startDay))
  const clones = usable.map((t) => {
    const id = newId('t')
    idMap.set(t.id, id)
    return { ...shifted(t, offset), id, subtasks: cloneSubtasks(t.subtasks) }
  })
  return { doc: { ...doc, tasks: [...doc.tasks, ...clones] }, idMap }
}
