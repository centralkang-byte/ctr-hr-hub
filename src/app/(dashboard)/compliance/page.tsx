// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /compliance (Server Page)
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { ComplianceHubClient } from './ComplianceHubClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function CompliancePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser

  // Suspense 필요: ComplianceHubClient 내부에서 useSearchParams() 사용
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <ComplianceHubClient user={user} />
    </Suspense>
  )
}
