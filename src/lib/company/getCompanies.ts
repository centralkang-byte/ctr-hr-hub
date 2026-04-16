// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Company List (cached)
// Dashboard layout용 회사 목록 조회 — React cache + Redis
// ═══════════════════════════════════════════════════════════

import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { cacheGet, cacheSet } from '@/lib/redis'
import { ROLE } from '@/lib/constants'

// ─── Types ──────────────────────────────────────────────────

interface CompanyOption {
  id: string
  name: string
  nameEn: string | null
  countryCode: string | null
}

// ─── Constants ──────────────────────────────────────────────

const CACHE_TTL = 300 // 5 minutes — company list rarely changes
const CACHE_PREFIX = 'cache:companies'

// ─── Helper ─────────────────────────────────────────────────

/**
 * 사용자 역할에 따른 회사 목록 조회.
 * React cache()로 동일 요청 내 dedup + Redis로 cross-request 캐시.
 */
export const getCompaniesForUser = cache(
  async (role: string, companyId: string): Promise<CompanyOption[]> => {
    const canSeeAll = [ROLE.SUPER_ADMIN, ROLE.HR_ADMIN, ROLE.EXECUTIVE].includes(
      role as typeof ROLE.SUPER_ADMIN,
    )

    const cacheKey = canSeeAll
      ? `${CACHE_PREFIX}:all`
      : `${CACHE_PREFIX}:${companyId}`

    // Redis 캐시 조회
    const cached = await cacheGet<CompanyOption[]>(cacheKey)
    if (cached) return cached

    // DB 조회
    let companies: CompanyOption[]

    if (canSeeAll) {
      companies = await prisma.company.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, nameEn: true, countryCode: true },
        orderBy: { name: 'asc' },
      })
    } else {
      const ownCompany = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true, nameEn: true, countryCode: true },
      })
      companies = ownCompany ? [ownCompany] : []
    }

    // Redis 캐시 저장
    if (companies.length > 0) {
      await cacheSet(cacheKey, companies, CACHE_TTL)
    }

    return companies
  },
)
