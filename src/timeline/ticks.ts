import { fromDayNumber, toDayNumber, weekday, type IsoDate } from '../model/dates'

export type TickInterval = 'day' | 'week' | 'month' | 'year'

export interface Tick {
  day: number
  label: string
  /** Weekday label, shown under day ticks when there is room. */
  sub?: string
  major: boolean
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export function tickInterval(zoom: number): TickInterval {
  if (zoom <= 0.03) return 'year'
  if (zoom <= 0.15) return 'month'
  if (zoom <= 0.6) return 'week'
  return 'day'
}

const parts = (d: IsoDate) => ({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)), d: Number(d.slice(8, 10)) })
const dayOf = (y: number, m: number, d: number) => toDayNumber(fromDayNumberSafe(y, m, d))
// Builds a date from parts that may overflow (e.g. month 13), via UTC normalisation.
const fromDayNumberSafe = (y: number, m: number, d: number) => fromDayNumber(Date.UTC(y, m - 1, d) / 86_400_000)

/** Ticks for days in [firstDay, lastDay]. */
export function computeTicks(zoom: number, firstDay: number, lastDay: number, withWeekdays: boolean): Tick[] {
  const interval = tickInterval(zoom)
  const ticks: Tick[] = []
  const start = parts(fromDayNumber(firstDay))

  if (interval === 'day') {
    for (let day = firstDay; day <= lastDay; day++) {
      const date = fromDayNumber(day)
      const { m, d } = parts(date)
      ticks.push({
        day,
        label: d === 1 ? `${MONTHS[m - 1]} 1` : String(d),
        sub: withWeekdays ? WEEKDAYS[weekday(date)] : undefined,
        major: d === 1,
      })
    }
  } else if (interval === 'week') {
    // Monday on or before firstDay.
    let day = firstDay - ((weekday(fromDayNumber(firstDay)) + 6) % 7)
    for (; day <= lastDay; day += 7) {
      const { m, d } = parts(fromDayNumber(day))
      ticks.push({ day, label: `${MONTHS[m - 1]} ${d}`, major: d <= 7 })
    }
  } else if (interval === 'month') {
    for (let { y, m } = start; ; m++) {
      const day = dayOf(y, m, 1)
      if (day > lastDay) break
      const { y: yy, m: mm } = parts(fromDayNumber(day))
      ticks.push({ day, label: `${MONTHS[mm - 1]} '${String(yy).slice(2)}`, major: mm === 1 })
    }
  } else {
    for (let y = start.y; ; y++) {
      const day = dayOf(y, 1, 1)
      if (day > lastDay) break
      ticks.push({ day, label: String(y), major: true })
    }
  }
  return ticks
}

/** Saturdays and Sundays in [firstDay, lastDay]. */
export function weekendDays(firstDay: number, lastDay: number): number[] {
  const out: number[] = []
  for (let day = firstDay; day <= lastDay; day++) {
    const wd = weekday(fromDayNumber(day))
    if (wd === 0 || wd === 6) out.push(day)
  }
  return out
}
