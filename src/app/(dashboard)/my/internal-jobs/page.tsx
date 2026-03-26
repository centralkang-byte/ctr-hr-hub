// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /my/internal-jobs (Server Page)
// B4: 내부 공고 — 직원 자기 지원 뷰
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import InternalJobsClient from './InternalJobsClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function InternalJobsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <InternalJobsClient user={user} />
    </Suspense>
  )
}
