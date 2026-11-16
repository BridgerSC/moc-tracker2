// Pure edits for projects, groups, steps (rows) and subtasks.
// Like edits.ts: each returns a new document, or the same one when nothing changes.

import { newId } from './ids'
import type { Group, Project, Step, Subtask, SubtaskStatus, Task, TimelineDoc } from './types'
import { SUBTASK_STATUSES } from './types'

const insertAt = <T>(list: readonly T[], index: number, item: T): T[] => {
  const i = Math.max(0, Math.min(list.length, index))
  return [...list.slice(0, i), item, ...list.slice(i)]
}

function patchItem<T extends { id: string }>(list: readonly T[], id: string, patch: Partial<T>): T[] | null {
  let changed = false
  const next = list.map((item) => {
    if (item.id !== id) return item
    const keys = Object.keys(patch) as (keyof T)[]
    if (!keys.some((k) => patch[k] !== item[k])) return item
    changed = true
    return { ...item, ...patch }
  })
  return changed ? next : null
}

const stepIdsOf = (g: Group) => new Set(g.steps.map((s) => s.id))
export const allStepIds = (doc: TimelineDoc) => new Set(doc.groups.flatMap((g) => g.steps.map((s) => s.id)))

// --- projects -----------------------------------------------------------------

export function addProject(doc: TimelineDoc, project: Project): TimelineDoc {
  return { ...doc, projects: [...doc.projects, project] }
}

export function updateProject(doc: TimelineDoc, id: string, patch: Partial<Omit<Project, 'id'>>): TimelineDoc {
  const projects = patchItem<Project>(doc.projects, id, patch)
  return projects ? { ...doc, projects } : doc
}

/** Removes a project. Its blocks stay, unassigned (v4.8 left them as invisible orphans). */
export function deleteProject(doc: TimelineDoc, id: string): TimelineDoc {
  if (!doc.projects.some((p) => p.id === id)) return doc
  return {
    ...doc,
    projects: doc.projects.filter((p) => p.id !== id),
    tasks: doc.tasks.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)),
  }
}

// --- groups -------------------------------------------------------------------

export function addGroup(doc: TimelineDoc, group: Group, index = doc.groups.length): TimelineDoc {
  return { ...doc, groups: insertAt(doc.groups, index, group) }
}

export function renameGroup(doc: TimelineDoc, id: string, name: string): TimelineDoc {
  const groups = patchItem<Group>(doc.groups, id, { name })
  return groups ? { ...doc, groups } : doc
}

/** Removes a group, its rows and every block on them. */
export function deleteGroup(doc: TimelineDoc, id: string): TimelineDoc {
  const group = doc.groups.find((g) => g.id === id)
  if (!group) return doc
  const steps = stepIdsOf(group)
  return { ...doc, groups: doc.groups.filter((g) => g.id !== id), tasks: doc.tasks.filter((t) => !steps.has(t.stepId)) }
}

/** Copies a group and its rows (not its blocks) right after the original. */
export function duplicateGroup(doc: TimelineDoc, id: string): TimelineDoc {
  const index = doc.groups.findIndex((g) => g.id === id)
  const group = doc.groups[index]
  if (!group) return doc
  const copy: Group = {
    id: newId('g'),
    name: `${group.name} (Copy)`,
    steps: group.steps.map((s) => ({ id: newId('s'), name: s.name })),
  }
  return addGroup(doc, copy, index + 1)
}

/** Moves a group so it ends up at `toIndex` in the final list. */
export function moveGroup(doc: TimelineDoc, id: string, toIndex: number): TimelineDoc {
  const from = doc.groups.findIndex((g) => g.id === id)
  if (from < 0) return doc
  const rest = doc.groups.filter((g) => g.id !== id)
  const target = Math.max(0, Math.min(rest.length, toIndex))
  if (target === from) return doc
  return { ...doc, groups: insertAt(rest, target, doc.groups[from]!) }
}

// --- steps (rows) -----------------------------------------------------------------

export function findStep(doc: TimelineDoc, stepId: string): { group: Group; index: number } | null {
  for (const group of doc.groups) {
    const index = group.steps.findIndex((s) => s.id === stepId)
    if (index >= 0) return { group, index }
  }
  return null
}

const withGroup = (doc: TimelineDoc, groupId: string, fn: (g: Group) => Group): TimelineDoc => {
  let changed = false
  const groups = doc.groups.map((g) => {
    if (g.id !== groupId) return g
    const next = fn(g)
    if (next !== g) changed = true
    return next
  })
  return changed ? { ...doc, groups } : doc
}

export function addStep(doc: TimelineDoc, groupId: string, step: Step, index?: number): TimelineDoc {
  return withGroup(doc, groupId, (g) => ({ ...g, steps: insertAt(g.steps, index ?? g.steps.length, step) }))
}

export function renameStep(doc: TimelineDoc, stepId: string, name: string): TimelineDoc {
  const found = findStep(doc, stepId)
  if (!found) return doc
  return withGroup(doc, found.group.id, (g) => {
    const steps = patchItem<Step>(g.steps, stepId, { name })
    return steps ? { ...g, steps } : g
  })
}

