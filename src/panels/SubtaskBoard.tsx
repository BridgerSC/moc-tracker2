import { ChevronDown, ChevronUp, ListChecks, Plus, X } from 'lucide-react'
import { useRef, useState, type DragEvent, type MouseEvent } from 'react'
import { newId } from '../model/ids'
import { addSubtask, deleteSubtask, duplicateSubtask, moveSubtask, updateSubtask } from '../model/structure'
import { SUBTASK_STATUSES, type Subtask, type SubtaskStatus, type Task, type TimelineDoc } from '../model/types'
import { docStore, selectDoc, selectLocked, useDoc } from '../store/docStore'
import { uiStore, useUi } from '../store/uiStore'
import { STATUS_STYLES } from '../ui/styles'

const COLUMN_NAMES: Record<SubtaskStatus, string> = { todo: 'To do', progress: 'In progress', done: 'Done' }

const apply = (recipe: (d: TimelineDoc) => TimelineDoc) => docStore.getState().apply(recipe)

/** Multi-line card editor: Enter saves, Shift+Enter adds a line, Esc cancels. */
function CardEditor({ initial, onDone }: { initial: string; onDone: (title: string | null) => void }) {
  const finished = useRef(false)
  const finish = (title: string | null) => {
    if (finished.current) return
    finished.current = true
    onDone(title)
  }
  return (
    <textarea
      autoFocus
      defaultValue={initial}
      rows={2}
      placeholder="What needs doing?"
      aria-label="Sub-task"
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          finish(e.currentTarget.value.trim())
        } else if (e.key === 'Escape') {
          e.stopPropagation()
          finish(null)
        }
      }}
      onBlur={(e) => finish(e.currentTarget.value.trim())}
      className="w-full resize-none rounded-md border border-accent bg-surface px-2.5 py-2 text-[12px] text-ink shadow-card outline-none ring-3 ring-accent/15 placeholder:text-ink-subtle"
    />
  )
}

