import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import type { Metadata } from 'next'
import PulseRespondClient from './PulseRespondClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export const metadata: Metadata = { title: '설문 응답 | CTR HR Hub' }

export default async function PulseRespondPage({ params }: { params: Promise<Record<string, string>> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser
  const { id } = await params

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <PulseRespondClient user={user} id={id} />
    </Suspense>
  )
}
