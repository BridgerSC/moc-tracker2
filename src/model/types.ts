import type { IsoDate } from './dates'

// The timeline document: everything that is synced and undoable.
// View state (selection, zoom, collapsed groups, token…) lives elsewhere.

export type SubtaskStatus = 'todo' | 'progress' | 'done'

export const SUBTASK_STATUSES: readonly SubtaskStatus[] = ['todo', 'progress', 'done']

export interface Subtask {
  id: string
  title: string
  status: SubtaskStatus
}

/** A block on the timeline. */
export interface Task {
  id: string
  /** Owning project; null when unassigned. */
  projectId: string | null
  /** The step (row) the block sits on. */
  stepId: string
  /** First day covered. */
  start: IsoDate
  /** Length in whole days, at least 1. The last day is `endDate(start, duration)`. */
  duration: number
  title: string
  notes: string
  /** Kanban cards; order is meaningful. */
  subtasks: Subtask[]
}

/** A client or production. Supplies block colour and an optional deadline. */
export interface Project {
  id: string
  name: string
  /** "#RRGGBB". */
  color: string
  /** Inclusive deadline day, or null. */
  deadline: IsoDate | null
  archived: boolean
  notes: string
}

/** A timeline row. */
export interface Step {
  id: string
  name: string
}

/** A collapsible category of rows. */
export interface Group {
  id: string
  name: string
  steps: Step[]
}

export interface TimelineDoc {
  projects: Project[]
  groups: Group[]
  tasks: Task[]
}

export const emptyDoc = (): TimelineDoc => ({ projects: [], groups: [], tasks: [] })

/** Which save of the shared file a document came from. */
export interface SyncMeta {
  /** Increments on every successful save; used to detect conflicting saves. 0 for unversioned (v4.8) data. */
  rev: number
  /** ISO timestamp of that save, informational only. */
  savedAt: string | null
  savedBy: string | null
}

export const FILE_FORMAT_VERSION = 5

/** The JSON stored in the Gist from v5 on. Metadata first so the file reads well. */
export interface TimelineFileV5 extends TimelineDoc {
  version: typeof FILE_FORMAT_VERSION
  rev: number
  savedAt: string
  savedBy: string
}
