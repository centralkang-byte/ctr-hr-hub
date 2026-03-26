import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import type { Metadata } from 'next'
import PulseSurveyClient from './PulseSurveyClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export const metadata: Metadata = { title: '펄스 서베이 | CTR HR Hub' }

export default async function PulseSurveyPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <PulseSurveyClient user={user} />
    </Suspense>
  )
}
