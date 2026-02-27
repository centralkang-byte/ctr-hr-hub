// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/profile/change-requests/[id]/review
// HR 관리자 — 변경 요청 승인/반려
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { sendNotification } from '@/lib/notifications'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Allowed employee fields for update ─────────────────────

type UpdatableField = 'phone' | 'emergencyContact' | 'emergencyContactPhone'

const UPDATABLE_FIELDS: readonly string[] = [
  'phone',
  'emergencyContact',
  'emergencyContactPhone',
]

// ─── Zod Schema ─────────────────────────────────────────────

const reviewSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().optional(),
})

// ─── Field Labels ───────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  phone: '전화번호',
  emergencyContact: '비상연락처 이름',
  emergencyContactPhone: '비상연락처 전화',
}

// ─── PUT — 승인/반려 ────────────────────────────────────────

export const PUT = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const body: unknown = await req.json()
    const parsed = reviewSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('입력값이 올바르지 않습니다.', {
        issues: parsed.error.issues,
      })
    }

    const { action: reviewAction, rejectionReason } = parsed.data

    // Reject must include reason
    if (reviewAction === 'REJECT' && !rejectionReason?.trim()) {
      throw badRequest('반려 사유를 입력해주세요.')
    }

    // Fetch the request
    const changeRequest = await prisma.profileChangeRequest.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true, companyId: true } },
      },
    })

    if (!changeRequest) {
      throw notFound('변경 요청을 찾을 수 없습니다.')
    }

    if (changeRequest.status !== 'CHANGE_PENDING') {
      throw badRequest('이미 처리된 요청입니다.')
    }

    // Company scope check (non-SUPER_ADMIN)
    if (
      user.role !== ROLE.SUPER_ADMIN &&
      changeRequest.employee.companyId !== user.companyId
    ) {
      throw notFound('변경 요청을 찾을 수 없습니다.')
    }

    const fieldLabel = FIELD_LABELS[changeRequest.fieldName] ?? changeRequest.fieldName

    if (reviewAction === 'APPROVE') {
      // Validate field name is allowed before updating
      if (!UPDATABLE_FIELDS.includes(changeRequest.fieldName)) {
        throw badRequest('허용되지 않는 필드입니다.')
      }

      // Transaction: update employee + update request status
      const updated = await prisma.$transaction(async (tx) => {
        // Update employee field
        await tx.employee.update({
          where: { id: changeRequest.employeeId },
          data: {
            [changeRequest.fieldName as UpdatableField]: changeRequest.newValue,
          },
        })

        // Update change request
        return tx.profileChangeRequest.update({
          where: { id },
          data: {
            status: 'CHANGE_APPROVED',
            reviewedBy: user.employeeId,
            reviewedAt: new Date(),
          },
        })
      })

      // Notification: approved
      sendNotification({
        employeeId: changeRequest.employeeId,
        triggerType: 'PROFILE_CHANGE_APPROVED',
        title: '프로필 변경 승인',
        body: `${fieldLabel} 변경 요청이 승인되었습니다.`,
        link: '/employees/me',
      })

      // Audit log
      const meta = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'PROFILE_CHANGE_APPROVE',
        resourceType: 'ProfileChangeRequest',
        resourceId: id,
        companyId: changeRequest.employee.companyId,
        changes: {
          fieldName: changeRequest.fieldName,
          oldValue: changeRequest.oldValue,
          newValue: changeRequest.newValue,
        },
        ip: meta.ip,
        userAgent: meta.userAgent,
      })

      return apiSuccess(updated)
    }

    // REJECT
    const rejected = await prisma.profileChangeRequest.update({
      where: { id },
      data: {
        status: 'CHANGE_REJECTED',
        reviewedBy: user.employeeId,
        reviewedAt: new Date(),
        rejectionReason: rejectionReason!.trim(),
      },
    })

    // Notification: rejected
    sendNotification({
      employeeId: changeRequest.employeeId,
      triggerType: 'PROFILE_CHANGE_REJECTED',
      title: '프로필 변경 반려',
      body: `${fieldLabel} 변경 요청이 반려되었습니다. 사유: ${rejectionReason!.trim()}`,
      link: '/employees/me',
    })

    // Audit log
    const meta = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'PROFILE_CHANGE_REJECT',
      resourceType: 'ProfileChangeRequest',
      resourceId: id,
      companyId: changeRequest.employee.companyId,
      changes: {
        fieldName: changeRequest.fieldName,
        rejectionReason: rejectionReason!.trim(),
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    })

    return apiSuccess(rejected)
  },
  perm(MODULE.EMPLOYEES, ACTION.APPROVE),
)
