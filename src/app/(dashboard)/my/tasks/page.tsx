// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /my/tasks (Unified Task Hub Full Page)
// Server wrapper: auth + redirect
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { MyTasksClient } from './MyTasksClient'

export default async function MyTasksPage() {
    const session = await getServerSession(authOptions)
    if (!session?.user) redirect('/login')

    const user = session.user as SessionUser
    return <MyTasksClient user={user} />
}
