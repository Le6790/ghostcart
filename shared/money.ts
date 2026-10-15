/** Parse a user-typed dollar amount ("12", "12.5", "$1,200.99") into integer cents. */
export function parseDollarsToCents(input: string): number | null {
  const trimmed = input.replace(/^\$/, '').trim()
  // Commas are only valid as thousands separators ("1,200.50"); "12,5" is ambiguous, so reject it.
  if (!/^(\d+|\d{1,3}(,\d{3})+)(\.\d{1,2})?$/.test(trimmed)) return null
  const cleaned = trimmed.replace(/,/g, '')
  const [whole, frac = ''] = cleaned.split('.')
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'))
}

export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)
}
