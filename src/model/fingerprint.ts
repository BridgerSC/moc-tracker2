import type { Group, Project, Subtask, Task, TimelineDoc } from './types'

// A stable string for a document's content, independent of object key order.
// Used to tell whether the local document differs from the last synced one.

const project = (p: Project) => [p.id, p.name, p.color, p.deadline, p.archived, p.notes]
const group = (g: Group) => [g.id, g.name, g.steps.map((s) => [s.id, s.name])]
const subtask = (s: Subtask) => [s.id, s.title, s.status]
const task = (t: Task) => [t.id, t.projectId, t.stepId, t.start, t.duration, t.title, t.notes, t.subtasks.map(subtask)]

export function docFingerprint(doc: TimelineDoc): string {
  return JSON.stringify([doc.projects.map(project), doc.groups.map(group), doc.tasks.map(task)])
}

export const isEmptyDoc = (doc: TimelineDoc) =>
  doc.projects.length === 0 && doc.groups.length === 0 && doc.tasks.length === 0
