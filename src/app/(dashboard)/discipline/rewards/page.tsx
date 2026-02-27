// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /discipline/rewards (Server Page)
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import RewardsListClient from './RewardsListClient'

export default async function RewardsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  return <RewardsListClient user={user} />
}
