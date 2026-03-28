import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { type Metadata } from 'next'
import OneOnOneClient from './OneOnOneClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export const metadata: Metadata = { title: '1:1 미팅 | CTR HR Hub' }

export default async function OneOnOnePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <OneOnOneClient user={user} />
    </Suspense>
  )
}
