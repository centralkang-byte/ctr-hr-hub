import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ExchangeRatesClient from './ExchangeRatesClient'
import type { SessionUser } from '@/types'

export const metadata = { title: '환율 관리 | CTR HR Hub' }

export default async function ExchangeRatesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  return <ExchangeRatesClient user={session.user as SessionUser} />
}
