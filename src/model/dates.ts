// Calendar dates for the timeline.
//
// Dates are stored as ISO calendar strings ("2026-11-16") and all arithmetic is
// done on whole "day numbers" (days since 1970-01-01) computed with UTC math.
// Nothing here depends on the local time zone, so daylight-saving changes can
// never shift a date. (v4.8 added 24h multiples to a local-midnight epoch and
// showed every winter date one day early.)
//
// Only `localToday` and `nowAsDayNumber` read the local clock, because "today"
// is inherently local.

declare const isoDateBrand: unique symbol

/** A validated "YYYY-MM-DD" calendar date. Create with `parseIsoDate` / `isoDate`. */
export type IsoDate = string & { readonly [isoDateBrand]: true }

const MS_PER_DAY = 86_400_000
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

const pad = (n: number, width: number) => String(n).padStart(width, '0')

function format(year: number, month: number, day: number): IsoDate {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}` as IsoDate
}

/** Returns the value as an IsoDate if it is a real calendar date (year 1000–9999), else null. */
export function parseIsoDate(value: unknown): IsoDate | null {
  if (typeof value !== 'string') return null
  const match = ISO_DATE_RE.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1000) return null
  const check = new Date(Date.UTC(year, month - 1, day))
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null
  }
  return value as IsoDate
}

/** Like `parseIsoDate` but throws on invalid input. Handy for literals and tests. */
export function isoDate(value: string): IsoDate {
  const parsed = parseIsoDate(value)
  if (!parsed) throw new RangeError(`Not a valid calendar date: ${JSON.stringify(value)}`)
  return parsed
}

/** Whole days since 1970-01-01. */
export function toDayNumber(date: IsoDate): number {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  return Date.UTC(year, month - 1, day) / MS_PER_DAY
}

/** Inverse of `toDayNumber`. */
export function fromDayNumber(dayNumber: number): IsoDate {
  if (!Number.isInteger(dayNumber)) throw new RangeError(`Day number must be an integer, got ${dayNumber}`)
  const d = new Date(dayNumber * MS_PER_DAY)
  return format(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromDayNumber(toDayNumber(date) + days)
}

/** Signed number of days from `from` to `to` (0 when equal). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toDayNumber(to) - toDayNumber(from)
}

/** Last day covered by a block that starts on `start` and lasts `duration` days (inclusive). */
export function endDate(start: IsoDate, duration: number): IsoDate {
  return addDays(start, duration - 1)
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: IsoDate): number {
  return new Date(toDayNumber(date) * MS_PER_DAY).getUTCDay()
}

export function isWeekend(date: IsoDate): boolean {
  const wd = weekday(date)
  return wd === 0 || wd === 6
}

/** Today's date on the local wall clock. */
export function localToday(now: Date = new Date()): IsoDate {
  return format(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/**
 * The current moment as a fractional day number, for the "now" line.
 * The fraction is measured against the real length of today (23 or 25 hours on
 * daylight-saving change days), so the line reaches the next day exactly at
 * local midnight.
 */
export function nowAsDayNumber(now: Date = new Date()): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const fraction = (now.getTime() - midnight.getTime()) / (nextMidnight.getTime() - midnight.getTime())
  return toDayNumber(localToday(now)) + fraction
}

/** v4.8 stored dates as whole-day offsets from this date. */
export const LEGACY_EPOCH: IsoDate = isoDate('2026-05-01')

/** Converts a v4.8 day offset to a calendar date. */
export function legacyOffsetToDate(offset: number): IsoDate {
  return addDays(LEGACY_EPOCH, Math.round(offset))
}
