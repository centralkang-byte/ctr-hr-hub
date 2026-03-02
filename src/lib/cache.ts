// ═══════════════════════════════════════════════════════════
// CTR HR Hub — API Cache Layer (Redis-based)
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from '@/lib/redis'

// ─── Cache TTL Constants ─────────────────────────────────

export const CACHE_STRATEGY = {
  ORG_TREE: { ttl: 600, prefix: 'cache:org:tree' },          // 10 min
  DASHBOARD_KPI: { ttl: 60, prefix: 'cache:dashboard:kpi' }, // 1 min
  CODE_TABLES: { ttl: 1800, prefix: 'cache:codes' },         // 30 min
  EMPLOYEE_LIST: { ttl: 300, prefix: 'cache:employees' },    // 5 min
  ANALYTICS: { ttl: 300, prefix: 'cache:analytics' },        // 5 min
} as const

export type CacheStrategy = (typeof CACHE_STRATEGY)[keyof typeof CACHE_STRATEGY]

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
  await cacheDelPattern(`${strategy.prefix}:${companyId}*`)
}

export async function invalidateCacheKey(key: string): Promise<void> {
  await cacheDel(key)
}

// ─── withCache HOF ───────────────────────────────────────

type RouteHandler = (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> },
) => Promise<NextResponse>

export function withCache(
  handler: RouteHandler,
  strategy: CacheStrategy,
  keyBuilder?: (req: NextRequest, companyId: string) => string,
): RouteHandler {
  return async (req, context) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return handler(req, context)
    }

    // Build cache key from URL + query params
    const url = new URL(req.url)
    const queryKey = url.searchParams.toString()
    const defaultKey = `${strategy.prefix}:${url.pathname}${queryKey ? `:${queryKey}` : ''}`
    const cacheKey = keyBuilder ? keyBuilder(req, '') : defaultKey

    // Try cache first
    const cached = await cacheGet<{ body: unknown; status: number }>(cacheKey)
    if (cached) {
      const response = NextResponse.json(cached.body, { status: cached.status })
      response.headers.set('X-Cache', 'HIT')
      return response
    }

    // Cache miss — execute handler
    const response = await handler(req, context)
    const responseBody = await response.clone().json()

    // Store in cache (only for successful responses)
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
