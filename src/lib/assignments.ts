// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Assignment 헬퍼 함수
// A2-1: Effective Dating 기반 인사 변동 이력 관리
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { parseDateOnly, formatToTz } from '@/lib/timezone'
import type { ChangeType, CreateAssignmentParams } from '@/types/assignment'

// ── 날짜 유틸: YYYY-MM-DD 문자열을 UTC 자정 Date로 안전하게 변환 ──
// new Date('2026-03-05')는 YYYY-MM-DD에서 UTC 자정을 반환하지만,
// new Date('2026-03-05T00:00:00') 같은 datetime 문자열은
// Node.js의 로컬 타임존을 적용해 UTC 오프셋이 발생할 수 있음.
// parseDateOnly()는 항상 Date.UTC()를 사용하므로 안전.
function toCalendarDate(date: Date | string): Date {
  if (typeof date === 'string') return parseDateOnly(date)
  // Date 객체도 UTC 자정으로 정규화 (시/분/초 제거)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

// ── 특정 타임존의 오늘 날짜를 UTC 자정 Date로 반환 ────────────────
// new Date()는 UTC "지금"이므로, 서버 UTC 기준 날짜가 법인 로컬 달력과
// 어긋날 수 있음. (예: Asia/Seoul UTC+9에서 UTC 23:00 = 다음날 08:00)
// timezone 파라미터를 전달하면 해당 법인의 달력 날짜 기준으로 "오늘"을 산출.
export function getTodayForTimezone(timezone: string): Date {
  const todayStr = formatToTz(new Date(), timezone, 'yyyy-MM-dd')
  return parseDateOnly(todayStr)
}

// ── 현재 유효한 assignment 조회 ──────────────────────────────
export async function getCurrentAssignment(employeeId: string) {
  return prisma.employeeAssignment.findFirst({
    where: {
      employeeId,
      isPrimary: true,
      endDate: null,
    },
    include: {
      company:     true,
      department:  true,
      jobGrade:    true,
      jobCategory: true,
    },
  })
}

// ── 특정 시점의 assignment 조회 (Effective Dating 핵심) ─────
// timezone: 선택적. Date 객체로 전달 시 해당 타임존의 달력 날짜로 재해석.
//   → API에서 new Date()를 전달할 때 반드시 법인 timezone을 함께 전달해야
//     UTC 날짜와 로컬 달력 날짜 간의 off-by-one을 방지할 수 있음.
export async function getAssignmentAtDate(
  employeeId: string,
  targetDate: Date | string,
  timezone?: string,
) {
  let date: Date
  if (typeof targetDate === 'string') {
    date = parseDateOnly(targetDate)
  } else if (timezone) {
    // Date 객체를 타임존 기준 달력 날짜로 재해석 (off-by-one 방지)
    // 예: new Date()가 UTC 2026-03-05T23:00Z여도 Asia/Seoul에서는 2026-03-06
    const localDateStr = formatToTz(targetDate, timezone, 'yyyy-MM-dd')
    date = parseDateOnly(localDateStr)
  } else {
    date = toCalendarDate(targetDate)
  }
  return prisma.employeeAssignment.findFirst({
    where: {
      employeeId,
      isPrimary:     true,
      effectiveDate: { lte: date },
      OR: [
        { endDate: null },
        { endDate: { gt: date } },
      ],
    },
    include: {
      company:     true,
      department:  true,
      jobGrade:    true,
      jobCategory: true,
    },
  })
}

// ── 새 assignment 생성 (이전 레코드 자동 종료) ───────────────
export async function createAssignment(params: CreateAssignmentParams) {
  const {
    employeeId,
    effectiveDate,
    changeType,
    companyId,
    departmentId,
    jobGradeId,
    jobCategoryId,
    employmentType,
    contractType,
    status,
    positionId,
    isPrimary = true,
    reason,
    orderNumber,
    approvedBy,
  } = params

  // parseDateOnly로 YYYY-MM-DD 문자열을 UTC 자정으로 안전하게 변환.
  // new Date(string)은 datetime 문자열에서 로컬 타임존을 적용해 날짜가 어긋날 수 있음.
  const date = toCalendarDate(effectiveDate)

  return prisma.$transaction(async (tx) => {
    // 1. 기존 현재 primary assignment 종료
    if (isPrimary) {
      await tx.employeeAssignment.updateMany({
        where: {
          employeeId,
          isPrimary: true,
          endDate:   null,
        },
        data: {
          endDate: date,
        },
      })
    }

    // 2. 새 assignment 생성
    return tx.employeeAssignment.create({
      data: {
        employeeId,
        effectiveDate: date,
        endDate:       null,
        changeType,
        companyId,
        departmentId,
        jobGradeId,
        jobCategoryId,
        employmentType,
        contractType,
        status,
        positionId,
        isPrimary,
        reason,
        orderNumber,
        approvedBy,
      },
      include: {
        company:     true,
        department:  true,
        jobGrade:    true,
        jobCategory: true,
      },
    })
  })
}

// ── 직원의 assignment 이력 조회 ──────────────────────────────
export async function getAssignmentHistory(employeeId: string) {
  return prisma.employeeAssignment.findMany({
    where:   { employeeId },
    include: {
      company:     { select: { id: true, name: true, code: true } },
      department:  { select: { id: true, name: true } },
      jobGrade:    { select: { id: true, name: true, code: true } },
      jobCategory: { select: { id: true, name: true } },
      approver:    { select: { id: true, name: true, photoUrl: true } },
    },
    orderBy: { effectiveDate: 'desc' },
  })
}

// ── 부서별 현재 인원 조회 ────────────────────────────────────
export async function getEmployeesByDepartment(departmentId: string) {
  return prisma.employeeAssignment.findMany({
    where: {
      departmentId,
      isPrimary: true,
      endDate:   null,
    },
    include: {
      employee: {
        select: {
          id:         true,
          name:       true,
          nameEn:     true,
          employeeNo: true,
          email:      true,
          photoUrl:   true,
        },
      },
    },
  })
}

// ── 법인별 현재 인원 조회 ────────────────────────────────────
export async function getEmployeesByCompany(companyId: string) {
  return prisma.employeeAssignment.findMany({
    where: {
      companyId,
      isPrimary: true,
      endDate:   null,
    },
    include: {
      employee: {
        select: {
          id:         true,
          name:       true,
          nameEn:     true,
          employeeNo: true,
          email:      true,
          photoUrl:   true,
        },
      },
      department:  { select: { id: true, name: true } },
      jobGrade:    { select: { id: true, name: true } },
    },
  })
}

// ── current_employee_view를 raw SQL로 조회 ───────────────────
// A2-3 전환 기간 동안 기존 API 호환성을 위해 사용
export async function queryCurrentEmployeeView<T = Record<string, unknown>>(
  where: string,
  params: unknown[]
): Promise<T[]> {
  return prisma.$queryRawUnsafe<T[]>(
    `SELECT * FROM current_employee_view WHERE ${where}`,
    ...params
  )
}

// ── 특정 직원의 현재 assignment 변경 유형 기록 ───────────────
export async function recordStatusChange(params: {
  employeeId:    string
  effectiveDate: Date | string
  newStatus:     string
  companyId:     string
  departmentId?: string
  jobGradeId?:   string
  jobCategoryId?: string
  employmentType: string
  contractType?:  string
  reason?:       string
  approvedBy?:   string
}) {
  return createAssignment({
    ...params,
    changeType: 'STATUS_CHANGE' as ChangeType,
    isPrimary:  true,
    status:     params.newStatus,
  })
}

// ── 포지션 기반 매니저 조회 (A2-2) ─────────────────────────────
export async function getManagerByPosition(positionId: string): Promise<{
  managerId: string | null
  managerPositionId: string | null
  managerPositionTitle: string | null
} | null> {
  const position = await prisma.position.findUnique({
    where: { id: positionId },
    select: {
      reportsTo: {
        select: {
          id: true,
          titleKo: true,
          titleEn: true,
          assignments: {
            where: { isPrimary: true, endDate: null },
            select: { employeeId: true },
            take: 1,
          },
        },
      },
    },
  })

  if (!position?.reportsTo) return null

  return {
    managerId: position.reportsTo.assignments[0]?.employeeId ?? null,
    managerPositionId: position.reportsTo.id,
    managerPositionTitle: position.reportsTo.titleKo,
  }
}

// ── 포지션의 직속 부하 조회 ──────────────────────────────────────
export async function getDirectReports(
  positionId: string
): Promise<Array<{ positionId: string; titleKo: string; employeeId: string | null }>> {
  const reports = await prisma.position.findMany({
    where: { reportsToPositionId: positionId, isActive: true },
    select: {
      id: true,
      titleKo: true,
      assignments: {
        where: { isPrimary: true, endDate: null },
        select: { employeeId: true },
        take: 1,
      },
    },
    orderBy: { titleKo: 'asc' },
  })

  return reports.map((r: typeof reports[number]) => ({
    positionId: r.id,
    titleKo: r.titleKo,
    employeeId: r.assignments[0]?.employeeId ?? null,
  }))
}

// ── 점선 라인 매니저 조회 ────────────────────────────────────────
export async function getDottedLineManager(positionId: string): Promise<{
  managerId: string | null
  positionId: string
  positionTitle: string
} | null> {
  const position = await prisma.position.findUnique({
    where: { id: positionId },
    select: {
      dottedLineTo: {
        select: {
          id: true,
          titleKo: true,
          assignments: {
            where: { isPrimary: true, endDate: null },
            select: { employeeId: true },
            take: 1,
          },
        },
      },
    },
  })

  if (!position?.dottedLineTo) return null

  return {
    managerId: position.dottedLineTo.assignments[0]?.employeeId ?? null,
    positionId: position.dottedLineTo.id,
    positionTitle: position.dottedLineTo.titleKo,
  }
}
