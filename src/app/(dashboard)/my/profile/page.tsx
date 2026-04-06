import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { prisma } from '@/lib/prisma'
import { getDivisionName } from '@/lib/employee/profile-utils'
import { MyProfileClient } from './MyProfileClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
  const t = await getTranslations('mySpace')
  return { title: t('profileTitle') }
}

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
            department: {
              select: {
                id: true, name: true, level: true,
                parent: {
                  select: {
                    id: true, name: true, level: true,
                    parent: { select: { id: true, name: true, level: true } },
                  },
                },
              },
            },
            jobGrade: { select: { id: true, name: true, code: true } },
            company: { select: { id: true, code: true, name: true } },
            title: { select: { id: true, name: true } },
            position: { select: { id: true, titleKo: true } },
            workLocation: { select: { country: true, city: true, name: true } },
          },
        },
        profileExtension: true,
        emergencyContacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        profileVisibility: true,
        employeeHistories: {
          orderBy: { effectiveDate: 'desc' },
          take: 10,
          include: {
            toDept: { select: { name: true } },
            toGrade: { select: { name: true } },
            toCompany: { select: { name: true } },
          }
        },
        compensationHistories: {
          orderBy: { effectiveDate: 'desc' },
          take: 5,
          select: {
            id: true, effectiveDate: true, changeType: true, newBaseSalary: true, currency: true
          }
        },
        employeeDocuments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true, docType: true, title: true, createdAt: true, fileKey: true
          }
        }
      },
    })
  } catch (err) {
    console.error('[my/profile] Prisma query failed:', err)
    // Fallback: fetch without optional relations that may not have tables
    try {
      const fallbackEmployee = await prisma.employee.findUnique({
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
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      employee = fallbackEmployee as any;

      // Add empty defaults for missing relations
      if (employee) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (employee as any).profileExtension = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (employee as any).emergencyContacts = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (employee as any).profileVisibility = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (employee as any).employeeHistories = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (employee as any).compensationHistories = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (employee as any).employeeDocuments = [];
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const primaryAsgn = (employee as any).assignments?.[0]
  const division = getDivisionName(primaryAsgn?.department ?? null)

  const serialized = {
    ...employee,
    hireDate:  employee.hireDate?.toISOString() ?? new Date().toISOString(),
    birthDate: employee.birthDate?.toISOString() ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    employeeHistories: employee.employeeHistories?.map((h: any) => ({
      ...h,
      effectiveDate: h.effectiveDate?.toISOString() ?? new Date().toISOString(),
      createdAt: h.createdAt?.toISOString() ?? new Date().toISOString(),
    })) ?? [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    compensationHistories: employee.compensationHistories?.map((h: any) => ({
      ...h,
      effectiveDate: h.effectiveDate?.toISOString() ?? new Date().toISOString(),
      newBaseSalary: h.newBaseSalary ? h.newBaseSalary.toString() : '0' // Convert Decimal to string
    })) ?? [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    employeeDocuments: employee.employeeDocuments?.map((d: any) => ({
      ...d,
      createdAt: d.createdAt?.toISOString() ?? new Date().toISOString()
    })) ?? []
  }

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <MyProfileClient user={user} employee={serialized as any} division={division} />
    </Suspense>
  )
}

