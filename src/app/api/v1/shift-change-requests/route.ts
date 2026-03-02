// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Shift Change Requests API
// GET  /api/v1/shift-change-requests  — List change requests
// POST /api/v1/shift-change-requests  — Create change request
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { shiftChangeRequestCreateSchema } from '@/lib/schemas/shift'
import type { SessionUser } from '@/types'
// ShiftChangeRequestStatus is mapped via @@map, use string literal
type ShiftChangeRequestStatus = 'SCR_PENDING' | 'SCR_APPROVED' | 'SCR_REJECTED'

// ─── GET: List change requests ──────────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    try {
      const { searchParams } = new URL(req.url)
      const status = searchParams.get('status') as ShiftChangeRequestStatus | null
      const page = Math.max(1, Number(searchParams.get('page') ?? 1))
      const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))
      const skip = (page - 1) * limit

      const companyFilter =
        user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

      const where = {
        ...companyFilter,
        ...(status ? { status } : {}),
      }

      const [requests, total] = await Promise.all([
        prisma.shiftChangeRequest.findMany({
          where,
          include: {
            requester: {
              select: { id: true, name: true, employeeNo: true },
            },
            targetEmployee: {
              select: { id: true, name: true, employeeNo: true },
            },
            approver: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.shiftChangeRequest.count({ where }),
      ])

      return apiPaginated(requests, buildPagination(page, limit, total))
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)

// ─── POST: Create change request ────────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    try {
      const body = await req.json()
      const parsed = shiftChangeRequestCreateSchema.safeParse(body)

      if (!parsed.success) {
        throw badRequest('입력값이 올바르지 않습니다.', {
          issues: parsed.error.issues,
        })
      }

      const request = await prisma.shiftChangeRequest.create({
        data: {
          companyId: user.companyId,
          requesterId: user.employeeId,
          targetEmployeeId: parsed.data.targetEmployeeId ?? null,
          originalDate: new Date(parsed.data.originalDate),
          requestedDate: parsed.data.requestedDate
            ? new Date(parsed.data.requestedDate)
            : null,
          originalSlotIndex: parsed.data.originalSlotIndex,
          requestedSlotIndex: parsed.data.requestedSlotIndex ?? null,
          reason: parsed.data.reason,
          status: 'SCR_PENDING',
        },
        include: {
          requester: {
            select: { id: true, name: true, employeeNo: true },
          },
          targetEmployee: {
            select: { id: true, name: true, employeeNo: true },
          },
        },
      })

      return apiSuccess(request, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.CREATE),
)
