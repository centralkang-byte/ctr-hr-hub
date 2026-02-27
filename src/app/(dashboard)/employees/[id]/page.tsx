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

  const [employee, companies, departments, jobGrades, jobCategories] = await Promise.all([
    prisma.employee.findFirst({
      where: { id, deletedAt: null, ...companyFilter },
      include: {
        company: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        jobGrade: { select: { id: true, name: true } },
        jobCategory: { select: { id: true, name: true } },
        manager: {
          select: {
            id: true,
            name: true,
            photoUrl: true,
            employeeNo: true,
            department: { select: { name: true } },
            jobGrade: { select: { name: true } },
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

  if (!employee) {
    notFound()
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
