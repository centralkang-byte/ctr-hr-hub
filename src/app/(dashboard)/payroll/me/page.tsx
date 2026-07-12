import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCompaniesForUser } from '@/lib/company/getCompanies'
import { isYearEndSelfServiceVisible } from '@/lib/payroll/year-end-visibility'
import type { SessionUser } from '@/types'
import PayrollMeClient from './PayrollMeClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function PayrollMePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  // 연말정산 링크는 종전 rail 조건(KR + 1~3월) 보존 — Codex G2 P1
  const companies = await getCompaniesForUser(user.role, user.companyId)
  const countryCode = companies.find((c) => c.id === user.companyId)?.countryCode ?? null
  const showYearEnd = isYearEndSelfServiceVisible(countryCode)
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <PayrollMeClient user={user} showYearEnd={showYearEnd} />
    </Suspense>
  )
}
