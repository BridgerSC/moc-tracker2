import { Copy, MousePointerClick, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { deleteBlocks, duplicateBlocks } from '../app/actions'
import { FALLBACK_COLOR } from '../model/colors'
import { daysBetween, endDate } from '../model/dates'
import { deleteTasks, updateTask } from '../model/edits'
import { orphanTasks, updateTasks } from '../model/structure'
import type { Project, Task, TimelineDoc } from '../model/types'
import { docStore, selectDoc, useDoc } from '../store/docStore'
import { useUi } from '../store/uiStore'
import { btn, input } from '../ui/styles'
import { DateField, Divider, Label, PanelButton, Swatch, TextField } from './fields'

const apply = (recipe: (d: TimelineDoc) => TimelineDoc) => docStore.getState().apply(recipe)

function ProjectPicker({ projects, currentId, onPick }: { projects: Project[]; currentId: string | null | undefined; onPick: (id: string | null) => void }) {
  // Archived projects are only offered if a block already uses one.
  const options = projects.filter((p) => !p.archived || p.id === currentId)
  const row = (key: string, color: string, name: string, active: boolean, onClick: () => void) => (
    <button
      key={key}
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
        active ? 'bg-accent-soft font-medium text-accent-ink' : 'text-ink hover:bg-subtle'
      }`}
    >
      <Swatch color={color} />
      <span className="truncate">{name}</span>
    </button>
  )
  return (
    <div className="paper-scroll flex max-h-52 flex-col gap-0.5 overflow-y-auto rounded-md border border-line p-1">
      {options.map((p) => row(p.id, p.color, `${p.name || 'Unnamed'}${p.archived ? ' (archived)' : ''}`, p.id === currentId, () => onPick(p.id)))}
      {row('none', FALLBACK_COLOR, 'No project', currentId === null, () => onPick(null))}
    </div>
  )
}

function SingleBlock({ task, doc }: { task: Task; doc: TimelineDoc }) {
  const end = endDate(task.start, task.duration)
  const project = doc.projects.find((p) => p.id === task.projectId)
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.04em] text-ink-subtle uppercase">
          <Swatch color={project?.color ?? FALLBACK_COLOR} size={8} />
          {project?.name || 'No project'}
        </span>
        <TextField
          value={task.title}
          placeholder="Untitled block"
          ariaLabel="Block title"
          coalesceKey={`task:${task.id}:title`}
          update={(d, title) => updateTask(d, task.id, { title })}
        />
      </div>

      <div>
        <Label>Dates · {task.duration} day{task.duration === 1 ? '' : 's'}</Label>
        <div className="grid grid-cols-2 gap-2">
          <DateField ariaLabel="Start date" value={task.start} onChange={(start) => apply((d) => updateTask(d, task.id, { start }))} />
          <DateField
            ariaLabel="End date"
            value={end}
            onChange={(newEnd) => apply((d) => updateTask(d, task.id, { duration: Math.max(1, daysBetween(task.start, newEnd) + 1) }))}
          />
        </div>
      </div>

      <div>
        <Label>Row</Label>
        <select
          aria-label="Row"
          value={task.stepId}
          onChange={(e) => apply((d) => updateTask(d, task.id, { stepId: e.target.value }))}
          className={`${input} cursor-pointer`}
        >
          {doc.groups.map((g) => (
            <optgroup key={g.id} label={g.name || 'Unnamed'}>
              {g.steps.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || 'Unnamed'}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div>
        <Label>Project</Label>
        <ProjectPicker projects={doc.projects} currentId={task.projectId} onPick={(projectId) => apply((d) => updateTask(d, task.id, { projectId }))} />
      </div>

      <div>
        <Label>Notes</Label>
        <TextField
          multiline
          value={task.notes}
          placeholder="Links, details…"
          ariaLabel="Notes"
          coalesceKey={`task:${task.id}:notes`}
          update={(d, notes) => updateTask(d, task.id, { notes })}
        />
      </div>

      <Divider />
      <div className="flex gap-2">
        <PanelButton onClick={() => duplicateBlocks([task.id])}>
          <Copy size={14} /> Duplicate
        </PanelButton>
        <PanelButton danger onClick={() => deleteBlocks(new Set([task.id]))}>
          <Trash2 size={14} /> Delete
        </PanelButton>
      </div>
    </div>
  )
}

function ManyBlocks({ ids, doc }: { ids: ReadonlySet<string>; doc: TimelineDoc }) {
  const [title, setTitle] = useState('')
  const selected = doc.tasks.filter((t) => ids.has(t.id))
  const projectIds = new Set(selected.map((t) => t.projectId))
  const shared = projectIds.size === 1 ? [...projectIds][0] : undefined
  const applyTitle = () => apply((d) => updateTasks(d, ids, { title: title.trim() }))

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label>Set title for all</Label>
        <div className="flex gap-2">
          <input
            value={title}
            placeholder="New title"
            aria-label="Title for all selected blocks"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyTitle()}
            className={input}
          />
          <button type="button" onClick={applyTitle} className={btn('secondary')}>
            Apply
          </button>
        </div>
      </div>
      <div>
        <Label>Project for all</Label>
        <ProjectPicker projects={doc.projects} currentId={shared} onPick={(projectId) => apply((d) => updateTasks(d, ids, { projectId }))} />
      </div>
      <Divider />
      <div className="flex gap-2">
        <PanelButton onClick={() => duplicateBlocks(ids)}>
          <Copy size={14} /> Duplicate all
        </PanelButton>
        <PanelButton danger onClick={() => deleteBlocks(ids)}>
          <Trash2 size={14} /> Delete all
        </PanelButton>
      </div>
    </div>
  )
}

function NothingSelected({ doc }: { doc: TimelineDoc }) {
  const orphans = orphanTasks(doc)
  return (
    <div className="flex flex-col items-center gap-3 pt-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sunken text-ink-subtle">
        <MousePointerClick size={18} />
      </div>
      <div className="text-[13px] font-medium text-ink">No block selected</div>
      <div className="max-w-[220px] text-[12px] leading-relaxed text-ink-subtle">Click a block to see its details, or double-click a row to create one.</div>
      {orphans.length > 0 && (
        <div className="mt-6 w-full rounded-lg border border-warn/30 bg-warn-soft p-3 text-left">
          <div className="mb-2.5 text-[12px] leading-relaxed text-warn-ink">
            {orphans.length} block{orphans.length === 1 ? ' is' : 's are'} on rows that no longer exist and can’t be shown.
          </div>
          <PanelButton danger onClick={() => apply((d) => deleteTasks(d, new Set(orphans.map((t) => t.id))))}>
            <Trash2 size={14} /> Delete them
          </PanelButton>
        </div>
      )}
    </div>
  )
}

export function Inspector() {
  const doc = useDoc(selectDoc)
  const selection = useUi((s) => s.selection)
  const selected = doc.tasks.filter((t) => selection.has(t.id))

  return (
    <div className="p-5">
      {selected.length > 1 && <h2 className="m-0 mb-5 text-[15px] font-semibold">{selected.length} blocks selected</h2>}
      {selected.length === 1 ? (
        <SingleBlock key={selected[0]!.id} task={selected[0]!} doc={doc} />
      ) : selected.length > 1 ? (
        <ManyBlocks ids={new Set(selected.map((t) => t.id))} doc={doc} />
      ) : (
        <NothingSelected doc={doc} />
      )}
    </div>
  )
}
