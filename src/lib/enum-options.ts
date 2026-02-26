// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Dynamic Enum Options Helper (v3.2)
// UI의 모든 Select/Dropdown: tenant_enum_options API에서 옵션 로드
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { cacheGet, cacheSet, cacheDel } from '@/lib/redis'
import { CACHE_TTL } from '@/lib/constants'

// ─── Types ───────────────────────────────────────────────

export interface EnumOption {
  id: string
  enumGroup: string
  optionKey: string
  label: string
  color: string | null
  icon: string | null
  sortOrder: number
  isSystem: boolean
  isActive: boolean
}

// ─── Cache key builder ───────────────────────────────────

function cacheKey(companyId: string, enumGroup: string): string {
  return `enum_options:${companyId}:${enumGroup}`
}

// ─── Get Enum Options ────────────────────────────────────

export async function getEnumOptions(
  companyId: string,
  enumGroup: string,
): Promise<EnumOption[]> {
  // Try cache first
  const cached = await cacheGet<EnumOption[]>(cacheKey(companyId, enumGroup))
  if (cached) return cached

  // Fetch from DB: active only, sorted by sortOrder
  const options = await prisma.tenantEnumOption.findMany({
    where: {
      companyId,
      enumGroup,
      isActive: true,
    },
    orderBy: { sortOrder: 'asc' },
  })

  const mapped: EnumOption[] = options.map((opt) => ({
    id: opt.id,
    enumGroup: opt.enumGroup,
    optionKey: opt.optionKey,
    label: opt.label,
    color: opt.color,
    icon: opt.icon,
    sortOrder: opt.sortOrder,
    isSystem: opt.isSystem,
    isActive: opt.isActive,
  }))

  // Cache
  await cacheSet(cacheKey(companyId, enumGroup), mapped, CACHE_TTL.ENUM_OPTIONS)

  return mapped
}

// ─── Get All Enum Options (including inactive, for admin) ─

export async function getAllEnumOptions(
  companyId: string,
  enumGroup: string,
): Promise<EnumOption[]> {
  const options = await prisma.tenantEnumOption.findMany({
    where: {
      companyId,
      enumGroup,
    },
    orderBy: { sortOrder: 'asc' },
  })

  return options.map((opt) => ({
    id: opt.id,
    enumGroup: opt.enumGroup,
    optionKey: opt.optionKey,
    label: opt.label,
    color: opt.color,
    icon: opt.icon,
    sortOrder: opt.sortOrder,
    isSystem: opt.isSystem,
    isActive: opt.isActive,
  }))
}

// ─── Get single enum option by key ──────────────────────

export async function getEnumOptionByKey(
  companyId: string,
  enumGroup: string,
  optionKey: string,
): Promise<EnumOption | null> {
  const option = await prisma.tenantEnumOption.findFirst({
    where: {
      companyId,
      enumGroup,
      optionKey,
    },
  })

  if (!option) return null

  return {
    id: option.id,
    enumGroup: option.enumGroup,
    optionKey: option.optionKey,
    label: option.label,
    color: option.color,
    icon: option.icon,
    sortOrder: option.sortOrder,
    isSystem: option.isSystem,
    isActive: option.isActive,
  }
}

// ─── Invalidate cache ────────────────────────────────────

export async function invalidateEnumOptionsCache(
  companyId: string,
  enumGroup: string,
): Promise<void> {
  await cacheDel(cacheKey(companyId, enumGroup))
}
