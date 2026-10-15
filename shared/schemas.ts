import { z } from 'zod'

export const CATEGORIES = [
  'dining',
  'shopping',
  'entertainment',
  'travel',
  'subscriptions',
  'other',
] as const

export const categorySchema = z.enum(CATEGORIES)
export type Category = z.infer<typeof categorySchema>

export const STATUSES = ['skipped', 'bought'] as const
export const statusSchema = z.enum(STATUSES)
export type Status = z.infer<typeof statusSchema>

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

export const entryInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  amountCents: z.number().int().positive().max(100_000_000),
  category: categorySchema,
  note: z.string().trim().max(500).optional().nullable(),
  skippedAt: isoDate,
})
export type EntryInput = z.infer<typeof entryInputSchema>

export const entryPatchSchema = entryInputSchema.partial().extend({ status: statusSchema.optional() })

export type EntryPatch = z.infer<typeof entryPatchSchema>

export interface Entry {
  id: number
  title: string
  amountCents: number
  category: Category
  note: string | null
  skippedAt: string
  status: Status
  createdAt: string
}

export const goalInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  targetCents: z.number().int().positive().max(1_000_000_000),
})
export type GoalInput = z.infer<typeof goalInputSchema>

export interface Goal {
  name: string
  targetCents: number
  startedAt: string
}

export interface Summary {
  totalCents: number
  monthCents: number
  count: number
  topCategory: { category: Category; cents: number } | null
  goal: (Goal & { savedCents: number; percent: number; reached: boolean }) | null
}

export interface Me {
  login: string
  name: string
}
