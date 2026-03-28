// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /employees/new (Server Page)
// HR_ADMIN 전용 직원 등록 4-step 위자드
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLE } from '@/lib/constants'
import type { SessionUser, RefOption, DeptOption } from '@/types'
import { EmployeeNewClient } from './EmployeeNewClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

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

  const positionCompanyFilter =
    user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

  // Fetch reference data for the wizard
  const [companies, departments, jobCategories, gradeTitleMappings, positions] = await Promise.all([
    prisma.company.findMany({
      where: { deletedAt: null, ...companyFilter },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.department.findMany({
      where: { deletedAt: null, ...deptCompanyFilter },
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
    prisma.position.findMany({
      where: { deletedAt: null, ...positionCompanyFilter },
      select: { id: true, titleKo: true, code: true, companyId: true },
      orderBy: { titleKo: 'asc' },
    }),
  ])

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <EmployeeNewClient
        user={user}
        companies={companies}
        departments={departments}
        jobCategories={jobCategories}
        gradeTitleMappings={gradeTitleMappings}
        positions={positions}
      />
    </Suspense>
  )
}
