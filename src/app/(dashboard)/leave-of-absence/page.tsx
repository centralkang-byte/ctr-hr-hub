// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /leave-of-absence (Server Page)
// 휴직 관리: 신청 + 승인/거부 + 이력 조회
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { LoaClient } from './LoaClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function LeaveOfAbsencePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <LoaClient user={user} />
    </Suspense>
  )
}
