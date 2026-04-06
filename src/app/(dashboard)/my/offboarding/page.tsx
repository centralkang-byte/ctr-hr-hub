// ═══════════════════════════════════════════════════════════
// CTR HR Hub — My Offboarding Page (Stage 5-B)
// /(dashboard)/my/offboarding
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { MyOffboardingClient } from './MyOffboardingClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
  const t = await getTranslations('myOffboarding')
  return { title: t('title') }
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
