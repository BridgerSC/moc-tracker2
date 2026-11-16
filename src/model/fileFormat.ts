// Reading and writing the shared timeline file (the Gist's data.json).
//
// Reads, in order of preference:
//   v5    – this app's format: calendar-date strings, `rev` counter.
//   v4.8  – day offsets from 2026-05-01, `exportedAt`/`lastEditedBy`, version "4.8".
//   older – v4.x files with a top-level `steps` array instead of `groups`.
// Always writes v5.
//
// Reading is lenient: bad fields are repaired or the item is dropped, and every
// repair is reported in `warnings` so nothing is lost silently.

import { FALLBACK_COLOR, parseColor } from './colors'
import { legacyOffsetToDate, parseIsoDate, type IsoDate } from './dates'
import { newId, type IdPrefix } from './ids'
import {
  FILE_FORMAT_VERSION,
  SUBTASK_STATUSES,
  type Group,
  type Project,
  type Step,
  type Subtask,
  type SubtaskStatus,
  type SyncMeta,
  type Task,
  type TimelineDoc,
  type TimelineFileV5,
} from './types'

export type SourceFormat = 'v5' | 'v4.8' | 'v4-steps'

export interface ReadResult {
  doc: TimelineDoc
  meta: SyncMeta
  source: SourceFormat
  /** Human-readable notes about anything repaired or dropped. Empty for clean data. */
  warnings: string[]
}

/** Thrown when the content can't be read at all (not JSON, wrong shape, or a newer format). */
export class TimelineFileError extends Error {
  override name = 'TimelineFileError'
}

type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)

export function parseTimelineFile(text: string): ReadResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (err) {
    throw new TimelineFileError(`Timeline file is not valid JSON: ${(err as Error).message}`)
  }
  return readTimelineFile(raw)
}

export function readTimelineFile(raw: unknown): ReadResult {
  if (!isObject(raw)) throw new TimelineFileError('Timeline file must be a JSON object.')

  const { version } = raw
  if (typeof version === 'number' && version > FILE_FORMAT_VERSION) {
    throw new TimelineFileError(
      `This timeline was saved by a newer version of the app (format v${version}). Reload to get the latest version.`,
    )
  }

  const isV5 = version === FILE_FORMAT_VERSION
  const source: SourceFormat = isV5 ? 'v5' : Array.isArray(raw.groups) ? 'v4.8' : 'v4-steps'
  const reader = new Reader(isV5 ? readIsoDate : readLegacyDate)

  if (!isV5 && !Array.isArray(raw.groups) && !Array.isArray(raw.steps)) {
    if (Array.isArray(raw.employees)) {
      throw new TimelineFileError(
        'This file uses the original PROJECT CAL format (employees/arrays), which predates v4 and cannot be imported.',
      )
    }
    throw new TimelineFileError('Timeline file has no groups or steps.')
  }

  const rawGroups = isV5 || Array.isArray(raw.groups)
    ? raw.groups
    : [{ id: 'g_legacy', name: 'Main Timeline', steps: raw.steps }]

  const doc: TimelineDoc = {
    projects: reader.list(raw.projects, 'projects', (p, i) => reader.project(p, i)),
    groups: reader.list(rawGroups, 'groups', (g, i) => reader.group(g, i)),
    tasks: reader.list(raw.tasks, 'tasks', (t, i) => reader.task(t, i)),
  }

  const meta: SyncMeta = isV5
    ? {
        rev: Number.isInteger(raw.rev) && (raw.rev as number) >= 0 ? (raw.rev as number) : 0,
        savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : null,
        savedBy: typeof raw.savedBy === 'string' ? raw.savedBy : null,
      }
    : {
        rev: 0,
        savedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : null,
        savedBy: typeof raw.lastEditedBy === 'string' ? raw.lastEditedBy : null,
      }

  return { doc, meta, source, warnings: reader.warnings }
}

/** Serializes a document as a v5 file. `rev` should be the new revision being saved. */
export function serializeTimelineFile(
  doc: TimelineDoc,
  meta: { rev: number; savedAt: string; savedBy: string },
): string {
  // Built field by field so the key order (metadata first) is stable.
  const file: TimelineFileV5 = {
    version: FILE_FORMAT_VERSION,
    rev: meta.rev,
    savedAt: meta.savedAt,
    savedBy: meta.savedBy,
    projects: doc.projects,
    groups: doc.groups,
    tasks: doc.tasks,
  }
  return JSON.stringify(file, null, 2)
}

// --- internals ---------------------------------------------------------------

type DateReader = (v: unknown) => IsoDate | null

