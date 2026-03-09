// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Unified Task List API
// GET /api/v1/unified-tasks
// ═══════════════════════════════════════════════════════════
//
// 쿼리 파라미터:
//   types        - 쉼표 구분 (e.g., LEAVE_APPROVAL,PAYROLL_REVIEW)
//   statuses     - 쉼표 구분 (e.g., PENDING,IN_PROGRESS)
//   assigneeId   - 담당자 필터 (생략 시 로그인 사용자)
//   requesterId  - 신청자 필터
//   page         - 기본 1
//   limit        - 기본 20, 최대 100
//   sortField    - createdAt|updatedAt|priority (기본 createdAt)
//   sortDir      - asc|desc (기본 desc)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import {
  UnifiedTaskType,
  UnifiedTaskStatus,
  type UnifiedTask,
  type UnifiedTaskListResponse,
} from '@/lib/unified-task/types'
import {
  leaveRequestMapper,
  type LeaveRequestWithRelations,
} from '@/lib/unified-task/mappers/leave.mapper'
import {
  payrollRunMapper,
  type PayrollRunWithRelations,
} from '@/lib/unified-task/mappers/payroll.mapper'
import {
  onboardingTaskMapper,
  type OnboardingTaskWithRelations,
} from '@/lib/unified-task/mappers/onboarding.mapper'
import {
  offboardingTaskMapper,
  OFFBOARDING_TASK_INCLUDE,
  type OffboardingTaskWithRelations,
} from '@/lib/unified-task/mappers/offboarding.mapper'
import {
  fetchPerformanceTasks,
} from '@/lib/unified-task/mappers/performance.mapper'

// ─── Priority 정렬 가중치 ────────────────────────────────

const PRIORITY_WEIGHT: Record<string, number> = {
  URGENT: 4,
  HIGH:   3,
  MEDIUM: 2,
  LOW:    1,
}

// ─── 타입 필터 파싱 ───────────────────────────────────────

function parseTypes(param: string | null): UnifiedTaskType[] | undefined {
  if (!param) return undefined
  const raw = param.split(',').map((s) => s.trim().toUpperCase())
  const valid = Object.values(UnifiedTaskType) as string[]
  const filtered = raw.filter((t) => valid.includes(t)) as UnifiedTaskType[]
  return filtered.length > 0 ? filtered : undefined
}

function parseStatuses(param: string | null): UnifiedTaskStatus[] | undefined {
  if (!param) return undefined
  const raw = param.split(',').map((s) => s.trim().toUpperCase())
  const valid = Object.values(UnifiedTaskStatus) as string[]
  const filtered = raw.filter((s) => valid.includes(s)) as UnifiedTaskStatus[]
  return filtered.length > 0 ? filtered : undefined
}

// ─── LeaveRequest 조회 ────────────────────────────────────

const LEAVE_INCLUDE = {
  employee: {
    select: {
      id: true,
      name: true,
      assignments: {
        where: { isPrimary: true, endDate: null },
        take: 1,
        select: {
          jobGrade: { select: { name: true } },
          department: { select: { name: true } },
        },
      },
    },
  },
  policy: {
    select: { name: true, leaveType: true, isPaid: true },
  },
  approver: {
    select: {
      id: true,
      name: true,
      assignments: {
        where: { isPrimary: true, endDate: null },
        take: 1,
        select: {
          jobGrade: { select: { name: true } },
          department: { select: { name: true } },
        },
      },
    },
  },
} as const

// ─── PayrollRun 조회 ──────────────────────────────────────

const PAYROLL_INCLUDE = {
  approver: {
    select: {
      id: true,
      name: true,
      assignments: {
        where: { isPrimary: true, endDate: null },
        take: 1,
        select: {
          jobGrade: { select: { name: true } },
          department: { select: { name: true } },
        },
      },
    },
  },
} as const

// ─── EmployeeOnboardingTask 조회 ───────────────────────────────────

