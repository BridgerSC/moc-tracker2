import { Flag } from 'lucide-react'
import type { PointerEvent } from 'react'
import { toDayNumber } from '../model/dates'
import type { Project } from '../model/types'
import { projectSwatch } from '../ui/color'
import { DEADLINE_LANE_HEIGHT, RULER_HEIGHT, dayToX, type Scale } from './geometry'
import type { Tick } from './ticks'

interface Props {
  scale: Scale
  width: number
  ticks: Tick[]
  /** Set at day zoom: each tick is one day this wide. */
  tickWidth: number | null
  todayDay: number
  nowDay: number
  projects: Project[]
  showFlagNames: boolean
  onFlagPointerDown: (e: PointerEvent, projectId: string) => void
}

/** The sticky band above the canvas: date ruler plus the deadline lane. */
export function TimelineHeader({
  scale, width, ticks, tickWidth, todayDay, nowDay, projects, showFlagNames, onFlagPointerDown,
}: Props) {
  return (
    <div className="relative bg-surface" style={{ width, height: RULER_HEIGHT + DEADLINE_LANE_HEIGHT }}>
      <div className="relative overflow-hidden border-b border-line" style={{ height: RULER_HEIGHT }}>
        {ticks.map((t) => {
          const left = dayToX(scale, t.day)
          if (tickWidth === null) {
            // Week / month / year ticks: one label each.
            return (
              <div
                key={t.day}
                className={`absolute top-0 flex h-full items-end border-l border-line px-2 pb-2.5 text-[12px] whitespace-nowrap ${
                  t.major ? 'font-semibold text-ink' : 'text-ink-muted'
                }`}
                style={{ left }}
              >
                {t.label}
              </div>
            )
          }
          // Day ticks: weekday (or month on the 1st) above the date number.
          const isToday = t.day === todayDay
          const [top, num] = t.label.includes(' ') ? t.label.split(' ') : [t.sub ?? '', t.label]
          const topText = t.label.includes(' ') ? top : tickWidth > 48 ? top : top?.slice(0, 1)
          return (
            <div
              key={t.day}
              className="absolute top-0 flex h-full flex-col items-center justify-end gap-1 pb-2"
              style={{ left, width: tickWidth }}
            >
              <span className={`text-[10px] leading-none font-medium ${t.major ? 'text-ink' : 'text-ink-subtle'}`}>
                {topText}
              </span>
              <span
                className={`flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1 text-[12px] leading-none ${
                  isToday ? 'bg-accent font-semibold text-white' : t.major ? 'font-semibold text-ink' : 'text-ink-muted'
                }`}
              >
                {num}
              </span>
            </div>
          )
        })}
        {tickWidth === null && <div className="absolute top-0 bottom-0 w-[2px] bg-accent" style={{ left: dayToX(scale, nowDay) - 1 }} />}
      </div>
      <div className="relative overflow-hidden border-b border-line" style={{ height: DEADLINE_LANE_HEIGHT }}>
        {projects.map((p) => {
          if (!p.deadline) return null
          // The flag sits at the end of the (inclusive) deadline day.
          const x = dayToX(scale, toDayNumber(p.deadline) + 1)
          const sw = projectSwatch(p.color)
          return (
            <div
              key={p.id}
              role="button"
              tabIndex={-1}
              className="absolute top-2 flex h-6 -translate-x-full cursor-ew-resize items-center gap-1.5 rounded-full border px-2 text-[11px] font-medium whitespace-nowrap text-ink"
              style={{ left: x, background: sw.fill, borderColor: sw.edge }}
              title={`${p.name || 'Unnamed'} deadline: ${p.deadline} (drag to move, click for details)`}
              onPointerDown={(e) => onFlagPointerDown(e, p.id)}
            >
              <Flag size={11} strokeWidth={2.4} />
              {showFlagNames && <span className="max-w-[160px] truncate">{p.name || 'Unnamed'}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
