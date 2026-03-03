// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Unified Attendance Approval API (B6-2)
// GET  /api/v1/approvals/attendance  — 통합 승인함 목록
// POST /api/v1/approvals/attendance  — 승인 요청 생성
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { z } from 'zod'
import type { SessionUser } from '@/types'

const createSchema = z.object({
  requestType: z.enum(['leave', 'overtime', 'attendance_correction', 'shift_change']),
  referenceId: z.string().optional(),
  title: z.string().min(1).max(200),
  details: z.record(z.string(), z.unknown()).optional(),
  approverIds: z.array(z.string().uuid()).min(1).max(5),
})

// ─── GET: 통합 승인함 목록 ────────────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const requestType = searchParams.get('requestType')
    const view = searchParams.get('view') ?? 'mine' // mine | team | pending-approval
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const skip = (page - 1) * limit

    const companyFilter =
      user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    let where: Record<string, unknown> = { ...companyFilter }

    if (view === 'mine') {
      // 내가 신청한 요청
      where = { ...where, requesterId: user.employeeId }
    } else if (view === 'pending-approval') {
      // 내가 승인해야 하는 요청
      where = {
        ...where,
        steps: {
          some: {
            approverId: user.employeeId,
            status: 'pending',
          },
        },
        status: 'pending',
      }
    } else if (view === 'team') {
      // 팀원 요청 (매니저/HR용) — companyId만 필터
    }

    if (status) where.status = status
    if (requestType) where.requestType = requestType

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
  perm(MODULE.LEAVE, ACTION.VIEW),
)

// ─── POST: 승인 요청 생성 ────────────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)
    const data = parsed.data

    const companyId = user.companyId
    if (!companyId) throw badRequest('법인 정보가 없습니다.')

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
        data: data.approverIds.map((approverId, idx) => ({
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
  perm(MODULE.LEAVE, ACTION.CREATE),
)
