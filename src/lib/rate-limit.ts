// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Rate Limiter (Redis with In-Memory Fallback)
// ═══════════════════════════════════════════════════════════

import { redis } from '@/lib/redis'
import { NextRequest, NextResponse } from 'next/server'
import { extractRequestMeta } from '@/lib/audit'
import { getToken } from 'next-auth/jwt'

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
  /** Authentication: 10 req/min per IP */
  AUTH: { maxRequests: 10, windowSeconds: 60 } as RateLimitConfig,
  /** File Upload: 5 req/min */
  FILE_UPLOAD: { maxRequests: 5, windowSeconds: 60 } as RateLimitConfig,
  /** Export: 5 req/min per user */
  EXPORT: { maxRequests: 5, windowSeconds: 60 } as RateLimitConfig,
  /** AI Endpoints: 20 req/min per user */
  AI: { maxRequests: 20, windowSeconds: 60 } as RateLimitConfig,
  /** Bulk Operations: 3 req/min */
  BULK: { maxRequests: 3, windowSeconds: 60 } as RateLimitConfig,
} as const

// ─── In-Memory Fallback Store ────────────────────────────

const memoryStore = new Map<string, { timestamps: number[] }>()

function checkRateLimitInMemory(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now()
  const windowStart = now - config.windowSeconds * 1000

  let entry = memoryStore.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    memoryStore.set(key, entry)
  }

  // Remove expired entries
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart)
  // Add current request
  entry.timestamps.push(now)
  const count = entry.timestamps.length

  // Probabilistic cleanup to prevent memory leaks
  if (Math.random() < 0.01) {
    const cutoff = now - 120_000
    for (const [k, v] of memoryStore) {
      if (v.timestamps.every((t) => t < cutoff)) {
        memoryStore.delete(k)
      }
    }
  }

  return {
    allowed: count <= config.maxRequests,
    remaining: Math.max(0, config.maxRequests - count),
    resetAt: Math.ceil((now + config.windowSeconds * 1000) / 1000),
  }
}

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

    const pipeline = redis.pipeline()
    pipeline.zremrangebyscore(redisKey, 0, windowStart)
    pipeline.zadd(redisKey, now, `${now}:${Math.random()}`)
    pipeline.zcard(redisKey)
    pipeline.expire(redisKey, config.windowSeconds)

    const results = await pipeline.exec()

    // pipeline.exec() resolves (not rejects) when Redis is down,
    // returning [Error, null] per command. Detect this and fallback.
    if (!results || results[2]?.[0]) {
      return checkRateLimitInMemory(key, config)
    }

    const count = (results[2][1] as number) ?? 0

    return {
      allowed: count <= config.maxRequests,
      remaining: Math.max(0, config.maxRequests - count),
      resetAt: Math.ceil((now + config.windowSeconds * 1000) / 1000),
    }
  } catch {
    // Fallback to in-memory rate limiting when Redis is unavailable
    return checkRateLimitInMemory(key, config)
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

    // Use userId for per-user rate limiting, fallback to IP
    let userId: string | undefined
    try {
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
      userId = (token?.sub as string) ?? (token?.employeeId as string)
    } catch {
      // Ignore token extraction errors
    }
    const key = `${userId ?? ip}:${req.nextUrl.pathname}`

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
