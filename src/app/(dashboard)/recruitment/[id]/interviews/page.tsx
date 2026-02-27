import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { InterviewListClient } from './InterviewListClient'

export default async function InterviewListPage({
  params,
}: {
  params: Promise<Record<string, string>>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const { id } = await params
  const user = session.user as SessionUser
  return <InterviewListClient user={user} postingId={id} />
}
