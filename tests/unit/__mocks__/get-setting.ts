// Stub for `@/lib/settings/get-setting` — bypasses React cache() + Prisma in unit tests
// All settings functions return null (fallback to hardcoded defaults in callers)

export async function getSettingValue(): Promise<null> { return null }
export async function getPayrollSetting(): Promise<null> { return null }
export async function getAttendanceSetting(): Promise<null> { return null }
export async function getPerformanceSetting(): Promise<null> { return null }
export async function getSystemSetting(): Promise<null> { return null }
export async function getOrganizationSetting(): Promise<null> { return null }
export async function getCompensationSetting(): Promise<null> { return null }
export async function getCompaRatioThresholds(): Promise<null> { return null }
export async function getContractRulesFromSettings(): Promise<null> { return null }
export async function getNudgeRulesSettings(): Promise<null> { return null }
export async function getAlertThresholdsSettings(): Promise<null> { return null }
export async function getAnalyticsThresholdsSettings(): Promise<null> { return null }
export async function getSessionConfigSettings(): Promise<null> { return null }
