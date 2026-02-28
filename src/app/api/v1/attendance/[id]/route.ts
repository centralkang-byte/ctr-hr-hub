// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Single Attendance Detail & Correction API
// GET  /api/v1/attendance/:id — Detail view
// PUT  /api/v1/attendance/:id — Manual correction (HR Admin)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Correction Schema ──────────────────────────────────

const correctionSchema = z.object({
  clockIn: z.string().datetime().optional(),
  clockOut: z.string().datetime().optional(),
  workType: z.enum(['REGULAR', 'REMOTE', 'FIELD', 'BUSINESS_TRIP']).optional(),
  status: z.enum(['NORMAL', 'LATE', 'EARLY_OUT', 'ABSENT', 'ON_LEAVE', 'HOLIDAY']).optional(),
  note: z.string().min(1, '수정 사유를 입력해주세요').max(500),
})

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

    // 1. Parse & validate body
    const body = await req.json()
    const parsed = correctionSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('입력값이 올바르지 않습니다.', {
        issues: parsed.error.issues,
      })
    }

    // 2. Find existing record
    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const attendance = await prisma.attendance.findFirst({
      where: {
        id,
        ...companyFilter,
      },
    })

    if (!attendance) {
      throw notFound('출근 기록을 찾을 수 없습니다.')
    }

    // 3. Store previous values for audit
    const previousValues: Record<string, unknown> = {}
    if (parsed.data.clockIn !== undefined) previousValues.clockIn = attendance.clockIn
    if (parsed.data.clockOut !== undefined) previousValues.clockOut = attendance.clockOut
    if (parsed.data.workType !== undefined) previousValues.workType = attendance.workType
    if (parsed.data.status !== undefined) previousValues.status = attendance.status
    previousValues.note = attendance.note

    // 4. Build update data
    const updateData: Record<string, unknown> = {
      note: parsed.data.note,
    }

    if (parsed.data.clockIn !== undefined) {
      updateData.clockIn = new Date(parsed.data.clockIn)
    }
    if (parsed.data.clockOut !== undefined) {
      updateData.clockOut = new Date(parsed.data.clockOut)
    }
    if (parsed.data.workType !== undefined) {
      updateData.workType = parsed.data.workType
    }
    if (parsed.data.status !== undefined) {
      updateData.status = parsed.data.status
    }

    // 5. Recalculate totalMinutes if clockIn or clockOut changed
    const effectiveClockIn = parsed.data.clockIn
      ? new Date(parsed.data.clockIn)
      : attendance.clockIn
    const effectiveClockOut = parsed.data.clockOut
      ? new Date(parsed.data.clockOut)
      : attendance.clockOut

    if (effectiveClockIn && effectiveClockOut) {
      const diffMs = effectiveClockOut.getTime() - effectiveClockIn.getTime()
      updateData.totalMinutes = Math.max(0, Math.round(diffMs / 60000))
    }

    // 6. Update the record
    const updated = await prisma.attendance.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: { name: true, employeeNo: true },
        },
      },
    })

    // 7. Audit log (fire-and-forget)
    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'attendance.manual_correction',
      resourceType: 'attendance',
      resourceId: id,
      companyId: attendance.companyId,
      changes: { before: JSON.parse(JSON.stringify(previousValues)), after: parsed.data },
      ip,
      userAgent,
    })

    return apiSuccess(updated)
  },
  perm(MODULE.ATTENDANCE, ACTION.APPROVE),
)
