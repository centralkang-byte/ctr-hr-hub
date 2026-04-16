// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /recruitment/requisitions (Server Page)
// B4: 채용 요청 목록 + 승인함
// ═══════════════════════════════════════════════════════════

import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import RequisitionListClient from './RequisitionListClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
  const t = await getTranslations('recruitment')
  return { title: t('pageTitle_requisitions') }
}

export default async function RequisitionsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <RequisitionListClient user={user} />
    </Suspense>
  )
}
