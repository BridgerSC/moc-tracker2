import { Archive, ArchiveRestore, ChevronDown, ChevronRight, FolderGit2, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { createProject, removeProject } from '../app/actions'
import { parseColor } from '../model/colors'
import type { IsoDate } from '../model/dates'
import { updateProject } from '../model/structure'
import type { Project, TimelineDoc } from '../model/types'
import { docStore, selectDoc, useDoc } from '../store/docStore'
import { uiStore, useUi } from '../store/uiStore'
import { DateField, Label, PanelButton, Swatch, TextField } from './fields'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const shortDate = (d: IsoDate) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`

const apply = (recipe: (d: TimelineDoc) => TimelineDoc, coalesceKey?: string) =>
  docStore.getState().apply(recipe, coalesceKey ? { coalesceKey } : undefined)

function ProjectCard({ project, blocks, expanded }: { project: Project; blocks: number; expanded: boolean }) {
  const id = project.id
  return (
    <div className="border border-[#2a2a2a] bg-[#161616]">
      <button
        type="button"
        onClick={() => uiStore.getState().toggleProjectExpanded(id)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left font-poppins text-[11px] font-semibold tracking-[0.5px] text-white uppercase hover:bg-[#1c1c1c]"
      >
        <Swatch color={project.color} />
        <span className="min-w-0 flex-1 truncate">{project.name || 'Unnamed'}</span>
        {project.deadline && <span className="text-[9px] font-normal text-[#888]">{shortDate(project.deadline)}</span>}
        <span className="text-[9px] font-normal text-[#666]">{blocks}</span>
        {expanded ? <ChevronDown size={13} className="text-[#666]" /> : <ChevronRight size={13} className="text-[#666]" />}
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-[#2a2a2a] p-3">
          <div>
            <Label>Name</Label>
            <TextField value={project.name} coalesceKey={`project:${id}:name`} update={(d, name) => updateProject(d, id, { name })} />
          </div>
          <div>
            <Label>Deadline</Label>
            <div className="flex gap-1.5">
              <DateField value={project.deadline} onChange={(deadline) => apply((d) => updateProject(d, id, { deadline }))} />
              {project.deadline && (
                <button
                  type="button"
                  title="Clear deadline"
                  aria-label="Clear deadline"
                  onClick={() => apply((d) => updateProject(d, id, { deadline: null }))}
                  className="shrink-0 border border-[#2a2a2a] px-2 text-[#888] hover:border-[#666] hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
          <div>
            <Label>Colour</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={project.color.toLowerCase()}
                onChange={(e) => {
                  const color = parseColor(e.target.value)
                  if (color) apply((d) => updateProject(d, id, { color }), `project:${id}:color`)
                }}
                className="h-8 w-12 cursor-pointer border border-[#2a2a2a] bg-transparent p-0.5"
              />
              <span className="font-mono text-[11px] text-[#888]">{project.color}</span>
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <TextField
              multiline
              value={project.notes}
              placeholder="Links, descriptions, details…"
              coalesceKey={`project:${id}:notes`}
              update={(d, notes) => updateProject(d, id, { notes })}
            />
          </div>
          <div className="flex gap-2">
            <PanelButton title="Hide this project and its blocks" onClick={() => apply((d) => updateProject(d, id, { archived: true }))}>
              <Archive size={12} /> Archive
            </PanelButton>
            <PanelButton danger onClick={() => removeProject(id)}>
              <Trash2 size={12} /> Delete
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
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bebas text-[22px] tracking-[2px] text-[#aaa]">
          <FolderGit2 size={18} /> Projects
        </div>
        <button
          type="button"
          onClick={createProject}
          className="flex items-center gap-1 border border-[#06D6A0]/40 px-2 py-1 font-poppins text-[10px] tracking-[1px] text-[#06D6A0] uppercase hover:bg-[#06D6A0]/10"
        >
          <Plus size={12} /> Add
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {active.map((p) => (
          <ProjectCard key={p.id} project={p} blocks={counts.get(p.id) ?? 0} expanded={expanded.has(p.id)} />
        ))}
        {active.length === 0 && <div className="py-6 text-center font-poppins text-[11px] text-[#666]">No projects yet.</div>}
      </div>

      {archived.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="flex w-full items-center gap-1.5 font-poppins text-[10px] tracking-[1.5px] text-[#777] uppercase hover:text-white"
          >
            {showArchived ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Archived ({archived.length})
          </button>
          {showArchived && (
            <div className="mt-2 flex flex-col gap-1">
              {archived.map((p) => (
                <div key={p.id} className="group flex items-center gap-2 border border-[#222] px-3 py-2 font-poppins text-[11px] text-[#888]">
                  <Swatch color={p.color} />
                  <span className="min-w-0 flex-1 truncate">{p.name || 'Unnamed'}</span>
                  <button
                    type="button"
                    title="Restore"
                    aria-label="Restore"
                    onClick={() => apply((d) => updateProject(d, p.id, { archived: false }))}
                    className="text-[#666] hover:text-[#06D6A0]"
                  >
                    <ArchiveRestore size={13} />
                  </button>
                  <button
                    type="button"
                    title="Delete permanently"
                    aria-label="Delete permanently"
                    onClick={() => removeProject(p.id)}
                    className="text-[#666] hover:text-[#e05050]"
                  >
                    <Trash2 size={13} />
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
