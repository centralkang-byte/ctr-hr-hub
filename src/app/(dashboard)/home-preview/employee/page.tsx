// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /home-preview/employee (Server Page)
// R3 Dashboard Pilot — EmployeeHomeV2, 3중 가드.
// EMPLOYEE only — SUPER_ADMIN 제외 (개인 데이터 범위라 의미 없음).
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { HomeSkeleton } from '@/components/shared/PageSkeleton'
import { assertHomePreviewEnabled, assertPilotRole } from '@/lib/home-preview/guard'
import { EmployeePilotClient } from './EmployeePilotClient'

// ─── Page ─────────────────────────────────────────────────

export default async function EmployeePilotPage() {
  assertHomePreviewEnabled()

  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  assertPilotRole(user.role, [ROLE.EMPLOYEE])

  return (
    <Suspense fallback={<HomeSkeleton />}>
      <EmployeePilotClient user={user} />
    </Suspense>
  )
}
