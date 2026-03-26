// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /recruitment/talent-pool (Server Page)
// B4: Talent Pool 관리
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import TalentPoolClient from './TalentPoolClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function TalentPoolPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <TalentPoolClient user={user} />
    </Suspense>
  )
}
