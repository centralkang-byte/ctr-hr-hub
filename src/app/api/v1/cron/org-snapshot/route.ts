// CRON: secured by CRON_SECRET header, not user session
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/cron/org-snapshot
// 월별 조직도 스냅샷 (모든 활성 Company)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyCronSecret } from '@/lib/cron-auth'
import { buildOrgSnapshot } from '@/lib/org-snapshot-builder'
import { apiSuccess, apiError } from '@/lib/api'
import { unauthorized } from '@/lib/errors'

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) return apiError(unauthorized('인증 실패'))

  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
    select: { id: true },
  })

  const results: { companyId: string; success: boolean }[] = []

  for (const company of companies) {
    try {
      await buildOrgSnapshot(company.id)
      results.push({ companyId: company.id, success: true })
    } catch {
      results.push({ companyId: company.id, success: false })
    }
  }

  return apiSuccess({
    total: companies.length,
    succeeded: results.filter((r) => r.success).length,
    results,
  })
}
