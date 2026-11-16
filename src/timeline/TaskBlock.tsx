import { AlignLeft } from 'lucide-react'
import { memo, type PointerEvent } from 'react'
import type { Task } from '../model/types'
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
}

const HEIGHT = STEP_ROW_HEIGHT - 2 * BLOCK_INSET

export const TaskBlock = memo(function TaskBlock({
  task, color, projectName, left, top, width, selected, onPointerDown, onRename,
}: Props) {
  const done = task.subtasks.filter((s) => s.status === 'done').length
  const total = task.subtasks.length
  const showText = width > 40
  // Many blocks are named only by their project; then the project name is the headline.
  const headline = task.title || projectName
  const subline = task.title ? projectName : ''
  // Narrow blocks still get grabbable edges, but leave some body to drag.
  const handle = Math.min(10, Math.max(3, width / 4))

  return (
    <div
      data-task-id={task.id}
      className={`absolute overflow-hidden rounded-[3px] font-poppins text-[#0e0e0e] select-none ${
        selected ? 'z-20 outline-2 outline-white' : 'z-10'
      }`}
      style={{ left, top: top + BLOCK_INSET, width: Math.max(4, width), height: HEIGHT, background: color }}
      onPointerDown={(e) => onPointerDown(e, task.id, 'body')}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onRename(task.id)
      }}
      title={subline ? `${headline} · ${subline}` : headline}
    >
      {showText && (
        <div className="pointer-events-none flex h-full flex-col justify-center px-2.5 pb-1">
          <div className="truncate text-[11px] leading-tight font-semibold">{headline}</div>
          {subline && <div className="truncate text-[9px] leading-tight opacity-70">{subline}</div>}
        </div>
      )}
      {total > 0 && (
        <>
          <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-[3px] bg-black/20">
            <div className="h-full bg-black/60" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          {width > 70 && (
            <div className="pointer-events-none absolute right-2 bottom-1 text-[8px] font-semibold opacity-70">
              {done}/{total}
            </div>
          )}
        </>
      )}
      {task.notes && width > 50 && (
        <AlignLeft size={10} className="pointer-events-none absolute top-1.5 right-2 opacity-60" />
      )}
      <div
        className="absolute inset-y-0 left-0 cursor-ew-resize hover:bg-white/30"
        style={{ width: handle }}
        onPointerDown={(e) => onPointerDown(e, task.id, 'start')}
      />
      <div
        className="absolute inset-y-0 right-0 cursor-ew-resize hover:bg-white/30"
        style={{ width: handle }}
        onPointerDown={(e) => onPointerDown(e, task.id, 'end')}
      />
    </div>
  )
})
