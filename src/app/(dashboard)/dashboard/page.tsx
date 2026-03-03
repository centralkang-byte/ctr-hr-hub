import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { prisma } from '@/lib/prisma'
import { DashboardClient } from './DashboardClient'

export const metadata = { title: 'HR KPI 대시보드 | CTR HR Hub' }

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser
  const allowedRoles = [ROLE.HR_ADMIN, ROLE.SUPER_ADMIN, ROLE.EXECUTIVE]
  if (!allowedRoles.includes(user.role as never)) redirect('/')

  const companies =
    user.role === ROLE.SUPER_ADMIN
      ? await prisma.company.findMany({
          select: { id: true, code: true, name: true },
          orderBy: { code: 'asc' },
        })
      : user.companyId
      ? await prisma.company.findMany({
          where: { id: user.companyId },
          select: { id: true, code: true, name: true },
        })
      : []

  const defaultCompanyId = user.role === ROLE.SUPER_ADMIN ? null : (user.companyId ?? null)

  return <DashboardClient user={user} companies={companies} defaultCompanyId={defaultCompanyId} />
}
