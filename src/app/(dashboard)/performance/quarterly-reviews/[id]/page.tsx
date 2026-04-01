import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import QuarterlyReviewDetailClient from './QuarterlyReviewDetailClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

interface Props {
  params: Promise<{ id: string }>
}

export default async function QuarterlyReviewDetailPage({ params }: Props) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  const { id } = await params

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <QuarterlyReviewDetailClient user={user} reviewId={id} />
    </Suspense>
  )
}
