import type { Group } from '../model/types'
import { GROUP_ROW_HEIGHT, STEP_ROW_HEIGHT } from './geometry'

export interface GroupRow {
  kind: 'group'
  id: string
  name: string
  top: number
  height: number
  collapsed: boolean
  stepCount: number
}

export interface StepRow {
  kind: 'step'
  id: string
  name: string
  groupId: string
  top: number
  height: number
}

export type Row = GroupRow | StepRow

export interface RowLayout {
  /** Everything drawn, top to bottom (steps of collapsed groups are omitted). */
  rows: Row[]
  /** Visible steps, top to bottom: the rows blocks can sit on. */
  steps: StepRow[]
  stepById: Map<string, StepRow>
  height: number
}

export function layoutRows(groups: readonly Group[], collapsed: ReadonlySet<string>): RowLayout {
  const rows: Row[] = []
  const steps: StepRow[] = []
  let y = 0
  for (const g of groups) {
    const isCollapsed = collapsed.has(g.id)
    rows.push({ kind: 'group', id: g.id, name: g.name, top: y, height: GROUP_ROW_HEIGHT, collapsed: isCollapsed, stepCount: g.steps.length })
    y += GROUP_ROW_HEIGHT
    if (isCollapsed) continue
    for (const s of g.steps) {
      const row: StepRow = { kind: 'step', id: s.id, name: s.name, groupId: g.id, top: y, height: STEP_ROW_HEIGHT }
      rows.push(row)
      steps.push(row)
      y += STEP_ROW_HEIGHT
    }
  }
  return { rows, steps, stepById: new Map(steps.map((s) => [s.id, s])), height: y }
}

/** The visible step at canvas y, or the nearest one by centre when y is on a group header or outside. */
export function stepAtY(layout: RowLayout, y: number): StepRow | undefined {
  let best: StepRow | undefined
  let bestDistance = Infinity
  for (const s of layout.steps) {
    if (y >= s.top && y < s.top + s.height) return s
    const distance = Math.abs(y - (s.top + s.height / 2))
    if (distance < bestDistance) {
      best = s
      bestDistance = distance
    }
  }
  return best
}

/** The visible step whose row contains y exactly (no snapping), for clicks. */
export function stepContainingY(layout: RowLayout, y: number): StepRow | undefined {
  return layout.steps.find((s) => y >= s.top && y < s.top + s.height)
}
