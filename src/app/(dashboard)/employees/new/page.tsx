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
  // 직급(JobGrade)을 직접 소스로 사용 — GradeTitleMapping은 호칭 자동완성 보조용만.
  // jobCategory는 법인 스코프 select(법인당 4종, 폼이 선택 법인으로 필터) → 교차 12중복 방지.
  const [companies, departments, jobGrades, jobCategories, gradeTitleMappings, positions] = await Promise.all([
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
    prisma.jobGrade.findMany({
      where: { deletedAt: null, ...deptCompanyFilter },
      select: { id: true, code: true, name: true, gradeType: true, rankOrder: true, companyId: true },
      orderBy: { rankOrder: 'asc' },
    }),
    prisma.jobCategory.findMany({
      where: { deletedAt: null, ...deptCompanyFilter },
      select: { id: true, name: true, companyId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.gradeTitleMapping.findMany({
      where: {
        ...deptCompanyFilter,
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
        jobGrades={jobGrades}
        jobCategories={jobCategories}
        gradeTitleMappings={gradeTitleMappings}
        positions={positions}
      />
    </Suspense>
  )
}
