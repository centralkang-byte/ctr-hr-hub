// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Delegation API
// GET  /api/v1/delegation        → 나의 대결 목록
// POST /api/v1/delegation        → 대결 생성
// ═══════════════════════════════════════════════════════════

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { eventBus } from '@/lib/events/event-bus'

function apiErr(opts: { status: number; message: string }) {
  return NextResponse.json(
    { error: { code: opts.status < 500 ? 'BAD_REQUEST' : 'INTERNAL_ERROR', message: opts.message } },
    { status: opts.status },
  )
}

// ─── GET: 나의 대결 목록 (내가 위임한 + 나에게 위임된) ─────

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    // EMPLOYEE는 위임 기능 사용 불가
    if (user.role === ROLE.EMPLOYEE) {
      return apiErr({ status: 403, message: '위임 기능은 매니저 이상만 사용할 수 있습니다.' })
    }

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') ?? 'all' // 'delegated' | 'received' | 'all'
    const includeExpired = searchParams.get('includeExpired') === 'true'

    const statusFilter = includeExpired
      ? undefined
      : { in: ['ACTIVE' as const] }

    const [delegated, received] = await Promise.all([
      type === 'received'
        ? Promise.resolve([])
        : prisma.approvalDelegation.findMany({
            where: {
              delegatorId: user.employeeId,
              companyId: user.companyId,
              ...(statusFilter ? { status: statusFilter } : {}),
            },
            include: {
              delegatee: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  assignments: {
                    where: { isPrimary: true, endDate: null },
                    take: 1,
                    select: {
                      department: { select: { name: true } },
                      jobGrade: { select: { name: true } },
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          }),

      type === 'delegated'
        ? Promise.resolve([])
        : prisma.approvalDelegation.findMany({
            where: {
              delegateeId: user.employeeId,
              companyId: user.companyId,
              ...(statusFilter ? { status: statusFilter } : {}),
            },
            include: {
              delegator: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  assignments: {
                    where: { isPrimary: true, endDate: null },
                    take: 1,
                    select: {
                      department: { select: { name: true } },
                      jobGrade: { select: { name: true } },
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          }),
    ])

    return apiSuccess({ delegated, received })
  },
  perm(MODULE.LEAVE, ACTION.VIEW),
)

// ─── POST: 대결 생성 ──────────────────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    // EMPLOYEE는 위임 기능 사용 불가
    if (user.role === ROLE.EMPLOYEE) {
      return apiErr({ status: 403, message: '위임 기능은 매니저 이상만 사용할 수 있습니다.' })
    }

    const body = await req.json()
    const {
      delegateeId,
      scope = 'LEAVE_ONLY',
      reason,
      startDate,
      endDate,
    } = body as {
      delegateeId: string
      scope?: 'LEAVE_ONLY' | 'ALL'
      reason?: string
      startDate: string
      endDate: string
    }

    // Validation
    if (!delegateeId || !startDate || !endDate) {
      return apiErr({ status: 400, message: '필수 파라미터가 누락되었습니다.' })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (end <= start) {
      return apiErr({ status: 400, message: '종료일은 시작일 이후여야 합니다.' })
    }

    // Max 30 days
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff > 30) {
      return apiErr({ status: 400, message: '최대 30일까지 위임 가능합니다.' })
    }

    // Start date must not be in the past (allow today)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (end < today) {
      return apiErr({ status: 400, message: '종료일이 이미 지났습니다.' })
    }

    // Cannot delegate to self
    if (delegateeId === user.employeeId) {
      return apiErr({ status: 400, message: '본인에게 위임할 수 없습니다.' })
    }

    // Check delegatee exists, is in same company, and has MANAGER+ role
    const delegatee = await prisma.employee.findFirst({
      where: {
        id: delegateeId,
        assignments: {
          some: {
            companyId: user.companyId,
            isPrimary: true,
            endDate: null,
          },
        },
      },
      include: {
        employeeRoles: {
          where: { endDate: null },
          take: 1,
          include: { role: { select: { name: true } } },
        },
      },
    })

    if (!delegatee) {
      return apiErr({ status: 404, message: '대결자를 찾을 수 없습니다.' })
    }

    // Only Manager-level or above can be delegatees (not Employee)
    const INELIGIBLE_ROLES = ['employee']
    const delegateeRole = delegatee.employeeRoles[0]?.role?.name ?? ''
    if (!delegateeRole || INELIGIBLE_ROLES.includes(delegateeRole.toLowerCase())) {
      return apiErr({ status: 400, message: '대결자는 매니저 이상 직급이어야 합니다.' })
    }

    // Check for overlapping active delegation
    const overlap = await prisma.approvalDelegation.findFirst({
      where: {
        delegatorId: user.employeeId,
        status: 'ACTIVE',
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } },
        ],
      },
    })

    if (overlap) {
      return apiErr({
        status: 409,
        message: '해당 기간에 이미 활성화된 대결 설정이 있습니다.',
      })
    }

    // Create delegation
    const delegation = await prisma.approvalDelegation.create({
      data: {
        delegatorId: user.employeeId,
        delegateeId,
        companyId: user.companyId,
        scope,
        reason: reason ?? null,
        startDate: start,
        endDate: end,
        status: 'ACTIVE',
      },
      include: {
        delegatee: { select: { id: true, name: true } },
        delegator: { select: { id: true, name: true } },
      },
    })

    // Publish event
    void eventBus.publish('DELEGATION_STARTED', {
      delegationId: delegation.id,
      delegatorId: user.employeeId,
      delegateeId,
      companyId: user.companyId,
      scope,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    }).catch(console.error)

    return apiSuccess(delegation, 201)
  },
  perm(MODULE.LEAVE, ACTION.UPDATE),
)
