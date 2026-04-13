import { type NextRequest, NextResponse } from 'next/server'
import { withPermission, perm } from '@/lib/permissions'
import { buildPagination } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { z } from 'zod'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

const querySchema = z.object({
  search: z.string().optional(),
  companyId: z.string().optional(),
  departmentId: z.string().optional(),
  departmentIds: z.string().optional(), // 쉼표 구분 복수 부서 ID (하위 부서 포함 용)
  jobGradeId: z.string().optional(),
  skill: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) throw badRequest('Invalid query params', { issues: parsed.error.issues })

    const { search, companyId, departmentId, departmentIds, jobGradeId, skill, page, limit } = parsed.data
    const skip = (page - 1) * limit

    const assignmentFilter: Record<string, unknown> = { isPrimary: true, endDate: null, status: { in: ['ACTIVE', 'ON_LEAVE'] } }
    // 회사 필터: 명시적 companyId > SA 전체 조회 > 자기 회사만
    if (companyId) {
      assignmentFilter.companyId = companyId
    } else if (user.role !== 'SUPER_ADMIN') {
      assignmentFilter.companyId = user.companyId
    }
    // 부서 필터: departmentIds(복수) > departmentId(단수)
    if (departmentIds) {
      assignmentFilter.departmentId = { in: departmentIds.split(',').filter(Boolean) }
    } else if (departmentId) {
      assignmentFilter.departmentId = departmentId
    }
    if (jobGradeId) assignmentFilter.jobGradeId = jobGradeId

    const baseWhere = {
      deletedAt: null,
      assignments: { some: assignmentFilter },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { nameEn: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { employeeNo: { contains: search, mode: 'insensitive' as const } },
              { assignments: { some: { department: { name: { contains: search, mode: 'insensitive' as const } } } } },
            ],
          }
        : {}),
      ...(skill ? { profileExtension: { skills: { has: skill } } } : {}),
    }

    // 비활성 직원 수 (같은 부서/회사 범위, TERMINATED/RESIGNED)
    const inactiveFilter: Record<string, unknown> = { isPrimary: true, endDate: null, status: { in: ['TERMINATED', 'RESIGNED'] } }
    if (assignmentFilter.companyId) inactiveFilter.companyId = assignmentFilter.companyId
    if (assignmentFilter.departmentId) inactiveFilter.departmentId = assignmentFilter.departmentId

    const [total, inactiveCount, employees] = await Promise.all([
      prisma.employee.count({ where: baseWhere }),
      prisma.employee.count({ where: { deletedAt: null, assignments: { some: inactiveFilter } } }),
      prisma.employee.findMany({
        where: baseWhere,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          assignments: {
            where: { isPrimary: true, endDate: null },
            take: 1,
            include: {
              department: { select: { id: true, name: true } },
              jobGrade: { select: { id: true, name: true, code: true } },
              company: { select: { id: true, code: true, name: true } },
              title: { select: { id: true, name: true } },
              position: { select: { id: true, titleKo: true } },
            },
          },
          profileExtension: {
            select: { bio: true, skills: true, languages: true, certifications: true, avatarPath: true },
          },
          profileVisibility: true,
        },
      }),
    ])

    const viewerDeptId = (user as unknown as Record<string, unknown>).departmentId as string | undefined
    const isHR = user.role === 'HR_ADMIN' || user.role === 'SUPER_ADMIN'

    const result = employees.map((emp) => {
      const asgn = extractPrimaryAssignment(emp.assignments)
      const vis = emp.profileVisibility
      const isSameDept = asgn?.departmentId === viewerDeptId

      const canSee = (level?: string | null) => {
        if (!level || level === 'public') return true
        if (isHR) return true
        if (level === 'team') return isSameDept
        return false
      }

      return {
        id: emp.id,
        name: emp.name,
        nameEn: emp.nameEn,
        email: emp.email,
        phone: canSee(vis?.personalPhone) ? emp.phone : null,
        photoUrl: emp.photoUrl,
        avatarPath: emp.profileExtension?.avatarPath ?? null,
        department: asgn?.department ?? null,
        jobGrade: asgn?.jobGrade ?? null,
        company: asgn?.company ?? null,
        title: asgn?.title ?? null,
        position: asgn?.position ? { id: asgn.position.id, titleKo: asgn.position.titleKo } : null,
        bio: canSee(vis?.bio) ? (emp.profileExtension?.bio ?? null) : null,
        skills: canSee(vis?.skills) ? (emp.profileExtension?.skills ?? []) : [],
        languages: canSee(vis?.skills) ? (emp.profileExtension?.languages ?? null) : null,
        certifications: canSee(vis?.skills) ? (emp.profileExtension?.certifications ?? null) : null,
      }
    })

    const pagination = buildPagination(page, limit, total)
    return NextResponse.json({ data: result, pagination, inactiveCount })
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
