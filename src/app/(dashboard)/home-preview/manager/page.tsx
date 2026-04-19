// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /home-preview/manager (Server Page)
// R2 Dashboard Pilot — ManagerHomeV2, 3중 가드 (HOME_PREVIEW + VERCEL_ENV + role).
// R3 (Session 178): assertHomePreviewEnabled + assertPilotRole 공용 가드 사용.
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { HomeSkeleton } from '@/components/shared/PageSkeleton'
import { assertHomePreviewEnabled, assertPilotRole } from '@/lib/home-preview/guard'
import { ManagerPilotClient } from './ManagerPilotClient'

// ─── Page ─────────────────────────────────────────────────

export default async function ManagerPilotPage() {
  assertHomePreviewEnabled()

  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  // MANAGER만 허용 — SUPER_ADMIN은 별도 DTO를 받아 미스매치 발생.
  assertPilotRole(user.role, [ROLE.MANAGER])

  return (
    <Suspense fallback={<HomeSkeleton />}>
      <ManagerPilotClient user={user} />
    </Suspense>
  )
}
