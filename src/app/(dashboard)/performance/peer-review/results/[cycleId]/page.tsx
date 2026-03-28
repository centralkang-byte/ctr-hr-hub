import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import type { Metadata } from 'next'
import PeerReviewResultsClient from './PeerReviewResultsClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export const metadata: Metadata = { title: '동료 평가 결과 | CTR HR Hub' }

export default async function PeerReviewResultsPage({ params }: { params: Promise<Record<string, string>> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser
  const { cycleId } = await params

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <PeerReviewResultsClient user={user} cycleId={cycleId} />
    </Suspense>
  )
}
