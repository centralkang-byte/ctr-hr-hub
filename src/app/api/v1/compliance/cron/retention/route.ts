// CRON: secured by x-cron-secret header, not user session
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Data Retention Cron Job
// Runs retention policies automatically
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enforceRetention } from '@/lib/compliance/gdpr'
import { apiSuccess, apiError } from '@/lib/api'
import { unauthorized } from '@/lib/errors'
import { verifyCronSecret } from '@/lib/cron-auth'

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return apiError(unauthorized('인증 실패'))
  }

  const policies = await prisma.dataRetentionPolicy.findMany({
    where: { deletedAt: null, autoDelete: true },
  })

  const results: Array<{ policyId: string; category: string; processed: number }> = []

  for (const policy of policies) {
    const result = await enforceRetention(policy.companyId, policy.id)
    results.push({
      policyId: policy.id,
      category: policy.category,
      processed: result.processed,
    })
  }

  return apiSuccess({ results })
}
