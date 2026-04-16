// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Cron 인증 헬퍼
// x-cron-secret 헤더 검증 (Supabase pg_cron + net.http_post)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'

export function verifyCronSecret(req: NextRequest): boolean {
  const secret = req.headers.get('x-cron-secret')
  // Read CRON_SECRET at call time (not module-load time) to avoid
  // stale values when env vars are injected after build.
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  return secret === expected
}
