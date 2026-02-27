// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /settings/contract-rules (Server Page)
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import ContractRulesClient from './ContractRulesClient'

export default async function ContractRulesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser
  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN'
  if (!isAdmin) redirect('/dashboard')

  return (
    <div className="p-6">
      <ContractRulesClient />
    </div>
  )
}
