import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyTerminal, updateTerminalHeartbeat } from '@/lib/terminal'
import { terminalClockSchema } from '@/lib/schemas/terminal'
import { isAppError, badRequest, notFound, AppError } from '@/lib/errors'
import { apiSuccess, apiError } from '@/lib/api'
import {
  completeClockOutEvent,
  createClockInEvent,
} from '@/lib/attendance/clock-event-service'
import { resolveDayContext } from '@/lib/attendance/judgeStatus'

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
      return apiError(badRequest('잘못된 요청'))
    }

    // 판정·소속 날짜 기준은 항상 단말기 이벤트 시각(eventTime) — 서버 now 사용 금지 (S276)
    const eventTime = new Date(parsed.data.timestamp)
    const { workDate: eventDate } = await resolveDayContext(
      terminal.companyId,
      eventTime,
    )

    // 3. Find employee by employeeNo in the terminal company on the event date
    const employee = await prisma.employee.findFirst({
      where: {
        employeeNo: parsed.data.employeeNo,
        deletedAt: null,
        assignments: {
          some: {
            companyId: terminal.companyId,
            isPrimary: true,
            effectiveDate: { lte: eventDate },
            OR: [
              { endDate: null },
              { endDate: { gt: eventDate } },
            ],
          },
        },
      },
    })
    if (!employee) {
      return apiError(notFound('직원을 찾을 수 없습니다.'))
    }

    if (parsed.data.eventType === 'CLOCK_IN') {
      const attendance = await createClockInEvent({
        companyId: terminal.companyId,
        employeeId: employee.id,
        eventTime,
        method: 'FINGERPRINT',
        source: 'terminal',
        terminalId: terminal.id,
      })

      // Update heartbeat
      await updateTerminalHeartbeat(terminal.id)

      return apiSuccess({ id: attendance.id, type: 'CLOCK_IN' }, 201)
    } else {
      const { attendance, totalMinutes, overtimeMinutes } =
        await completeClockOutEvent({
          companyId: terminal.companyId,
          employeeId: employee.id,
          eventTime,
          method: 'FINGERPRINT',
          source: 'terminal',
          overtimeBreakPolicy: 'graduated',
        })

      await updateTerminalHeartbeat(terminal.id)

      return apiSuccess({ id: attendance.id, type: 'CLOCK_OUT', totalMinutes, overtimeMinutes })
    }
  } catch (error) {
    if (isAppError(error)) {
      return apiError(error as AppError)
    }
    return apiError(new AppError(500, 'INTERNAL_ERROR', '서버 오류'))
  }
}
