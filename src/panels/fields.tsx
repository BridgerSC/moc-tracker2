import type { ReactNode } from 'react'
import { parseIsoDate, type IsoDate } from '../model/dates'
import type { TimelineDoc } from '../model/types'
import { docStore } from '../store/docStore'
import { btn, input, textarea } from '../ui/styles'

// Form controls bound straight to the document. Text edits are applied on every
// keystroke (so the timeline updates live) but coalesce into one undo step per
// field; leaving the field closes that step.

export function Label({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-ink-muted">
      {icon && <span className="text-ink-subtle">{icon}</span>}
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
  ariaLabel?: string
}

export function TextField({ value, update, coalesceKey, placeholder, multiline, autoFocus, ariaLabel }: TextFieldProps) {
  const onChange = (next: string) => docStore.getState().apply((d) => update(d, next), { coalesceKey })
  const onBlur = () => docStore.getState().seal()
  return multiline ? (
    <textarea
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      autoFocus={autoFocus}
      rows={5}
      className={textarea}
    />
  ) : (
    <input
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      autoFocus={autoFocus}
      className={input}
    />
  )
}

export function DateField({ value, onChange, ariaLabel }: { value: IsoDate | null; onChange: (date: IsoDate) => void; ariaLabel?: string }) {
  return (
    <input
      type="date"
      value={value ?? ''}
      aria-label={ariaLabel}
      onChange={(e) => {
        const date = parseIsoDate(e.target.value)
        if (date) onChange(date)
      }}
      className={`${input} tabular-nums`}
    />
  )
}

export function PanelButton({
  children, onClick, danger, title,
}: { children: ReactNode; onClick: () => void; danger?: boolean; title?: string }) {
  return (
    <button type="button" title={title} onClick={onClick} className={`${btn(danger ? 'danger' : 'secondary')} flex-1`}>
      {children}
    </button>
  )
}

export function Swatch({ color, size = 10 }: { color: string; size?: number }) {
  return <span className="shrink-0 rounded-[3px]" style={{ background: color, width: size, height: size }} />
}

export function Divider() {
  return <div className="h-px shrink-0 bg-line" />
}
