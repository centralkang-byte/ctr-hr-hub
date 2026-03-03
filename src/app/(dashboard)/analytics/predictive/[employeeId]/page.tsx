import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import EmployeeRiskDetailClient from './EmployeeRiskDetailClient'

export default async function EmployeeRiskDetailPage({
  params,
}: {
  params: Promise<{ employeeId: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const user = session.user as { role?: string }
  if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role ?? '')) {
    redirect('/analytics')
  }

  const { employeeId } = await params
  return <EmployeeRiskDetailClient employeeId={employeeId} />
}
