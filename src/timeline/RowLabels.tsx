import { ChevronDown, ChevronRight } from 'lucide-react'
import type { RowLayout } from './rows'

interface Props {
  layout: RowLayout
  height: number
  onToggleGroup: (groupId: string) => void
}

/** Row names down the left edge. (Editing and reordering arrive in milestone 3.) */
export function RowLabels({ layout, height, onToggleGroup }: Props) {
  return (
    <div className="relative border-r border-[#2a2a2a] bg-[#0e0e0e]" style={{ height }}>
      {layout.rows.map((row) =>
        row.kind === 'group' ? (
          <button
            key={row.id}
            type="button"
            className="absolute inset-x-0 flex items-center gap-1.5 border-b border-[#2a2a2a] bg-[#161616] px-2 text-left font-poppins text-[11px] font-semibold tracking-[1px] text-[#A06CD5] uppercase hover:bg-[#1c1c1c]"
            style={{ top: row.top, height: row.height }}
            onClick={() => onToggleGroup(row.id)}
            title={row.collapsed ? 'Expand' : 'Collapse'}
          >
            {row.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            <span className="truncate">{row.name || 'Unnamed'}</span>
            {row.collapsed && <span className="ml-auto text-[9px] font-normal text-[#666]">{row.stepCount}</span>}
          </button>
        ) : (
          <div
            key={row.id}
            className="absolute inset-x-0 flex items-center border-b border-[#2a2a2a] pr-2 pl-7 font-poppins text-[12px] text-[#e8e8e8]"
            style={{ top: row.top, height: row.height }}
          >
            <span className="truncate">{row.name || 'Unnamed'}</span>
          </div>
        ),
      )}
    </div>
  )
}
