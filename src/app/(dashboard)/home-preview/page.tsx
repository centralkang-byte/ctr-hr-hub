// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /home-preview (Server Page)
// R1 Foundation showcase — HOME_PREVIEW env gated.
// Codex Gate 1 Fix #1: 서버 전용 env 사용 (NEXT_PUBLIC_* 금지).
// Next.js는 NEXT_PUBLIC_*를 빌드 시 inline → 프로모션된 빌드에서 누출 위험.
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { HomeSkeleton } from '@/components/shared/PageSkeleton'
import { PreviewClient } from './PreviewClient'

// ─── Page ─────────────────────────────────────────────────

export default async function HomePreviewPage() {
  // 서버 전용 env 런타임 체크 — prod build에 var 없으면 자동 404
  if (process.env.HOME_PREVIEW !== 'true') {
    notFound()
  }

  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  return (
    <Suspense fallback={<HomeSkeleton />}>
      <PreviewClient user={user} />
    </Suspense>
  )
}
