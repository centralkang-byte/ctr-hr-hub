import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { getTranslations } from 'next-intl/server'
import PulseResultsClient from './PulseResultsClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
  const t = await getTranslations('performance')
  return { title: `${t('pulse.resultsPageTitle')} | CTR HR Hub` }
}

export default async function PulseResultsPage({ params }: { params: Promise<Record<string, string>> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser
  const { id } = await params

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <PulseResultsClient user={user} id={id} />
    </Suspense>
  )
}
