import { Archive, ArchiveRestore, ChevronDown, ChevronRight, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { createProject, removeProject } from '../app/actions'
import { parseColor } from '../model/colors'
import type { IsoDate } from '../model/dates'
import { updateProject } from '../model/structure'
import type { Project, TimelineDoc } from '../model/types'
import { docStore, selectDoc, useDoc } from '../store/docStore'
import { uiStore, useUi } from '../store/uiStore'
import { btn, iconBtn } from '../ui/styles'
import { DateField, Label, PanelButton, Swatch, TextField } from './fields'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortDate = (d: IsoDate) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`

const apply = (recipe: (d: TimelineDoc) => TimelineDoc, coalesceKey?: string) =>
  docStore.getState().apply(recipe, coalesceKey ? { coalesceKey } : undefined)

function ProjectCard({ project, blocks, expanded }: { project: Project; blocks: number; expanded: boolean }) {
  const id = project.id
  const toggle = () => uiStore.getState().toggleProjectExpanded(id)
  return (
    <div className={`rounded-lg border bg-surface transition-colors ${expanded ? 'border-line-strong shadow-card' : 'border-line'}`}>
      {/* Not a <button>, so it still works inside the view-only (disabled) fieldset. */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={toggle}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle()}
        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 hover:bg-subtle"
      >
        <Swatch color={project.color} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{project.name || 'Unnamed'}</span>
        {project.deadline && <span className="text-[12px] text-ink-subtle tabular-nums">{shortDate(project.deadline)}</span>}
        <span className="min-w-5 rounded-full bg-sunken px-1.5 text-center text-[11px] text-ink-subtle tabular-nums">{blocks}</span>
        {expanded ? <ChevronDown size={14} className="text-ink-subtle" /> : <ChevronRight size={14} className="text-ink-subtle" />}
      </div>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-line px-3 pt-3 pb-3.5">
          <div>
            <Label>Name</Label>
            <TextField value={project.name} ariaLabel="Project name" coalesceKey={`project:${id}:name`} update={(d, name) => updateProject(d, id, { name })} />
          </div>
          <div>
            <Label>Deadline</Label>
            <div className="flex gap-1.5">
              <DateField ariaLabel="Deadline" value={project.deadline} onChange={(deadline) => apply((d) => updateProject(d, id, { deadline }))} />
              {project.deadline && (
                <button
                  type="button"
                  title="Clear deadline"
                  aria-label="Clear deadline"
                  onClick={() => apply((d) => updateProject(d, id, { deadline: null }))}
                  className={iconBtn}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div>
            <Label>Colour</Label>
            <label className="flex w-fit cursor-pointer items-center gap-2.5 rounded-md border border-line py-1 pr-3 pl-1 hover:border-line-strong">
              <input
                type="color"
                aria-label="Project colour"
                value={project.color.toLowerCase()}
                onChange={(e) => {
                  const color = parseColor(e.target.value)
                  if (color) apply((d) => updateProject(d, id, { color }), `project:${id}:color`)
                }}
                className="h-6 w-6 cursor-pointer rounded-[4px] border-0 bg-transparent p-0"
              />
              <span className="font-mono text-[12px] text-ink-muted">{project.color}</span>
            </label>
          </div>
          <div>
            <Label>Notes</Label>
            <TextField
              multiline
              value={project.notes}
              placeholder="Links, descriptions, details…"
              ariaLabel="Project notes"
              coalesceKey={`project:${id}:notes`}
              update={(d, notes) => updateProject(d, id, { notes })}
            />
          </div>
          <div className="flex gap-2">
            <PanelButton title="Hide this project and its blocks" onClick={() => apply((d) => updateProject(d, id, { archived: true }))}>
              <Archive size={14} /> Archive
            </PanelButton>
            <PanelButton danger onClick={() => removeProject(id)}>
              <Trash2 size={14} /> Delete
            </PanelButton>
          </div>
        </div>
      )}
    </div>
  )
}

export function ProjectsPanel() {
  const doc = useDoc(selectDoc)
  const expanded = useUi((s) => s.expandedProjects)
  const [showArchived, setShowArchived] = useState(false)
  const counts = new Map<string, number>()
  for (const t of doc.tasks) if (t.projectId) counts.set(t.projectId, (counts.get(t.projectId) ?? 0) + 1)
  const active = doc.projects.filter((p) => !p.archived)
  const archived = doc.projects.filter((p) => p.archived)

  return (
    <div className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="m-0 text-[15px] font-semibold">
          Projects <span className="font-normal text-ink-subtle">{active.length}</span>
        </h2>
        <button type="button" onClick={createProject} className={btn('secondary', 'sm')}>
          <Plus size={14} /> New
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {active.map((p) => (
          <ProjectCard key={p.id} project={p} blocks={counts.get(p.id) ?? 0} expanded={expanded.has(p.id)} />
        ))}
        {active.length === 0 && <div className="py-8 text-center text-[13px] text-ink-subtle">No projects yet.</div>}
      </div>

      {archived.length > 0 && (
        <div className="mt-6">
          <div
            role="button"
            tabIndex={0}
            aria-expanded={showArchived}
            onClick={() => setShowArchived((v) => !v)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setShowArchived((v) => !v)}
            className="flex w-fit cursor-pointer items-center gap-1.5 rounded-md py-1 pr-2 text-[12px] font-medium text-ink-muted hover:text-ink"
          >
            {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Archived · {archived.length}
          </div>
          {showArchived && (
            <div className="mt-2 flex flex-col gap-1">
              {archived.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] text-ink-muted hover:bg-subtle">
                  <Swatch color={p.color} />
                  <span className="min-w-0 flex-1 truncate">{p.name || 'Unnamed'}</span>
                  <button
                    type="button"
                    title="Restore"
                    aria-label={`Restore ${p.name || 'project'}`}
                    onClick={() => apply((d) => updateProject(d, p.id, { archived: false }))}
                    className={`${iconBtn} h-7 w-7`}
                  >
                    <ArchiveRestore size={14} />
                  </button>
                  <button
                    type="button"
                    title="Delete permanently"
                    aria-label={`Delete ${p.name || 'project'}`}
                    onClick={() => removeProject(p.id)}
                    className={`${iconBtn} h-7 w-7 hover:text-danger`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
