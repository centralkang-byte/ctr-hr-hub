// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /employees/[id] (Server Page)
// 직원 프로필: 5탭 (기본정보/인사이력/문서/징계상벌/연봉이력)
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { EmployeeDetailClient } from './EmployeeDetailClient'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import { getManagerIdByPosition } from '@/lib/employee/direct-reports'
import { getDivisionName, canViewGrade as canViewGradeUtil } from '@/lib/employee/profile-utils'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser

  const companyFilter =
    user.role === ROLE.SUPER_ADMIN ? {} : { id: user.companyId }

  const assignmentFilter =
    user.role === ROLE.SUPER_ADMIN
      ? {}
      : { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } }

  // 부서/직급/직무군/매핑 fetch 제거 — 편집 폼에서 발령 필드 제외로 미사용 (S276 ed-01)
  const [rawEmployee, companies] = await Promise.all([
    prisma.employee.findFirst({
      where: { id, deletedAt: null, ...assignmentFilter },
      include: {
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          include: {
            company: { select: { id: true, name: true } },
            department: {
              select: {
                id: true, name: true, level: true,
                parent: {
                  select: {
                    id: true, name: true, level: true,
                    parent: { select: { id: true, name: true, level: true } },
                  },
                },
              },
            },
            jobGrade: { select: { id: true, name: true } },
            title: { select: { id: true, name: true } },
            jobCategory: { select: { id: true, name: true } },
            position: { select: { id: true, titleKo: true, titleEn: true, code: true } },
            workLocation: { select: { country: true, city: true, name: true } },
          },
        },
      },
    }),
    prisma.company.findMany({
      where: { deletedAt: null, ...companyFilter },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  if (!rawEmployee) {
    notFound()
  }

  // Shape the raw query result into the EmployeeDetail type expected by EmployeeDetailClient.
  // Fields that moved to EmployeeAssignment are lifted from the primary assignment.
  // manager is now derived from position hierarchy (A2-2); set to null for now.
  const primaryAssignment = extractPrimaryAssignment(rawEmployee.assignments)

  // Position-based manager lookup
  const managerId = await getManagerIdByPosition(id)
  const managerData = managerId
    ? await prisma.employee.findUnique({
        where: { id: managerId },
        select: {
          id: true,
          name: true,
          photoUrl: true,
          assignments: {
            where: { isPrimary: true, endDate: null },
            take: 1,
            select: {
              title: { select: { name: true } },
              department: { select: { name: true } },
            },
          },
        },
      })
    : null

  const managerPrimary = managerData?.assignments?.[0] ?? null
  const manager = managerData
    ? {
        id: managerData.id,
        name: managerData.name,
        photoUrl: managerData.photoUrl ?? null,
        title: managerPrimary?.title?.name ?? null,
        department: managerPrimary?.department?.name ?? null,
      }
    : null

  const division = getDivisionName(primaryAssignment?.department ?? null)
  const canViewGradeFlag = canViewGradeUtil(user.role, user.employeeId, id, managerId)

  // 수습/계약 라이프사이클은 HR 전용 — 비특권 role엔 서버에서 제거
  const isHrPrivileged = user.role === ROLE.SUPER_ADMIN || user.role === ROLE.HR_ADMIN
  const lifecycleStrip = isHrPrivileged
    ? {}
    : { probationStatus: null, probationStartDate: null, probationEndDate: null, contractStartDate: null, contractEndDate: null }

  const employee = {
    ...rawEmployee,
    ...lifecycleStrip,
    companyId: primaryAssignment?.companyId ?? '',
    company: primaryAssignment?.company ?? null,
    department: primaryAssignment?.department ?? null,
    jobGrade: primaryAssignment?.jobGrade ?? null,
    title: primaryAssignment?.title ?? null,
    jobCategory: primaryAssignment?.jobCategory ?? null,
    employmentType: primaryAssignment?.employmentType ?? '',
    status: primaryAssignment?.status ?? '',
    position: primaryAssignment?.position ?? null,
    workLocation: primaryAssignment?.workLocation ?? null,
    manager,
  }

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <EmployeeDetailClient
        user={user}
        employee={employee as Parameters<typeof EmployeeDetailClient>[0]['employee']}
        companies={companies}
        division={division}
        canViewGrade={canViewGradeFlag}
        canViewSensitive={canViewGradeFlag}
      />
    </Suspense>
  )
}
