// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /my/tasks (Unified Task Hub Full Page)
// Server wrapper: auth + redirect
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { MyTasksClient } from './MyTasksClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function MyTasksPage() {
    const session = await getServerSession(authOptions)
    if (!session?.user) redirect('/login')

    const user = session.user as SessionUser
    return (
      <Suspense fallback={<ListPageSkeleton />}>
        <MyTasksClient user={user} />
      </Suspense>
    )
}
