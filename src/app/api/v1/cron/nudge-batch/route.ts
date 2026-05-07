// CRON: secured by CRON_SECRET header, not user session
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/cron/nudge-batch
// 일일 Nudge 배치 — 전 법인 매니저에 대해 nudge 룰 평가
//
// 스케줄: 0 1 * * * (UTC 01:00 = KST 10:00)
// check-nudges.ts는 PROTECTED — 수정하지 않고 호출만 함
// oncePer24h 가드가 중복 발송 방지
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyCronSecret } from '@/lib/cron-auth'
import { checkNudgesForUser } from '@/lib/nudge/check-nudges'
import { apiSuccess, apiError } from '@/lib/api'
import { unauthorized } from '@/lib/errors'

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) return apiError(unauthorized('인증 실패'))

  let companiesChecked = 0
  let managersChecked = 0
  let nudgesSent = 0

  // 전 법인 active company 조회
  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
    select: { id: true, code: true },
  })

  for (const company of companies) {
    companiesChecked++

    // 해당 법인의 MANAGER/HR_ADMIN/EXECUTIVE 역할 직원 조회
    // Session 208: 기존 `role: { name: { in: [...] } }`는 seed name(공백 포함 'HR Admin'
    // 'Super Admin' 'Executive')과 불일치로 항상 0 row → nudge cron이 *전체 매니저급
    // 직원 0명*에게 발송하는 silent fail이었음. Role.code SSOT 매칭 + EmployeeRole.
    // endDate=null + companyId scope 추가.
    const managers = await prisma.employee.findMany({
      where: {
        assignments: {
          some: {
            companyId: company.id,
            status: 'ACTIVE',
            isPrimary: true,
            endDate: null,
          },
        },
        employeeRoles: {
          some: {
            role: { code: { in: ['MANAGER', 'HR_ADMIN', 'EXECUTIVE', 'SUPER_ADMIN'] } },
            companyId: company.id,
            endDate: null,
          },
        },
      },
      select: { id: true },
    })

    for (const manager of managers) {
      managersChecked++
      const summary = await checkNudgesForUser(company.id, manager.id)
      nudgesSent += summary.totalSent
    }
  }

  return apiSuccess({ companiesChecked, managersChecked, nudgesSent })
}
