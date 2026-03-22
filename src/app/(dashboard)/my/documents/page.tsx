import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { MyDocumentsClient } from './MyDocumentsClient'

export const metadata = { title: '문서/증명서 | CTR HR Hub' }

export default async function MyDocumentsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return <MyDocumentsClient user={user} />
}
