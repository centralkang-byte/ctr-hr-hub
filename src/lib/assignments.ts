// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Assignment 헬퍼 함수
// A2-1: Effective Dating 기반 인사 변동 이력 관리
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { ChangeType, CreateAssignmentParams } from '@/types/assignment'

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
export async function getAssignmentAtDate(employeeId: string, targetDate: Date | string) {
  const date = typeof targetDate === 'string' ? new Date(targetDate) : targetDate
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

  const date = typeof effectiveDate === 'string' ? new Date(effectiveDate) : effectiveDate

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
