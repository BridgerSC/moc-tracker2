import { describe, expect, it } from 'vitest'
import { isoDate, toDayNumber } from './dates'
import {
  clampRowDelta,
  deleteTasks,
  duplicateTasks,
  makeCloneIds,
  moveTasks,
  pasteTasks,
  resizeTasks,
  updateTask,
} from './edits'
import type { Task, TimelineDoc } from './types'

// Compact fixtures: tasks are [id, stepId, startDate, duration].
function task(id: string, stepId: string, start: string, duration: number): Task {
  return { id, projectId: null, stepId, start: isoDate(start), duration, title: id, notes: '', subtasks: [] }
}

function docWith(...tasks: Task[]): TimelineDoc {
  return {
    projects: [],
    groups: [{ id: 'g1', name: 'G', steps: [{ id: 's1', name: 'A' }, { id: 's2', name: 'B' }, { id: 's3', name: 'C' }] }],
    tasks,
  }
}

const rows = ['s1', 's2', 's3']
const ids = (...xs: string[]) => new Set(xs)
/** id → "stepId start+duration" for readable assertions. */
const layout = (doc: TimelineDoc) =>
  Object.fromEntries(doc.tasks.map((t) => [t.id, `${t.stepId} ${t.start.slice(5)}+${t.duration}`]))

describe('updateTask / deleteTasks', () => {
  const doc = docWith(task('a', 's1', '2026-11-02', 3))

  it('returns the same doc when nothing changes', () => {
    expect(updateTask(doc, 'a', { title: 'a' })).toBe(doc)
    expect(updateTask(doc, 'missing', { title: 'x' })).toBe(doc)
    expect(deleteTasks(doc, ids('missing'))).toBe(doc)
  })

  it('applies patches and deletions', () => {
    expect(updateTask(doc, 'a', { title: 'New' }).tasks[0]?.title).toBe('New')
    expect(deleteTasks(doc, ids('a')).tasks).toEqual([])
  })
})

describe('moveTasks', () => {
  const doc = docWith(
    task('a', 's1', '2026-11-02', 3),
    task('b', 's1', '2026-11-05', 2),
    task('c', 's1', '2026-10-30', 2),
    task('d', 's2', '2026-11-03', 4),
  )

  it('moves selected blocks by days and rows', () => {
    const next = moveTasks(doc, { ids: ids('a', 'd'), days: 2, rowDelta: 1, visibleStepIds: rows, ripple: false })
    expect(layout(next)).toMatchObject({ a: 's2 11-04+3', d: 's3 11-05+4', b: 's1 11-05+2' })
  })

  it('keeps every block on a visible row', () => {
    expect(clampRowDelta(doc, ids('a', 'd'), 5, rows)).toBe(1)
    expect(clampRowDelta(doc, ids('a', 'd'), -5, rows)).toBe(0)
  })

  it('crosses daylight-saving changes without drifting', () => {
    const next = moveTasks(doc, { ids: ids('c'), days: 3, rowDelta: 0, visibleStepIds: rows, ripple: false })
    expect(next.tasks.find((t) => t.id === 'c')?.start).toBe('2026-11-02')
  })

  it('is a no-op for a zero move', () => {
    expect(moveTasks(doc, { ids: ids('a'), days: 0, rowDelta: 0, visibleStepIds: rows, ripple: false })).toBe(doc)
  })

  it('ripple shifts later blocks in the same row only, and never changes rows', () => {
    const next = moveTasks(doc, { ids: ids('a'), days: 4, rowDelta: 1, visibleStepIds: rows, ripple: true })
    expect(layout(next)).toEqual({
      a: 's1 11-06+3',
      b: 's1 11-09+2', // later in the same row: pushed
      c: 's1 10-30+2', // earlier: untouched
      d: 's2 11-03+4', // other row: untouched
    })
  })

  it('ripple works leftwards too, pulling later blocks back', () => {
    const next = moveTasks(doc, { ids: ids('a'), days: -1, rowDelta: 0, visibleStepIds: rows, ripple: true })
    expect(layout(next)).toMatchObject({ a: 's1 11-01+3', b: 's1 11-04+2', c: 's1 10-30+2' })
  })
})

