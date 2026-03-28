import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { prisma } from '@/lib/prisma'
import { DirectoryClient } from './DirectoryClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export const metadata = { title: 'People Directory | CTR HR Hub' }

export default async function DirectoryPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser

  const companies = await prisma.company.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  })

  const departments = await prisma.department.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, companyId: true },
    orderBy: { name: 'asc' },
  })

  const jobGrades = await prisma.jobGrade.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, code: true, companyId: true },
    orderBy: { rankOrder: 'asc' },
  })

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <DirectoryClient
        user={user}
        companies={companies}
        departments={departments}
        jobGrades={jobGrades}
      />
    </Suspense>
  )
}
