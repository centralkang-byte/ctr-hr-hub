// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /home-preview (Server Page)
// R1 Foundation showcase — HOME_PREVIEW env gated + VERCEL_ENV guard.
// R3 (Session 178): /lib/home-preview/guard로 2중 가드 추출.
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { HomeSkeleton } from '@/components/shared/PageSkeleton'
import { assertHomePreviewEnabled } from '@/lib/home-preview/guard'
import { PreviewClient } from './PreviewClient'

// ─── Page ─────────────────────────────────────────────────

export default async function HomePreviewPage() {
  assertHomePreviewEnabled()

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