const readIsoDate: DateReader = (v) => parseIsoDate(v)
const readLegacyDate: DateReader = (v) =>
  typeof v === 'number' && Number.isFinite(v) ? legacyOffsetToDate(v) : null

class Reader {
  readonly warnings: string[] = []
  private readonly seenIds = new Set<string>()
  private readonly readDate: DateReader

  constructor(readDate: DateReader) {
    this.readDate = readDate
  }

  warn(message: string) {
    this.warnings.push(message)
  }

  list<T>(value: unknown, label: string, readItem: (item: Json, index: number) => T | null): T[] {
    if (value === undefined) {
      this.warn(`No ${label} in file; starting with none.`)
      return []
    }
    if (!Array.isArray(value)) {
      this.warn(`${label} is not a list; ignored.`)
      return []
    }
    const out: T[] = []
    value.forEach((item, index) => {
      if (!isObject(item)) {
        this.warn(`${label}[${index}] is not an object; dropped.`)
        return
      }
      const read = readItem(item, index)
      if (read !== null) out.push(read)
    })
    return out
  }

  /** Returns the item's id, or a fresh one if it is missing or already used. */
  id(value: unknown, prefix: IdPrefix, where: string): string {
    if (typeof value === 'string' && value !== '' && !this.seenIds.has(value)) {
      this.seenIds.add(value)
      return value
    }
    const fresh = newId(prefix)
    this.seenIds.add(fresh)
    this.warn(
      typeof value === 'string' && value !== ''
        ? `${where}: duplicate id ${JSON.stringify(value)} replaced with ${fresh}.`
        : `${where}: missing id; assigned ${fresh}.`,
    )
    return fresh
  }

  project(p: Json, i: number): Project {
    const where = `projects[${i}]`
    const color = parseColor(p.color)
    if (color === null) this.warn(`${where}: colour ${JSON.stringify(p.color)} not recognised; using ${FALLBACK_COLOR}.`)
    let deadline: IsoDate | null = null
    if (p.deadline !== null && p.deadline !== undefined) {
      deadline = this.readDate(p.deadline)
      if (deadline === null) this.warn(`${where}: deadline ${JSON.stringify(p.deadline)} not readable; cleared.`)
    }
    return {
      id: this.id(p.id, 'p', where),
      name: str(p.name),
      color: color ?? FALLBACK_COLOR,
      deadline,
      archived: p.archived === true,
      notes: str(p.notes),
    }
  }

  group(g: Json, i: number): Group {
    const where = `groups[${i}]`
    return {
      id: this.id(g.id, 'g', where),
      name: str(g.name),
      steps: this.list(g.steps, `${where}.steps`, (s, j) => this.step(s, `${where}.steps[${j}]`)),
    }
  }

  step(s: Json, where: string): Step {
    return { id: this.id(s.id, 's', where), name: str(s.name) }
  }

  task(t: Json, i: number): Task | null {
    const where = `tasks[${i}]`
    if (typeof t.stepId !== 'string' || t.stepId === '') {
      this.warn(`${where} (${JSON.stringify(t.title ?? '')}): no step; dropped.`)
      return null
    }
    const start = this.readDate(t.start)
    if (start === null) {
      this.warn(`${where} (${JSON.stringify(t.title ?? '')}): start ${JSON.stringify(t.start)} not readable; dropped.`)
      return null
    }
    let duration = typeof t.duration === 'number' && Number.isFinite(t.duration) ? Math.round(t.duration) : NaN
    if (!(duration >= 1)) {
      this.warn(`${where}: duration ${JSON.stringify(t.duration)} invalid; set to 1.`)
      duration = 1
    }
    return {
      id: this.id(t.id, 't', where),
      projectId: typeof t.projectId === 'string' && t.projectId !== '' ? t.projectId : null,
      stepId: t.stepId,
      start,
      duration,
      title: str(t.title),
      notes: str(t.notes),
      subtasks: t.subtasks === undefined
        ? []
        : this.list(t.subtasks, `${where}.subtasks`, (s, j) => this.subtask(s, `${where}.subtasks[${j}]`)),
    }
  }

  subtask(s: Json, where: string): Subtask {
    let status: SubtaskStatus
    if (SUBTASK_STATUSES.includes(s.status as SubtaskStatus)) {
      status = s.status as SubtaskStatus
    } else if (s.status === undefined) {
      // v4.x before the Kanban board used a boolean.
      status = s.isCompleted === true ? 'done' : 'todo'
    } else {
      this.warn(`${where}: status ${JSON.stringify(s.status)} unknown; set to todo.`)
      status = 'todo'
    }
    return { id: this.id(s.id, 'st', where), title: str(s.title), status }
  }
}
