/**
 * CTR HR Hub — Settings Value Accessor with Request Memoization
 *
 * Wraps the CompanyProcessSetting lookup in React's `cache()` for
 * per-request deduplication. When multiple lib functions request
 * the same setting during a single API route handler, only ONE
 * database query is executed.
 *
 * Usage:
 *   const rates = await getSettingValue<KrSocialInsurance>('PAYROLL', 'kr-social-insurance', companyId)
 *   const pensionRate = rates?.pensionRate ?? 0.045  // always ?? not ||
 */
import { cache } from 'react'
import { prisma } from '@/lib/prisma'

/**
 * Fetches a single setting value, with company→global fallback.
 * Wrapped in `cache()` for per-request deduplication (Next.js App Router).
 */
export const getSettingValue = cache(async function <T = Record<string, unknown>>(
  settingType: string,
  settingKey: string,
  companyId?: string | null,
): Promise<T | null> {
  // Try company-specific first
  if (companyId) {
    const override = await prisma.companyProcessSetting.findFirst({
      where: { settingType, settingKey, companyId },
    })
    if (override) return override.settingValue as T
  }

  // Fall back to global default
  const global = await prisma.companyProcessSetting.findFirst({
    where: { settingType, settingKey, companyId: null },
  })

  return global ? (global.settingValue as T) : null
})

/**
 * Type-safe shorthand for specific categories
 */
export async function getPayrollSetting<T = Record<string, unknown>>(
  key: string,
  companyId?: string | null,
): Promise<T | null> {
  return getSettingValue<T>('PAYROLL', key, companyId)
}

export async function getAttendanceSetting<T = Record<string, unknown>>(
  key: string,
  companyId?: string | null,
): Promise<T | null> {
  return getSettingValue<T>('ATTENDANCE', key, companyId)
}

export async function getPerformanceSetting<T = Record<string, unknown>>(
  key: string,
  companyId?: string | null,
): Promise<T | null> {
  return getSettingValue<T>('PERFORMANCE', key, companyId)
}

export async function getSystemSetting<T = Record<string, unknown>>(
  key: string,
  companyId?: string | null,
): Promise<T | null> {
  return getSettingValue<T>('SYSTEM', key, companyId)
}
