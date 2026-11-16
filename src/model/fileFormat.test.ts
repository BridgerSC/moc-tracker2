import { describe, expect, it } from 'vitest'
import { legacyOffsetToDate } from './dates'
import { TimelineFileError, parseTimelineFile, readTimelineFile, serializeTimelineFile } from './fileFormat'
import seed from './__fixtures__/v48-seed.json'

// A snapshot of the real shared Gist, if one has been downloaded locally.
// It is git-ignored (team data); the test is skipped when it's absent.
const localSnapshots = import.meta.glob<{ default: unknown }>('./__fixtures__/gist.local.json', { eager: true })
const realGist = Object.values(localSnapshots)[0]?.default

describe('reading v4.8 files', () => {
  const result = readTimelineFile(seed)
  const { doc } = result

  it('identifies the source format and carries over sync metadata', () => {
    expect(result.source).toBe('v4.8')
    expect(result.meta).toEqual({ rev: 0, savedAt: '2026-11-16T14:03:22.511Z', savedBy: 'Alice' })
  })

  it('converts day offsets to calendar dates', () => {
    expect(doc.tasks.map((t) => [t.id, t.start])).toEqual([
      ['t1', '2026-04-29'],
      ['t2', '2026-05-05'],
      ['t3', '2026-05-01'],
      ['t4', '2026-11-02'], // a winter date: v4.8 displayed this as Nov 1
    ])
    expect(doc.projects.map((p) => p.deadline)).toEqual(['2026-05-15', null, '2026-11-16'])
  })

  it('normalises colours, including old Tailwind classes', () => {
    expect(doc.projects.map((p) => p.color)).toEqual(['#FFD166', '#06D6A0', '#118AB2'])
  })

  it('fills in missing subtasks and maps the legacy isCompleted flag', () => {
    expect(doc.tasks.find((t) => t.id === 't3')?.subtasks).toEqual([])
    expect(doc.tasks.find((t) => t.id === 't1')?.subtasks.map((s) => s.status)).toEqual(['done', 'done'])
  })

  it('keeps groups, steps, archived flags and unassigned tasks', () => {
    expect(doc.groups.map((g) => g.steps.map((s) => s.id))).toEqual([['s1', 's2'], ['s3', 's4'], ['s5', 's6']])
    expect(doc.projects.map((p) => p.archived)).toEqual([false, false, true])
    expect(doc.tasks.find((t) => t.id === 't4')?.projectId).toBeNull()
  })

  it('reports nothing for clean data', () => {
    expect(result.warnings).toEqual([])
  })
})

describe('reading older v4 files with top-level steps', () => {
  it('wraps the steps in a single group', () => {
    const result = readTimelineFile({
      projects: [],
      steps: [{ id: 's1', name: 'Only row' }],
      tasks: [{ id: 't1', projectId: null, stepId: 's1', start: 0, duration: 1, title: 'x', notes: '' }],
    })
    expect(result.source).toBe('v4-steps')
    expect(result.doc.groups).toEqual([{ id: 'g_legacy', name: 'Main Timeline', steps: [{ id: 's1', name: 'Only row' }] }])
  })
})

describe('repairing bad data', () => {
  const result = readTimelineFile({
    version: '4.8',
    projects: [
      { id: 'p1', name: 'A', color: 'teal', deadline: 'soon' },
      { id: 'p1', name: 'Duplicate id', color: '#abc' },
    ],
    groups: [{ id: 'g1', name: 'G', steps: [{ name: 'No id' }] }],
    tasks: [
      { id: 't1', stepId: 's1', start: 1, duration: 0, subtasks: [{ id: 'x', title: 'y', status: 'blocked' }] },
      { id: 't2', start: 1, duration: 1, title: 'No step' },
      { id: 't3', stepId: 's1', start: 'tuesday', duration: 1, title: 'Bad start' },
      'not an object',
    ],
  })

  it('repairs what it can', () => {
    const [p1, p2] = result.doc.projects
    expect(p1).toMatchObject({ color: '#666666', deadline: null, archived: false, notes: '' })
    expect(p2?.color).toBe('#AABBCC')
    expect(p2?.id).not.toBe('p1')
    expect(result.doc.groups[0]?.steps[0]?.id).toMatch(/^s_/)
    expect(result.doc.tasks[0]).toMatchObject({ duration: 1, title: '', projectId: null })
    expect(result.doc.tasks[0]?.subtasks[0]?.status).toBe('todo')
  })

  it('drops tasks it cannot place, and says so', () => {
    expect(result.doc.tasks.map((t) => t.id)).toEqual(['t1'])
    expect(result.warnings).toHaveLength(9)
    expect(result.warnings.join('\n')).toMatch(/No step.*dropped/)
    expect(result.warnings.join('\n')).toMatch(/Bad start.*dropped/)
  })
})

describe('rejecting unreadable files', () => {
  it.each([
    ['not JSON', '{oops'],
    ['not an object', '[]'],
    ['no rows at all', '{"projects":[],"tasks":[]}'],
  ])('%s', (_label, text) => {
    expect(() => parseTimelineFile(text)).toThrow(TimelineFileError)
  })

  it('explains the pre-v4 PROJECT CAL format', () => {
    expect(() => readTimelineFile({ employees: [], tasks: [] })).toThrow(/original PROJECT CAL format/)
  })

  it('refuses files from a newer app version instead of mangling them', () => {
    expect(() => readTimelineFile({ version: 6, projects: [], groups: [], tasks: [] })).toThrow(/newer version/)
  })
})

describe('v5 round trip', () => {
  it('writes v5 and reads it back unchanged', () => {
    const { doc } = readTimelineFile(seed)
    const text = serializeTimelineFile(doc, { rev: 7, savedAt: '2026-11-17T09:00:00.000Z', savedBy: 'Bo' })
    const back = parseTimelineFile(text)
    expect(back.source).toBe('v5')
    expect(back.doc).toEqual(doc)
    expect(back.meta).toEqual({ rev: 7, savedAt: '2026-11-17T09:00:00.000Z', savedBy: 'Bo' })
    expect(back.warnings).toEqual([])
  })

  it('puts metadata first in the file', () => {
    const text = serializeTimelineFile({ projects: [], groups: [], tasks: [] }, { rev: 1, savedAt: 'now', savedBy: 'me' })
    expect(Object.keys(JSON.parse(text))).toEqual(['version', 'rev', 'savedAt', 'savedBy', 'projects', 'groups', 'tasks'])
  })
})

describe.skipIf(realGist === undefined)('real Gist snapshot (local only)', () => {
  const raw = realGist as { projects: unknown[]; groups: { steps: unknown[] }[]; tasks: { id: string; start: number }[] }
  const result = readTimelineFile(raw)

  it('migrates without any repairs', () => {
    expect(result.warnings).toEqual([])
  })

  it('keeps every project, group, step and task', () => {
    expect(result.doc.projects).toHaveLength(raw.projects.length)
    expect(result.doc.groups.map((g) => g.steps.length)).toEqual(raw.groups.map((g) => g.steps.length))
    expect(result.doc.tasks).toHaveLength(raw.tasks.length)
  })

  it('maps every task start to the calendar day v4.8 meant', () => {
    for (const original of raw.tasks) {
      const migrated = result.doc.tasks.find((t) => t.id === original.id)
      expect(migrated?.start).toBe(legacyOffsetToDate(original.start))
    }
  })

  it('survives a v5 round trip', () => {
    const text = serializeTimelineFile(result.doc, { rev: 1, savedAt: 'x', savedBy: 'y' })
    expect(parseTimelineFile(text).doc).toEqual(result.doc)
  })
})
