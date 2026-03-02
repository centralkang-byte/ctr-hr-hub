// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Redis-based Sliding Window Rate Limiter
// ═══════════════════════════════════════════════════════════

import { redis } from '@/lib/redis'
import { NextRequest, NextResponse } from 'next/server'
import { extractRequestMeta } from '@/lib/audit'

// ─── Rate Limit Configuration ────────────────────────────

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number
  /** Window size in seconds */
  windowSeconds: number
  /** Key prefix for Redis */
  keyPrefix?: string
}

export const RATE_LIMITS = {
  /** General API: 60 req/min */
  GENERAL: { maxRequests: 60, windowSeconds: 60 } as RateLimitConfig,
  /** Authentication: 10 req/min */
  AUTH: { maxRequests: 10, windowSeconds: 60 } as RateLimitConfig,
  /** File Upload: 5 req/min */
  FILE_UPLOAD: { maxRequests: 5, windowSeconds: 60 } as RateLimitConfig,
  /** Export: 5 req/min */
  EXPORT: { maxRequests: 5, windowSeconds: 60 } as RateLimitConfig,
  /** AI Endpoints: 10 req/min (cost-sensitive) */
  AI: { maxRequests: 10, windowSeconds: 60 } as RateLimitConfig,
  /** Bulk Operations: 3 req/min */
  BULK: { maxRequests: 3, windowSeconds: 60 } as RateLimitConfig,
} as const

// ─── Rate Limit Check ────────────────────────────────────

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

async function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  try {
    const now = Date.now()
    const windowStart = now - config.windowSeconds * 1000
    const redisKey = `rl:${config.keyPrefix ?? 'api'}:${key}`

    // Sliding window using sorted set
    const pipeline = redis.pipeline()
    // Remove expired entries
    pipeline.zremrangebyscore(redisKey, 0, windowStart)
    // Add current request
    pipeline.zadd(redisKey, now, `${now}:${Math.random()}`)
    // Count requests in window
    pipeline.zcard(redisKey)
    // Set TTL
    pipeline.expire(redisKey, config.windowSeconds)

    const results = await pipeline.exec()
    const count = (results?.[2]?.[1] as number) ?? 0

    return {
      allowed: count <= config.maxRequests,
      remaining: Math.max(0, config.maxRequests - count),
      resetAt: Math.ceil((now + config.windowSeconds * 1000) / 1000),
    }
  } catch {
    // Graceful degradation: allow request if Redis is down
    return { allowed: true, remaining: -1, resetAt: 0 }
  }
}

// ─── Rate Limit Response Headers ─────────────────────────

function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult,
  config: RateLimitConfig,
): void {
  response.headers.set('X-RateLimit-Limit', String(config.maxRequests))
  response.headers.set('X-RateLimit-Remaining', String(result.remaining))
  if (result.resetAt > 0) {
    response.headers.set('X-RateLimit-Reset', String(result.resetAt))
  }
}

// ─── withRateLimit HOF ───────────────────────────────────

type RouteHandler = (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> },
) => Promise<NextResponse>

export function withRateLimit(
  handler: RouteHandler,
  config: RateLimitConfig,
): RouteHandler {
  return async (req, context) => {
    const { ip } = extractRequestMeta(req.headers)
    const key = `${ip}:${req.nextUrl.pathname}`

    const result = await checkRateLimit(key, config)

    if (!result.allowed) {
      const errorResponse = NextResponse.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
          },
        },
        { status: 429 },
      )
      addRateLimitHeaders(errorResponse, result, config)
      errorResponse.headers.set(
        'Retry-After',
        String(config.windowSeconds),
      )
      return errorResponse
    }

    const response = await handler(req, context)
    addRateLimitHeaders(response, result, config)
    return response
  }
}