/** Removes a row and every block on it. */
export function deleteStep(doc: TimelineDoc, stepId: string): TimelineDoc {
  const found = findStep(doc, stepId)
  if (!found) return doc
  const next = withGroup(doc, found.group.id, (g) => ({ ...g, steps: g.steps.filter((s) => s.id !== stepId) }))
  return { ...next, tasks: next.tasks.filter((t) => t.stepId !== stepId) }
}

/** Copies a row (not its blocks) right after the original. */
export function duplicateStep(doc: TimelineDoc, stepId: string): TimelineDoc {
  const found = findStep(doc, stepId)
  if (!found) return doc
  const step = found.group.steps[found.index]!
  return addStep(doc, found.group.id, { id: newId('s'), name: `${step.name} (Copy)` }, found.index + 1)
}

/** Moves a row to `toIndex` within `toGroupId` (index in the final list). Rows can change group. */
export function moveStep(doc: TimelineDoc, stepId: string, toGroupId: string, toIndex: number): TimelineDoc {
  const found = findStep(doc, stepId)
  if (!found || !doc.groups.some((g) => g.id === toGroupId)) return doc
  if (found.group.id === toGroupId && found.index === Math.max(0, Math.min(found.group.steps.length - 1, toIndex))) {
    return doc
  }
  const step = found.group.steps[found.index]!
  const groups = doc.groups.map((g) => {
    let steps = g.steps.filter((s) => s.id !== stepId)
    if (g.id === toGroupId) steps = insertAt(steps, toIndex, step)
    return steps.length === g.steps.length && g.id !== toGroupId && g.id !== found.group.id ? g : { ...g, steps }
  })
  return { ...doc, groups }
}

// --- tasks (bulk) ---------------------------------------------------------------------

export function updateTasks(doc: TimelineDoc, ids: ReadonlySet<string>, patch: Partial<Omit<Task, 'id'>>): TimelineDoc {
  let changed = false
  const keys = Object.keys(patch) as (keyof typeof patch)[]
  const tasks = doc.tasks.map((t) => {
    if (!ids.has(t.id) || !keys.some((k) => patch[k] !== t[k])) return t
    changed = true
    return { ...t, ...patch }
  })
  return changed ? { ...doc, tasks } : doc
}

/** Blocks on rows that no longer exist (only possible with old or hand-edited data). */
export function orphanTasks(doc: TimelineDoc): Task[] {
  const steps = allStepIds(doc)
  return doc.tasks.filter((t) => !steps.has(t.stepId))
}

// --- subtasks -------------------------------------------------------------------------

const withTask = (doc: TimelineDoc, taskId: string, fn: (t: Task) => Task): TimelineDoc => {
  let changed = false
  const tasks = doc.tasks.map((t) => {
    if (t.id !== taskId) return t
    const next = fn(t)
    if (next !== t) changed = true
    return next
  })
  return changed ? { ...doc, tasks } : doc
}

/** Keeps the stored order as To Do, then In Progress, then Done (as v4.8 did). */
const byColumn = (subtasks: readonly Subtask[]): Subtask[] =>
  SUBTASK_STATUSES.flatMap((status) => subtasks.filter((s) => s.status === status))

export function addSubtask(doc: TimelineDoc, taskId: string, subtask: Subtask): TimelineDoc {
  return withTask(doc, taskId, (t) => ({ ...t, subtasks: byColumn([...t.subtasks, subtask]) }))
}

export function updateSubtask(
  doc: TimelineDoc,
  taskId: string,
  subtaskId: string,
  patch: Partial<Omit<Subtask, 'id'>>,
): TimelineDoc {
  return withTask(doc, taskId, (t) => {
    const subtasks = patchItem<Subtask>(t.subtasks, subtaskId, patch)
    return subtasks ? { ...t, subtasks: byColumn(subtasks) } : t
  })
}

export function deleteSubtask(doc: TimelineDoc, taskId: string, subtaskId: string): TimelineDoc {
  return withTask(doc, taskId, (t) =>
    t.subtasks.some((s) => s.id === subtaskId) ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) } : t,
  )
}

export function duplicateSubtask(doc: TimelineDoc, taskId: string, subtaskId: string): TimelineDoc {
  return withTask(doc, taskId, (t) => {
    const index = t.subtasks.findIndex((s) => s.id === subtaskId)
    const original = t.subtasks[index]
    if (!original) return t
    const copy = { ...original, id: newId('st'), title: `${original.title} (Copy)` }
    return { ...t, subtasks: insertAt(t.subtasks, index + 1, copy) }
  })
}

/** Moves a card to `status`, at `index` among that column's other cards. */
export function moveSubtask(
  doc: TimelineDoc,
  taskId: string,
  subtaskId: string,
  status: SubtaskStatus,
  index: number,
): TimelineDoc {
  return withTask(doc, taskId, (t) => {
    const card = t.subtasks.find((s) => s.id === subtaskId)
    if (!card) return t
    const others = t.subtasks.filter((s) => s.id !== subtaskId)
    const columns = SUBTASK_STATUSES.map((st) => others.filter((s) => s.status === st))
    const target = columns[SUBTASK_STATUSES.indexOf(status)]!
    columns[SUBTASK_STATUSES.indexOf(status)] = insertAt(target, index, card.status === status ? card : { ...card, status })
    const subtasks = columns.flat()
    const same = subtasks.every((s, i) => s === t.subtasks[i])
    return same ? t : { ...t, subtasks }
  })
}
