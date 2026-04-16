import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { getTranslations } from 'next-intl/server'
import PeerReviewClient from './PeerReviewClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
  const t = await getTranslations('performance')
  return { title: `${t('peerReview_pageTitle')} | CTR HR Hub` }
}

export default async function PeerReviewPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <PeerReviewClient user={user} />
    </Suspense>
  )
}