function Board({ task, locked }: { task: Task; locked: boolean }) {
  const editingId = useUi((s) => s.editingSubtaskId)
  const [draft, setDraft] = useState<SubtaskStatus | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [drop, setDrop] = useState<{ status: SubtaskStatus; index: number } | null>(null)
  const columnRefs = useRef<Partial<Record<SubtaskStatus, HTMLDivElement | null>>>({})

  const finishEdit = (card: Subtask, title: string | null) => {
    uiStore.getState().setEditingSubtask(null)
    if (title === null || title === card.title) return
    // Emptying a card deletes it.
    apply((d) => (title === '' ? deleteSubtask(d, task.id, card.id) : updateSubtask(d, task.id, card.id, { title })))
  }

  const finishDraft = (status: SubtaskStatus, title: string | null) => {
    setDraft(null)
    if (title) apply((d) => addSubtask(d, task.id, { id: newId('st'), title, status }))
  }

  const openMenu = (e: MouseEvent, card: Subtask) => {
    e.preventDefault()
    const ui = uiStore.getState()
    ui.openContextMenu(e.clientX, e.clientY, [
      { label: 'Rename', onSelect: () => ui.setEditingSubtask(card.id) },
      { label: 'Duplicate', onSelect: () => apply((d) => duplicateSubtask(d, task.id, card.id)) },
      { label: 'Delete', danger: true, divider: true, onSelect: () => apply((d) => deleteSubtask(d, task.id, card.id)) },
    ])
  }

  const onDragOver = (e: DragEvent, status: SubtaskStatus) => {
    if (!dragId) return
    e.preventDefault()
    const cards = [...(columnRefs.current[status]?.querySelectorAll<HTMLElement>('[data-card]') ?? [])].filter(
      (el) => el.dataset.card !== dragId,
    )
    let index = cards.length
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i]!.getBoundingClientRect()
      if (e.clientY < r.top + r.height / 2) {
        index = i
        break
      }
    }
    if (drop?.status !== status || drop.index !== index) setDrop({ status, index })
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    if (dragId && drop) apply((d) => moveSubtask(d, task.id, dragId, drop.status, drop.index))
    setDragId(null)
    setDrop(null)
  }

  return (
    <div className="grid h-full grid-cols-3 gap-3 px-4 pb-4">
      {SUBTASK_STATUSES.map((status) => {
        const cards = task.subtasks.filter((s) => s.status === status)
        const shown = cards.filter((c) => c.id !== dragId)
        const tone = STATUS_STYLES[status]
        const placeholder = <div className="h-[3px] shrink-0 rounded-full bg-accent" />
        return (
          <div
            key={status}
            ref={(el) => {
              columnRefs.current[status] = el
            }}
            className="flex min-h-0 flex-col rounded-lg bg-sunken"
            onDragOver={(e) => onDragOver(e, status)}
            onDrop={onDrop}
          >
            <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5 text-[12px] font-medium text-ink-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: tone.edge }} />
              {COLUMN_NAMES[status]}
              <span className="text-ink-subtle tabular-nums">{cards.length}</span>
            </div>
            <div className="paper-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-2">
              {shown.map((card, i) => (
                <div key={card.id} className="contents">
                  {drop?.status === status && drop.index === i && placeholder}
                  {editingId === card.id ? (
                    <CardEditor initial={card.title} onDone={(title) => finishEdit(card, title)} />
                  ) : (
                    <div
                      data-card={card.id}
                      draggable={!locked}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', card.id)
                        setDragId(card.id)
                      }}
                      onDragEnd={() => {
                        setDragId(null)
                        setDrop(null)
                      }}
                      onDoubleClick={() => !locked && uiStore.getState().setEditingSubtask(card.id)}
                      onContextMenu={(e) => (locked ? e.preventDefault() : openMenu(e, card))}
                      className={`group relative rounded-md border border-line bg-surface px-2.5 py-2 pr-7 text-[12px] leading-snug whitespace-pre-wrap shadow-card ${
                        locked ? '' : 'cursor-grab hover:border-line-strong'
                      } ${status === 'done' ? 'text-ink-subtle line-through' : 'text-ink'}`}
                    >
                      {card.title || <span className="text-ink-subtle italic">Untitled</span>}
                      <button
                        type="button"
                        aria-label="Delete sub-task"
                        title="Delete"
                        onClick={() => apply((d) => deleteSubtask(d, task.id, card.id))}
                        className="absolute top-1.5 right-1.5 hidden h-5 w-5 cursor-pointer items-center justify-center rounded text-ink-subtle group-hover:flex hover:bg-danger-soft hover:text-danger"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {drop?.status === status && drop.index >= shown.length && placeholder}
              {draft === status ? (
                <CardEditor initial="" onDone={(title) => finishDraft(status, title)} />
              ) : (
                !locked && (
                  <button
                    type="button"
                    onClick={() => setDraft(status)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] text-ink-subtle hover:bg-surface hover:text-ink"
                  >
                    <Plus size={13} /> Add
                  </button>
                )
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Sub-task board for the selected block, docked under the timeline. */
export function SubtaskBoard() {
  const doc = useDoc(selectDoc)
  const selection = useUi((s) => s.selection)
  const open = useUi((s) => s.boardOpen)
  const locked = useDoc(selectLocked)
  const task = selection.size === 1 ? doc.tasks.find((t) => selection.has(t.id)) : undefined
  if (!task) return null
  const done = task.subtasks.filter((s) => s.status === 'done').length
  const total = task.subtasks.length

  return (
    <section aria-label="Sub-tasks" className="flex shrink-0 flex-col border-t border-line bg-surface" style={{ height: open ? 272 : 44 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => uiStore.getState().setBoardOpen(!open)}
        className="flex h-11 shrink-0 cursor-pointer items-center gap-2.5 px-4 text-left hover:bg-subtle"
      >
        <ListChecks size={15} className="text-ink-subtle" />
        <span className="text-[13px] font-semibold">Sub-tasks</span>
        <span className="truncate text-[13px] text-ink-subtle">{task.title || 'Untitled block'}</span>
        <span className="ml-auto flex items-center gap-2 text-[12px] text-ink-subtle tabular-nums">
          {total > 0 && (
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-sunken">
              <span className="block h-full rounded-full bg-ok" style={{ width: `${(done / total) * 100}%` }} />
            </span>
          )}
          {done}/{total} done
        </span>
        {open ? <ChevronDown size={15} className="text-ink-subtle" /> : <ChevronUp size={15} className="text-ink-subtle" />}
      </button>
      {open && (
        <fieldset disabled={locked} className="m-0 min-h-0 min-w-0 flex-1 border-0 p-0">
          <Board key={task.id} task={task} locked={locked} />
        </fieldset>
      )}
    </section>
  )
}
