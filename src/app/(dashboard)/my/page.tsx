import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { prisma } from '@/lib/prisma'
import { MySpaceClient } from './MySpaceClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
  const t = await getTranslations('mySpace')
  return { title: t('pageTitle') }
}

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
    // LB1: 신 SSOT(LeaveYearBalance) 사용 — 레거시 EmployeeLeaveBalance는 시드 전용(런타임 쓰기 0)
    // 이라 시드 직후 잔여연차가 stale/빈값. year 기준은 /api/v1/leave/balances SSOT와 동일하게 맞춤.
    prisma.leaveYearBalance.findMany({
      where: { employeeId: user.employeeId, year: new Date().getFullYear() },
      include: { leaveTypeDef: { select: { name: true, code: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.profileChangeRequest.count({
      where: { employeeId: user.employeeId, status: 'CHANGE_PENDING' },
    }),
  ])

  if (!employee) redirect('/login')

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <MySpaceClient
        user={user}
        employee={employee}
        leaveBalances={leaveBalances}
        pendingChangeRequests={pendingChangeRequests}
      />
    </Suspense>
  )
}
