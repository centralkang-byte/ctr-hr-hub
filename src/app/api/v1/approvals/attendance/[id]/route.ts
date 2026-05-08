// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Unified Attendance Approval Action API (B6-2)
// GET    /api/v1/approvals/attendance/[id]  — 상세 조회
// PUT    /api/v1/approvals/attendance/[id]  — 승인/반려 처리
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, conflict, notFound, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { z } from 'zod'
import type { SessionUser } from '@/types'

const actionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  comment: z.string().max(500).optional(),
})

export const GET = withPermission(
  async (_req: NextRequest, context, _user: SessionUser) => {
    const { id } = await context.params
    const req = await prisma.attendanceApprovalRequest.findUnique({
      where: { id },
      include: {
        requester: { select: { id: true, name: true, employeeNo: true } },
        steps: {
          include: { approver: { select: { id: true, name: true } } },
          orderBy: { stepOrder: 'asc' },
        },
      },
    })
    if (!req) throw notFound('승인 요청을 찾을 수 없습니다.')
    return apiSuccess(req)
  },
  perm(MODULE.LEAVE, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params
    const body = await req.json()
    const parsed = actionSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)
    const { action, comment } = parsed.data

    const approvalReq = await prisma.attendanceApprovalRequest.findUnique({
      where: { id },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    })
    if (!approvalReq) throw notFound('승인 요청을 찾을 수 없습니다.')
    if (approvalReq.status !== 'pending') throw badRequest('이미 처리된 요청입니다.')

    // 현재 단계 확인
    const currentStep = approvalReq.steps.find(
      (s) => s.stepOrder === approvalReq.currentStep && s.status === 'pending'
    )
    if (!currentStep) throw badRequest('현재 승인 단계를 찾을 수 없습니다.')
    if (currentStep.approverId !== user.employeeId) throw forbidden('이 요청의 승인자가 아닙니다.')

    const now = new Date()

    // 동시 결재 race 방어: pending→approved/rejected atomic transition. updateMany +
    // status: 'pending' 조건 → READ COMMITTED row lock으로 첫 tx만 count=1, 둘째는
    // count=0 → race lost. mixed approve/reject 동시 클릭 + double-click 시 nextStep
    // 중복 활성화 + currentStep 2번 advance 차단.
    const txResult = await prisma.$transaction(async (tx) => {
      const stepUpdate = await tx.attendanceApprovalStep.updateMany({
        where: { id: currentStep.id, status: 'pending' },
        data: {
          status: action === 'approve' ? 'approved' : 'rejected',
          comment,
          decidedAt: now,
        },
      })
      if (stepUpdate.count === 0) return { raceLost: true } as const

      if (action === 'reject') {
        // 반려 — 요청 최종 반려
        await tx.attendanceApprovalRequest.update({
          where: { id },
          data: { status: 'rejected', updatedAt: now },
        })
      } else {
        // 승인 — 다음 단계 확인
        const nextStep = approvalReq.steps.find((s) => s.stepOrder === approvalReq.currentStep + 1)
        if (nextStep) {
          // 다음 단계로 진행
          await tx.attendanceApprovalStep.update({
            where: { id: nextStep.id },
            data: { status: 'pending' },
          })
          await tx.attendanceApprovalRequest.update({
            where: { id },
            data: { currentStep: approvalReq.currentStep + 1, updatedAt: now },
          })
        } else {
          // 모든 단계 완료 — 최종 승인
          await tx.attendanceApprovalRequest.update({
            where: { id },
            data: { status: 'approved', updatedAt: now },
          })
        }
      }
      return { raceLost: false } as const
    })

    if (txResult.raceLost) throw conflict('이미 처리된 결재 단계입니다.')

    // 최신 상태 반환
    const updated = await prisma.attendanceApprovalRequest.findUnique({
      where: { id },
      include: {
        requester: { select: { id: true, name: true } },
        steps: {
          include: { approver: { select: { id: true, name: true } } },
          orderBy: { stepOrder: 'asc' },
        },
      },
    })
    return apiSuccess(updated)
  },
  perm(MODULE.LEAVE, ACTION.UPDATE),
)
