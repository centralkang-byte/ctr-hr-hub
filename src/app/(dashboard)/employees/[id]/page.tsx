// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /employees/[id] (Server Page)
// 직원 프로필: 5탭 (기본정보/인사이력/문서/징계상벌/연봉이력)
// ═══════════════════════════════════════════════════════════

import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLE } from '@/lib/constants'
import type { SessionUser, DeptOption, RefOption } from '@/types'
import { EmployeeDetailClient } from './EmployeeDetailClient'

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
    user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

  const assignmentFilter =
    user.role === ROLE.SUPER_ADMIN
      ? {}
      : { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } }

  const [rawEmployee, companies, departments, jobGrades, jobCategories] = await Promise.all([
    prisma.employee.findFirst({
      where: { id, deletedAt: null, ...assignmentFilter },
      include: {
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          include: {
            company: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            jobGrade: { select: { id: true, name: true } },
            jobCategory: { select: { id: true, name: true } },
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
      where: { deletedAt: null, isActive: true, ...companyFilter },
      select: { id: true, name: true, companyId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.jobGrade.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.jobCategory.findMany({
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
  const primaryAssignment = rawEmployee.assignments[0]

  const employee = {
    ...rawEmployee,
    companyId: primaryAssignment?.companyId ?? '',
    company: primaryAssignment?.company ?? null,
    department: primaryAssignment?.department ?? null,
    jobGrade: primaryAssignment?.jobGrade ?? null,
    jobCategory: primaryAssignment?.jobCategory ?? null,
    employmentType: primaryAssignment?.employmentType ?? '',
    status: primaryAssignment?.status ?? '',
    // TODO: Populate manager via position-based hierarchy lookup (A2-2)
    manager: null,
  }

  return (
    <EmployeeDetailClient
      user={user}
      employee={employee as Parameters<typeof EmployeeDetailClient>[0]['employee']}
      companies={companies}
      departments={departments as DeptOption[]}
      jobGrades={jobGrades}
      jobCategories={jobCategories}
    />
  )
}
