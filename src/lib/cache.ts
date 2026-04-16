// ═══════════════════════════════════════════════════════════
// CTR HR Hub — API Cache Layer (Redis-based)
// 사용자 격리 캐시 키 + 무효화 헬퍼
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { cacheGet, cacheSet, cacheDel, cacheDelPattern, redis } from '@/lib/redis'

// ─── Cache TTL Constants ─────────────────────────────────

export const CACHE_STRATEGY = {
  ORG_TREE: { ttl: 600, prefix: 'cache:org:tree' },          // 10 min
  DASHBOARD_KPI: { ttl: 60, prefix: 'cache:dashboard:kpi' }, // 1 min
  CODE_TABLES: { ttl: 1800, prefix: 'cache:codes' },         // 30 min
  EMPLOYEE_LIST: { ttl: 300, prefix: 'cache:employees' },    // 5 min
  ANALYTICS: { ttl: 300, prefix: 'cache:analytics' },        // 5 min
  SIDEBAR: { ttl: 30, prefix: 'cache:sidebar' },             // 30 sec
  RECRUITMENT: { ttl: 120, prefix: 'cache:recruitment' },     // 2 min
} as const

export type CacheStrategy = (typeof CACHE_STRATEGY)[keyof typeof CACHE_STRATEGY]

// ─── Cache Scope ────────────────────────────────────────
// 사용자 격리가 필요한 캐시 vs 법인 단위 공유 캐시 구분

type CacheScope = 'user' | 'company' | 'global'

// ─── Cache Key Builder ───────────────────────────────────

export function buildCacheKey(
  strategy: CacheStrategy,
  companyId: string,
  extra?: string,
): string {
  return extra
    ? `${strategy.prefix}:${companyId}:${extra}`
    : `${strategy.prefix}:${companyId}`
}

// ─── Cache Invalidation ──────────────────────────────────

export async function invalidateCache(
  strategy: CacheStrategy,
  companyId: string,
): Promise<void> {
  await cacheDelPattern(`${strategy.prefix}:${companyId}:*`)
}

export async function invalidateCacheKey(key: string): Promise<void> {
  await cacheDel(key)
}

/** 여러 캐시 전략을 한번에 무효화 */
export async function invalidateMultiple(
  strategies: CacheStrategy[],
  companyId: string,
): Promise<void> {
  await Promise.all(
    strategies.map((s) => invalidateCache(s, companyId)),
  )
}

// ─── Cache Stats ────────────────────────────────────────

const CACHE_STATS_TTL = 3600 // 1 hour

function trackCacheResult(prefix: string, hit: boolean): void {
  const key = hit ? `monitor:cache:hit:${prefix}` : `monitor:cache:miss:${prefix}`
  try {
    // Fire-and-forget: INCR + EXPIRE as individual commands
    redis.incr(key).catch(() => {})
    redis.expire(key, CACHE_STATS_TTL).catch(() => {})
  } catch {
    // Graceful degradation
  }
}

/** 전략별 cache hit rate 통계 */
export async function getCacheStats(): Promise<{
  overall: { hits: number; misses: number; hitRate: number }
  byStrategy: Record<string, { hits: number; misses: number; hitRate: number }>
}> {
  const strategies = Object.values(CACHE_STRATEGY)
  const byStrategy: Record<string, { hits: number; misses: number; hitRate: number }> = {}
  let totalHits = 0
  let totalMisses = 0

  try {
    const keys: string[] = []
    for (const s of strategies) {
      keys.push(`monitor:cache:hit:${s.prefix}`)
      keys.push(`monitor:cache:miss:${s.prefix}`)
    }
    const results = keys.length > 0 ? await redis.mget(...keys) : []
    if (!results) {
      return { overall: { hits: 0, misses: 0, hitRate: 0 }, byStrategy }
    }

    for (let i = 0; i < strategies.length; i++) {
      const hits = parseInt(results[i * 2] || '0', 10)
      const misses = parseInt(results[i * 2 + 1] || '0', 10)
      const total = hits + misses
      byStrategy[strategies[i].prefix] = {
        hits,
        misses,
        hitRate: total > 0 ? Math.round((hits / total) * 100) / 100 : 0,
      }
      totalHits += hits
      totalMisses += misses
    }
  } catch {
    // Graceful degradation
  }

  const total = totalHits + totalMisses
  return {
    overall: {
      hits: totalHits,
      misses: totalMisses,
      hitRate: total > 0 ? Math.round((totalHits / total) * 100) / 100 : 0,
    },
    byStrategy,
  }
}

// ─── withCache HOF ───────────────────────────────────────

type RouteHandler = (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> },
) => Promise<NextResponse>

/**
 * API Route 캐시 래퍼.
 * @param handler 원본 라우트 핸들러
 * @param strategy 캐시 전략 (TTL + prefix)
 * @param scope 캐시 격리 수준:
 *   - 'user': 사용자별 격리 (companyId:role:employeeId) — 대시보드 KPI, 사이드바 등
 *   - 'company': 법인별 공유 (companyId) — analytics, org tree 등
 *   - 'global': 전역 공유 — code tables 등
 */
export function withCache(
  handler: RouteHandler,
  strategy: CacheStrategy,
  scope: CacheScope = 'company',
): RouteHandler {
  return async (req, context) => {
    // GET 요청만 캐시
    if (req.method !== 'GET') {
      return handler(req, context)
    }

    // 캐시 키 구성 — scope에 따라 사용자 정보 포함
    const url = new URL(req.url)
    const queryKey = url.searchParams.toString()
    let cacheKey: string

    if (scope === 'global') {
      cacheKey = `${strategy.prefix}:${url.pathname}${queryKey ? `:${queryKey}` : ''}`
    } else {
      // JWT에서 사용자 정보 경량 추출 (DB 조회 없음)
      const token = await getToken({ req })
      if (!token) {
        // 인증 없으면 캐시 스킵 — handler가 401 반환할 것
        return handler(req, context)
      }

      const companyId = (token.companyId as string) || 'unknown'
      const role = (token.role as string) || 'unknown'
      const employeeId = (token.employeeId as string) || 'unknown'

      if (scope === 'user') {
        cacheKey = `${strategy.prefix}:${companyId}:${role}:${employeeId}:${url.pathname}${queryKey ? `:${queryKey}` : ''}`
      } else {
        // company scope — include role to prevent cross-role cache bleed (e.g. HR_ADMIN cached 200 served to EMPLOYEE)
        cacheKey = `${strategy.prefix}:${companyId}:${role}:${url.pathname}${queryKey ? `:${queryKey}` : ''}`
      }
    }

    // 캐시 조회
    const cached = await cacheGet<{ body: unknown; status: number }>(cacheKey)
    if (cached) {
      trackCacheResult(strategy.prefix, true)
      const response = NextResponse.json(cached.body, { status: cached.status })
      response.headers.set('X-Cache', 'HIT')
      return response
    }

    // 캐시 미스 — 핸들러 실행
    trackCacheResult(strategy.prefix, false)
    const response = await handler(req, context)
    const responseBody = await response.clone().json()

    // 성공 응답만 캐시
    if (response.status >= 200 && response.status < 300) {
      await cacheSet(
        cacheKey,
        { body: responseBody, status: response.status },
        strategy.ttl,
      )
    }

    response.headers.set('X-Cache', 'MISS')
    return response
  }
}
