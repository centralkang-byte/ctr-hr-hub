import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { prisma } from '@/lib/prisma'
import PayrollImportClient from './PayrollImportClient'
import type { SessionUser } from '@/types'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
  const t = await getTranslations('payroll')
  return { title: `${t('page.import')} | CTR HR Hub` }
}

export default async function PayrollImportPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser

  // 해외 법인 목록 (KR 제외)
  const companies = await prisma.company.findMany({
    where: { code: { not: 'CTR' } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, code: true, currency: true },
  })

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <PayrollImportClient user={user} companies={companies} />
    </Suspense>
  )
}
