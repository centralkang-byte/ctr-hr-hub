import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import WorkforceClient from './WorkforceClient'
import { ChartSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
  const t = await getTranslations('analytics')
  return { title: t('workforce.pageTitle') }
}

export default async function WorkforcePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser
  const t = await getTranslations('analytics')

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t('workforce.pageTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('workforce.pageDescription')}</p>
      </div>
      <Suspense fallback={<ChartSkeleton />}>
        <WorkforceClient user={user} />
      </Suspense>
    </div>
  )
}
