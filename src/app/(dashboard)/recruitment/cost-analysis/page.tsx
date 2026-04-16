import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { CostAnalysisClient } from './CostAnalysisClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
  const t = await getTranslations('recruitment')
  return { title: t('pageTitle_costAnalysis') }
}

export default async function CostAnalysisPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <CostAnalysisClient user={user} />
    </Suspense>
  )
}
