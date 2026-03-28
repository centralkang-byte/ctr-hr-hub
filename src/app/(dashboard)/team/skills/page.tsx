// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 팀원 역량 평가 페이지 (매니저용) (B8-3)
// ═══════════════════════════════════════════════════════════
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import TeamSkillsClient from './TeamSkillsClient'
import type { SessionUser } from '@/types'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function TeamSkillsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser

  const canAccess = ['HR_ADMIN', 'SUPER_ADMIN', 'MANAGER', 'EXECUTIVE'].includes(user.role)
  if (!canAccess) redirect('/my/skills')

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <TeamSkillsClient user={user} />
    </Suspense>
  )
}
