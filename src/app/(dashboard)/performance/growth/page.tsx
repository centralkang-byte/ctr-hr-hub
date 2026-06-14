// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /performance/growth 평가/성장 허브 (Server Page)
// 프로토 page-wrappers.jsx PerfGrowthWrapper 정합: 목표 + 분기 리뷰 + 자기평가 통합.
// KPI(현재 사이클/평가 마감 D-day)는 서버에서 unmasked PerformanceCycle 로 계산
// (EMPLOYEE /cycles GET 마스킹 우회).
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { SessionUser } from '@/types'
import type { GrowthHubKpi } from '@/lib/performance/growth-hub'
import { pickCurrentCycle, computeCycleDday } from '@/lib/performance/growth-kpi'
import { loadSelfAssessmentProps } from '@/lib/skills/load-self-assessment-props'
import { getCompanyTimezone } from '@/lib/recruitment/timezone-lookup'
import PerfGrowthClient from './PerfGrowthClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function PerfGrowthPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser

  const now = new Date()
  const [skills, cycles, tz] = await Promise.all([
    loadSelfAssessmentProps(user),
    prisma.performanceCycle.findMany({
      where: { companyId: user.companyId },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true, name: true, year: true, half: true, status: true,
        goalStart: true, goalEnd: true, evalStart: true, evalEnd: true,
      },
    }),
    getCompanyTimezone(user.companyId),
  ])

  const current = pickCurrentCycle(cycles, now)
  let kpi: GrowthHubKpi | null = null
  if (current) {
    const approvedGoals = await prisma.mboGoal.count({
      where: {
        employeeId: user.employeeId,
        companyId: user.companyId,
        cycleId: current.id,
        status: 'APPROVED',
      },
    })
    kpi = {
      cycleName: current.name,
      cycleHalf: current.half,
      dday: computeCycleDday(current.evalEnd, now, tz),
      approvedGoals,
    }
  }

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <PerfGrowthClient user={user} skillsProps={skills} kpi={kpi} />
    </Suspense>
  )
}
