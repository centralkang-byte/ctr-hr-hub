// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /recruitment (Server Page)
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import RecruitmentListClient from './RecruitmentListClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function RecruitmentPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <RecruitmentListClient user={user} />
    </Suspense>
  )
}
