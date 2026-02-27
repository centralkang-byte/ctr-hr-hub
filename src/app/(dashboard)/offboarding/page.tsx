// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /offboarding (Server Page)
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { OffboardingDashboardClient } from './OffboardingDashboardClient'

export default async function OffboardingPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  return <OffboardingDashboardClient user={user} />
}
