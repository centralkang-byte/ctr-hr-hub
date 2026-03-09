// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Performance Review → UnifiedTask Mapper
// src/lib/unified-task/mappers/performance.mapper.ts
// ═══════════════════════════════════════════════════════════
//
// D-1 API Aggregation: PerformanceTask DB 모델 없음.
// 성과 태스크는 활성 사이클의 현재 페이즈 + 로그인 사용자 역할에 따라
// 런타임에 동적으로 계산된다.
//
// 지원 페이즈:
//   ACTIVE      → 직원: 목표 등록·제출 / 매니저: 팀원 목표 검토
//   EVAL_OPEN   → 직원: 자기평가 제출 / 매니저: 팀원 평가 작성
//   CALIBRATION → HR: 캘리브레이션 세션 진행
//   DRAFT/CLOSED → 태스크 없음
//
// 배치 효율:
//   - 최대 4개 쿼리 (사이클 1 + 데이터 1~2 + direct reports 1)
//   - 인메모리 grouping으로 N+1 방지
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import {
  UnifiedTaskType,
  UnifiedTaskStatus,
  UnifiedTaskPriority,
  type UnifiedTask,
  type UnifiedTaskActor,
} from '../types'

// ─── 타입 ────────────────────────────────────────────────

export interface PerformanceMapperContext {
  employeeId: string
  companyId:  string
  role:       string   // SessionUser.role (e.g., 'HR_ADMIN', 'MANAGER', 'EMPLOYEE')
}

// ─── 상수 ─────────────────────────────────────────────────

const SYSTEM_ACTOR: UnifiedTaskActor = {
  employeeId: 'system:performance',
  name:       '성과관리',
}

// ─── 우선순위 계산 ────────────────────────────────────────

function calcPriorityFromDeadline(deadline: Date | null | undefined): UnifiedTaskPriority {
  if (!deadline) return UnifiedTaskPriority.MEDIUM
  const diffMs   = deadline.getTime() - Date.now()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays < 0)   return UnifiedTaskPriority.URGENT   // 마감 초과
  if (diffDays <= 2)  return UnifiedTaskPriority.HIGH
  if (diffDays <= 5)  return UnifiedTaskPriority.MEDIUM
  return UnifiedTaskPriority.LOW
}

// ─── Actor 헬퍼 ──────────────────────────────────────────

function makeActor(
  id: string,
  name: string,
  opts?: { position?: string; department?: string; avatarUrl?: string },
): UnifiedTaskActor {
  return { employeeId: id, name, ...opts }
}

// ─── 메인 매퍼 함수 ───────────────────────────────────────

/**
 * 로그인 사용자 컨텍스트를 기반으로 활성 성과 사이클의 UnifiedTask 목록을 생성한다.
 *
 * 비동기 함수임에 주의: 기존 정적 매퍼와 달리 DB 조회가 필요하다.
 */
