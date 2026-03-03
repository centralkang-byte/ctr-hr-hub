import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PayrollImportClient from './PayrollImportClient'
import type { SessionUser } from '@/types'

export const metadata = { title: '해외 급여 업로드 | CTR HR Hub' }

export default async function PayrollImportPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser

  // 해외 법인 목록 (KR 제외)
  const companies = await prisma.company.findMany({
    where: { code: { not: 'CTR-KR' } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, code: true, currency: true },
  })

  return <PayrollImportClient user={user} companies={companies} />
}
