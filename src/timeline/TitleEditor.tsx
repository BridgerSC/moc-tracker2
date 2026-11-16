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
      className="absolute z-40 rounded-[3px] border-2 border-white bg-[#0e0e0e] px-2 font-poppins text-[12px] font-semibold text-white outline-none"
      style={{ left, top: top + BLOCK_INSET, width: Math.max(width, 200), height: 32 }}
    />
  )
}
