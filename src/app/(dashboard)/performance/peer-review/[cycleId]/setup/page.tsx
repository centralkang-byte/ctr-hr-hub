import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { getTranslations } from 'next-intl/server'
import PeerNominationSetupClient from './PeerNominationSetupClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
  const t = await getTranslations('performance')
  return { title: `${t('peerReview_setupPageTitle')} | CTR HR Hub` }
}

export default async function PeerNominationSetupPage({ params }: { params: Promise<Record<string, string>> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser
  const { cycleId } = await params

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <PeerNominationSetupClient user={user} cycleId={cycleId} />
    </Suspense>
  )
}
