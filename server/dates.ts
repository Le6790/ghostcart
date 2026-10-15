/**
 * "Today" for the server, in a configurable timezone.
 *
 * Configure with APP_TIMEZONE (an IANA name such as America/Los_Angeles). Falls back to TZ, then the
 * machine's own zone. Stored dates are plain YYYY-MM-DD strings, so this only decides where the
 * day, month and week boundaries fall.
 */
export function timeZone(): string {
  return process.env.APP_TIMEZONE || process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function today(now = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Fail fast with a clear message if APP_TIMEZONE/TZ is not a valid IANA zone. */
export function assertTimeZone(): string {
  const tz = timeZone()
  try {
    today()
  } catch {
    throw new Error(`Invalid timezone "${tz}". Set APP_TIMEZONE to an IANA name like America/New_York.`)
  }
  return tz
}
