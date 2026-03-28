// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Redis Client (ioredis, graceful degradation)
// ═══════════════════════════════════════════════════════════

import Redis from 'ioredis'
import { env } from '@/lib/env'

// ─── Redis Client Singleton ──────────────────────────────

const globalForRedis = globalThis as unknown as {
  __redis: Redis | undefined
}

function getRedisClient(): Redis {
  if (!globalForRedis.__redis) {
    const redisUrl = env.REDIS_URL
    globalForRedis.__redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) return null
        return Math.min(times * 200, 2000)
      },
    })

    globalForRedis.__redis.on('error', () => {
      // Graceful degradation: Redis errors should not crash the app
    })
  }
  return globalForRedis.__redis
}

export const redis = getRedisClient()

// ─── Cache Helpers (graceful degradation) ─────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get(key)
    if (!value) return null
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds?: number,
): Promise<void> {
  try {
    const serialized = JSON.stringify(value)
    if (ttlSeconds) {
      await redis.set(key, serialized, 'EX', ttlSeconds)
    } else {
      await redis.set(key, serialized)
    }
  } catch {
    // Graceful degradation
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await redis.del(key)
  } catch {
    // Graceful degradation
  }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    // SCAN 기반 — KEYS 대비 O(N) 블로킹 방지
    const stream = redis.scanStream({ match: pattern, count: 100 })
    const pipeline = redis.pipeline()
    let count = 0
    for await (const keys of stream) {
      if (keys.length > 0) {
        pipeline.del(...keys)
        count += keys.length
      }
    }
    if (count > 0) {
      await pipeline.exec()
    }
  } catch {
    // Graceful degradation
  }
}
