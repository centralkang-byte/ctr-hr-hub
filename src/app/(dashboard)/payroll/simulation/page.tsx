import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PayrollSimulationClient from './PayrollSimulationClient'
import type { SessionUser } from '@/types'

export const metadata = { title: '급여 시뮬레이션 | CTR HR Hub' }

export default async function PayrollSimulationPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser

  const [companies, jobGrades] = await Promise.all([
    prisma.company.findMany({ orderBy: { code: 'asc' }, select: { id: true, name: true, code: true, currency: true } }),
    prisma.jobGrade.findMany({ orderBy: { rankOrder: 'asc' }, select: { id: true, name: true, rankOrder: true } }),
  ])

  return <PayrollSimulationClient user={user} companies={companies} jobGrades={jobGrades} />
}