describe('resizeTasks', () => {
  // Row s1: c [10-30..10-31] a [11-02..11-04] b [11-05..11-06]   (a and b touch)
  const doc = docWith(
    task('c', 's1', '2026-10-30', 2),
    task('a', 's1', '2026-11-02', 3),
    task('b', 's1', '2026-11-05', 2),
    task('d', 's2', '2026-11-05', 2),
  )

  it('grows and shrinks from either edge', () => {
    expect(layout(resizeTasks(doc, { ids: ids('a'), edge: 'end', days: 2, mode: 'normal' })).a).toBe('s1 11-02+5')
    expect(layout(resizeTasks(doc, { ids: ids('a'), edge: 'start', days: -2, mode: 'normal' })).a).toBe('s1 10-31+5')
  })

  it('never shrinks a block below one day', () => {
    expect(layout(resizeTasks(doc, { ids: ids('a', 'b'), edge: 'end', days: -9, mode: 'normal' }))).toMatchObject({
      a: 's1 11-02+2', // clamped by b, the shortest selected block
      b: 's1 11-05+1',
    })
    expect(layout(resizeTasks(doc, { ids: ids('a'), edge: 'start', days: 9, mode: 'normal' })).a).toBe('s1 11-04+1')
  })

  it('ripple on the end edge pushes later blocks in the row', () => {
    expect(layout(resizeTasks(doc, { ids: ids('a'), edge: 'end', days: 2, mode: 'ripple' }))).toEqual({
      c: 's1 10-30+2',
      a: 's1 11-02+5',
      b: 's1 11-07+2',
      d: 's2 11-05+2',
    })
  })

  it('ripple on the start edge pushes earlier blocks in the row', () => {
    expect(layout(resizeTasks(doc, { ids: ids('a'), edge: 'start', days: -2, mode: 'ripple' }))).toMatchObject({
      c: 's1 10-28+2',
      a: 's1 10-31+5',
      b: 's1 11-05+2',
    })
  })

  it('ripple cascades when several blocks in a row are resized', () => {
    const three = docWith(task('x', 's1', '2026-11-01', 2), task('y', 's1', '2026-11-04', 2), task('z', 's1', '2026-11-08', 1))
    expect(layout(resizeTasks(three, { ids: ids('x', 'y'), edge: 'end', days: 1, mode: 'ripple' }))).toEqual({
      x: 's1 11-01+3',
      y: 's1 11-05+3', // pushed by x, then grown
      z: 's1 11-10+1', // pushed by both
    })
  })

  it('rolling moves the shared edge with the touching neighbour', () => {
    expect(layout(resizeTasks(doc, { ids: ids('a'), edge: 'end', days: 1, mode: 'rolling' }))).toMatchObject({
      a: 's1 11-02+4',
      b: 's1 11-06+1',
    })
    expect(layout(resizeTasks(doc, { ids: ids('b'), edge: 'start', days: -1, mode: 'rolling' }))).toMatchObject({
      a: 's1 11-02+2',
      b: 's1 11-04+3',
    })
  })

  it('rolling never squeezes the neighbour below one day', () => {
    expect(layout(resizeTasks(doc, { ids: ids('a'), edge: 'end', days: 5, mode: 'rolling' }))).toMatchObject({
      a: 's1 11-02+4',
      b: 's1 11-06+1',
    })
  })

  it('rolling without a touching neighbour is a plain resize', () => {
    expect(layout(resizeTasks(doc, { ids: ids('c'), edge: 'end', days: 1, mode: 'rolling' }))).toMatchObject({
      c: 's1 10-30+3',
      a: 's1 11-02+3',
    })
  })
})

describe('duplicating and pasting', () => {
  const withSubtasks: Task = { ...task('a', 's1', '2026-11-02', 3), subtasks: [{ id: 'st1', title: 'x', status: 'done' }] }
  const doc = docWith(withSubtasks, task('b', 's2', '2026-11-06', 1))

  it('duplicates with fresh task and subtask ids, optionally shifted', () => {
    const idMap = makeCloneIds(['a'])
    const next = duplicateTasks(doc, idMap, (t) => t.duration)
    const clone = next.tasks.at(-1)!
    expect(clone.id).toBe(idMap.get('a'))
    expect(clone.start).toBe('2026-11-05')
    expect(clone.subtasks[0]?.id).not.toBe('st1')
    expect(clone.subtasks[0]).toMatchObject({ title: 'x', status: 'done' })
  })

  it('pastes so the earliest copy starts on the target day, keeping relative positions', () => {
    const target = toDayNumber(isoDate('2026-12-12'))
    const { doc: next, idMap } = pasteTasks(doc, doc.tasks, target)
    expect(idMap.size).toBe(2)
    const pasted = next.tasks.slice(2)
    expect(pasted.map((t) => t.start)).toEqual(['2026-12-12', '2026-12-16'])
  })

  it('skips pasting onto rows that no longer exist', () => {
    const gone: Task = task('z', 'deleted-step', '2026-11-02', 1)
    const { doc: next, idMap } = pasteTasks(doc, [gone], 20_800)
    expect(next).toBe(doc)
    expect(idMap.size).toBe(0)
  })
})
