import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { emptyDoc, type TimelineDoc } from '../model/types'
import * as H from './history'

// The timeline document and its undo history.
//
// All edits go through `apply(recipe)`, where `recipe` returns a new document
// (or the same one for "no change"). Drags and other continuous gestures should
// preview in the UI and call `apply` once on release.

export type Recipe = (doc: TimelineDoc) => TimelineDoc

export interface DocState {
  history: H.History<TimelineDoc>
  /** Applies an edit as one undo step (or merges it into the previous one, see `coalesceKey`). */
  apply: (recipe: Recipe, options?: H.CommitOptions) => void
  undo: () => void
  redo: () => void
  /** Closes the current coalescing run, e.g. when a text field loses focus. */
  seal: () => void
  /**
   * Replaces the whole document, e.g. after loading from the Gist.
   * `undoable: false` also clears the history (initial load); `true` lets the user undo the replacement.
   */
  replace: (doc: TimelineDoc, options: { undoable: boolean }) => void
}

export function createDocStore(initial: TimelineDoc = emptyDoc()) {
  return createStore<DocState>()((set) => ({
    history: H.createHistory(initial),
    apply: (recipe, options) =>
      set((s) => {
        const next = H.commit(s.history, recipe(s.history.present), options)
        return next === s.history ? s : { history: next }
      }),
    undo: () => set((s) => ({ history: H.undo(s.history) })),
    redo: () => set((s) => ({ history: H.redo(s.history) })),
    seal: () => set((s) => ({ history: H.seal(s.history) })),
    replace: (doc, { undoable }) =>
      set((s) => ({ history: undoable ? H.commit(H.seal(s.history), doc) : H.createHistory(doc) })),
  }))
}

export type DocStore = ReturnType<typeof createDocStore>

/** The app-wide document store. */
export const docStore = createDocStore()

export function useDoc<T>(selector: (state: DocState) => T): T {
  return useStore(docStore, selector)
}

export const selectDoc = (s: DocState) => s.history.present
export const selectCanUndo = (s: DocState) => s.history.past.length > 0
export const selectCanRedo = (s: DocState) => s.history.future.length > 0
