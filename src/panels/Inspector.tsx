import { Clock, Copy, FolderOpen, Rows3, SquareDashedMousePointer, Trash2, Type, Zap } from 'lucide-react'
import { useState } from 'react'
import { deleteBlocks, duplicateBlocks } from '../app/actions'
import { FALLBACK_COLOR } from '../model/colors'
import { daysBetween, endDate } from '../model/dates'
import { deleteTasks, updateTask } from '../model/edits'
import { orphanTasks, updateTasks } from '../model/structure'
import type { Project, Task, TimelineDoc } from '../model/types'
import { docStore, selectDoc, useDoc } from '../store/docStore'
import { useUi } from '../store/uiStore'
import { DateField, Label, PanelButton, Swatch, TextField, inputClass } from './fields'

const apply = (recipe: (d: TimelineDoc) => TimelineDoc) => docStore.getState().apply(recipe)

function ProjectPicker({ projects, currentId, onPick }: { projects: Project[]; currentId: string | null | undefined; onPick: (id: string | null) => void }) {
  // Archived projects are only offered if a block already uses one.
  const options = projects.filter((p) => !p.archived || p.id === currentId)
  const row = (key: string, color: string, name: string, active: boolean, onClick: () => void) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 border px-3 py-2 text-left font-poppins text-[11px] transition-colors ${
        active ? 'border-[#888] bg-[#222] text-white' : 'border-[#2a2a2a] bg-[#161616] text-[#ccc] hover:border-[#444]'
      }`}
    >
      <Swatch color={color} />
      <span className="truncate">{name}</span>
    </button>
  )
  return (
    <div className="brutal-scroll flex max-h-48 flex-col gap-1 overflow-y-auto">
      {options.map((p) => row(p.id, p.color, `${p.name || 'Unnamed'}${p.archived ? ' (archived)' : ''}`, p.id === currentId, () => onPick(p.id)))}
      {row('none', FALLBACK_COLOR, 'No project', currentId === null, () => onPick(null))}
    </div>
  )
}

function SingleBlock({ task, doc }: { task: Task; doc: TimelineDoc }) {
  const end = endDate(task.start, task.duration)
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Label icon={<Type size={11} />}>Block title</Label>
        <TextField
          value={task.title}
          placeholder="Untitled"
          coalesceKey={`task:${task.id}:title`}
          update={(d, title) => updateTask(d, task.id, { title })}
        />
      </div>
      <div>
        <Label icon={<FolderOpen size={11} />}>Project</Label>
        <ProjectPicker projects={doc.projects} currentId={task.projectId} onPick={(projectId) => apply((d) => updateTask(d, task.id, { projectId }))} />
      </div>
      <div>
        <Label icon={<Rows3 size={11} />}>Row</Label>
        <select
          value={task.stepId}
          onChange={(e) => apply((d) => updateTask(d, task.id, { stepId: e.target.value }))}
          className={`${inputClass} [color-scheme:dark]`}
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
        <Label icon={<Clock size={11} />}>Timing · {task.duration} day{task.duration === 1 ? '' : 's'}</Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <DateField value={task.start} onChange={(start) => apply((d) => updateTask(d, task.id, { start }))} />
            <div className="mt-1 text-center font-poppins text-[9px] tracking-[1px] text-[#666] uppercase">Start</div>
          </div>
          <div>
            <DateField
              value={end}
              onChange={(newEnd) => apply((d) => updateTask(d, task.id, { duration: Math.max(1, daysBetween(task.start, newEnd) + 1) }))}
            />
            <div className="mt-1 text-center font-poppins text-[9px] tracking-[1px] text-[#666] uppercase">End</div>
          </div>
        </div>
      </div>
      <div>
        <Label>Notes</Label>
        <TextField
          multiline
          value={task.notes}
          placeholder="Links, details…"
          coalesceKey={`task:${task.id}:notes`}
          update={(d, notes) => updateTask(d, task.id, { notes })}
        />
      </div>
      <div className="flex gap-2">
        <PanelButton onClick={() => duplicateBlocks([task.id])}>
          <Copy size={12} /> Duplicate
        </PanelButton>
        <PanelButton danger onClick={() => deleteBlocks(new Set([task.id]))}>
          <Trash2 size={12} /> Delete
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
      <div className="font-poppins text-[13px] text-white">{selected.length} blocks selected</div>
      <div>
        <Label icon={<Type size={11} />}>Set title for all</Label>
        <div className="flex gap-1.5">
          <input
            value={title}
            placeholder="New title"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyTitle()}
            className={inputClass}
          />
          <button
            type="button"
            onClick={applyTitle}
            className="shrink-0 border border-[#2a2a2a] px-3 font-poppins text-[10px] text-[#aaa] uppercase hover:border-[#666] hover:text-white"
          >
            Apply
          </button>
        </div>
      </div>
      <div>
        <Label icon={<FolderOpen size={11} />}>Assign project to all</Label>
        <ProjectPicker projects={doc.projects} currentId={shared} onPick={(projectId) => apply((d) => updateTasks(d, ids, { projectId }))} />
      </div>
      <div className="flex gap-2">
        <PanelButton onClick={() => duplicateBlocks(ids)}>
          <Copy size={12} /> Duplicate all
        </PanelButton>
        <PanelButton danger onClick={() => deleteBlocks(ids)}>
          <Trash2 size={12} /> Delete all
        </PanelButton>
      </div>
    </div>
  )
}

function NothingSelected({ doc }: { doc: TimelineDoc }) {
  const orphans = orphanTasks(doc)
  return (
    <div className="flex flex-col items-center gap-4 pt-10 text-center">
      <Zap size={24} className="text-[#555]" />
      <div className="font-poppins text-[11px] leading-relaxed text-[#777]">
        No block selected.
        <br />
        Click a block, or double-click a row to create one.
      </div>
      {orphans.length > 0 && (
        <div className="mt-6 w-full border border-[#3a1a1a] p-3 text-left">
          <div className="mb-2 font-poppins text-[11px] text-[#e0a040]">
            {orphans.length} block{orphans.length === 1 ? ' is' : 's are'} on rows that no longer exist and can’t be shown.
          </div>
          <PanelButton danger onClick={() => apply((d) => deleteTasks(d, new Set(orphans.map((t) => t.id))))}>
            <Trash2 size={12} /> Delete them
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
      <div className="mb-5 flex items-center gap-2 font-bebas text-[22px] tracking-[2px] text-[#aaa]">
        {selected.length > 1 ? <SquareDashedMousePointer size={18} /> : <Zap size={18} />}
        {selected.length > 1 ? 'Bulk edit' : 'Inspect block'}
      </div>
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
