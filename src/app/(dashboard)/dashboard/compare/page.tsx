import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import { authOptions } from '@/lib/auth'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { CompareClient } from './CompareClient'
import { HomeSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
  const t = await getTranslations('home')
  return { title: t('compare.pageTitle') + ' | CTR HR Hub' }
}

export default async function ComparePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  const allowedRoles = [ROLE.HR_ADMIN, ROLE.SUPER_ADMIN, ROLE.EXECUTIVE]
  if (!allowedRoles.includes(user.role as never)) redirect('/dashboard')
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <CompareClient />
    </Suspense>
  )
}
