// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Tenant Settings Helper (v3.2)
// 설정 참조 우선순위: tenant_settings → DB ENUM → 하드코딩 금지
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { cacheGet, cacheSet, cacheDel } from '@/lib/redis'
import { notFound } from '@/lib/errors'
import { CACHE_TTL, DEFAULT_CORE_VALUES, DEFAULT_RATING_SCALE, DEFAULT_GRADE_LABELS, DEFAULT_BRAND_COLORS } from '@/lib/constants'
import type { CoreValue, RatingScale, GradeLabels, BrandColors } from '@/types'
import type { TenantSetting } from '@/generated/prisma/client'
import type { EnabledModule } from '@/lib/constants'

// ─── Cache key builder ───────────────────────────────────

function cacheKey(companyId: string): string {
  return `tenant_settings:${companyId}`
}

// ─── Get Tenant Settings ─────────────────────────────────

export async function getTenantSettings(companyId: string): Promise<TenantSetting> {
  // Try Redis cache first
  const cached = await cacheGet<TenantSetting>(cacheKey(companyId))
  if (cached) return cached

  // Fetch from DB
  const settings = await prisma.tenantSetting.findUnique({
    where: { companyId },
  })

  if (!settings) {
    throw notFound(`법인 설정을 찾을 수 없습니다: ${companyId}`)
  }

  // Cache for 5 minutes
  await cacheSet(cacheKey(companyId), settings, CACHE_TTL.TENANT_SETTINGS)

  return settings
}

// ─── Module Enabled Check ────────────────────────────────

export async function isModuleEnabled(
  companyId: string,
  module: string,
): Promise<boolean> {
  const settings = await getTenantSettings(companyId)
  const enabledModules = settings.enabledModules as string[] | null
  if (!enabledModules) return false
  return enabledModules.includes(module)
}

// ─── Get Core Values ─────────────────────────────────────

export async function getCoreValues(companyId: string): Promise<CoreValue[]> {
  try {
    const settings = await getTenantSettings(companyId)
    const coreValues = settings.coreValues as CoreValue[] | null
    if (coreValues && coreValues.length > 0) return coreValues
  } catch {
    // Fall through to default
  }
  return [...DEFAULT_CORE_VALUES]
}

// ─── Get Rating Scale ────────────────────────────────────

export async function getRatingScale(companyId: string): Promise<RatingScale> {
  try {
    const settings = await getTenantSettings(companyId)
    const ratingLabels = settings.ratingLabels as string[] | null
    return {
      min: settings.ratingScaleMin ?? DEFAULT_RATING_SCALE.min,
      max: settings.ratingScaleMax ?? DEFAULT_RATING_SCALE.max,
      labels: ratingLabels ?? [...DEFAULT_RATING_SCALE.labels],
    }
  } catch {
    // Fall through to default
  }
  return {
    min: DEFAULT_RATING_SCALE.min,
    max: DEFAULT_RATING_SCALE.max,
    labels: [...DEFAULT_RATING_SCALE.labels],
  }
}

// ─── Get Grade Labels ────────────────────────────────────

export async function getGradeLabels(companyId: string): Promise<GradeLabels> {
  try {
    const settings = await getTenantSettings(companyId)
    const gradeLabels = settings.gradeLabels as GradeLabels | null
    if (gradeLabels) return gradeLabels
  } catch {
    // Fall through to default
  }
  return { ...DEFAULT_GRADE_LABELS }
}

// ─── Get Brand Colors ────────────────────────────────────

export async function getBrandColors(companyId: string): Promise<BrandColors> {
  try {
    const settings = await getTenantSettings(companyId)
    return {
      primary: settings.primaryColor ?? DEFAULT_BRAND_COLORS.primary,
      secondary: settings.secondaryColor ?? DEFAULT_BRAND_COLORS.secondary,
      accent: settings.accentColor ?? DEFAULT_BRAND_COLORS.accent,
    }
  } catch {
    return { ...DEFAULT_BRAND_COLORS }
  }
}

// ─── Get Enabled Modules ─────────────────────────────────

export async function getEnabledModules(companyId: string): Promise<EnabledModule[]> {
  try {
    const settings = await getTenantSettings(companyId)
    return (settings.enabledModules as EnabledModule[] | null) ?? []
  } catch {
    return []
  }
}

// ─── Invalidate Cache ────────────────────────────────────

export async function invalidateTenantSettingsCache(companyId: string): Promise<void> {
  await cacheDel(cacheKey(companyId))
}
