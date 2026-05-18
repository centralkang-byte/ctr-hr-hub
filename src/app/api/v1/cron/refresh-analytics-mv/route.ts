// CRON: secured by CRON_SECRET (x-cron-secret OR Vercel-native Bearer)
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /api/v1/cron/refresh-analytics-mv  (GET + POST)
// Analytics MV 8개 일일 갱신 (REFRESH MATERIALIZED VIEW CONCURRENTLY)
//
// 스케줄: 0 18 * * * (UTC 18:00 = KST 03:00, 오프피크)
// MV 정의/생성은 scripts/db/apply-analytics-mv.ts (1회 적용). 본 라우트는
// 갱신만. 트리거 경로가 환경마다 불확실(STATUS Session 221: Vercel native
// cron = GET + `Authorization: Bearer ${CRON_SECRET}` / 기존 프로젝트 패턴
// = Supabase pg_cron net.http_post POST + `x-cron-secret`). 둘 다 수용해
// 추측 없이 동작 보장. CONCURRENTLY 는 트랜잭션 밖 + UNIQUE INDEX 필요
// (mv_analytics.sql 충족).
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyCronSecret } from '@/lib/cron-auth'
import { apiSuccess, apiError } from '@/lib/api'
import { unauthorized, AppError } from '@/lib/errors'

const MVS = [
  'mv_headcount_daily',
  'mv_attendance_weekly',
  'mv_performance_summary',
  'mv_recruitment_funnel',
  'mv_burnout_risk',
  'mv_team_health',
  'mv_exit_reason_monthly',
  'mv_compa_ratio_distribution',
] as const

// 기존 SSOT(verifyCronSecret = x-cron-secret) 재사용 + Vercel native cron의
// `Authorization: Bearer ${CRON_SECRET}` 추가 수용. 공유 헬퍼는 무수정(타 3
// 라우트 영향 회피), Bearer 경로만 로컬 보강.
function isCronAuthorized(req: NextRequest): boolean {
  if (verifyCronSecret(req)) return true
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  return req.headers.get('authorization') === `Bearer ${expected}`
}

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return apiError(unauthorized('인증 실패'))

  const refreshed: string[] = []
  const skipped: { mv: string; reason: string }[] = []
  const failed: { mv: string; reason: string }[] = []

  for (const mv of MVS) {
    try {
      // CONCURRENTLY: 트랜잭션 밖 단일 statement (autocommit). 식별자는
      // 고정 상수 화이트리스트라 인젝션 무관.
      await prisma.$executeRawUnsafe(
        `REFRESH MATERIALIZED VIEW CONCURRENTLY ${mv}`,
      )
      refreshed.push(mv)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      // 42P01 = MV 미적용 환경(apply 스크립트 미실행)만 양성 skip
      // (배포-순서 무관 무해). 그 외(UNIQUE INDEX 부재·락 타임아웃·권한·
      // SQL 오류 등)는 hard fail → 500 surface (cron 실패로 표면화).
      if (msg.includes('42P01') || msg.includes('does not exist')) {
        skipped.push({ mv, reason: 'not_applied' })
      } else {
        failed.push({ mv, reason: msg.slice(0, 160) })
      }
    }
  }

  if (failed.length > 0) {
    return apiError(
      new AppError(500, 'MV_REFRESH_FAILED', 'MV 갱신 일부 실패', {
        refreshed,
        skipped,
        failed,
      }),
    )
  }

  return apiSuccess({
    refreshed: refreshed.length,
    skipped: skipped.length,
    refreshedMvs: refreshed,
    skippedMvs: skipped,
  })
}

export const POST = handle
export const GET = handle
