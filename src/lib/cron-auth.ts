// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Cron 인증 헬퍼
// x-cron-secret 헤더 검증 (Supabase pg_cron + net.http_post)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { env } from '@/lib/env'

export function verifyCronSecret(req: NextRequest): boolean {
  const secret = req.headers.get('x-cron-secret')
  if (!env.CRON_SECRET) return false
  return secret === env.CRON_SECRET
}
