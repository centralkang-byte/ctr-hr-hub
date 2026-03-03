import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { prisma } from '@/lib/prisma'
import { MyProfileClient } from './MyProfileClient'

export const metadata = { title: '내 프로필 | CTR HR Hub' }

export default async function MyProfilePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser

  const employee = await prisma.employee.findUnique({
    where: { id: user.employeeId },
    select: {
      id: true,
      employeeNo: true,
      name: true,
      nameEn: true,
      email: true,
      phone: true,
      birthDate: true,
      gender: true,
      hireDate: true,
      assignments: {
        where: { isPrimary: true, endDate: null },
        take: 1,
        include: {
          department: { select: { id: true, name: true } },
          jobGrade: { select: { id: true, name: true, code: true } },
          company: { select: { id: true, code: true, name: true } },
        },
      },
      profileExtension: true,
      emergencyContacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
      profileVisibility: true,
    },
  })

  if (!employee) redirect('/login')

  return <MyProfileClient user={user} employee={employee} />
}
