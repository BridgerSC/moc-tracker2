import { describe, expect, it } from 'vitest'
import { isoDate } from './dates'
import {
  addSubtask,
  deleteGroup,
  deleteProject,
  deleteStep,
  deleteSubtask,
  duplicateGroup,
  duplicateStep,
  duplicateSubtask,
  moveGroup,
  moveStep,
  moveSubtask,
  orphanTasks,
  renameGroup,
  renameStep,
  updateProject,
  updateSubtask,
  updateTasks,
} from './structure'
import type { Subtask, Task, TimelineDoc } from './types'

const task = (id: string, stepId: string, projectId: string | null = 'p1', subtasks: Subtask[] = []): Task => ({
  id, projectId, stepId, start: isoDate('2026-11-16'), duration: 1, title: id, notes: '', subtasks,
})

const doc: TimelineDoc = {
  projects: [
    { id: 'p1', name: 'One', color: '#FFD166', deadline: null, archived: false, notes: '' },
    { id: 'p2', name: 'Two', color: '#06D6A0', deadline: null, archived: false, notes: '' },
  ],
  groups: [
    { id: 'g1', name: 'Pre', steps: [{ id: 's1', name: 'A' }, { id: 's2', name: 'B' }] },
    { id: 'g2', name: 'Prod', steps: [{ id: 's3', name: 'C' }] },
    { id: 'g3', name: 'Post', steps: [] },
  ],
  tasks: [task('t1', 's1'), task('t2', 's2', 'p2'), task('t3', 's3'), task('t4', 'gone')],
}

const shape = (d: TimelineDoc) => d.groups.map((g) => `${g.id}[${g.steps.map((s) => s.id).join(',')}]`).join(' ')

describe('projects', () => {
  it('updates and no-ops', () => {
    expect(updateProject(doc, 'p1', { name: 'One' })).toBe(doc)
    expect(updateProject(doc, 'p1', { name: 'Uno' }).projects[0]?.name).toBe('Uno')
  })

  it('deleting a project unassigns its blocks instead of orphaning them', () => {
    const next = deleteProject(doc, 'p1')
    expect(next.projects.map((p) => p.id)).toEqual(['p2'])
    expect(next.tasks.map((t) => t.projectId)).toEqual([null, 'p2', null, null])
  })
})

describe('groups and rows', () => {
  it('renames', () => {
    expect(renameGroup(doc, 'g1', 'Pre').groups).toBe(doc.groups)
    expect(renameGroup(doc, 'g1', 'X').groups[0]?.name).toBe('X')
    expect(renameStep(doc, 's3', 'Z').groups[1]?.steps[0]?.name).toBe('Z')
  })

  it('deleting a group removes its rows and their blocks', () => {
    const next = deleteGroup(doc, 'g1')
    expect(shape(next)).toBe('g2[s3] g3[]')
    expect(next.tasks.map((t) => t.id)).toEqual(['t3', 't4'])
  })

  it('deleting a row removes its blocks', () => {
    const next = deleteStep(doc, 's2')
    expect(shape(next)).toBe('g1[s1] g2[s3] g3[]')
    expect(next.tasks.map((t) => t.id)).toEqual(['t1', 't3', 't4'])
  })

  it('duplicates groups and rows (structure only) right after the original', () => {
    const g = duplicateGroup(doc, 'g1')
    expect(g.groups.map((x) => x.name)).toEqual(['Pre', 'Pre (Copy)', 'Prod', 'Post'])
    expect(g.groups[1]?.steps.map((s) => s.name)).toEqual(['A', 'B'])
    expect(g.groups[1]?.steps[0]?.id).not.toBe('s1')
    expect(g.tasks).toBe(doc.tasks)
    expect(duplicateStep(doc, 's1').groups[0]?.steps.map((s) => s.name)).toEqual(['A', 'A (Copy)', 'B'])
  })

  it('reorders groups', () => {
    expect(shape(moveGroup(doc, 'g3', 0))).toBe('g3[] g1[s1,s2] g2[s3]')
    expect(shape(moveGroup(doc, 'g1', 9))).toBe('g2[s3] g3[] g1[s1,s2]')
    expect(moveGroup(doc, 'g2', 1)).toBe(doc)
  })

  it('reorders rows within and across groups', () => {
    expect(shape(moveStep(doc, 's2', 'g1', 0))).toBe('g1[s2,s1] g2[s3] g3[]')
    expect(shape(moveStep(doc, 's1', 'g2', 1))).toBe('g1[s2] g2[s3,s1] g3[]')
    expect(shape(moveStep(doc, 's3', 'g3', 0))).toBe('g1[s1,s2] g2[] g3[s3]')
    expect(moveStep(doc, 's1', 'g1', 0)).toBe(doc)
  })

  it('finds orphans', () => {
    expect(orphanTasks(doc).map((t) => t.id)).toEqual(['t4'])
  })
})

describe('bulk task edits', () => {
  it('patches only the given blocks that differ', () => {
    const next = updateTasks(doc, new Set(['t1', 't2']), { projectId: 'p2' })
    expect(next.tasks.map((t) => t.projectId)).toEqual(['p2', 'p2', 'p1', 'p1'])
    expect(updateTasks(doc, new Set(['t2']), { projectId: 'p2' })).toBe(doc)
  })
})

describe('subtasks', () => {
  const cards: Subtask[] = [
    { id: 'a', title: 'a', status: 'todo' },
    { id: 'b', title: 'b', status: 'todo' },
    { id: 'c', title: 'c', status: 'progress' },
    { id: 'd', title: 'd', status: 'done' },
  ]
  const withCards: TimelineDoc = { ...doc, tasks: [task('t1', 's1', 'p1', cards)] }
  const order = (d: TimelineDoc) => d.tasks[0]!.subtasks.map((s) => `${s.id}:${s.status}`).join(' ')

  it('adds into the right column', () => {
    expect(order(addSubtask(withCards, 't1', { id: 'e', title: '', status: 'todo' }))).toBe('a:todo b:todo e:todo c:progress d:done')
  })

  it('moves cards between and within columns', () => {
    expect(order(moveSubtask(withCards, 't1', 'a', 'done', 0))).toBe('b:todo c:progress a:done d:done')
    expect(order(moveSubtask(withCards, 't1', 'a', 'todo', 1))).toBe('b:todo a:todo c:progress d:done')
    expect(order(moveSubtask(withCards, 't1', 'd', 'progress', 9))).toBe('a:todo b:todo c:progress d:progress')
    expect(moveSubtask(withCards, 't1', 'a', 'todo', 0)).toBe(withCards)
  })

  it('edits, duplicates and deletes', () => {
    // Changing status keeps the card's relative order within the new column.
    expect(order(updateSubtask(withCards, 't1', 'a', { status: 'done' }))).toBe('b:todo c:progress a:done d:done')
    const dup = duplicateSubtask(withCards, 't1', 'c')
    expect(dup.tasks[0]!.subtasks.map((s) => s.title)).toEqual(['a', 'b', 'c', 'c (Copy)', 'd'])
    expect(order(deleteSubtask(withCards, 't1', 'b'))).toBe('a:todo c:progress d:done')
    expect(deleteSubtask(withCards, 't1', 'zzz')).toBe(withCards)
  })
})