export async function fetchPerformanceTasks(
  ctx: PerformanceMapperContext,
): Promise<UnifiedTask[]> {
  const { employeeId, companyId, role } = ctx
  const isHrAdmin = role === 'HR_ADMIN' || role === 'SUPER_ADMIN'

  // ── Step 1: 활성 사이클 조회 ─────────────────────────────
  const activeCycle = await prisma.performanceCycle.findFirst({
    where: {
      companyId,
      status: { notIn: ['DRAFT', 'CLOSED'] },
    },
    orderBy: { createdAt: 'desc' },
  })

  // 활성 사이클 없음 → 태스크 없음
  if (!activeCycle) return []

  const cycleId    = activeCycle.id
  const cycleMeta  = {
    cycleName:  activeCycle.name,
    cyclePhase: activeCycle.status as string,
    year:       activeCycle.year,
  }
  const now = new Date()

  // ── Step 2: 로그인 사용자 포지션 조회 ────────────────────
  // 매니저 태스크 생성을 위해 positionId 필요
  const myAssignment = await prisma.employeeAssignment.findFirst({
    where: { employeeId, isPrimary: true, endDate: null },
    select: {
      positionId:  true,
      position:    { select: { id: true, titleKo: true } },
      department:  { select: { name: true } },
      jobGrade:    { select: { name: true } },
    },
  })

  const myPositionId   = myAssignment?.positionId ?? null
  const myDepartment   = myAssignment?.department?.name
  const myJobGrade     = myAssignment?.jobGrade?.name
  const myPositionTitle = myAssignment?.position?.titleKo

  // ── Step 3: 직속 부하 조회 (포지션 기반) ─────────────────
  // EmployeeAssignment where position.reportsToPositionId = myPositionId
  let directReports: Array<{ employeeId: string; name: string; positionTitle?: string; department?: string }> = []

  if (myPositionId) {
    const reports = await prisma.employeeAssignment.findMany({
      where: {
        companyId,
        isPrimary: true,
        endDate:   null,
        status:    'ACTIVE',
        position: { reportsToPositionId: myPositionId },
      },
      select: {
        employeeId: true,
        employee:   { select: { id: true, name: true } },
        position:   { select: { titleKo: true } },
        department: { select: { name: true } },
      },
    })

    directReports = reports.map((r) => ({
      employeeId:    r.employee.id,
      name:          r.employee.name,
      positionTitle: r.position?.titleKo,
      department:    r.department?.name,
    }))
  }

  const isManager  = directReports.length > 0

  // ── Step 4: 페이즈별 태스크 생성 ─────────────────────────

  const tasks: UnifiedTask[] = []
  const myself = makeActor(employeeId, '', {
    position:   myPositionTitle,
    department: myDepartment,
  })

  // ────────────────────────────────────────────────────────
  // 페이즈: ACTIVE (목표 설정)
  // ────────────────────────────────────────────────────────
  if (activeCycle.status === 'ACTIVE') {
    const goalDeadline = activeCycle.goalEnd
    const goalPriority = calcPriorityFromDeadline(goalDeadline)
    const goalDueDateStr = goalDeadline?.toISOString()

    // ── 배치 조회: 관련 직원들 목표 전체 ──────────────────
    const relevantEmployeeIds = [
      employeeId,
      ...directReports.map((r) => r.employeeId),
    ]

    const allGoals = await prisma.mboGoal.findMany({
      where: {
        cycleId,
        companyId,
        employeeId: { in: relevantEmployeeIds },
      },
      select: { employeeId: true, status: true },
    })

    // employeeId → 목표 목록 맵
    const goalsByEmployee = new Map<string, string[]>()
    for (const g of allGoals) {
      const existing = goalsByEmployee.get(g.employeeId) ?? []
      existing.push(g.status)
      goalsByEmployee.set(g.employeeId, existing)
    }

    // ── 직원 본인 태스크: MBO 목표 등록 ──────────────────
    const myGoalStatuses = goalsByEmployee.get(employeeId) ?? []
    const hasApproved    = myGoalStatuses.some((s) => s === 'APPROVED')
    const hasPending     = myGoalStatuses.some((s) => s === 'PENDING_APPROVAL')
    const hasDraft       = myGoalStatuses.some((s) => s === 'DRAFT' || s === 'REJECTED')

    let goalSubmitStatus: UnifiedTaskStatus
    if (hasApproved && !hasPending && !hasDraft) {
      goalSubmitStatus = UnifiedTaskStatus.COMPLETED
    } else if (myGoalStatuses.length === 0) {
      goalSubmitStatus = UnifiedTaskStatus.PENDING
    } else {
      goalSubmitStatus = UnifiedTaskStatus.IN_PROGRESS
    }

    tasks.push({
      id:          `performance:goal_submit:${employeeId}:${cycleId}`,
      type:        UnifiedTaskType.PERFORMANCE_REVIEW,
      status:      goalSubmitStatus,
      priority:    goalSubmitStatus === UnifiedTaskStatus.COMPLETED ? UnifiedTaskPriority.LOW : goalPriority,
      title:       '[성과] MBO 목표 등록',
      summary:     `${activeCycle.name} — 목표 가중치 합계 100% 제출`,
      requester:   myself,
      assignee:    myself,
      createdAt:   now.toISOString(),
      updatedAt:   now.toISOString(),
      dueDate:     goalDueDateStr,
      sourceId:    cycleId,
      sourceModel: 'PerformanceCycle',
      actionUrl:   '/performance/goals',
      companyId,
      metadata:    { ...cycleMeta },
    })

    // ── 매니저 태스크: 팀원 목표 검토 ────────────────────
    if (isManager) {
      for (const report of directReports) {
        const reportGoalStatuses = goalsByEmployee.get(report.employeeId) ?? []
        const hasPendingApproval = reportGoalStatuses.some((s) => s === 'PENDING_APPROVAL')
        const allApproved        = reportGoalStatuses.length > 0 &&
          reportGoalStatuses.every((s) => s === 'APPROVED')

        // PENDING_APPROVAL 없으면 이 팀원에 대한 검토 태스크는 불필요
        if (!hasPendingApproval && !allApproved) continue

        const reviewStatus = allApproved
          ? UnifiedTaskStatus.COMPLETED
          : UnifiedTaskStatus.PENDING

        const reportActor = makeActor(report.employeeId, report.name, {
          position:   report.positionTitle,
          department: report.department,
        })

        tasks.push({
          id:          `performance:goal_review:${report.employeeId}:${cycleId}`,
          type:        UnifiedTaskType.PERFORMANCE_REVIEW,
          status:      reviewStatus,
          priority:    reviewStatus === UnifiedTaskStatus.COMPLETED ? UnifiedTaskPriority.LOW : goalPriority,
          title:       `[성과] ${report.name} 목표 검토`,
          summary:     `${report.name}님의 MBO 목표 승인 대기`,
          requester:   reportActor,
          assignee:    myself,
          createdAt:   now.toISOString(),
          updatedAt:   now.toISOString(),
          dueDate:     goalDueDateStr,
          sourceId:    `${report.employeeId}:${cycleId}`,
          sourceModel: 'MboGoal',
          actionUrl:   '/performance/team-goals',
          companyId,
          metadata:    { ...cycleMeta, targetEmployeeId: report.employeeId, targetEmployeeName: report.name },
        })
      }
    }
  }

  // ────────────────────────────────────────────────────────
  // 페이즈: EVAL_OPEN (자기평가 + 매니저 평가)
  // ────────────────────────────────────────────────────────
  else if (activeCycle.status === 'EVAL_OPEN') {
    const evalDeadline    = activeCycle.evalEnd
    const evalPriority    = calcPriorityFromDeadline(evalDeadline)
    const evalDueDateStr  = evalDeadline?.toISOString()

    // ── 배치 조회: 관련 직원 평가 전체 ──────────────────
    const relevantEmployeeIds = [
      employeeId,
      ...directReports.map((r) => r.employeeId),
    ]

    const allEvals = await prisma.performanceEvaluation.findMany({
      where: {
        cycleId,
        companyId,
        OR: [
          // 직원 본인의 자기평가
          { employeeId, evalType: 'SELF' },
          // 팀원들에 대한 매니저 평가 (이 사용자가 평가자)
          { evaluatorId: employeeId, evalType: 'MANAGER', employeeId: { in: relevantEmployeeIds } },
        ],
      },
      select: {
        employeeId:  true,
        evaluatorId: true,
        evalType:    true,
        status:      true,
      },
    })

    // 자기평가 상태
    const selfEval = allEvals.find((e) => e.evalType === 'SELF' && e.employeeId === employeeId)
    const selfStatus =
      selfEval?.status === 'SUBMITTED' || selfEval?.status === 'CONFIRMED'
        ? UnifiedTaskStatus.COMPLETED
        : UnifiedTaskStatus.PENDING

    tasks.push({
      id:          `performance:self_eval:${employeeId}:${cycleId}`,
      type:        UnifiedTaskType.PERFORMANCE_REVIEW,
      status:      selfStatus,
      priority:    selfStatus === UnifiedTaskStatus.COMPLETED ? UnifiedTaskPriority.LOW : evalPriority,
      title:       '[성과] 자기평가 작성',
      summary:     `${activeCycle.name} — 성과 및 역량 자기평가 제출`,
      requester:   myself,
      assignee:    myself,
      createdAt:   now.toISOString(),
      updatedAt:   now.toISOString(),
      dueDate:     evalDueDateStr,
      sourceId:    cycleId,
      sourceModel: 'PerformanceCycle',
      actionUrl:   '/performance/self-eval',
      companyId,
      metadata:    { ...cycleMeta },
    })

    // ── 매니저 태스크: 팀원별 평가 작성 ──────────────────
    if (isManager) {
      // evaluatorId = 자신, evalType = MANAGER 평가 맵
      const mgrEvalMap = new Map<string, string>() // targetEmployeeId → status
      for (const e of allEvals) {
        if (e.evalType === 'MANAGER' && e.evaluatorId === employeeId) {
          mgrEvalMap.set(e.employeeId, e.status)
        }
      }

      for (const report of directReports) {
        const evalStatus = mgrEvalMap.get(report.employeeId)
        const status =
          evalStatus === 'SUBMITTED' || evalStatus === 'CONFIRMED'
            ? UnifiedTaskStatus.COMPLETED
            : UnifiedTaskStatus.PENDING

        const reportActor = makeActor(report.employeeId, report.name, {
          position:   report.positionTitle,
          department: report.department,
        })

        tasks.push({
          id:          `performance:mgr_eval:${report.employeeId}:${cycleId}`,
          type:        UnifiedTaskType.PERFORMANCE_REVIEW,
          status,
          priority:    status === UnifiedTaskStatus.COMPLETED ? UnifiedTaskPriority.LOW : evalPriority,
          title:       `[성과] ${report.name} 평가 작성`,
          summary:     `${report.name}님에 대한 매니저 평가`,
          requester:   reportActor,
          assignee:    myself,
          createdAt:   now.toISOString(),
          updatedAt:   now.toISOString(),
          dueDate:     evalDueDateStr,
          sourceId:    `${report.employeeId}:${cycleId}`,
          sourceModel: 'PerformanceEvaluation',
          actionUrl:   '/performance/team-evaluations',
          companyId,
          metadata:    { ...cycleMeta, targetEmployeeId: report.employeeId, targetEmployeeName: report.name },
        })
      }
    }
  }

  // ────────────────────────────────────────────────────────
  // 페이즈: CALIBRATION (HR 전용)
  // ────────────────────────────────────────────────────────
  else if (activeCycle.status === 'CALIBRATION') {
    // HR_ADMIN 또는 SUPER_ADMIN에게만 캘리브레이션 태스크 노출
    if (isHrAdmin) {
      const sessions = await prisma.calibrationSession.findMany({
        where:   { cycleId, companyId },
        select:  { id: true, name: true, status: true, departmentId: true },
        orderBy: { createdAt: 'asc' },
      })

      for (const session of sessions) {
        const isCompleted = session.status === 'CALIBRATION_COMPLETED'
        const sessionStatus = isCompleted
          ? UnifiedTaskStatus.COMPLETED
          : session.status === 'CALIBRATION_IN_PROGRESS'
            ? UnifiedTaskStatus.IN_PROGRESS
            : UnifiedTaskStatus.PENDING

        tasks.push({
          id:          `performance:calibration:${session.id}`,
          type:        UnifiedTaskType.PERFORMANCE_REVIEW,
          status:      sessionStatus,
          priority:    isCompleted ? UnifiedTaskPriority.LOW : UnifiedTaskPriority.MEDIUM,
          title:       `[성과] 캘리브레이션 세션`,
          summary:     session.name,
          requester:   SYSTEM_ACTOR,
          assignee:    myself,
          createdAt:   now.toISOString(),
          updatedAt:   now.toISOString(),
          sourceId:    session.id,
          sourceModel: 'CalibrationSession',
          actionUrl:   '/performance/calibration',
          companyId,
          metadata:    { ...cycleMeta, sessionId: session.id, sessionName: session.name },
        })
      }
    }
  }

  // DRAFT / CLOSED → 태스크 없음 (빈 배열 반환)

  return tasks
}

// ─── Prisma Include 상수 (route.ts 참조용) ──────────────
// Performance 매퍼는 DB include 없이 자체 쿼리를 실행하므로
// include 객체는 내부적으로 처리됨.
// 외부에서 참조할 필요 없지만 패턴 일관성을 위해 빈 객체 export.
export const PERFORMANCE_TASK_INCLUDE = {} as const
