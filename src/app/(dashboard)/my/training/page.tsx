// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /my/training (Server Page)
// B9-1: 내 교육 현황 — 직원 셀프서비스 뷰
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import MyTrainingClient from './MyTrainingClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function MyTrainingPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <MyTrainingClient user={user} />
    </Suspense>
  )
}
