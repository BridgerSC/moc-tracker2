import { afterEach, describe, expect, it, vi } from 'vitest'
import { isoDate } from '../model/dates'
import { docFingerprint } from '../model/fingerprint'
import type { TimelineDoc } from '../model/types'
import { decidePull, decidePush, type RemoteSnapshot, type SyncSnapshot } from './decide'
import { GistError, keyOwner, readGist, writeGist } from './gist'

const meta = (rev: number, savedAt = `2026-11-1${rev}T00:00:00Z`) => ({ rev, savedAt, savedBy: 'x' })

describe('decidePull', () => {
  const local = (over: Partial<SyncSnapshot> = {}): SyncSnapshot => ({
    base: meta(3), baseFingerprint: 'B', localFingerprint: 'B', localIsEmpty: false, ...over,
  })
  const remote = (rev: number, fingerprint: string): RemoteSnapshot => ({ meta: meta(rev), fingerprint })

  it('records identical content without asking', () => {
    expect(decidePull(local({ localFingerprint: 'R' }), remote(4, 'R'))).toBe('same')
  })
  it('does nothing when the remote has not moved', () => {
    expect(decidePull(local({ localFingerprint: 'L' }), remote(3, 'B'))).toBe('up-to-date')
  })
  it('takes newer remote content when there are no local changes', () => {
    expect(decidePull(local(), remote(4, 'R'))).toBe('adopt')
  })
  it('asks when both sides changed', () => {
    expect(decidePull(local({ localFingerprint: 'L' }), remote(4, 'R'))).toBe('conflict')
  })
  it('first sync: adopts into an empty browser, asks if there is local content', () => {
    expect(decidePull(local({ base: null, baseFingerprint: null, localFingerprint: 'E', localIsEmpty: true }), remote(0, 'R'))).toBe('adopt')
    expect(decidePull(local({ base: null, baseFingerprint: null, localFingerprint: 'L' }), remote(0, 'R'))).toBe('conflict')
  })
  it('tells v4.8 versions apart by timestamp (they all have rev 0)', () => {
    const v48 = local({ base: { rev: 0, savedAt: 'a', savedBy: null } })
    expect(decidePull(v48, { meta: { rev: 0, savedAt: 'b', savedBy: null }, fingerprint: 'R' })).toBe('adopt')
  })
})

describe('decidePush', () => {
  const local: SyncSnapshot = { base: meta(3), baseFingerprint: 'B', localFingerprint: 'L', localIsEmpty: false }
  it('allows upload when nobody saved since our base', () => {
    expect(decidePush(local, { meta: meta(3), fingerprint: 'B' })).toBe('ok')
  })
  it('allows upload when the remote was re-saved with the same content', () => {
    expect(decidePush(local, { meta: meta(4), fingerprint: 'B' })).toBe('ok')
  })
  it('flags a conflict when someone else saved different content', () => {
    expect(decidePush(local, { meta: meta(4), fingerprint: 'R' })).toBe('conflict')
  })
  it('flags a conflict when this browser never synced', () => {
    expect(decidePush({ ...local, base: null, baseFingerprint: null }, { meta: meta(0), fingerprint: 'R' })).toBe('conflict')
  })
})

describe('docFingerprint', () => {
  it('ignores key order', () => {
    const a: TimelineDoc = {
      projects: [], groups: [],
      tasks: [{ id: 't', projectId: null, stepId: 's', start: isoDate('2026-11-16'), duration: 1, title: '', notes: '', subtasks: [] }],
    }
    const b = JSON.parse('{"tasks":[{"subtasks":[],"notes":"","title":"","duration":1,"start":"2026-11-16","stepId":"s","projectId":null,"id":"t"}],"groups":[],"projects":[]}')
    expect(docFingerprint(b)).toBe(docFingerprint(a))
  })
})

describe('gist client', () => {
  afterEach(() => vi.unstubAllGlobals())

  const respond = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers })

  it('reads the file and sends the key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(200, { owner: { login: 'Bo' }, files: { 'data.json': { content: '{"a":1}' } } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(readGist('abc', 'data.json', 'tok')).resolves.toEqual({ text: '{"a":1}', ownerLogin: 'Bo' })
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.github.com/gists/abc')
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe('Bearer tok')
  })

  it('reads without a key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(200, { files: { 'data.json': { content: 'x' } } }))
    vi.stubGlobal('fetch', fetchMock)
    await readGist('abc', 'data.json', null)
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBeUndefined()
  })

  it('follows raw_url for truncated files', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(200, { files: { 'data.json': { content: 'partial', truncated: true, raw_url: 'https://raw/x' } } }))
      .mockResolvedValueOnce(respond(200, 'full text'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(readGist('abc', 'data.json', null)).resolves.toMatchObject({ text: 'full text' })
    expect(fetchMock.mock.calls[1]![0]).toBe('https://raw/x')
  })

  it.each([
    [401, {}, 'auth'],
    [403, { 'x-ratelimit-remaining': '0' }, 'rate-limit'],
    [403, {}, 'forbidden'],
    [404, {}, 'not-found'],
    [500, {}, 'bad-response'],
  ])('maps HTTP %i to %s', async (status, headers, kind) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(status, {}, headers as Record<string, string>)))
    await expect(readGist('abc', 'data.json', null)).rejects.toMatchObject({ kind })
  })

  it('reports a missing file and network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, { files: {} })))
    await expect(readGist('abc', 'data.json', null)).rejects.toMatchObject({ kind: 'not-found' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(readGist('abc', 'data.json', null)).rejects.toBeInstanceOf(GistError)
  })

  it('writes with PATCH and verifies the echoed content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(200, { files: { 'data.json': { content: 'new' } } }))
    vi.stubGlobal('fetch', fetchMock)
    await writeGist('abc', 'data.json', 'tok', 'new')
    const init = fetchMock.mock.calls[0]![1]
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ files: { 'data.json': { content: 'new' } } })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, { files: { 'data.json': { content: 'other' } } })))
    await expect(writeGist('abc', 'data.json', 'tok', 'new')).rejects.toMatchObject({ kind: 'bad-response' })
  })

  it('looks up who a key belongs to', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, { login: 'BridgerSC' })))
    await expect(keyOwner('tok')).resolves.toBe('BridgerSC')
  })
})
