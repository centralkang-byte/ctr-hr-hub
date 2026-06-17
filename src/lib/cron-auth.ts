// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Cron 인증 헬퍼 (SSOT)
// 두 트리거 경로를 모두 수용한다 (동일한 CRON_SECRET 값을 요구 —
// 추가 수용일 뿐 보안 약화가 아님):
//   1) Supabase pg_cron + net.http_post → `x-cron-secret` 헤더
//   2) Vercel 네이티브 cron        → `Authorization: Bearer ${CRON_SECRET}`
// CRON_SECRET 미설정 시 fail-closed (false).
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'

export function verifyCronSecret(req: NextRequest): boolean {
  // Read CRON_SECRET at call time (not module-load time) to avoid
  // stale values when env vars are injected after build.
  const expected = process.env.CRON_SECRET
  if (!expected) return false

  // 1) Supabase pg_cron net.http_post: x-cron-secret 헤더
  if (req.headers.get('x-cron-secret') === expected) return true

  // 2) Vercel 네이티브 cron: Authorization: Bearer ${CRON_SECRET}
  if (req.headers.get('authorization') === `Bearer ${expected}`) return true

  return false
}
