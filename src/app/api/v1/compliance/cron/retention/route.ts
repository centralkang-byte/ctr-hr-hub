// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Data Retention Cron Job
// Runs retention policies automatically
// ═══════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enforceRetention } from '@/lib/compliance/gdpr'

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  return NextResponse.json({ ok: true, results })
}
