import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTranslations } from 'next-intl/server'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import YearEndHRClient from './YearEndHRClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
  const t = await getTranslations('payroll')
  return { title: `${t('page.yearEnd')} | CTR HR Hub` }
}

export default async function YearEndHRPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser

  // Only HR_ADMIN and SUPER_ADMIN can access this page
  if (user.role !== ROLE.HR_ADMIN && user.role !== ROLE.SUPER_ADMIN) {
    redirect('/home')
  }

  const currentYear = new Date().getFullYear()

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <YearEndHRClient user={user} defaultYear={currentYear} />
    </Suspense>
  )
}
