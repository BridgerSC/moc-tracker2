import type { ReactNode } from 'react'
import { parseIsoDate, type IsoDate } from '../model/dates'
import type { TimelineDoc } from '../model/types'
import { docStore } from '../store/docStore'

// Form controls bound straight to the document. Text edits are applied on every
// keystroke (so the timeline updates live) but coalesce into one undo step per
// field; leaving the field closes that step.

export const inputClass =
  'w-full border border-[#2a2a2a] bg-[#0e0e0e] px-2 py-1.5 font-poppins text-[12px] text-[#e8e8e8] outline-none transition-colors focus:border-[#666]'

export function Label({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 font-poppins text-[9px] tracking-[1.5px] text-[#777] uppercase">
      {icon}
      {children}
    </div>
  )
}

interface TextFieldProps {
  value: string
  /** Builds the new document for a value. */
  update: (doc: TimelineDoc, value: string) => TimelineDoc
  /** Identifies the field for undo coalescing, e.g. `task:t1:title`. */
  coalesceKey: string
  placeholder?: string
  multiline?: boolean
  autoFocus?: boolean
}

export function TextField({ value, update, coalesceKey, placeholder, multiline, autoFocus }: TextFieldProps) {
  const onChange = (next: string) => docStore.getState().apply((d) => update(d, next), { coalesceKey })
  const onBlur = () => docStore.getState().seal()
  return multiline ? (
    <textarea
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      autoFocus={autoFocus}
      rows={5}
      className={`${inputClass} brutal-scroll min-h-[100px] resize-y leading-relaxed`}
    />
  ) : (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      autoFocus={autoFocus}
      className={inputClass}
    />
  )
}

export function DateField({ value, onChange }: { value: IsoDate | null; onChange: (date: IsoDate) => void }) {
  return (
    <input
      type="date"
      value={value ?? ''}
      onChange={(e) => {
        const date = parseIsoDate(e.target.value)
        if (date) onChange(date)
      }}
      className={`${inputClass} [color-scheme:dark]`}
    />
  )
}

export function PanelButton({
  children, onClick, danger, title,
}: { children: ReactNode; onClick: () => void; danger?: boolean; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 border px-2 py-2 font-poppins text-[10px] tracking-[1px] uppercase transition-colors ${
        danger
          ? 'border-[#3a1a1a] text-[#c05050] hover:border-[#e05050] hover:text-[#e05050]'
          : 'border-[#2a2a2a] text-[#aaa] hover:border-[#666] hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

export function Swatch({ color }: { color: string }) {
  return <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: color }} />
}
