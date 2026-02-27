// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /recruitment/[id]/applicants (Server Page)
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import ApplicantListClient from './ApplicantListClient'

export default async function ApplicantsPage({
  params,
}: {
  params: Promise<Record<string, string>>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser
  const { id } = await params

  return <ApplicantListClient user={user} postingId={id} />
}
