// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /employees/new (Server Page)
// HR_ADMIN 전용 직원 등록 4-step 위자드
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLE } from '@/lib/constants'
import type { SessionUser, RefOption, DeptOption } from '@/types'
import { EmployeeNewClient } from './EmployeeNewClient'

export type { RefOption, DeptOption }

export default async function EmployeeNewPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  // HR_ADMIN / SUPER_ADMIN only
  if (user.role !== ROLE.HR_ADMIN && user.role !== ROLE.SUPER_ADMIN) {
    redirect('/employees')
  }

  const companyFilter =
    user.role === ROLE.SUPER_ADMIN ? {} : { id: user.companyId }

  const deptCompanyFilter =
    user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

  // Fetch reference data for the wizard
  const [companies, departments, jobGrades, jobCategories] = await Promise.all([
    prisma.company.findMany({
      where: { deletedAt: null, ...companyFilter },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.department.findMany({
      where: { deletedAt: null, isActive: true, ...deptCompanyFilter },
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

  return (
    <EmployeeNewClient
      user={user}
      companies={companies}
      departments={departments}
      jobGrades={jobGrades}
      jobCategories={jobCategories}
    />
  )
}
