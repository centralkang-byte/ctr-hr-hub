// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Unified Attendance Approval API (B6-2)
// GET  /api/v1/approvals/attendance  — 통합 승인함 목록
// POST /api/v1/approvals/attendance  — 승인 요청 생성
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, forbidden } from '@/lib/errors'
import { hasPermission, perm, requirePermission, withAuth } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { z } from 'zod'
import type { SessionUser } from '@/types'
import { getCorrectionReviewerScope } from '@/lib/attendance/correction-roles'

const createSchema = z.object({
  requestType: z.enum(['leave', 'overtime', 'attendance_correction', 'shift_change']),
  referenceId: z.string().optional(),
  title: z.string().min(1).max(200),
  details: z.record(z.string(), z.unknown()).optional(),
  approverIds: z.array(z.string().uuid()).min(1).max(5),
}).strict()

const listQuerySchema = z.object({
  view: z.enum(['mine', 'team', 'pending-approval']).default('mine'),
  requestType: z.enum(['leave', 'overtime', 'attendance_correction', 'shift_change']).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict()

type ApprovalRequestType = z.infer<typeof createSchema>['requestType']

const APPROVAL_REQUEST_TYPES: ApprovalRequestType[] = [
  'leave',
  'overtime',
  'attendance_correction',
  'shift_change',
]

function permissionForRequestType(requestType: ApprovalRequestType, action: string) {
  switch (requestType) {
    case 'leave':
      return perm(MODULE.LEAVE, action)
    case 'overtime':
    case 'attendance_correction':
    case 'shift_change':
      return perm(MODULE.ATTENDANCE, action)
  }
}

// ─── GET: 통합 승인함 목록 ────────────────────────────────

export const GET = withAuth(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const parsed = listQuerySchema.safeParse(Object.fromEntries(searchParams.entries()))
    if (!parsed.success) throw badRequest('조회 조건이 올바르지 않습니다.')
    const { status, requestType, view, page, limit } = parsed.data
    const skip = (page - 1) * limit

    const { isGlobalSuper, hrCompanyIds } = await getCorrectionReviewerScope(
      prisma,
      user.employeeId,
    )
    const canReadLeave = hasPermission(user, perm(MODULE.LEAVE, ACTION.VIEW))
    const canReadAttendance = hasPermission(user, perm(MODULE.ATTENDANCE, ACTION.VIEW))
    const allowedTypes = APPROVAL_REQUEST_TYPES.filter((type) =>
      type === 'leave' ? canReadLeave : canReadAttendance,
    )
    if (allowedTypes.length === 0) {
      throw forbidden('승인 요청을 조회할 권한이 없습니다.')
    }
    if (requestType && !allowedTypes.includes(requestType)) {
      requirePermission(user, permissionForRequestType(requestType, ACTION.VIEW))
    }

    let where: Record<string, unknown>

    if (view === 'mine') {
      // Request ownership is sufficient even after a company transfer.
      where = {
        requesterId: user.employeeId,
        requestType: { in: requestType ? [requestType] : allowedTypes },
      }
    } else {
      if (view === 'team' && !isGlobalSuper && hrCompanyIds.length === 0) {
        throw forbidden('HR 관리자만 팀 요청을 조회할 수 있습니다.')
      }

      const pendingStep = {
        some: {
          approverId: user.employeeId,
          status: 'pending',
        },
      }

      const requestedTypes = requestType ? [requestType] : allowedTypes
      const branches: Record<string, unknown>[] = []

      for (const type of requestedTypes) {
        const isCorrection = type === 'attendance_correction'
        const canReadType = type === 'leave' ? canReadLeave : canReadAttendance
        if (!canReadType) continue
        if (isCorrection && !isGlobalSuper && hrCompanyIds.length === 0) continue

        branches.push({
          requestType: type,
          ...(isCorrection
            ? isGlobalSuper ? {} : { companyId: { in: hrCompanyIds } }
            : isGlobalSuper
              ? {}
              : view === 'team'
                ? { companyId: { in: hrCompanyIds } }
                : { companyId: user.companyId }),
          ...(view === 'pending-approval' ? { steps: pendingStep } : {}),
        })
      }

      if (branches.length === 0) {
        throw forbidden('승인 요청을 조회할 권한이 없습니다.')
      }
      where = {
        OR: branches,
        ...(view === 'pending-approval' ? { status: 'pending' } : {}),
      }
    }

    if (status) where.status = status

    const [requests, total] = await Promise.all([
      prisma.attendanceApprovalRequest.findMany({
        where,
        include: {
          requester: { select: { id: true, name: true, employeeNo: true } },
          steps: {
            include: { approver: { select: { id: true, name: true } } },
            orderBy: { stepOrder: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.attendanceApprovalRequest.count({ where }),
    ])

    return apiPaginated(requests, buildPagination(page, limit, total))
  },
)

// ─── POST: 승인 요청 생성 ────────────────────────────────

export const POST = withAuth(
  async (req: NextRequest, _context, user: SessionUser) => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      throw badRequest('요청 본문이 올바른 JSON 형식이 아닙니다.')
    }
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)
    const data = parsed.data

    if (data.requestType === 'attendance_correction') {
      throw badRequest('근태 보정 요청은 전용 API를 사용해야 합니다.')
    }
    requirePermission(user, permissionForRequestType(data.requestType, ACTION.CREATE))

    const companyId = user.companyId
    if (!companyId) throw badRequest('법인 정보가 없습니다.')

    const approverIds = [...new Set(data.approverIds)]
    if (approverIds.length !== data.approverIds.length || approverIds.includes(user.employeeId)) {
      throw badRequest('승인자를 다시 확인해 주세요.')
    }
    const now = new Date()
    const eligibleApprovers = await prisma.employee.findMany({
      where: {
        id: { in: approverIds },
        deletedAt: null,
        assignments: {
          some: {
            companyId,
            effectiveDate: { lte: now },
            endDate: null,
            isPrimary: true,
            status: { in: ['ACTIVE', 'ON_LEAVE'] },
          },
        },
      },
      select: { id: true },
    })
    if (eligibleApprovers.length !== approverIds.length) {
      throw badRequest('같은 법인의 재직 중인 직원만 승인자로 지정할 수 있습니다.')
    }

    const request = await prisma.$transaction(async (tx) => {
      const created = await tx.attendanceApprovalRequest.create({
        data: {
          companyId,
          requesterId: user.employeeId,
          requestType: data.requestType,
          referenceId: data.referenceId,
          title: data.title,
          details: (data.details ?? {}) as object,
          status: 'pending',
          currentStep: 1,
        },
      })

      // 승인 단계 생성
      await tx.attendanceApprovalStep.createMany({
        data: approverIds.map((approverId, idx) => ({
          requestId: created.id,
          stepOrder: idx + 1,
          approverId,
          status: idx === 0 ? 'pending' : 'waiting',
        })),
      })

      return tx.attendanceApprovalRequest.findUnique({
        where: { id: created.id },
        include: {
          steps: {
            include: { approver: { select: { id: true, name: true } } },
            orderBy: { stepOrder: 'asc' },
          },
        },
      })
    })

    return apiSuccess(request, 201)
  },
)
