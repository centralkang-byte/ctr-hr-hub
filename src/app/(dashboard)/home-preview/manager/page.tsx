// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /home-preview/manager (Server Page)
// R2 Dashboard Pilot — ManagerHomeV2 preview, env + VERCEL_ENV + role gated.
// Codex Gate 1 HIGH fix: MANAGER only (SUPER_ADMIN은 다른 DTO를 받으므로 제외).
// Codex Gate 1 MEDIUM fix: VERCEL_ENV !== 'production' 2차 가드.
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { HomeSkeleton } from '@/components/shared/PageSkeleton'
import { ManagerPilotClient } from './ManagerPilotClient'

// ─── Page ─────────────────────────────────────────────────

export default async function ManagerPilotPage() {
  // 1차 가드: env flag 런타임 체크 (서버 전용, NEXT_PUBLIC_* 금지)
  if (process.env.HOME_PREVIEW !== 'true') {
    notFound()
  }
  // 2차 가드: production 유출 방어 — Vercel env가 production이면 강제 차단
  if (process.env.VERCEL_ENV === 'production') {
    notFound()
  }

  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  // 3차 가드: MANAGER만 허용 — summary API가 role별 다른 DTO 반환하므로 SUPER_ADMIN 등은 미스매치 발생.
  if (user.role !== ROLE.MANAGER) {
    notFound()
  }

  return (
    <Suspense fallback={<HomeSkeleton />}>
      <ManagerPilotClient user={user} />
    </Suspense>
  )
}
