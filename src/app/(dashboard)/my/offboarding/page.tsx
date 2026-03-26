// ═══════════════════════════════════════════════════════════
// CTR HR Hub — My Offboarding Page (Stage 5-B)
// /(dashboard)/my/offboarding
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { MyOffboardingClient } from './MyOffboardingClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export const metadata = {
  title: '나의 퇴직처리 — CTR HR Hub',
  description: '나의 퇴직 처리 진행 현황과 할 일을 확인하세요.',
}

export default async function MyOffboardingPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  // All roles can access — client will show "no process" message if applicable
  const _user = session.user as SessionUser

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <MyOffboardingClient />
      </div>
    </Suspense>
  )
}
