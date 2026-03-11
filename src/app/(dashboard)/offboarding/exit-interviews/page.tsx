// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /offboarding/exit-interviews (Exit Interview Statistics)
// E-2: GP#2 Offboarding Pipeline
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { ExitInterviewStatsClient } from './ExitInterviewStatsClient'

export default async function ExitInterviewStatsPage() {
    const session = await getServerSession(authOptions)
    if (!session?.user) redirect('/login')
    const user = session.user as SessionUser
    return <ExitInterviewStatsClient user={user} />
}
