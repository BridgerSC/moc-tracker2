// User-level commands shared by menus, panels and shortcuts.
// Each is one undo step. Destructive ones that would remove blocks ask first.

import { deleteTasks, duplicateTasks, makeCloneIds } from '../model/edits'
import { newId } from '../model/ids'
import {
  addGroup,
  addProject,
  addStep,
  deleteGroup,
  deleteProject,
  deleteStep,
  duplicateGroup,
  duplicateStep,
} from '../model/structure'
import type { Project } from '../model/types'
import { docStore } from '../store/docStore'
import { uiStore } from '../store/uiStore'

const doc = () => docStore.getState().history.present
const apply = (...args: Parameters<ReturnType<typeof docStore.getState>['apply']>) => docStore.getState().apply(...args)
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Colours offered to new projects, in order (the first one not already used is picked). */
export const PROJECT_PALETTE = ['#FFD166', '#06D6A0', '#118AB2', '#EF476F', '#A06CD5', '#4D908E', '#F77F00', '#EAE2B7']

// --- blocks -----------------------------------------------------------------------

export function deleteBlocks(ids: ReadonlySet<string>) {
  apply((d) => deleteTasks(d, ids))
  const ui = uiStore.getState()
  ui.select([...ui.selection].filter((id) => !ids.has(id)))
}

/** Copies each block to just after itself and selects the copies. */
export function duplicateBlocks(ids: Iterable<string>) {
  const idMap = makeCloneIds(ids)
  if (idMap.size === 0) return
  apply((d) => duplicateTasks(d, idMap, (t) => t.duration))
  uiStore.getState().select(idMap.values())
}

// --- projects ---------------------------------------------------------------------

export function createProject() {
  const used = new Set(doc().projects.map((p) => p.color))
  const project: Project = {
    id: newId('p'),
    name: 'New Project',
    color: PROJECT_PALETTE.find((c) => !used.has(c)) ?? PROJECT_PALETTE[0]!,
    deadline: null,
    archived: false,
    notes: '',
  }
  apply((d) => addProject(d, project))
  uiStore.getState().showProject(project.id)
  return project.id
}

export function removeProject(projectId: string) {
  const project = doc().projects.find((p) => p.id === projectId)
  if (!project) return
  const blocks = doc().tasks.filter((t) => t.projectId === projectId).length
  const run = () => apply((d) => deleteProject(d, projectId))
  if (blocks === 0) return run()
  uiStore.getState().askConfirm({
    title: 'Delete project',
    message: `Delete “${project.name || 'Unnamed'}”? Its ${plural(blocks, 'block')} will stay on the timeline as “No Project”. You can undo this.`,
    confirmLabel: 'Delete project',
    onConfirm: run,
  })
}

// --- groups and rows ---------------------------------------------------------------

export function createGroup() {
  const id = newId('g')
  apply((d) => addGroup(d, { id, name: 'New Category', steps: [] }))
  uiStore.getState().setRenamingRow(id)
}

export function createStep(groupId: string) {
  const id = newId('s')
  apply((d) => addStep(d, groupId, { id, name: 'New Step' }))
  const ui = uiStore.getState()
  if (ui.collapsedGroups.has(groupId)) ui.toggleGroup(groupId)
  ui.setRenamingRow(id)
}

export function copyGroup(groupId: string) {
  apply((d) => duplicateGroup(d, groupId))
}

export function copyStep(stepId: string) {
  apply((d) => duplicateStep(d, stepId))
}

export function removeGroup(groupId: string) {
  const group = doc().groups.find((g) => g.id === groupId)
  if (!group) return
  const steps = new Set(group.steps.map((s) => s.id))
  const blocks = doc().tasks.filter((t) => steps.has(t.stepId)).length
  const run = () => apply((d) => deleteGroup(d, groupId))
  if (blocks === 0) return run()
  uiStore.getState().askConfirm({
    title: 'Delete category',
    message: `Delete “${group.name || 'Unnamed'}” with its ${plural(group.steps.length, 'row')} and the ${plural(blocks, 'block')} on them? You can undo this.`,
    confirmLabel: 'Delete category',
    onConfirm: run,
  })
}

export function removeStep(stepId: string) {
  const step = doc().groups.flatMap((g) => g.steps).find((s) => s.id === stepId)
  if (!step) return
  const blocks = doc().tasks.filter((t) => t.stepId === stepId).length
  const run = () => apply((d) => deleteStep(d, stepId))
  if (blocks === 0) return run()
  uiStore.getState().askConfirm({
    title: 'Delete row',
    message: `Delete the row “${step.name || 'Unnamed'}” and its ${plural(blocks, 'block')}? You can undo this.`,
    confirmLabel: 'Delete row',
    onConfirm: run,
  })
}
