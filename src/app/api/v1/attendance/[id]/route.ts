// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Single Attendance Detail & Correction API
// GET  /api/v1/attendance/:id — Detail view
// PUT  /api/v1/attendance/:id — Manual correction (HR Admin)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { applyDirectAttendanceCorrection } from '@/lib/attendance/correction-service'

// ─── GET — Single attendance detail ──────────────────────

export const GET = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const attendance = await prisma.attendance.findFirst({
      where: {
        id,
        ...companyFilter,
      },
      include: {
        employee: {
          select: { name: true, employeeNo: true },
        },
      },
    })

    if (!attendance) {
      throw notFound('출근 기록을 찾을 수 없습니다.')
    }

    return apiSuccess(attendance)
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)

// ─── PUT — Manual correction (HR Admin) ──────────────────

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    let body: unknown
    try {
      body = await req.json()
    } catch {
      throw badRequest('요청 본문이 올바른 JSON 형식이 아닙니다.')
    }
    const updated = await applyDirectAttendanceCorrection({
      attendanceId: id,
      input: body,
      user,
      meta: extractRequestMeta(req.headers),
    })
    return apiSuccess(updated)
  },
  perm(MODULE.ATTENDANCE, ACTION.APPROVE),
)
