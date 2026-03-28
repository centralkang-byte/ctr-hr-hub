import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { InterviewFormClient } from './InterviewFormClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function NewInterviewPage({
  params,
}: {
  params: Promise<Record<string, string>>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const { id } = await params
  const user = session.user as SessionUser
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <InterviewFormClient user={user} postingId={id} />
    </Suspense>
  )
}
