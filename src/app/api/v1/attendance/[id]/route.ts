// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Single Attendance Detail & Correction API
// GET  /api/v1/attendance/:id — Detail view
// PUT  /api/v1/attendance/:id — Manual correction (HR Admin)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { computeOvertimeMinutes } from '@/lib/attendance/overtime'
import { judgeStatusForAttendance } from '@/lib/attendance/judgeStatus'
import type { SessionUser } from '@/types'

// ─── Correction Schema ──────────────────────────────────

const correctionSchema = z.object({
  // null = 시각 삭제(미기록으로 되돌림), undefined = 변경 없음
  clockIn: z.string().datetime().nullable().optional(),
  clockOut: z.string().datetime().nullable().optional(),
  workType: z.enum(['NORMAL', 'OVERTIME', 'NIGHT', 'HOLIDAY']).optional(),
  status: z.enum(['NORMAL', 'LATE', 'EARLY_OUT', 'ABSENT']).optional(),
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

    // 0. 수동보정은 HR 전용 — MANAGER의 attendance_manage가 전사 쓰기로 새지 않게 차단 (att-05)
    if (user.role !== ROLE.HR_ADMIN && user.role !== ROLE.SUPER_ADMIN) {
      throw forbidden('근태 보정 권한이 없습니다.')
    }

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
      updateData.clockIn = parsed.data.clockIn ? new Date(parsed.data.clockIn) : null
    }
    if (parsed.data.clockOut !== undefined) {
      updateData.clockOut = parsed.data.clockOut ? new Date(parsed.data.clockOut) : null
    }
    if (parsed.data.workType !== undefined) {
      updateData.workType = parsed.data.workType
    }
    if (parsed.data.status !== undefined) {
      updateData.status = parsed.data.status
    }

    // 5. Recalculate totalMinutes if clockIn or clockOut changed
    const effectiveClockIn = parsed.data.clockIn === undefined
      ? attendance.clockIn
      : parsed.data.clockIn
        ? new Date(parsed.data.clockIn)
        : null
    const effectiveClockOut = parsed.data.clockOut === undefined
      ? attendance.clockOut
      : parsed.data.clockOut
        ? new Date(parsed.data.clockOut)
        : null

    if (effectiveClockIn && effectiveClockOut) {
      const diffMs = effectiveClockOut.getTime() - effectiveClockIn.getTime()
      const totalMinutes = Math.max(0, Math.round(diffMs / 60000))
      updateData.totalMinutes = totalMinutes
      // 근무시간이 바뀌면 초과근무도 재계산 (clock-out 경로와 동일 식).
      // 누락 시 stale overtimeMinutes가 급여 초과수당으로 흘러감 (Bucket D #9).
      updateData.overtimeMinutes = computeOvertimeMinutes(totalMinutes)
    } else {
      // 시각이 삭제되면 파생 분(分)도 함께 초기화 — stale 값이 급여로 흘러가지 않게
      updateData.totalMinutes = null
      updateData.overtimeMinutes = null
    }

    // 시각이 바뀌었는데 status를 명시하지 않았으면 자동 재판정 (S276 att-09).
    // 규칙: 명시 status 항상 우선 · clockIn 없음→지각판정 안 함 · clockOut 없음→조퇴판정 안 함 ·
    //       수동 ABSENT는 시각 수정만으로 해제 안 됨(sticky).
    // 판정 기준은 보정 "대상 행"의 법인/직원 (SUPER_ADMIN 보정 시 user.companyId 사용 금지)
    const timesChanged =
      parsed.data.clockIn !== undefined || parsed.data.clockOut !== undefined
    if (timesChanged && parsed.data.status === undefined) {
      updateData.status = await judgeStatusForAttendance({
        companyId: attendance.companyId,
        employeeId: attendance.employeeId,
        workDate: attendance.workDate,
        clockIn: effectiveClockIn,
        clockOut: effectiveClockOut,
        previousStatus: attendance.status,
      })
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
