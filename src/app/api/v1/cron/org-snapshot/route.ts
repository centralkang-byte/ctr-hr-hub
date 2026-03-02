// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/cron/org-snapshot
// 월별 조직도 스냅샷 (모든 활성 Company)
// ═══════════════════════════════════════════════════════════

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyCronSecret } from '@/lib/cron-auth'
import { buildOrgSnapshot } from '@/lib/org-snapshot-builder'

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

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

  return NextResponse.json({
    success: true,
    total: companies.length,
    succeeded: results.filter((r) => r.success).length,
    results,
  })
}
