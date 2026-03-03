import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { prisma } from '@/lib/prisma'
import { MySpaceClient } from './MySpaceClient'

export const metadata = { title: '나의 공간 | CTR HR Hub' }

export default async function MySpacePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser

  const [employee, leaveBalances, pendingChangeRequests] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: user.employeeId },
      select: {
        id: true,
        name: true,
        employeeNo: true,
        hireDate: true,
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          include: {
            department: { select: { name: true } },
            jobGrade: { select: { name: true, code: true } },
            company: { select: { name: true, code: true } },
          },
        },
      },
    }),
    prisma.employeeLeaveBalance.findMany({
      where: { employeeId: user.employeeId },
      include: { policy: { select: { name: true, leaveType: true } } },
    }),
    prisma.profileChangeRequest.count({
      where: { employeeId: user.employeeId, status: 'CHANGE_PENDING' },
    }),
  ])

  if (!employee) redirect('/login')

  return (
    <MySpaceClient
      user={user}
      employee={employee}
      leaveBalances={leaveBalances}
      pendingChangeRequests={pendingChangeRequests}
    />
  )
}
