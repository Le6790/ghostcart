import { describe, expect, it } from 'vitest'
import { formatCents, parseDollarsToCents } from './money.ts'

describe('parseDollarsToCents', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12.50', 1250],
    ['0.99', 99],
    ['$1,200.99', 120099],
    [' 7 ', 700],
    ['0', 0],
    ['19.99', 1999],
  ])('parses %s', (input, cents) => {
    expect(parseDollarsToCents(input)).toBe(cents)
  })

  it.each(['', 'abc', '-5', '1.234', '1.', '.5', '1e3', '12,5'])('rejects %j', (input) => {
    expect(parseDollarsToCents(input)).toBeNull()
  })
})

describe('formatCents', () => {
  it('formats USD', () => {
    expect(formatCents(123456)).toBe('$1,234.56')
    expect(formatCents(5)).toBe('$0.05')
    expect(formatCents(0)).toBe('$0.00')
  })
})
