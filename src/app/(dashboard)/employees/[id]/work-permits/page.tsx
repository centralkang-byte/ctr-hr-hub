// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /employees/[id]/work-permits (Server Page)
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import WorkPermitsClient from './WorkPermitsClient'

export default async function WorkPermitsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser

  return (
    <div className="p-6">
      <WorkPermitsClient employeeId={id} permissions={user.permissions ?? []} />
    </div>
  )
}
