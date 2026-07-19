// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Bulk Approval Action API (Phase 2)
// POST /api/v1/approvals/attendance/bulk
// Body: { ids: string[], action: 'APPROVE' | 'REJECT', comment?: string }
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden } from '@/lib/errors'
import { hasPermission, withAuth, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { z } from 'zod'
import type { SessionUser } from '@/types'
import { getCorrectionReviewerScope } from '@/lib/attendance/correction-roles'

const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['APPROVE', 'REJECT']),
  comment: z.string().max(500).optional(),
}).strict()

export const POST = withAuth(
  async (req: NextRequest, _context, user: SessionUser) => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      throw badRequest('요청 본문이 올바른 JSON 형식이 아닙니다.')
    }
    const parsed = bulkSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.issues.map((e) => e.message).join(', '))
    const { action, comment } = parsed.data
    const ids = [...new Set(parsed.data.ids)]

    const now = new Date()
    const results: { id: string; status: 'processed' | 'skipped'; reason?: string }[] = []
    const { isGlobalSuper } = await getCorrectionReviewerScope(
      prisma,
      user.employeeId,
      now,
    )
    const canDecideLeave = hasPermission(user, perm(MODULE.LEAVE, ACTION.UPDATE))
    const canDecideAttendance = hasPermission(
      user,
      perm(MODULE.ATTENDANCE, ACTION.APPROVE),
    )
    if (!canDecideLeave && !canDecideAttendance) {
      throw forbidden('승인 요청을 처리할 권한이 없습니다.')
    }
    const actorScope = {
      ...(isGlobalSuper ? {} : { companyId: user.companyId }),
      steps: { some: { approverId: user.employeeId, status: 'pending' } },
    }

    // 모든 요청 조회
    const requests = await prisma.attendanceApprovalRequest.findMany({
      where: {
        id: { in: ids },
        status: 'pending',
        OR: [
          ...(canDecideLeave ? [{ requestType: 'leave', ...actorScope }] : []),
          ...(canDecideAttendance
            ? [{ requestType: { in: ['overtime', 'shift_change'] }, ...actorScope }]
            : []),
        ],
      },
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
      const canDecideType = approvalReq.requestType === 'leave'
        ? canDecideLeave
        : ['overtime', 'shift_change'].includes(approvalReq.requestType) && canDecideAttendance
      if (!canDecideType) {
        results.push({ id: approvalReq.id, status: 'skipped', reason: '승인 권한 없음' })
        continue
      }
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
        // 동시 결재 race 방어: pending→approved/rejected atomic. race-lost는 명시적
        // 'skipped' 분기 — generic catch로 흡수되지 않도록 (Codex Gate 1 MED 1).
        const txResult = await prisma.$transaction(async (tx) => {
          const stepUpdate = await tx.attendanceApprovalStep.updateMany({
            where: { id: currentStep.id, status: 'pending' },
            data: {
              status: action === 'APPROVE' ? 'approved' : 'rejected',
              comment,
              decidedAt: now,
            },
          })
          if (stepUpdate.count === 0) return { raceLost: true } as const

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
          return { raceLost: false } as const
        })

        if (txResult.raceLost) {
          results.push({ id: approvalReq.id, status: 'skipped', reason: '이미 처리된 결재 단계' })
        } else {
          results.push({ id: approvalReq.id, status: 'processed' })
        }
      } catch {
        results.push({ id: approvalReq.id, status: 'skipped', reason: '처리 중 오류 발생' })
      }
    }

    const processed = results.filter((r) => r.status === 'processed').length
    const skipped = results.filter((r) => r.status === 'skipped').length

    return apiSuccess({ processed, skipped, results })
  },
)
