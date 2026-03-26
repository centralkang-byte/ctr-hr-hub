import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { type Metadata } from 'next'
import RecognitionClient from './RecognitionClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export const metadata: Metadata = { title: 'Recognition | CTR HR Hub' }

export default async function RecognitionPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <RecognitionClient user={user} />
    </Suspense>
  )
}
