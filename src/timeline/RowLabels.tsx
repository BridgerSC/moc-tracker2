import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import { useRef, useState, type DragEvent, type MouseEvent } from 'react'
import { copyGroup, copyStep, createStep, removeGroup, removeStep } from '../app/actions'
import { moveGroup, moveStep, renameGroup, renameStep } from '../model/structure'
import type { Group } from '../model/types'
import { docStore, selectLocked, useDoc } from '../store/docStore'
import { uiStore, useUi } from '../store/uiStore'
import type { Row, RowLayout } from './rows'

interface Props {
  layout: RowLayout
  groups: readonly Group[]
  height: number
}

type Dragging = { kind: 'group' | 'step'; id: string }
type Drop =
  | { kind: 'group'; toIndex: number; lineY: number }
  | { kind: 'step'; groupId: string; toIndex: number; lineY: number }

const rowAt = (layout: RowLayout, y: number) => layout.rows.find((r) => y >= r.top && y < r.top + r.height)

/** Bottom edge of a group's last drawn row. */
function groupBottom(layout: RowLayout, groupId: string): number {
  let bottom = 0
  for (const r of layout.rows) {
    if ((r.kind === 'group' && r.id === groupId) || (r.kind === 'step' && r.groupId === groupId)) bottom = r.top + r.height
  }
  return bottom
}

/** Where a dragged group or row would land for pointer y (null = nowhere useful). */
function computeDrop(drag: Dragging, y: number, layout: RowLayout, groups: readonly Group[]): Drop | null {
  const row = rowAt(layout, y)
  if (drag.kind === 'group') {
    const rest = groups.filter((g) => g.id !== drag.id)
    let targetId: string | undefined
    let before = false
    if (!row) targetId = rest.at(-1)?.id
    else if (row.kind === 'group') {
      targetId = row.id
      before = y < row.top + row.height / 2
    } else targetId = row.groupId
    if (!targetId || targetId === drag.id) return null
    const index = rest.findIndex((g) => g.id === targetId)
    const header = layout.rows.find((r) => r.id === targetId)!
    return { kind: 'group', toIndex: before ? index : index + 1, lineY: before ? header.top : groupBottom(layout, targetId) }
  }

  if (!row) {
    const last = groups.at(-1)
    if (!last) return null
    return { kind: 'step', groupId: last.id, toIndex: last.steps.filter((s) => s.id !== drag.id).length, lineY: groupBottom(layout, last.id) }
  }
  if (row.kind === 'group') return { kind: 'step', groupId: row.id, toIndex: 0, lineY: row.top + row.height }
  if (row.id === drag.id) return null
  const group = groups.find((g) => g.id === row.groupId)!
  const rest = group.steps.filter((s) => s.id !== drag.id)
  const before = y < row.top + row.height / 2
  const index = rest.findIndex((s) => s.id === row.id)
  return { kind: 'step', groupId: group.id, toIndex: before ? index : index + 1, lineY: before ? row.top : row.top + row.height }
}

function NameInput({ initial, onDone }: { initial: string; onDone: (name: string | null) => void }) {
  const finished = useRef(false)
  const finish = (name: string | null) => {
    if (finished.current) return
    finished.current = true
    onDone(name)
  }
  return (
    <input
      autoFocus
      defaultValue={initial}
      onFocus={(e) => e.currentTarget.select()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(e.currentTarget.value.trim())
        if (e.key === 'Escape') {
          e.stopPropagation()
          finish(null)
        }
      }}
      onBlur={(e) => finish(e.currentTarget.value.trim())}
      className="h-7 min-w-0 flex-1 rounded-md border border-accent bg-surface px-2 text-[13px] font-medium tracking-normal text-ink normal-case outline-none ring-3 ring-accent/15"
    />
  )
}

