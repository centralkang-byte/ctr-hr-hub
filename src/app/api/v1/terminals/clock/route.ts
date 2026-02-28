import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyTerminal, updateTerminalHeartbeat } from '@/lib/terminal'
import { terminalClockSchema } from '@/lib/schemas/terminal'
import { isAppError } from '@/lib/errors'

// ─── POST /api/v1/terminals/clock ───────────────────────
// Terminal clock event (CLOCK_IN / CLOCK_OUT)
// Uses terminal auth (X-Terminal-ID + X-Terminal-Secret), NOT withPermission

export async function POST(req: NextRequest) {
  try {
    // 1. Verify terminal
    const terminal = await verifyTerminal(req.headers)

    // 2. Parse body
    const body: unknown = await req.json()
    const parsed = terminalClockSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: '잘못된 요청', issues: parsed.error.issues },
        { status: 400 },
      )
    }

    // 3. Find employee by employeeNo in same company
    const employee = await prisma.employee.findFirst({
      where: {
        employeeNo: parsed.data.employeeNo,
        companyId: terminal.companyId,
        deletedAt: null,
      },
    })
    if (!employee) {
      return NextResponse.json(
        { error: '직원을 찾을 수 없습니다.' },
        { status: 404 },
      )
    }

    const eventTime = new Date(parsed.data.timestamp)
    const today = new Date(eventTime)
    today.setHours(0, 0, 0, 0)

    if (parsed.data.eventType === 'CLOCK_IN') {
      // Check for existing uncompleted attendance today
      const existing = await prisma.attendance.findFirst({
        where: {
          employeeId: employee.id,
          workDate: today,
          clockOut: null,
        },
      })

      if (existing) {
        // Auto-close previous day's record at 23:59
        const autoClockOut = new Date(existing.workDate)
        autoClockOut.setHours(23, 59, 0, 0)
        await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            clockOut: autoClockOut,
            clockOutMethod: 'FINGERPRINT',
            totalMinutes: existing.clockIn
              ? Math.round((autoClockOut.getTime() - existing.clockIn.getTime()) / 60000)
              : 0,
            note: '단말기 자동 퇴근 처리',
          },
        })
      }

      // Create new attendance
      const attendance = await prisma.attendance.create({
        data: {
          employeeId: employee.id,
          companyId: terminal.companyId,
          workDate: today,
          clockIn: eventTime,
          clockInMethod: 'FINGERPRINT',
          status: 'NORMAL',
          workType: 'NORMAL',
          terminalId: terminal.id,
        },
      })

      // Update heartbeat
      await updateTerminalHeartbeat(terminal.id)

      return NextResponse.json(
        { success: true, data: { id: attendance.id, type: 'CLOCK_IN' } },
        { status: 201 },
      )
    } else {
      // CLOCK_OUT: find today's uncompleted attendance
      const existing = await prisma.attendance.findFirst({
        where: {
          employeeId: employee.id,
          clockOut: null,
        },
        orderBy: { clockIn: 'desc' },
      })

      if (!existing) {
        return NextResponse.json(
          { error: '출근 기록이 없습니다.' },
          { status: 400 },
        )
      }

      const totalMinutes = existing.clockIn
        ? Math.round((eventTime.getTime() - existing.clockIn.getTime()) / 60000)
        : 0
      const breakMinutes =
        totalMinutes >= 480 ? 60 : totalMinutes >= 240 ? 30 : 0
      const standardMinutes = 480
      const overtimeMinutes = Math.max(
        0,
        totalMinutes - breakMinutes - standardMinutes,
      )

      const attendance = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          clockOut: eventTime,
          clockOutMethod: 'FINGERPRINT',
          totalMinutes,
          overtimeMinutes,
        },
      })

      await updateTerminalHeartbeat(terminal.id)

      return NextResponse.json({
        success: true,
        data: {
          id: attendance.id,
          type: 'CLOCK_OUT',
          totalMinutes,
          overtimeMinutes,
        },
      })
    }
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json(
        { error: (error as { message: string }).message },
        { status: (error as { statusCode: number }).statusCode },
      )
    }
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
