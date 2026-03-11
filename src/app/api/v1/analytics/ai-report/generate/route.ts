// ═══════════════════════════════════════════════════════════
// G-2: AI Report Generate API
// POST /api/v1/analytics/ai-report/generate
// 🚨 CRITICAL: Idempotency — check-and-lock pattern
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { collectReportData } from '@/lib/analytics/ai-report/data-collector'
import { generateAiReport } from '@/lib/analytics/ai-report/generator'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    try {
      const body = await req.json()
      const companyId = body.companyId || null
      const period = body.period as string

      if (!period || !/^\d{4}-\d{2}$/.test(period)) {
        return apiError(new Error('period must be in YYYY-MM format'))
      }

      // ── Idempotency check ──
      const existing = await prisma.aiReport.findFirst({
        where: { companyId, period },
      })

      // Case 1: Already generated → return existing
      if (existing?.status === 'GENERATED') {
        return apiSuccess({ data: existing, message: '이미 생성된 리포트입니다.' })
      }

      // Case 2: Currently generating → return 409
      if (existing?.status === 'GENERATING') {
        return apiSuccess(
          { data: null, message: '리포트 생성이 진행 중입니다. 잠시 후 다시 확인해주세요.' },
          202,
        )
      }

      // Case 3: Failed or not exists → create/update with GENERATING status (lock)
      let report
      if (existing?.status === 'FAILED') {
        report = await prisma.aiReport.update({
          where: { id: existing.id },
          data: { status: 'GENERATING', content: '' },
        })
      } else {
        report = await prisma.aiReport.create({
          data: {
            companyId,
            period,
            content: '',
            status: 'GENERATING',
            generatedBy: user.employeeId,
          },
        })
      }

      // ── Generate report ──
      try {
        const data = await collectReportData(companyId, period)
        const content = await generateAiReport(data)

        const updated = await prisma.aiReport.update({
          where: { id: report.id },
          data: {
            content,
            status: 'GENERATED',
            metadata: {
              generatedAt: new Date().toISOString(),
              model: process.env.ANTHROPIC_API_KEY ? 'claude-sonnet-4-20250514' : 'template',
              kpiSnapshot: {
                headcount: data.headcount.total,
                turnoverRate: data.turnover.monthlyRate,
                laborCost: data.payroll.formattedTotal,
              },
            },
          },
        })

        return apiSuccess({ data: updated })
      } catch (genError) {
        // Mark as FAILED so user can retry
        await prisma.aiReport.update({
          where: { id: report.id },
          data: { status: 'FAILED' },
        })
        throw genError
      }
    } catch (error) {
      return apiError(error)
    }
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
