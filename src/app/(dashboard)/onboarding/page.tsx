// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /onboarding (Server Page)
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { OnboardingDashboardClient } from './OnboardingDashboardClient'

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  return <OnboardingDashboardClient user={user} />
}
