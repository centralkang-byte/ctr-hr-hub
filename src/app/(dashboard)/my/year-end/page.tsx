// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 연말정산 위자드 페이지 (Server Component)
// /my/year-end — CTR 전용 연말정산 자기신고
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { YearEndWizardClient } from './YearEndWizardClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
  const t = await getTranslations('yearEnd')
  return { title: t('pageTitle') }
}

export default async function YearEndPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser

  // Default to 2025 tax year
  const year = 2025

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <YearEndWizardClient user={user} year={year} />
    </Suspense>
  )
}
