import { describe, expect, it } from 'vitest'
import { emptyDoc, type TimelineDoc } from '../model/types'
import { createDocStore } from './docStore'
import { COALESCE_WINDOW_MS, HISTORY_LIMIT, commit, createHistory, redo, seal, undo } from './history'

describe('history', () => {
  it('undoes and redoes in order', () => {
    let h = createHistory('a')
    h = commit(h, 'b')
    h = commit(h, 'c')
    h = undo(h)
    expect(h.present).toBe('b')
    h = undo(h)
    expect(h.present).toBe('a')
    h = redo(h)
    h = redo(h)
    expect(h.present).toBe('c')
  })

  it('is a no-op at either end', () => {
    const h = createHistory('a')
    expect(undo(h)).toBe(h)
    expect(redo(h)).toBe(h)
  })

  it('ignores commits that change nothing, keeping redo intact', () => {
    let h = commit(createHistory('a'), 'b')
    h = undo(h)
    const same = commit(h, h.present)
    expect(same).toBe(h)
    expect(same.future).toEqual(['b'])
  })

  it('a new change clears redo', () => {
    let h = commit(createHistory('a'), 'b')
    h = undo(h)
    h = commit(h, 'x')
    expect(h.future).toEqual([])
  })

  it(`keeps at most ${HISTORY_LIMIT} undo steps`, () => {
    let h = createHistory(0)
    for (let i = 1; i <= HISTORY_LIMIT + 10; i++) h = commit(h, i)
    expect(h.past).toHaveLength(HISTORY_LIMIT)
    expect(h.past[0]).toBe(10)
  })

  describe('coalescing', () => {
    it('merges rapid commits with the same key into one undo step', () => {
      let h = createHistory('')
      h = commit(h, 'h', { coalesceKey: 'title', now: 1000 })
      h = commit(h, 'hi', { coalesceKey: 'title', now: 1200 })
      h = commit(h, 'hi!', { coalesceKey: 'title', now: 1400 })
      expect(h.past).toEqual([''])
      expect(undo(h).present).toBe('')
    })

    it('keeps the run open while typing continues, measured from the last keystroke', () => {
      let h = createHistory('')
      for (let i = 1; i <= 10; i++) h = commit(h, 'x'.repeat(i), { coalesceKey: 'title', now: i * 1000 })
      expect(h.past).toEqual([''])
    })

    it('starts a new step after a pause, a different key, or a seal', () => {
      let h = createHistory('a')
      h = commit(h, 'b', { coalesceKey: 'k', now: 0 })
      h = commit(h, 'c', { coalesceKey: 'k', now: COALESCE_WINDOW_MS + 1 })
      h = commit(h, 'd', { coalesceKey: 'other', now: COALESCE_WINDOW_MS + 2 })
      h = seal(h)
      h = commit(h, 'e', { coalesceKey: 'other', now: COALESCE_WINDOW_MS + 3 })
      expect(h.past).toEqual(['a', 'b', 'c', 'd'])
    })

    it('never merges into a step that was just undone', () => {
      let h = createHistory('a')
      h = commit(h, 'ab', { coalesceKey: 'k', now: 0 })
      h = undo(h)
      h = commit(h, 'ax', { coalesceKey: 'k', now: 10 })
      expect(h.past).toEqual(['a'])
    })
  })
})

describe('doc store', () => {
  const withProject = (name: string) => (doc: TimelineDoc): TimelineDoc => ({
    ...doc,
    projects: [...doc.projects, { id: name, name, color: '#FFD166', deadline: null, archived: false, notes: '' }],
  })

  it('applies edits and undoes them', () => {
    const store = createDocStore()
    store.getState().apply(withProject('p1'))
    store.getState().apply(withProject('p2'))
    expect(store.getState().history.present.projects.map((p) => p.id)).toEqual(['p1', 'p2'])
    store.getState().undo()
    expect(store.getState().history.present.projects.map((p) => p.id)).toEqual(['p1'])
  })

  it('does not notify subscribers for no-op edits', () => {
    const store = createDocStore()
    let calls = 0
    store.subscribe(() => calls++)
    store.getState().apply((doc) => doc)
    expect(calls).toBe(0)
  })

  it('replace without undo resets history (initial load)', () => {
    const store = createDocStore()
    store.getState().apply(withProject('p1'))
    store.getState().replace(emptyDoc(), { undoable: false })
    expect(store.getState().history.past).toEqual([])
  })

  it('refuses edits and undo while locked, but still allows replace', () => {
    let blocked = 0
    const store = createDocStore(emptyDoc(), () => blocked++)
    store.getState().apply(withProject('p1'))
    store.getState().setLocked(true)
    store.getState().apply(withProject('p2'))
    store.getState().undo()
    expect(store.getState().history.present.projects.map((p) => p.id)).toEqual(['p1'])
    expect(blocked).toBe(2)
    store.getState().replace(withProject('remote')(emptyDoc()), { undoable: false })
    expect(store.getState().history.present.projects.map((p) => p.id)).toEqual(['remote'])
  })

  it('replace with undo can be reverted (accepting a remote version)', () => {
    const store = createDocStore()
    store.getState().apply(withProject('local'))
    store.getState().replace(withProject('remote')(emptyDoc()), { undoable: true })
    store.getState().undo()
    expect(store.getState().history.present.projects.map((p) => p.id)).toEqual(['local'])
  })
})
