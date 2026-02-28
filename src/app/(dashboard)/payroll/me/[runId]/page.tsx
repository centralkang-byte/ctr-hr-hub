import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import PayStubDetailClient from './PayStubDetailClient'

interface Props {
  params: Promise<{ runId: string }>
}

export default async function PayStubDetailPage({ params }: Props) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  const { runId } = await params
  return <PayStubDetailClient user={user} runId={runId} />
}
