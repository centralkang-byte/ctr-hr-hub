// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Data Retention Cron Job
// Runs retention policies automatically
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { enforceRetention } from '@/lib/compliance/gdpr'
import { apiSuccess, apiError } from '@/lib/api'
import { unauthorized } from '@/lib/errors'

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError(unauthorized())
  }

  const policies = await prisma.dataRetentionPolicy.findMany({
    where: { isActive: true, autoDelete: true },
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
