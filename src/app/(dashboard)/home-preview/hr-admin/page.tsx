// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /home-preview/hr-admin (Server Page)
// R3 Dashboard Pilot — HrAdminHomeV2, 3중 가드 (HOME_PREVIEW + VERCEL_ENV + role).
// SUPER_ADMIN 허용 — HR/EXEC 두 브랜치 DTO가 동일해서 SUPER가 4 pilot 순회 가능.
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { HomeSkeleton } from '@/components/shared/PageSkeleton'
import { assertHomePreviewEnabled, assertPilotRole } from '@/lib/home-preview/guard'
import { HrAdminPilotClient } from './HrAdminPilotClient'

// ─── Page ─────────────────────────────────────────────────

export default async function HrAdminPilotPage() {
  assertHomePreviewEnabled()

  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  assertPilotRole(user.role, [ROLE.HR_ADMIN, ROLE.SUPER_ADMIN])

  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HrAdminPilotClient user={user} />
    </Suspense>
  )
}
