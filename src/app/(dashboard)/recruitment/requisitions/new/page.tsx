// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /recruitment/requisitions/new (Server Page)
// B4: 채용 요청서 작성
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import RequisitionFormClient from './RequisitionFormClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function NewRequisitionPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <RequisitionFormClient user={user} />
    </Suspense>
  )
}
