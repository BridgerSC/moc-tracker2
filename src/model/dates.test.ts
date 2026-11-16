import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetween,
  endDate,
  fromDayNumber,
  isoDate,
  isWeekend,
  legacyOffsetToDate,
  localToday,
  nowAsDayNumber,
  parseIsoDate,
  toDayNumber,
  weekday,
} from './dates'

describe('test environment', () => {
  it('runs in a daylight-saving time zone', () => {
    // Denver: UTC-6 in summer, UTC-7 in winter.
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(360)
    expect(new Date(2026, 11, 1).getTimezoneOffset()).toBe(420)
  })
})

describe('parseIsoDate', () => {
  it('accepts real calendar dates', () => {
    expect(parseIsoDate('2026-11-16')).toBe('2026-11-16')
    expect(parseIsoDate('2028-02-29')).toBe('2028-02-29')
  })

  it.each([
    '2026-02-30',
    '2027-02-29',
    '2026-13-01',
    '2026-1-5',
    '2026-11-16T00:00:00Z',
    '0999-01-01',
    '',
    'tomorrow',
  ])('rejects %j', (value) => {
    expect(parseIsoDate(value)).toBeNull()
  })

  it('rejects non-strings', () => {
    expect(parseIsoDate(20261116)).toBeNull()
    expect(parseIsoDate(null)).toBeNull()
  })

  it('isoDate throws on invalid input', () => {
    expect(() => isoDate('2026-02-30')).toThrow(RangeError)
  })
})

describe('day numbers', () => {
  it('counts from 1970-01-01', () => {
    expect(toDayNumber(isoDate('1970-01-01'))).toBe(0)
    expect(toDayNumber(isoDate('1970-01-02'))).toBe(1)
    expect(fromDayNumber(-1)).toBe('1969-12-31')
  })

  it('round-trips every day across several years, including DST changes', () => {
    const first = toDayNumber(isoDate('2025-01-01'))
    const last = toDayNumber(isoDate('2029-12-31'))
    for (let n = first; n <= last; n++) {
      expect(toDayNumber(fromDayNumber(n))).toBe(n)
    }
  })

  it('rejects fractional day numbers', () => {
    expect(() => fromDayNumber(1.5)).toThrow(RangeError)
  })
})

describe('date arithmetic', () => {
  it('adds days across month, year and DST boundaries', () => {
    expect(addDays(isoDate('2026-10-31'), 2)).toBe('2026-11-02') // across the Nov 1 DST change
    expect(addDays(isoDate('2027-03-13'), 2)).toBe('2027-03-15') // across the Mar 14 DST change
    expect(addDays(isoDate('2026-12-31'), 1)).toBe('2027-01-01')
    expect(addDays(isoDate('2026-03-01'), -1)).toBe('2026-02-28')
  })

  it('measures whole days between dates', () => {
    expect(daysBetween(isoDate('2026-05-01'), isoDate('2026-11-16'))).toBe(199)
    expect(daysBetween(isoDate('2026-11-16'), isoDate('2026-05-01'))).toBe(-199)
  })

  it('endDate is inclusive', () => {
    expect(endDate(isoDate('2026-11-16'), 1)).toBe('2026-11-16')
    expect(endDate(isoDate('2026-11-16'), 5)).toBe('2026-11-20')
  })

  it('knows weekdays and weekends', () => {
    expect(weekday(isoDate('2026-11-16'))).toBe(1) // Monday
    expect(isWeekend(isoDate('2026-11-21'))).toBe(true) // Saturday
    expect(isWeekend(isoDate('2026-11-22'))).toBe(true) // Sunday
    expect(isWeekend(isoDate('2026-11-23'))).toBe(false)
  })
})

describe('local clock', () => {
  it('localToday uses the local wall-clock date', () => {
    // 23:30 local on Nov 16 is already Nov 17 in UTC; the local date must win.
    expect(localToday(new Date(2026, 10, 16, 23, 30))).toBe('2026-11-16')
    expect(localToday(new Date(2026, 10, 16, 0, 0))).toBe('2026-11-16')
  })

  it('nowAsDayNumber is the day number plus the fraction of the local day', () => {
    const base = toDayNumber(isoDate('2026-11-16'))
    expect(nowAsDayNumber(new Date(2026, 10, 16, 0, 0))).toBe(base)
    expect(nowAsDayNumber(new Date(2026, 10, 16, 12, 0))).toBe(base + 0.5)
  })

  it('nowAsDayNumber handles the 25-hour day when DST ends', () => {
    // Nov 1 2026 in Denver has 25 hours (1:00–2:00 happens twice), so halfway
    // (12.5 h elapsed) is 11:30 on the wall clock, not 12:30.
    const base = toDayNumber(isoDate('2026-11-01'))
    expect(nowAsDayNumber(new Date(2026, 10, 1, 11, 30))).toBeCloseTo(base + 0.5, 10)
    expect(nowAsDayNumber(new Date(2026, 10, 1, 12, 30))).toBeCloseTo(base + 13.5 / 25, 10)
  })
})

describe('legacy (v4.8) offsets', () => {
  it('converts offsets from 2026-05-01', () => {
    expect(legacyOffsetToDate(0)).toBe('2026-05-01')
    expect(legacyOffsetToDate(-2)).toBe('2026-04-29')
  })

  it('does not reproduce the v4.8 one-day-early winter bug', () => {
    // v4.8 displayed offset 199 as 2026-11-15 in Denver.
    expect(legacyOffsetToDate(199)).toBe('2026-11-16')
    expect(legacyOffsetToDate(185)).toBe('2026-11-02')
  })
})
