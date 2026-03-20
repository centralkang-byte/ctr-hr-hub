/**
 * Track B B-1f: Worker Type Resolver — SSOT
 *
 * Determines worker type from assignment data.
 * Used by: Payroll, Leave, Performance, Attendance, Benefits modules
 * to check feature eligibility.
 *
 * Null-safe: returns 'OFFICE' as default if assignment is missing or incomplete.
 */

export type WorkerType = 'OFFICE' | 'PRODUCTION' | 'DISPATCH' | 'CONTRACT'

export function resolveWorkerType(assignment?: {
  employmentType?: string | null
  jobCategory?: { code?: string | null } | null
  contractType?: string | null
} | null): WorkerType {
  if (!assignment?.employmentType) return 'OFFICE' // Null guard — safe default

  if (assignment.employmentType === 'DISPATCH') return 'DISPATCH'
  if (assignment.employmentType === 'CONTRACT') return 'CONTRACT'

  // Within FULL_TIME, distinguish by jobCategory
  if (assignment.jobCategory?.code === 'PRODUCTION') return 'PRODUCTION'

  return 'OFFICE'
}

/**
 * Check if a worker type has a specific feature enabled.
 * Returns true by default if no setting found (fail-open for safety).
 */
export function isFeatureEnabledForWorkerType(
  workerType: WorkerType,
  feature: string,
  settings?: Record<string, boolean>
): boolean {
  if (!settings) return true // No settings loaded → default enabled
  const key = `${workerType}.${feature}`
  return settings[key] ?? true
}
