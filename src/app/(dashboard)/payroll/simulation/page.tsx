import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { prisma } from '@/lib/prisma'
import PayrollSimulationClient from './PayrollSimulationClient'
import type { SessionUser } from '@/types'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
  const t = await getTranslations('payroll')
  return { title: `${t('page.simulation')} | CTR HR Hub` }
}

export default async function PayrollSimulationPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser

  const [companies, departments] = await Promise.all([
    prisma.company.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, name: true, code: true, currency: true },
    }),
    prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, companyId: true },
    }),
  ])

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <PayrollSimulationClient
        user={user}
        companies={companies}
        departments={departments}
      />
    </Suspense>
  )
}
