// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /recruitment/new (Server Page)
// ═══════════════════════════════════════════════════════════

import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import PostingFormClient from './PostingFormClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
  const t = await getTranslations('recruitment')
  return { title: t('pageTitle_newPosting') }
}

export default async function RecruitmentNewPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <PostingFormClient user={user} />
    </Suspense>
  )
}
