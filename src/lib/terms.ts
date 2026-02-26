// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Term Override Helper (v3.2)
// 하드코딩 텍스트 금지 → getTermLabel() 사용
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { TermKey } from '@/lib/constants'

// ─── Default Terms (Korean) ──────────────────────────────

export const DEFAULT_TERMS: Record<TermKey, string> = {
  department: '부서',
  job_grade: '직급',
  employee_code: '사번',
  manager: '직속 상사',
  team: '팀',
  position: '직책',
  recognition: '칭찬/인정',
  one_on_one: '1:1 미팅',
  goal: '목표',
  evaluation: '평가',
  leave: '휴가',
  onboarding: '온보딩',
  offboarding: '퇴직',
  discipline: '징계/상벌',
}

// ─── In-memory cache: Map<companyId, Map<termKey, label>> ─

const termCache = new Map<string, Map<string, string>>()
const cacheTTL = 5 * 60 * 1000 // 5 minutes
const cacheTimestamps = new Map<string, number>()

function isCacheValid(companyId: string): boolean {
  const timestamp = cacheTimestamps.get(companyId)
  if (!timestamp) return false
  return Date.now() - timestamp < cacheTTL
}

// ─── Load term overrides for a company ───────────────────

async function loadTermOverrides(companyId: string): Promise<Map<string, string>> {
  const overrides = await prisma.termOverride.findMany({
    where: { companyId },
  })

  const map = new Map<string, string>()
  for (const override of overrides) {
    // Use labelKo as primary label (Korean default)
    map.set(override.termKey, override.labelKo)
  }

  termCache.set(companyId, map)
  cacheTimestamps.set(companyId, Date.now())

  return map
}

// ─── Get term label ──────────────────────────────────────

export async function getTermLabel(
  companyId: string,
  key: TermKey,
  _locale?: string,
): Promise<string> {
  // Check cache first
  if (isCacheValid(companyId)) {
    const cached = termCache.get(companyId)
    if (cached?.has(key)) {
      return cached.get(key)!
    }
  } else {
    // Reload cache
    const overrides = await loadTermOverrides(companyId)
    if (overrides.has(key)) {
      return overrides.get(key)!
    }
  }

  // Fallback to default
  return DEFAULT_TERMS[key]
}

// ─── Batch get term labels ───────────────────────────────

export async function getTermLabels(
  companyId: string,
  keys: TermKey[],
): Promise<Record<TermKey, string>> {
  const result: Partial<Record<TermKey, string>> = {}

  // Ensure cache is loaded
  if (!isCacheValid(companyId)) {
    await loadTermOverrides(companyId)
  }

  const cached = termCache.get(companyId)

  for (const key of keys) {
    result[key] = cached?.get(key) ?? DEFAULT_TERMS[key]
  }

  return result as Record<TermKey, string>
}

// ─── Invalidate cache for a company ──────────────────────

export function invalidateTermCache(companyId: string): void {
  termCache.delete(companyId)
  cacheTimestamps.delete(companyId)
}
