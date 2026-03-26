// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /recruitment/[id]/edit (Server Page)
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import PostingEditClient from './PostingEditClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function PostingEditPage({
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
      <PostingEditClient user={user} id={id} />
    </Suspense>
  )
}
