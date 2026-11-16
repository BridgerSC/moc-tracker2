import { PartyPopper } from 'lucide-react'
import { toDayNumber } from '../model/dates'
import type { Project } from '../model/types'
import { DEADLINE_LANE_HEIGHT, RULER_HEIGHT, dayToX, type Scale } from './geometry'
import type { Tick } from './ticks'

interface Props {
  scale: Scale
  width: number
  ticks: Tick[]
  tickWidth: number | null
  todayDay: number
  nowDay: number
  projects: Project[]
  showFlagNames: boolean
}

/** The sticky band above the canvas: date ruler plus the deadline lane. */
export function TimelineHeader({ scale, width, ticks, tickWidth, todayDay, nowDay, projects, showFlagNames }: Props) {
  return (
    <div className="relative" style={{ width, height: RULER_HEIGHT + DEADLINE_LANE_HEIGHT }}>
      <div className="relative overflow-hidden border-b border-[#2a2a2a] bg-[#161616]" style={{ height: RULER_HEIGHT }}>
        {ticks.map((t) => {
          const isToday = tickWidth !== null && t.day === todayDay
          return (
            <div
              key={t.day}
              className={`absolute top-0 flex h-full flex-col justify-center border-l px-1.5 text-[9px] leading-tight tracking-[1px] whitespace-nowrap uppercase ${
                t.major ? 'border-[#555] font-bold text-white' : 'border-[#2a2a2a] text-[#888]'
              } ${isToday ? 'bg-[#EF476F]/25 text-white' : ''}`}
              style={{ left: dayToX(scale, t.day), width: tickWidth ?? undefined }}
            >
              <span>{t.label}</span>
              {t.sub && <span className="text-[8px] font-normal opacity-60">{t.sub}</span>}
            </div>
          )
        })}
        <div className="absolute top-0 bottom-0 w-[2px] bg-red-500" style={{ left: dayToX(scale, nowDay) - 1 }}>
          <div className="absolute top-0 -left-[4px] border-x-[5px] border-t-[6px] border-x-transparent border-t-red-500" />
        </div>
      </div>
      <div className="relative overflow-hidden border-b border-[#2a2a2a] bg-[#0e0e0e]" style={{ height: DEADLINE_LANE_HEIGHT }}>
        {projects.map((p) => {
          if (!p.deadline) return null
          // The line marks the end of the (inclusive) deadline day.
          const x = dayToX(scale, toDayNumber(p.deadline) + 1)
          return (
            <div key={p.id} className="absolute top-0 bottom-0" style={{ left: x }}>
              <div className="absolute top-0 bottom-0 w-[2px] -translate-x-1/2 opacity-80" style={{ background: p.color }} />
              <div
                className="absolute top-2 flex -translate-x-1/2 items-center gap-1 rounded-full px-2 py-1 font-poppins text-[9px] font-semibold whitespace-nowrap text-[#0e0e0e] uppercase"
                style={{ background: p.color }}
                title={`${p.name || 'Unnamed'} deadline: ${p.deadline}`}
              >
                <PartyPopper size={11} />
                {showFlagNames && <span className="max-w-[140px] truncate">{p.name || 'Unnamed'}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
