// CRON: secured by CRON_SECRET header, not user session
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/cron/apply-scheduled-comp
// Off-Cycle 예약 보상 일괄 적용 — isScheduled=true + effectiveDate <= today + appliedAt IS NULL
//
// 스케줄: 0 15 * * * (UTC 15:00 = KST 00:00)
// CompensationHistory의 newBaseSalary가 SSOT이므로
// appliedAt만 설정하면 급여 조회 시 자동 반영됨
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyCronSecret } from '@/lib/cron-auth'
import { apiSuccess, apiError } from '@/lib/api'
import { unauthorized } from '@/lib/errors'

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) return apiError(unauthorized('인증 실패'))

  const now = new Date()
  // 오늘 자정 (UTC) 기준 — effectiveDate가 오늘 이하인 레코드
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  // 미적용 예약 보상 조회
  const scheduled = await prisma.compensationHistory.findMany({
    where: {
      isScheduled: true,
      effectiveDate: { lte: todayEnd },
      appliedAt: null,
    },
    select: {
      id: true,
      employeeId: true,
      companyId: true,
      newBaseSalary: true,
      currency: true,
    },
  })

  if (scheduled.length === 0) {
    return apiSuccess({ applied: 0 })
  }

  // 배치 업데이트 — appliedAt 설정
  const ids = scheduled.map((s) => s.id)
  await prisma.compensationHistory.updateMany({
    where: { id: { in: ids } },
    data: { appliedAt: now },
  })

  return apiSuccess({ applied: scheduled.length })
}
