import { describe, expect, it } from 'vitest'
import { fromDayNumber, isoDate, toDayNumber } from '../model/dates'
import type { Group } from '../model/types'
import { layoutRows, stepAtY, stepContainingY } from './rows'
import { computeTicks, tickInterval, weekendDays } from './ticks'

const groups: Group[] = [
  { id: 'g1', name: 'Pre', steps: [{ id: 's1', name: 'A' }, { id: 's2', name: 'B' }] },
  { id: 'g2', name: 'Prod', steps: [{ id: 's3', name: 'C' }] },
]

describe('layoutRows', () => {
  it('stacks group headers (36) and steps (68)', () => {
    const layout = layoutRows(groups, new Set())
    expect(layout.rows.map((r) => [r.id, r.top])).toEqual([
      ['g1', 0], ['s1', 36], ['s2', 104], ['g2', 172], ['s3', 208],
    ])
    expect(layout.height).toBe(276)
  })

  it('omits steps of collapsed groups', () => {
    const layout = layoutRows(groups, new Set(['g1']))
    expect(layout.steps.map((s) => s.id)).toEqual(['s3'])
    expect(layout.rows.map((r) => [r.id, r.top])).toEqual([['g1', 0], ['g2', 36], ['s3', 72]])
  })

  it('finds the step under a point, snapping from headers', () => {
    const layout = layoutRows(groups, new Set())
    expect(stepAtY(layout, 110)?.id).toBe('s2')
    expect(stepAtY(layout, 180)?.id).toBe('s2') // on g2 header (172–208): s2's centre (138) is nearer than s3's (242)
    expect(stepAtY(layout, 200)?.id).toBe('s3')
    expect(stepAtY(layout, -50)?.id).toBe('s1')
    expect(stepContainingY(layout, 10)).toBeUndefined()
  })
})

describe('ticks', () => {
  const day = (s: string) => toDayNumber(isoDate(s))

  it('picks an interval from the zoom level', () => {
    expect([1, 0.5, 0.1, 0.02].map(tickInterval)).toEqual(['day', 'week', 'month', 'year'])
  })

  it('labels days, marking the 1st as major', () => {
    const ticks = computeTicks(1, day('2026-10-31'), day('2026-11-02'), true)
    expect(ticks.map((t) => [t.label, t.sub, t.major])).toEqual([
      ['31', 'SAT', false],
      ['NOV 1', 'SUN', true],
      ['2', 'MON', false],
    ])
  })

  it('aligns weeks to Mondays', () => {
    const ticks = computeTicks(0.5, day('2026-11-18'), day('2026-12-01'), false)
    expect(ticks.map((t) => fromDayNumber(t.day))).toEqual(['2026-11-16', '2026-11-23', '2026-11-30'])
  })

  it('labels months and years, starting with the one already in progress', () => {
    expect(computeTicks(0.1, day('2026-11-15'), day('2027-02-01'), false).map((t) => t.label)).toEqual([
      "NOV '26", "DEC '26", "JAN '27", "FEB '27",
    ])
    expect(computeTicks(0.02, day('2026-06-01'), day('2028-03-01'), false).map((t) => t.label)).toEqual([
      '2026', '2027', '2028',
    ])
  })

  it('lists weekend days', () => {
    expect(weekendDays(day('2026-11-16'), day('2026-11-23')).map(fromDayNumber)).toEqual(['2026-11-21', '2026-11-22'])
  })
})
