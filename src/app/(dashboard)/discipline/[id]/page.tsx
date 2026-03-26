// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /discipline/[id] (Server Page)
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import DisciplineDetailClient from './DisciplineDetailClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function DisciplineDetailPage({
  params,
}: {
  params: Promise<Record<string, string>>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser
  const { id } = await params

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <DisciplineDetailClient user={user} id={id} />
    </Suspense>
  )
}
