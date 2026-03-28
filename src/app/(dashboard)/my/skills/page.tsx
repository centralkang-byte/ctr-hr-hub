// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 나의 역량 자기평가 페이지 (B8-3)
// ═══════════════════════════════════════════════════════════
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import MySkillsClient from './MySkillsClient'
import type { SessionUser } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function MySkillsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser

  const [competencies, employee] = await Promise.all([
    prisma.competency.findMany({
      where: { deletedAt: null },
      include: {
        category: { select: { id: true, name: true, code: true } },
        levels: { orderBy: { level: 'asc' } },
      },
      orderBy: [{ category: { displayOrder: 'asc' } }, { displayOrder: 'asc' }],
    }),
    prisma.employee.findUnique({
      where: { id: user.employeeId },
      include: {
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          include: { jobGrade: { select: { code: true, name: true } } },
        },
      },
    }),
  ])

  const primary = extractPrimaryAssignment(employee?.assignments ?? [])
  const grade = (primary as Record<string, any>)?.jobGrade?.code ?? ''

  // 역량 요건 (기대 수준)
  const requirements = await prisma.competencyRequirement.findMany({
    where: {
      OR: [{ companyId: user.companyId }, { companyId: null }],
      jobLevelCode: grade || undefined,
    },
    select: { competencyId: true, expectedLevel: true },
  })
  const reqMap = Object.fromEntries(requirements.map((r) => [r.competencyId, r.expectedLevel]))

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <MySkillsClient
        user={user}
        competencies={competencies}
        requirementMap={reqMap}
        grade={grade}
      />
    </Suspense>
  )
}
