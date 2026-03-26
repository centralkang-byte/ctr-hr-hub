import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import PayrollReviewClient from './PayrollReviewClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

interface Props {
  params: Promise<{ runId: string }>
}

export default async function PayrollReviewPage({ params }: Props) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  const { runId } = await params
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <PayrollReviewClient user={user} runId={runId} />
    </Suspense>
  )
}
