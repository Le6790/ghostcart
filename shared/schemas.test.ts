import { describe, expect, it } from 'vitest'
import { entryInputSchema, entryPatchSchema, goalInputSchema } from './schemas.ts'

const valid = { title: 'Sushi', amountCents: 4500, category: 'dining', skippedAt: '2026-10-01' }

describe('entryInputSchema', () => {
  it('accepts a valid entry and trims the title', () => {
    expect(entryInputSchema.parse({ ...valid, title: '  Sushi ' }).title).toBe('Sushi')
  })

  it('accepts an optional or null note', () => {
    expect(entryInputSchema.safeParse({ ...valid, note: null }).success).toBe(true)
    expect(entryInputSchema.safeParse({ ...valid, note: 'nice' }).success).toBe(true)
  })

  it.each([
    ['empty title', { title: '   ' }],
    ['long title', { title: 'x'.repeat(121) }],
    ['zero amount', { amountCents: 0 }],
    ['negative amount', { amountCents: -1 }],
    ['fractional amount', { amountCents: 1.5 }],
    ['huge amount', { amountCents: 100_000_001 }],
    ['bad category', { category: 'gambling' }],
    ['bad date', { skippedAt: '10/01/2026' }],
    ['long note', { note: 'x'.repeat(501) }],
  ])('rejects %s', (_name, override) => {
    expect(entryInputSchema.safeParse({ ...valid, ...override }).success).toBe(false)
  })
})

describe('entryPatchSchema', () => {
  it('allows partial updates but still validates fields', () => {
    expect(entryPatchSchema.safeParse({ title: 'New' }).success).toBe(true)
    expect(entryPatchSchema.safeParse({}).success).toBe(true)
    expect(entryPatchSchema.safeParse({ amountCents: -1 }).success).toBe(false)
  })
})

describe('goalInputSchema', () => {
  it('validates name and target', () => {
    expect(goalInputSchema.safeParse({ name: 'Trip', targetCents: 100 }).success).toBe(true)
    expect(goalInputSchema.safeParse({ name: '', targetCents: 100 }).success).toBe(false)
    expect(goalInputSchema.safeParse({ name: 'Trip', targetCents: 0 }).success).toBe(false)
    expect(goalInputSchema.safeParse({ name: 'Trip', targetCents: 1.5 }).success).toBe(false)
  })
})