const ONBOARDING_INCLUDE = {
  task: {
    select: {
      id:           true,
      title:        true,
      assigneeType: true,
      dueDaysAfter: true,
      isRequired:   true,
      category:     true,
      sortOrder:    true,
    },
  },
  employeeOnboarding: {
    include: {
      employee: {
        select: {
          id:   true,
          name: true,
          assignments: {
            where: { isPrimary: true, endDate: null },
            take:  1,
            select: {
              managerId:  true,
              jobGrade:   { select: { name: true } },
              department: { select: { name: true } },
            },
          },
        },
      },
      buddy:   { select: { id: true, name: true } },
      manager: { select: { id: true, name: true } },
    },
  },
} as const

// ─── GET Handler ──────────────────────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)

    // 파라미터 파싱
    const types      = parseTypes(searchParams.get('types'))
    const statuses   = parseStatuses(searchParams.get('statuses'))
    const assigneeId = searchParams.get('assigneeId') ?? undefined
    const requesterId = searchParams.get('requesterId') ?? undefined
    const page       = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit      = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const sortField  = (searchParams.get('sortField') ?? 'createdAt') as 'createdAt' | 'updatedAt' | 'priority'
    const sortDir    = (searchParams.get('sortDir') ?? 'desc') as 'asc' | 'desc'

    // 어떤 타입을 조회할지 결정
    const fetchLeave        = !types || types.includes(UnifiedTaskType.LEAVE_APPROVAL)
    const fetchPayroll      = !types || types.includes(UnifiedTaskType.PAYROLL_REVIEW)
    const fetchOnboarding   = !types || types.includes(UnifiedTaskType.ONBOARDING_TASK)
    const fetchOffboarding  = !types || types.includes(UnifiedTaskType.OFFBOARDING_TASK)
    const fetchPerformance  = !types || types.includes(UnifiedTaskType.PERFORMANCE_REVIEW)

    // ── 소스별 병렬 조회 ────────────────────────────────────

    const [leaveRaw, payrollRaw, onboardingRaw, offboardingRaw, performanceTasks] = await Promise.all([
      // 1. LeaveRequest
      fetchLeave
        ? prisma.leaveRequest.findMany({
            where: {
              companyId: user.companyId,
              // 매니저는 자기 팀 신청 조회, SUPER_ADMIN/HR_ADMIN은 전체
              ...(assigneeId ? { approvedBy: assigneeId } : {}),
              ...(requesterId ? { employeeId: requesterId } : {}),
            },
            include: LEAVE_INCLUDE,
            orderBy: { createdAt: 'desc' },
            // 소스 조회는 충분히 많이 가져와서 정렬/필터 후 페이지네이션
            take: 500,
          })
        : Promise.resolve([]),

      // 2. PayrollRun
      fetchPayroll
        ? prisma.payrollRun.findMany({
            where: {
              companyId: user.companyId,
              ...(assigneeId ? { approvedBy: assigneeId } : {}),
            },
            include: PAYROLL_INCLUDE,
            orderBy: { createdAt: 'desc' },
            take: 200,
          })
        : Promise.resolve([]),

      // 3. EmployeeOnboardingTask
      // 로그인 사용자가 담당자인 PENDING 타스크만 조회
      // assigneeType 기반으로 EMPLOYEE/BUDDY/MANAGER/HR/IT/FINANCE 분기
      fetchOnboarding
        ? prisma.employeeOnboardingTask.findMany({
            where: {
              status: 'PENDING',
              employeeOnboarding: {
                status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
                // 담당자 필터: EMPLOYEE(new hire 본인) OR BUDDY OR MANAGER
                // HR/IT/FINANCE는 해당 assigneeType로 필터
                OR: [
                  // 로그인 사용자의 온보딩 플랜 (신규 입사자 본인)
                  { employeeId: user.employeeId, companyId: user.companyId },
                  // 포괄적으로 법인 내 신규 입사자 온보딩 전체
                  { companyId: user.companyId },
                ],
              },
              // 담당자가 로그인 사용자인 타스크를 우선 노출
              ...(assigneeId
                ? {
                    OR: [
                      // 매니저인 경우: MANAGER 타스크 + assignment.managerId 일치
                      { task: { assigneeType: 'MANAGER' } },
                      // 버디인 경우
                      { task: { assigneeType: 'BUDDY' }, employeeOnboarding: { buddyId: assigneeId } },
                      // HR/IT/FINANCE 담당
                      { task: { assigneeType: { in: ['HR', 'IT', 'FINANCE'] } } },
                    ],
                  }
                : {}),
            },
            include: ONBOARDING_INCLUDE,
            orderBy: { employeeOnboarding: { createdAt: 'desc' } },
            take: 300,
          })
        : Promise.resolve([]),

      // 4. EmployeeOffboardingTask
      fetchOffboarding
        ? prisma.employeeOffboardingTask.findMany({
            where: {
              status: { in: ['PENDING', 'BLOCKED'] },
              employeeOffboarding: {
                status: 'IN_PROGRESS',
                employee: {
                  assignments: {
                    some: {
                      companyId: user.companyId,
                      isPrimary: true,
                      endDate: null,
                    },
                  },
                },
                // 로그인 사용자가 퇴직자 본인이거나 법인 전체 조회
                ...(assigneeId ? { employeeId: assigneeId } : {}),
              },
              ...(requesterId ? { employeeOffboarding: { employeeId: requesterId } } : {}),
            },
            include: OFFBOARDING_TASK_INCLUDE,
            orderBy: { employeeOffboarding: { lastWorkingDate: 'asc' } },   // 마감 임박 순
            take: 300,
          })
        : Promise.resolve([]),

      // 5. Performance Review Tasks (동적 계산)
      fetchPerformance
        ? fetchPerformanceTasks({
            employeeId: user.employeeId,
            companyId:  user.companyId,
            role:       user.role,
          })
        : Promise.resolve([]),
    ])

    // ── 매퍼 적용 ──────────────────────────────────────────

    const leaveTasks       = leaveRequestMapper.toUnifiedTasks(
      leaveRaw as LeaveRequestWithRelations[]
    )
    const payrollTasks     = payrollRunMapper.toUnifiedTasks(
      payrollRaw as PayrollRunWithRelations[]
    )
    const onboardingTasks  = onboardingTaskMapper.toUnifiedTasks(
      onboardingRaw as OnboardingTaskWithRelations[]
    )
    const offboardingTasks = offboardingTaskMapper.toUnifiedTasks(
      offboardingRaw as OffboardingTaskWithRelations[]
    )

    let allTasks: UnifiedTask[] = [
      ...leaveTasks,
      ...payrollTasks,
      ...onboardingTasks,
      ...offboardingTasks,
      ...performanceTasks,  // 동적 계산 태스크 병합
    ]

    // ── 상태 필터 ──────────────────────────────────────────

    if (statuses && statuses.length > 0) {
      const statusSet = new Set(statuses)
      allTasks = allTasks.filter((t) => statusSet.has(t.status))
    }

    // ── 정렬 ───────────────────────────────────────────────

    allTasks.sort((a, b) => {
      if (sortField === 'priority') {
        const diff = (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0)
        if (diff !== 0) return sortDir === 'desc' ? diff : -diff
        // 동일 priority면 createdAt desc
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }

      const aTime = new Date(a[sortField] ?? a.createdAt).getTime()
      const bTime = new Date(b[sortField] ?? b.createdAt).getTime()
      return sortDir === 'desc' ? bTime - aTime : aTime - bTime
    })

    // ── 카운트 집계 (페이지네이션 전 전체 기준) ─────────────

    const countByType: Partial<Record<UnifiedTaskType, number>> = {}
    const countByStatus: Partial<Record<UnifiedTaskStatus, number>> = {}

    for (const task of allTasks) {
      countByType[task.type] = (countByType[task.type] ?? 0) + 1
      countByStatus[task.status] = (countByStatus[task.status] ?? 0) + 1
    }

    // ── 페이지네이션 ───────────────────────────────────────

    const total    = allTasks.length
    const skip     = (page - 1) * limit
    const items    = allTasks.slice(skip, skip + limit)

    const response: UnifiedTaskListResponse = {
      items,
      total,
      page,
      limit,
      countByType,
      countByStatus,
    }

    return apiSuccess(response)
  },
  perm(MODULE.LEAVE, ACTION.VIEW),
)
