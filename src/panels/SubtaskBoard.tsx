import { ChevronDown, ChevronUp, ListChecks, Plus, X } from 'lucide-react'
import { useRef, useState, type DragEvent, type MouseEvent } from 'react'
import { newId } from '../model/ids'
import { addSubtask, deleteSubtask, duplicateSubtask, moveSubtask, updateSubtask } from '../model/structure'
import { SUBTASK_STATUSES, type Subtask, type SubtaskStatus, type Task, type TimelineDoc } from '../model/types'
import { docStore, selectDoc, useDoc } from '../store/docStore'
import { uiStore, useUi } from '../store/uiStore'

const COLUMN_NAMES: Record<SubtaskStatus, string> = { todo: 'To Do', progress: 'In Progress', done: 'Done' }
const COLUMN_COLORS: Record<SubtaskStatus, string> = { todo: '#888', progress: '#118AB2', done: '#06D6A0' }

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
      className="w-full resize-none border border-[#A06CD5] bg-[#0e0e0e] px-2 py-1.5 font-poppins text-[11px] text-white outline-none"
    />
  )
}

function Board({ task }: { task: Task }) {
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
    <div className="grid h-full grid-cols-3 gap-3 p-3">
      {SUBTASK_STATUSES.map((status) => {
        const cards = task.subtasks.filter((s) => s.status === status)
        const shown = cards.filter((c) => c.id !== dragId)
        const placeholder = <div className="h-[3px] shrink-0 rounded bg-[#06D6A0]" />
        return (
          <div
            key={status}
            ref={(el) => {
              columnRefs.current[status] = el
            }}
            className="flex min-h-0 flex-col border border-[#2a2a2a] bg-[#111]"
            onDragOver={(e) => onDragOver(e, status)}
            onDrop={onDrop}
          >
            <div className="flex items-center justify-between border-b border-[#2a2a2a] px-3 py-2 font-poppins text-[10px] tracking-[1.5px] uppercase" style={{ color: COLUMN_COLORS[status] }}>
              <span>{COLUMN_NAMES[status]}</span>
              <span className="text-[#666]">{cards.length}</span>
            </div>
            <div className="brutal-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-2">
              {shown.map((card, i) => (
                <div key={card.id} className="contents">
                  {drop?.status === status && drop.index === i && placeholder}
                  {editingId === card.id ? (
                    <CardEditor initial={card.title} onDone={(title) => finishEdit(card, title)} />
                  ) : (
                    <div
                      data-card={card.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', card.id)
                        setDragId(card.id)
                      }}
                      onDragEnd={() => {
                        setDragId(null)
                        setDrop(null)
                      }}
                      onDoubleClick={() => uiStore.getState().setEditingSubtask(card.id)}
                      onContextMenu={(e) => openMenu(e, card)}
                      className={`group relative cursor-grab border border-[#2a2a2a] bg-[#1a1a1a] px-2.5 py-2 pr-6 font-poppins text-[11px] leading-snug whitespace-pre-wrap text-[#ddd] hover:border-[#444] ${
                        status === 'done' ? 'text-[#888] line-through' : ''
                      }`}
                    >
                      {card.title || <span className="text-[#555] italic">Untitled</span>}
                      <button
                        type="button"
                        aria-label="Delete sub-task"
                        title="Delete"
                        onClick={() => apply((d) => deleteSubtask(d, task.id, card.id))}
                        className="absolute top-1.5 right-1.5 hidden text-[#666] group-hover:block hover:text-[#e05050]"
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
                <button
                  type="button"
                  onClick={() => setDraft(status)}
                  className="flex items-center gap-1 px-1 py-1 font-poppins text-[10px] tracking-[1px] text-[#555] uppercase hover:text-[#06D6A0]"
                >
                  <Plus size={11} /> Add
                </button>
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
  const task = selection.size === 1 ? doc.tasks.find((t) => selection.has(t.id)) : undefined
  if (!task) return null
  const done = task.subtasks.filter((s) => s.status === 'done').length

  return (
    <section className="flex shrink-0 flex-col border-t border-[#2a2a2a] bg-[#0e0e0e]" style={{ height: open ? 280 : 36 }}>
      <button
        type="button"
        onClick={() => uiStore.getState().setBoardOpen(!open)}
        className="flex h-9 shrink-0 items-center gap-2 px-4 text-left font-poppins text-[10px] tracking-[1.5px] text-[#888] uppercase hover:bg-[#161616]"
      >
        <ListChecks size={13} />
        <span>Sub-tasks</span>
        <span className="truncate text-white normal-case">{task.title || 'Untitled'}</span>
        <span className="ml-auto border border-[#2a2a2a] px-1.5 py-0.5 text-[9px]">
          {done} / {task.subtasks.length} done
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
      {open && (
        <div className="min-h-0 flex-1">
          <Board key={task.id} task={task} />
        </div>
      )}
    </section>
  )
}
