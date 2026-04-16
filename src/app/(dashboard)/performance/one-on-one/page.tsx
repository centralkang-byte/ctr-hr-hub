import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { getTranslations } from 'next-intl/server'
import OneOnOneClient from './OneOnOneClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
  const t = await getTranslations('performance')
  return { title: `${t('oneOnOne_pageTitle')} | CTR HR Hub` }
}

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
