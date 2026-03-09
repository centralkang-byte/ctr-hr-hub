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

  let employee
  try {
    employee = await prisma.employee.findUnique({
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
  } catch (err) {
    console.error('[my/profile] Prisma query failed:', err)
    // Fallback: fetch without optional relations that may not have tables
    try {
      employee = await prisma.employee.findUnique({
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
        },
      })
      // Add empty defaults for missing relations
      if (employee) {
        (employee as any).profileExtension = null;
        (employee as any).emergencyContacts = [];
        (employee as any).profileVisibility = null;
      }
    } catch (err2) {
      console.error('[my/profile] Fallback query also failed:', err2)
      redirect('/home')
    }
  }

  if (!employee) redirect('/login')

  // ─── Date 직렬화 (Server→Client 경계 crossing) ────────────
  // Next.js App Router는 Date 객체를 직접 넘길 수 없음.
  // 문자열로 변환 후 Client Component에서 new Date()로 복원.
  const serialized = {
    ...employee,
    hireDate:  employee.hireDate?.toISOString() ?? new Date().toISOString(),
    birthDate: employee.birthDate?.toISOString() ?? null,
  }

  return <MyProfileClient user={user} employee={serialized as any} />
}

