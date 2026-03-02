// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/monitoring/health
// 시스템 헬스체크 엔드포인트
// ═══════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

export async function GET() {
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

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allOk ? 200 : 503 },
  )
}
