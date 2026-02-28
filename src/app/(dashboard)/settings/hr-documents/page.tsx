import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { HrDocumentManager } from '@/components/hr-chatbot/HrDocumentManager'

export default async function HrDocumentsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser

  if (user.role !== ROLE.HR_ADMIN && user.role !== ROLE.SUPER_ADMIN) {
    redirect('/')
  }

  return <HrDocumentManager user={user} />
}
