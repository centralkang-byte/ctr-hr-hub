// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Korean Compliance Page (Server Component)
// 한국 근로기준법 준수 대시보드
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import KrComplianceClient from './KrComplianceClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function KrCompliancePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <KrComplianceClient user={user} />
    </Suspense>
  )
}