/** Row names down the left edge: rename, reorder, collapse, right-click for more. */
export function RowLabels({ layout, groups, height }: Props) {
  const renamingId = useUi((s) => s.renamingRowId)
  const locked = useDoc(selectLocked)
  const [dragging, setDragging] = useState<Dragging | null>(null)
  const [drop, setDrop] = useState<Drop | null>(null)
  const container = useRef<HTMLDivElement>(null)

  const finishRename = (row: Row, name: string | null) => {
    uiStore.getState().setRenamingRow(null)
    if (name === null || name === row.name) return
    docStore.getState().apply((d) => (row.kind === 'group' ? renameGroup(d, row.id, name) : renameStep(d, row.id, name)))
  }

  const openMenu = (e: MouseEvent, row: Row) => {
    e.preventDefault()
    if (!docStore.getState().ensureEditable()) return
    const ui = uiStore.getState()
    const rename = { label: 'Rename', onSelect: () => ui.setRenamingRow(row.id) }
    ui.openContextMenu(
      e.clientX,
      e.clientY,
      row.kind === 'group'
        ? [
            rename,
            { label: '+ Add Step', onSelect: () => createStep(row.id) },
            { label: 'Duplicate', onSelect: () => copyGroup(row.id) },
            { label: 'Delete', danger: true, divider: true, onSelect: () => removeGroup(row.id) },
          ]
        : [
            rename,
            { label: 'Duplicate', onSelect: () => copyStep(row.id) },
            { label: 'Delete', danger: true, divider: true, onSelect: () => removeStep(row.id) },
          ],
    )
  }

  const onDragStart = (e: DragEvent, row: Row) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', row.id)
    const el = (e.currentTarget as HTMLElement).closest('[data-row]')
    if (el) e.dataTransfer.setDragImage(el, 10, 10)
    setDragging({ kind: row.kind, id: row.id })
  }

  const onDragOver = (e: DragEvent) => {
    if (!dragging || !container.current) return
    e.preventDefault()
    const y = e.clientY - container.current.getBoundingClientRect().top
    const next = computeDrop(dragging, y, layout, groups)
    if (next?.lineY !== drop?.lineY || next?.kind !== drop?.kind) setDrop(next)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    if (dragging && drop) {
      const id = dragging.id
      docStore.getState().apply((d) =>
        drop.kind === 'group' ? moveGroup(d, id, drop.toIndex) : moveStep(d, id, drop.groupId, drop.toIndex),
      )
    }
    setDragging(null)
    setDrop(null)
  }

  const endDrag = () => {
    setDragging(null)
    setDrop(null)
  }

  const grip = (row: Row) => locked ? <span className="w-[14px] shrink-0" /> : (
    <span
      draggable
      onDragStart={(e) => onDragStart(e, row)}
      onDragEnd={endDrag}
      onClick={(e) => e.stopPropagation()}
      className="flex shrink-0 cursor-grab items-center text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:text-ink active:cursor-grabbing"
      title="Drag to reorder"
    >
      <GripVertical size={14} />
    </span>
  )

  return (
    <div
      ref={container}
      className="relative border-r border-line bg-surface"
      style={{ height }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={(e) => {
        if (!container.current?.contains(e.relatedTarget as Node | null)) setDrop(null)
      }}
    >
      {layout.rows.map((row) => {
        const renaming = renamingId === row.id
        const faded = dragging?.id === row.id ? 'opacity-40' : ''
        return row.kind === 'group' ? (
          <div
            key={row.id}
            data-row
            className={`group absolute inset-x-0 flex items-center gap-1 border-b border-line bg-subtle pr-2 pl-1 text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase ${faded}`}
            style={{ top: row.top, height: row.height }}
            onContextMenu={(e) => openMenu(e, row)}
          >
            {grip(row)}
            <button
              type="button"
              className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-subtle hover:bg-sunken hover:text-ink"
              onClick={() => uiStore.getState().toggleGroup(row.id)}
              title={row.collapsed ? 'Expand' : 'Collapse'}
              aria-label={row.collapsed ? 'Expand' : 'Collapse'}
            >
              {row.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
            {renaming ? (
              <NameInput initial={row.name} onDone={(name) => finishRename(row, name)} />
            ) : (
              <span
                className="min-w-0 flex-1 cursor-default truncate"
                onDoubleClick={() => docStore.getState().ensureEditable() && uiStore.getState().setRenamingRow(row.id)}
                title="Double-click to rename"
              >
                {row.name || 'Unnamed'}
              </span>
            )}
            {row.collapsed && (
              <span className="rounded-full bg-sunken px-1.5 text-[10px] font-medium tracking-normal text-ink-subtle">{row.stepCount}</span>
            )}
          </div>
        ) : (
          <div
            key={row.id}
            data-row
            className={`group absolute inset-x-0 flex items-center gap-1.5 border-b border-line bg-surface pr-2 pl-3 text-[13px] font-medium text-ink hover:bg-subtle ${faded}`}
            style={{ top: row.top, height: row.height }}
            onContextMenu={(e) => openMenu(e, row)}
          >
            {grip(row)}
            {renaming ? (
              <NameInput initial={row.name} onDone={(name) => finishRename(row, name)} />
            ) : (
              <span
                className="min-w-0 flex-1 cursor-default truncate"
                onDoubleClick={() => docStore.getState().ensureEditable() && uiStore.getState().setRenamingRow(row.id)}
                title="Double-click to rename"
              >
                {row.name || 'Unnamed'}
              </span>
            )}
          </div>
        )
      })}
      {drop && (
        <div
          className={`pointer-events-none absolute inset-x-2 z-10 h-[3px] -translate-y-1/2 rounded-full ${drop.kind === 'group' ? 'bg-accent' : 'bg-accent/70'}`}
          style={{ top: drop.lineY }}
        />
      )}
    </div>
  )
}
