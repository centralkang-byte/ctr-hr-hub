// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 나의 역량 자기평가 페이지 (B8-3)
// ═══════════════════════════════════════════════════════════
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import MySkillsClient from './MySkillsClient'
import type { SessionUser } from '@/types'
import { loadSelfAssessmentProps } from '@/lib/skills/load-self-assessment-props'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function MySkillsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser

  const { competencies, requirementMap, grade } = await loadSelfAssessmentProps(user)

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <MySkillsClient
        user={user}
        competencies={competencies}
        requirementMap={requirementMap}
        grade={grade}
      />
    </Suspense>
  )
}
