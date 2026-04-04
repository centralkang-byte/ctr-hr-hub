// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /compensation/off-cycle/[id] (Server Page)
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import OffCycleDetailClient from './OffCycleDetailClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function OffCycleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser
  const { id } = await params

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <OffCycleDetailClient user={user} requestId={id} />
    </Suspense>
  )
}
