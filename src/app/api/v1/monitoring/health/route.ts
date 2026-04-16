// PUBLIC: no auth required — pre-login / public endpoint
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/monitoring/health
// 시스템 헬스체크 엔드포인트
// ═══════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { getCacheStats } from '@/lib/cache'

export async function GET(request: Request) {
  const checks: Record<string, { status: string; latencyMs?: number }> = {}

  // DB check
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    checks.database = { status: 'ok', latencyMs: Date.now() - dbStart }
  } catch {
    checks.database = { status: 'error' }
  }

  // Redis check
  try {
    const redisStart = Date.now()
    await redis.ping()
    checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart }
  } catch {
    checks.redis = { status: 'error' }
  }

  const allOk = Object.values(checks).every((c) => c.status === 'ok')

  // Optional: include cache stats when ?stats=true (for load test monitoring)
  const url = new URL(request.url)
  const includeStats = url.searchParams.get('stats') === 'true'

  let cacheStats = undefined
  if (includeStats && checks.redis.status === 'ok') {
    try {
      cacheStats = await getCacheStats()
    } catch {
      // Non-critical: skip if stats collection fails
    }
  }

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
      ...(cacheStats && { cacheStats }),
    },
    { status: allOk ? 200 : 503 },
  )
}
