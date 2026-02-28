// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Team Goals Management (Server Page)
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import TeamGoalsClient from './TeamGoalsClient'

export default async function TeamGoalsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return <TeamGoalsClient user={user} />
}
