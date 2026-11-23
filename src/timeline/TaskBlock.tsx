import { AlignLeft } from 'lucide-react'
import { memo, type MouseEvent, type PointerEvent } from 'react'
import type { Task } from '../model/types'
import { projectSwatch } from '../ui/color'
import { BLOCK_INSET, STEP_ROW_HEIGHT } from './geometry'

export type BlockPart = 'body' | 'start' | 'end'

interface Props {
  task: Task
  color: string
  projectName: string
  left: number
  top: number
  width: number
  selected: boolean
  onPointerDown: (e: PointerEvent, taskId: string, part: BlockPart) => void
  onRename: (taskId: string) => void
  onContextMenu: (e: MouseEvent, taskId: string) => void
}

const HEIGHT = STEP_ROW_HEIGHT - 2 * BLOCK_INSET

export const TaskBlock = memo(function TaskBlock({
  task, color, projectName, left, top, width, selected, onPointerDown, onRename, onContextMenu,
}: Props) {
  const done = task.subtasks.filter((s) => s.status === 'done').length
  const total = task.subtasks.length
  const showText = width > 40
  // Many blocks are named only by their project; then the project name is the headline.
  const headline = task.title || projectName
  const subline = task.title ? projectName : ''
  const sw = projectSwatch(color)
  // Narrow blocks still get grabbable edges, but leave some body to drag.
  const handle = Math.min(8, Math.max(3, width / 4))

  return (
    <div
      data-task-id={task.id}
      className={`group absolute flex flex-col justify-center overflow-hidden rounded-md border text-ink select-none ${
        selected ? 'z-20' : 'z-10 hover:shadow-card'
      }`}
      style={{
        left: left + 1,
        top: top + BLOCK_INSET,
        width: Math.max(4, width - 2),
        height: HEIGHT,
        background: sw.fill,
        borderColor: sw.edge,
        boxShadow: selected ? '0 0 0 2px #ffffff, 0 0 0 4px var(--color-accent)' : undefined,
      }}
      onPointerDown={(e) => onPointerDown(e, task.id, 'body')}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onRename(task.id)
      }}
      onContextMenu={(e) => onContextMenu(e, task.id)}
      title={subline ? `${headline} · ${subline}` : headline}
    >
      {showText && (
        <div className="pointer-events-none flex min-w-0 flex-col gap-0.5 px-2.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="h-[7px] w-[7px] shrink-0 rounded-[2px]" style={{ background: sw.dot }} />
            <span className="truncate text-[12px] leading-tight font-semibold">{headline}</span>
            {task.notes && width > 90 && <AlignLeft size={11} className="ml-auto shrink-0 text-ink-muted" />}
          </div>
          {(subline || total > 0) && (
            <div className="flex min-w-0 items-center gap-1.5 pl-[13px] text-[11px] leading-tight text-[#3f3f3a]">
              {subline && <span className="truncate">{subline}</span>}
              {total > 0 && width > 70 && <span className="ml-auto shrink-0 tabular-nums">{done}/{total}</span>}
            </div>
          )}
        </div>
      )}
      {total > 0 && (
        <div className="pointer-events-none absolute right-2.5 bottom-1.5 left-2.5 h-[3px] overflow-hidden rounded-full" style={{ background: sw.track }}>
          <div className="h-full rounded-full" style={{ width: `${(done / total) * 100}%`, background: sw.dot }} />
        </div>
      )}
      <div
        className="absolute inset-y-0 left-0 cursor-ew-resize rounded-l-md group-hover:bg-ink/[0.06] hover:!bg-ink/[0.12]"
        style={{ width: handle }}
        onPointerDown={(e) => onPointerDown(e, task.id, 'start')}
      />
      <div
        className="absolute inset-y-0 right-0 cursor-ew-resize rounded-r-md group-hover:bg-ink/[0.06] hover:!bg-ink/[0.12]"
        style={{ width: handle }}
        onPointerDown={(e) => onPointerDown(e, task.id, 'end')}
      />
    </div>
  )
})
