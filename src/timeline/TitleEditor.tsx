import { useRef } from 'react'
import { BLOCK_INSET } from './geometry'

interface Props {
  initial: string
  left: number
  top: number
  width: number
  onCommit: (title: string) => void
  onCancel: () => void
}

/** Inline title input drawn over a block. Wide enough to type in even when the block is tiny. */
export function TitleEditor({ initial, left, top, width, onCommit, onCancel }: Props) {
  const finished = useRef(false)
  const finish = (fn: () => void) => {
    if (finished.current) return
    finished.current = true
    fn()
  }

  return (
    <input
      autoFocus
      defaultValue={initial}
      placeholder="Block title"
      onFocus={(e) => e.currentTarget.select()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(() => onCommit(e.currentTarget.value.trim()))
        else if (e.key === 'Escape') {
          e.stopPropagation()
          finish(onCancel)
        }
      }}
      onBlur={(e) => finish(() => onCommit(e.currentTarget.value.trim()))}
      className="absolute z-40 rounded-md border border-accent bg-surface px-2.5 text-[13px] font-medium text-ink shadow-pop outline-none ring-3 ring-accent/15 placeholder:text-ink-subtle"
      style={{ left, top: top + BLOCK_INSET + 10, width: Math.max(width, 220), height: 34 }}
    />
  )
}
