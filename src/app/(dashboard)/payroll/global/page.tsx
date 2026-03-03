import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import GlobalPayrollClient from './GlobalPayrollClient'
import type { SessionUser } from '@/types'

export const metadata = { title: '글로벌 급여 현황 | CTR HR Hub' }

export default async function GlobalPayrollPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  return <GlobalPayrollClient user={session.user as SessionUser} />
}
