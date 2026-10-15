import { describe, expect, it } from 'vitest'
import { localToday } from './dates.ts'

describe('localToday', () => {
  it('uses local calendar fields, zero-padded', () => {
    expect(localToday(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(localToday(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31')
  })
})
