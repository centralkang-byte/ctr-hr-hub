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
import type { SessionUser, DeptOption, RefOption } from '@/types'
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

  const deptFilter =
    user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

  const companyFilter =
    user.role === ROLE.SUPER_ADMIN ? {} : { id: user.companyId }

  const assignmentFilter =
    user.role === ROLE.SUPER_ADMIN
      ? {}
      : { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } }

  const [rawEmployee, companies, departments, jobCategories, gradeTitleMappings] = await Promise.all([
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
    prisma.department.findMany({
      where: { deletedAt: null, ...deptFilter },
      select: { id: true, name: true, companyId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.jobCategory.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.gradeTitleMapping.findMany({
      where: {
        jobGrade: { deletedAt: null },
        employeeTitle: { deletedAt: null },
      },
      include: {
        jobGrade: { select: { id: true, code: true, name: true, gradeType: true, rankOrder: true, companyId: true } },
        employeeTitle: { select: { id: true, name: true } },
      },
      orderBy: { jobGrade: { rankOrder: 'asc' } },
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

  const employee = {
    ...rawEmployee,
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
        departments={departments as DeptOption[]}
        jobCategories={jobCategories}
        gradeTitleMappings={gradeTitleMappings}
        division={division}
        canViewGrade={canViewGradeFlag}
        canViewSensitive={canViewGradeFlag}
      />
    </Suspense>
  )
}
