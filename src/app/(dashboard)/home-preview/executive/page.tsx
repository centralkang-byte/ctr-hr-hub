// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /home-preview/executive (Server Page)
// R3 Dashboard Pilot — ExecutiveHomeV2, 3중 가드.
// EXECUTIVE + SUPER_ADMIN 허용 (HR pilot과 동일한 Session 177 Gate 1 Fix #1 일관성).
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { HomeSkeleton } from '@/components/shared/PageSkeleton'
import { assertHomePreviewEnabled, assertPilotRole } from '@/lib/home-preview/guard'
import { ExecutivePilotClient } from './ExecutivePilotClient'

// ─── Page ─────────────────────────────────────────────────

export default async function ExecutivePilotPage() {
  assertHomePreviewEnabled()

  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  assertPilotRole(user.role, [ROLE.EXECUTIVE, ROLE.SUPER_ADMIN])

  return (
    <Suspense fallback={<HomeSkeleton />}>
      <ExecutivePilotClient user={user} />
    </Suspense>
  )
}
