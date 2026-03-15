/**
 * Calculate business days between two dates (inclusive of both dates).
 * Excludes weekends (Sat/Sun). Holiday exclusion is optional.
 */
export function calculateBusinessDays(
  startDate: Date,
  endDate: Date,
  holidays: Date[] = []
): number {
  if (startDate > endDate) return 0

  let count = 0
  const current = new Date(startDate)
  const holidaySet = new Set(
    holidays.map((h) => h.toISOString().split('T')[0])
  )

  while (current <= endDate) {
    const day = current.getDay()
    const dateStr = current.toISOString().split('T')[0]

    // Skip weekends (0=Sun, 6=Sat) and holidays
    if (day !== 0 && day !== 6 && !holidaySet.has(dateStr)) {
      count++
    }

    current.setDate(current.getDate() + 1)
  }

  return count
}
