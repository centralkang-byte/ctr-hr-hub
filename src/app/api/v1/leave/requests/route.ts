// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Requests API
// GET  /api/v1/leave/requests  — My leave requests
// POST /api/v1/leave/requests  — Create leave request
//
// F-3 Enhancements:
//   - Negative balance (마이너스 연차) support
//   - Advance booking + consecutive limit validation
//   - Team simultaneous absence warning
//   - Concurrency guard ($transaction)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { leaveRequestCreateSchema } from '@/lib/schemas/leave'
import { fetchPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import { calculateLeaveDays } from '@/lib/leave/calculateLeaveDays'
import { fetchCompanyHolidays } from '@/lib/leave/fetchHolidays'
import { resolveLeaveTypeDefId } from '@/lib/leave/resolveLeaveTypeDefId'
import { leaveTypeUsesBalance, resolveEventLeaveDays } from '@/lib/leave/eventBasedLeave'
import type { SessionUser } from '@/types'

// ─── GET: My leave requests ──────────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const skip = (page - 1) * limit

    const where = {
      employeeId: user.employeeId,
      ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' } : {}),
    }

    const [requests, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: {
          policy: { select: { name: true, leaveType: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.leaveRequest.count({ where }),
    ])

    return apiPaginated(requests, buildPagination(page, limit, total))
  },
  perm(MODULE.LEAVE, ACTION.VIEW),
)

// ─── POST: Create leave request ──────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body = await req.json()
    const parsed = leaveRequestCreateSchema.safeParse(body)

    if (!parsed.success) {
      throw badRequest('입력값이 올바르지 않습니다.', {
        issues: parsed.error.issues,
      })
    }

    const startDate = new Date(parsed.data.startDate)
    const endDate = new Date(parsed.data.endDate)
    const now = new Date()
    const warnings: string[] = []

    // B-3h: 겸직자도 Primary Assignment의 법인 기준으로만 휴가 차감
    const primaryAssignment = await fetchPrimaryAssignment(user.employeeId)
    const primaryCompanyId = primaryAssignment?.companyId ?? user.companyId

    // 멀티테넌트 FK 검증: policy는 본인 법인 소속(LeavePolicy.companyId는 non-null=법인전용), typeDef는 본인 법인 또는 글로벌(null)
    const policyOwned = await prisma.leavePolicy.findFirst({
      where: { id: parsed.data.policyId, companyId: primaryCompanyId, deletedAt: null },
      select: { id: true },
    })
    if (!policyOwned) throw badRequest('유효하지 않은 휴가 정책입니다.')
    if (parsed.data.leaveTypeDefId) {
      const typeDefOwned = await prisma.leaveTypeDef.findFirst({
        where: { id: parsed.data.leaveTypeDefId, OR: [{ companyId: primaryCompanyId }, { companyId: null }] },
        select: { id: true },
      })
      if (!typeDefOwned) throw badRequest('유효하지 않은 휴가 유형입니다.')
    }

    // ── F-3: LeaveTypeDef validation (minAdvanceDays, maxConsecutiveDays) ───

    // ── Phase 5: LeaveTypeDef 조회 (직접 ID 또는 policy 경유) ──

    let countingMethod: 'business_day' | 'calendar_day' = 'business_day'
    let includesHolidays = false
    let resolvedLeaveTypeDefId: string | null = parsed.data.leaveTypeDefId ?? null

    // leaveTypeDefId가 직접 제공되면 바로 조회, 아니면 policyId 경유 resolve
    type LeaveTypeDefInfo = {
      id: string
      minAdvanceDays: number | null
      maxConsecutiveDays: number | null
      countingMethod: string
      includesHolidays: boolean
      maxPerYear: number | null
      isSplittable: boolean
    }
    let leaveTypeDef: LeaveTypeDefInfo | null = null

    if (!resolvedLeaveTypeDefId) {
      resolvedLeaveTypeDefId = await resolveLeaveTypeDefId(parsed.data.policyId)
    }

    if (resolvedLeaveTypeDefId) {
      leaveTypeDef = await prisma.leaveTypeDef.findUnique({
        where: { id: resolvedLeaveTypeDefId },
        select: {
          id: true,
          minAdvanceDays: true,
          maxConsecutiveDays: true,
          countingMethod: true,
          includesHolidays: true,
          maxPerYear: true,
          isSplittable: true,
        },
      })
    }

    // 적립형(잔액 추적) vs 이벤트형(권리 기반) 판별 — accrualEngine 거울상(규칙 없음 ⇒ 잔액 없음)
    const usesBalance = resolvedLeaveTypeDefId
      ? await leaveTypeUsesBalance(resolvedLeaveTypeDefId)
      : false

    if (leaveTypeDef) {
      countingMethod = (leaveTypeDef.countingMethod as 'business_day' | 'calendar_day') ?? 'business_day'
      includesHolidays = leaveTypeDef.includesHolidays ?? false

      // Rule 1: Minimum advance booking (사전 신청 기간)
      if (leaveTypeDef.minAdvanceDays && leaveTypeDef.minAdvanceDays > 0) {
        const daysUntilStart = Math.floor(
          (startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        )
        if (daysUntilStart < leaveTypeDef.minAdvanceDays) {
          throw badRequest(
            `이 휴가 유형은 최소 ${leaveTypeDef.minAdvanceDays}일 전에 신청해야 합니다.`,
          )
        }
      }

      // Rule 2: Maximum consecutive days (연속 상한) — countingMethod 반영
      // 적립형만 여기서 검증. 이벤트형은 아래 전용 블록에서 cap + 권위 일수 산정.
      if (usesBalance && leaveTypeDef.maxConsecutiveDays && leaveTypeDef.maxConsecutiveDays > 0) {
        const holidays = await fetchCompanyHolidays(primaryCompanyId, startDate, endDate)
        const leaveDays = calculateLeaveDays({
          startDate,
          endDate,
          countingMethod,
          includesHolidays,
          holidays,
        })
        if (leaveDays > leaveTypeDef.maxConsecutiveDays) {
          throw badRequest(
            `최대 연속 ${leaveTypeDef.maxConsecutiveDays}일까지 신청할 수 있습니다.`,
          )
        }
      }

      // Rule 3: maxPerYear 검증 (연간 최대 사용 횟수)
      if (leaveTypeDef.maxPerYear && resolvedLeaveTypeDefId) {
        const currentYear = now.getFullYear()
        const yearStart = new Date(currentYear, 0, 1)
        const yearEnd = new Date(currentYear, 11, 31)
        const usedCount = await prisma.leaveRequest.count({
          where: {
            employeeId: user.employeeId,
            leaveTypeDefId: resolvedLeaveTypeDefId,
            status: { in: ['PENDING', 'APPROVED'] },
            startDate: { gte: yearStart, lte: yearEnd },
          },
        })
        if (usedCount >= leaveTypeDef.maxPerYear) {
          throw badRequest(
            `이 휴가 유형은 연간 최대 ${leaveTypeDef.maxPerYear}회까지 사용할 수 있습니다. (현재 ${usedCount}회 사용)`,
          )
        }
      }

      // Rule 4: isSplittable 검증 (분할 불가인데 반차 신청)
      if (!leaveTypeDef.isSplittable && parsed.data.halfDayType) {
        throw badRequest('이 휴가 유형은 반차(분할) 사용이 불가합니다.')
      }
    }

    // ── 이벤트형(권리 기반) 휴가: 정책 정의 일수로 검증 + 권위 일수 산정 ──
    // 적립형은 parsed.data.days를 잔액으로 검증하므로 그대로 사용한다.
    let effectiveDays = parsed.data.days
    if (!usesBalance) {
      const { days, cap } = await resolveEventLeaveDays({
        companyId: primaryCompanyId,
        policyId: parsed.data.policyId,
        startDate,
        endDate,
        countingMethod,
        includesHolidays,
        maxConsecutiveDays: leaveTypeDef?.maxConsecutiveDays ?? null,
        isSplittable: leaveTypeDef?.isSplittable ?? false,
        halfDayType: parsed.data.halfDayType,
        clientDays: parsed.data.days,
      })
      if (days <= 0) {
        throw badRequest('신청 가능한 휴가일이 없습니다. 날짜를 확인해주세요.')
      }
      if (cap != null && days > cap) {
        throw badRequest(`이 휴가 유형은 최대 ${cap}일까지 신청할 수 있습니다.`)
      }
      effectiveDays = days
    }

    // ── F-3: Half-day duplicate warning (반차+반차=1일) ──

    if (parsed.data.halfDayType) {
      const existingHalfDay = await prisma.leaveRequest.findFirst({
        where: {
          employeeId: user.employeeId,
          startDate,
          status: { in: ['PENDING', 'APPROVED'] },
          halfDayType: { not: null },
        },
      })

      if (existingHalfDay && existingHalfDay.halfDayType !== parsed.data.halfDayType) {
        warnings.push('같은 날 오전/오후 반차가 모두 신청되어 종일 휴가로 합산됩니다.')
      }
    }

    // ── Balance check + Negative balance + Transaction ──────

    // leaveTypeDefId가 없으면 policyId 경유 resolve
    if (!resolvedLeaveTypeDefId) {
      resolvedLeaveTypeDefId = await resolveLeaveTypeDefId(parsed.data.policyId)
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Read balance INSIDE transaction — 적립형만 (이벤트형은 잔액 row 없음)
      const balance =
        usesBalance && resolvedLeaveTypeDefId
          ? await tx.leaveYearBalance.findFirst({
              where: {
                employeeId: user.employeeId,
                leaveTypeDefId: resolvedLeaveTypeDefId,
                year: new Date().getFullYear(),
              },
            })
          : null

      // 적립형: 잔액 검증 (이벤트형은 위에서 정책 정의 일수로 이미 검증)
      if (usesBalance) {
        if (!balance) {
          throw badRequest('해당 휴가 유형의 잔여일이 없습니다.')
        }

        const totalAvailable =
          balance.entitled +
          balance.carriedOver +
          balance.adjusted -
          balance.used -
          balance.pending

        // 2. Check if request exceeds available
        if (effectiveDays > totalAvailable) {
          // 3. Check negative balance policy (B-3h: Primary 법인 기준)
          const leaveSetting = await tx.leaveSetting.findFirst({
            where: { companyId: primaryCompanyId },
          })

          const allowNegative = leaveSetting?.allowNegativeBalance ?? false
          const negativeLimit = leaveSetting?.negativeBalanceLimit ?? 0

          if (!allowNegative) {
            throw badRequest(
              `잔여 휴가가 부족합니다. (잔여: ${totalAvailable}일, 신청: ${effectiveDays}일)`,
            )
          }

          // 4. Check negative limit
          const wouldBeRemaining = totalAvailable - effectiveDays // negative number
          if (wouldBeRemaining < negativeLimit) {
            throw badRequest(
              `마이너스 연차 한도(${Math.abs(negativeLimit)}일)를 초과합니다. 현재 사용 가능: ${totalAvailable + Math.abs(negativeLimit)}일`,
            )
          }

          // 5. Add warning for negative usage
          const negativeUsed = effectiveDays - totalAvailable
          warnings.push(
            `마이너스 연차 ${negativeUsed}일이 사용됩니다. 다음 연도 부여 시 자동 차감됩니다.`,
          )
        }
      }

      // 6. Create request (B-3h: Primary 법인 기준으로 생성)
      const request = await tx.leaveRequest.create({
        data: {
          employeeId: user.employeeId,
          companyId: primaryCompanyId,
          policyId: parsed.data.policyId,
          leaveTypeDefId: resolvedLeaveTypeDefId,
          startDate,
          endDate,
          days: effectiveDays,
          halfDayType: parsed.data.halfDayType ?? null,
          reason: parsed.data.reason,
          status: 'PENDING',
        },
      })

      // 7. Atomic increment pending — 적립형만 (이벤트형은 잔액 미추적)
      if (balance) {
        await tx.leaveYearBalance.update({
          where: { id: balance.id },
          data: { pending: { increment: effectiveDays } },
        })
      }

      return request
    })

    // ── F-3: Team simultaneous absence warning ──────────────

    try {
      // Count team members on leave during the same period
      const teamAbsences = await prisma.leaveRequest.count({
        where: {
          companyId: primaryCompanyId,
          employeeId: { not: user.employeeId },
          status: { in: ['PENDING', 'APPROVED'] },
          startDate: { lte: endDate },
          endDate: { gte: startDate },
          // Same approver = same team
          approvedById: {
            not: null,
          },
        },
      })

      if (teamAbsences >= 2) {
        warnings.push(
          `⚠️ 이 기간 다른 팀원 ${teamAbsences}명이 부재 예정입니다. 매니저의 반려 가능성이 있습니다.`,
        )
      }
    } catch {
      // Non-blocking: warning failure shouldn't block request creation
    }

    // ── Audit log ──

    const meta = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'leave.request.create',
      resourceType: 'LeaveRequest',
      resourceId: result.id,
      companyId: primaryCompanyId,
      changes: {
        policyId: parsed.data.policyId,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        days: effectiveDays,
      },
      ...meta,
    })

    return apiSuccess(
      {
        ...result,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
      201,
    )
  },
  perm(MODULE.LEAVE, ACTION.CREATE),
)
