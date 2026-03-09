// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Bulk Approval Action API (Phase 2)
// POST /api/v1/approvals/attendance/bulk
// Body: { ids: string[], action: 'APPROVE' | 'REJECT', comment?: string }
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { z } from 'zod'
import type { SessionUser } from '@/types'

const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['APPROVE', 'REJECT']),
  comment: z.string().max(500).optional(),
})

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body = await req.json()
    const parsed = bulkSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.issues.map((e) => e.message).join(', '))
    const { ids, action, comment } = parsed.data

    const now = new Date()
    const results: { id: string; status: 'processed' | 'skipped'; reason?: string }[] = []

    // 모든 요청 조회
    const requests = await prisma.attendanceApprovalRequest.findMany({
      where: { id: { in: ids }, status: 'pending' },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    })

    // 요청 ID 별로 처리 결과 기록
    const foundIds = new Set(requests.map((r) => r.id))
    for (const id of ids) {
      if (!foundIds.has(id)) {
        results.push({ id, status: 'skipped', reason: '요청을 찾을 수 없거나 이미 처리됨' })
      }
    }

    // 각 요청 처리
    for (const approvalReq of requests) {
      const currentStep = approvalReq.steps.find(
        (s) => s.stepOrder === approvalReq.currentStep && s.status === 'pending'
      )

      if (!currentStep) {
        results.push({ id: approvalReq.id, status: 'skipped', reason: '현재 승인 단계 없음' })
        continue
      }

      if (currentStep.approverId !== user.employeeId) {
        results.push({ id: approvalReq.id, status: 'skipped', reason: '승인 권한 없음' })
        continue
      }

      try {
        await prisma.$transaction(async (tx) => {
          await tx.attendanceApprovalStep.update({
            where: { id: currentStep.id },
            data: {
              status: action === 'APPROVE' ? 'approved' : 'rejected',
              comment,
              decidedAt: now,
            },
          })

          if (action === 'REJECT') {
            await tx.attendanceApprovalRequest.update({
              where: { id: approvalReq.id },
              data: { status: 'rejected', updatedAt: now },
            })
          } else {
            const nextStep = approvalReq.steps.find(
              (s) => s.stepOrder === approvalReq.currentStep + 1
            )
            if (nextStep) {
              await tx.attendanceApprovalStep.update({
                where: { id: nextStep.id },
                data: { status: 'pending' },
              })
              await tx.attendanceApprovalRequest.update({
                where: { id: approvalReq.id },
                data: { currentStep: approvalReq.currentStep + 1, updatedAt: now },
              })
            } else {
              await tx.attendanceApprovalRequest.update({
                where: { id: approvalReq.id },
                data: { status: 'approved', updatedAt: now },
              })
            }
          }
        })
        results.push({ id: approvalReq.id, status: 'processed' })
      } catch {
        results.push({ id: approvalReq.id, status: 'skipped', reason: '처리 중 오류 발생' })
      }
    }

    const processed = results.filter((r) => r.status === 'processed').length
    const skipped = results.filter((r) => r.status === 'skipped').length

    return apiSuccess({ processed, skipped, results })
  },
  perm(MODULE.LEAVE, ACTION.UPDATE),
)
