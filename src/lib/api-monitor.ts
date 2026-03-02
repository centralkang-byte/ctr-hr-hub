// ═══════════════════════════════════════════════════════════
// CTR HR Hub — API Response Time Monitoring
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

// ─── Constants ───────────────────────────────────────────

const SLOW_QUERY_THRESHOLD_MS = 2000
const METRICS_KEY = 'monitor:api:metrics'
const METRICS_TTL = 3600 // 1 hour
const MAX_METRICS_ENTRIES = 1000

// ─── Metric Entry ────────────────────────────────────────

interface MetricEntry {
  path: string
  method: string
  status: number
  durationMs: number
  timestamp: number
}

// ─── withMonitoring HOF ──────────────────────────────────

type RouteHandler = (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> },
) => Promise<NextResponse>

export function withMonitoring(handler: RouteHandler): RouteHandler {
  return async (req, context) => {
    const start = Date.now()

    const response = await handler(req, context)

    const durationMs = Date.now() - start
    const path = new URL(req.url).pathname
    const method = req.method

    // Add timing header
    response.headers.set('X-Response-Time', `${durationMs}ms`)

    // Log slow queries
    if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
      console.warn(
        `[SLOW API] ${method} ${path} took ${durationMs}ms (status: ${response.status})`,
      )
    }

    // Store metric in Redis (fire-and-forget)
    const entry: MetricEntry = {
      path,
      method,
      status: response.status,
      durationMs,
      timestamp: Date.now(),
    }

    storeMetric(entry).catch(() => {
      // Silently fail: monitoring should not break business logic
    })

    return response
  }
}

// ─── Metric Storage ──────────────────────────────────────

async function storeMetric(entry: MetricEntry): Promise<void> {
  try {
    const pipeline = redis.pipeline()
    pipeline.lpush(METRICS_KEY, JSON.stringify(entry))
    pipeline.ltrim(METRICS_KEY, 0, MAX_METRICS_ENTRIES - 1)
    pipeline.expire(METRICS_KEY, METRICS_TTL)
    await pipeline.exec()
  } catch {
    // Graceful degradation
  }
}

// ─── Get Metrics ─────────────────────────────────────────

export async function getApiMetrics(): Promise<{
  totalRequests: number
  avgResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  slowQueries: number
  recentErrors: number
  topEndpoints: Array<{ path: string; count: number; avgMs: number }>
}> {
  try {
    const raw = await redis.lrange(METRICS_KEY, 0, MAX_METRICS_ENTRIES - 1)
    const entries: MetricEntry[] = raw.map((r) => JSON.parse(r))

    if (entries.length === 0) {
      return {
        totalRequests: 0,
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        slowQueries: 0,
        recentErrors: 0,
        topEndpoints: [],
      }
    }

    const durations = entries.map((e) => e.durationMs).sort((a, b) => a - b)
    const avg = durations.reduce((s, d) => s + d, 0) / durations.length
    const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0
    const p99 = durations[Math.floor(durations.length * 0.99)] ?? 0
    const slow = durations.filter((d) => d > SLOW_QUERY_THRESHOLD_MS).length
    const errors = entries.filter((e) => e.status >= 500).length

    // Group by endpoint
    const endpointMap = new Map<string, { count: number; totalMs: number }>()
    for (const entry of entries) {
      const existing = endpointMap.get(entry.path) ?? { count: 0, totalMs: 0 }
      existing.count++
      existing.totalMs += entry.durationMs
      endpointMap.set(entry.path, existing)
    }

    const topEndpoints = Array.from(endpointMap.entries())
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .map(([path, data]) => ({
        path,
        count: data.count,
        avgMs: Math.round(data.totalMs / data.count),
      }))

    return {
      totalRequests: entries.length,
      avgResponseTime: Math.round(avg),
      p95ResponseTime: Math.round(p95),
      p99ResponseTime: Math.round(p99),
      slowQueries: slow,
      recentErrors: errors,
      topEndpoints,
    }
  } catch {
    return {
      totalRequests: 0,
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      slowQueries: 0,
      recentErrors: 0,
      topEndpoints: [],
    }
  }
}
