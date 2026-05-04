// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/recruitment/requisitions
// B4: 채용 요청 목록 조회 + 신규 생성
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'
import type { SessionUser } from '@/types'

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  companyId: z.string().uuid().optional(),
  status: z.string().optional(),
  urgency: z.string().optional(),
  myApprovals: z.coerce.boolean().default(false), // 나의 결재 대기만 조회
})

const createSchema = z.object({
  companyId: z.string().uuid(),
  departmentId: z.string().uuid(),
  title: z.string().min(1, '직무명을 입력해주세요.'),
  headcount: z.number().int().min(1).default(1),
  jobLevel: z.string().optional(),
  employmentType: z.enum(['permanent', 'contract', 'intern']),
  justification: z.string().min(1, '채용 사유를 입력해주세요.'),
  requirements: z.any().optional(),
  urgency: z.enum(['urgent', 'normal', 'low']).default('normal'),
  targetDate: z.string().optional(),
  positionId: z.string().uuid().optional(),
  submitForApproval: z.boolean().default(false), // true=결재요청, false=임시저장
})

// ─── GET /api/v1/recruitment/requisitions ──────────────────
export const GET = withPermission(
  async (req: NextRequest, _context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams)
    const parsed = searchSchema.safeParse(params)
    if (!parsed.success) throw badRequest(parsed.error.message)

    const { page, limit, companyId, status, urgency, myApprovals } = parsed.data
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (companyId) where.companyId = companyId
    if (status) where.status = status
    if (urgency) where.urgency = urgency

    // 나의 결재 대기: requisition 생성 시 모든 step의 approvalRecord가
    // status='pending'으로 미리 생성되며 approverId는 비어 있다 (역할 기반).
    // 그래서 approverId 직접 비교로는 조회 불가 → approverRole + currentStep
    // 매칭 + 사용자 역할/관계로 해석한다.
    //
    // - hr_admin: HR_ADMIN / SUPER_ADMIN
    // - ceo: EXECUTIVE / SUPER_ADMIN
    // - direct_manager: user의 Position 직속 부하 (Position.reportsToPositionId)
    // - dept_head: user가 head로 지정된 Department(s)의 소속 직원 (Session 201
    //   `add_department_head_employee_id` 마이그레이션으로 활성화).
    // - 단일 SessionUser.role 기반: 멀티롤 employee(예: MANAGER + HR_ADMIN
    //   동시 보유)는 한 번에 하나의 role로 세션 잡힘 → 추가 role의 approval은
    //   놓침. 코드베이스 내 멀티롤 빈도 낮아 별도 follow-up.
    //
    // **반드시 stepOrder === currentStep**으로 한정. Pending 레코드는 미래
    // 단계까지 모두 미리 생성되므로 단순 some()으로는 다음 결재자가 현재
    // 단계 결정 전 미리 노출되어 out-of-order 승인 위험.
    //
    // **Cross-company 격리**: SUPER_ADMIN이 명시적으로 companyId를 넘기면
    // 해당 법인 한정, 그 외엔 user.companyId로 강제. 자체 법인 데이터만
    // 노출되도록 보장 (권한 helper resolveApproverByRole와 동일 정책).
    if (myApprovals) {
      const myApprovalsScope =
        user.role === 'SUPER_ADMIN' && companyId ? companyId : user.companyId
      where.companyId = myApprovalsScope
      const eligibleRoles: string[] = []
      if (user.role === 'HR_ADMIN' || user.role === 'SUPER_ADMIN') {
        eligibleRoles.push('hr_admin')
      }
      if (user.role === 'EXECUTIVE' || user.role === 'SUPER_ADMIN') {
        eligibleRoles.push('ceo')
      }

      // direct_manager: pre-fetch user의 Position 직속 부하 employeeId 집합
      let directReportIds: string[] = []
      const userAssignment = await prisma.employeeAssignment.findFirst({
        where: { employeeId: user.employeeId, isPrimary: true, endDate: null },
        select: { positionId: true },
      })
      if (userAssignment?.positionId) {
        const reports = await prisma.employeeAssignment.findMany({
          where: {
            isPrimary: true,
            endDate: null,
            position: { reportsToPositionId: userAssignment.positionId },
          },
          select: { employeeId: true },
        })
        directReportIds = reports.map((r) => r.employeeId)
      }

      // dept_head: user가 head로 지정된 Department의 id 집합.
      // requisition.departmentId(채용 대상 부서)가 이 집합에 속할 때 결재 대상.
      // requesterId 기반이 아님 — HR이 다른 부서용 채용을 등록하면 그 부서장이
      // 결재해야 하므로 채용 대상 부서로 매칭.
      // companyId scope는 myApprovalsScope로 강제 (cross-company head 방어).
      const headedDepts = await prisma.department.findMany({
        where: {
          headEmployeeId: user.employeeId,
          companyId: myApprovalsScope,
          deletedAt: null,
        },
        select: { id: true },
      })
      const headedDeptIds = headedDepts.map((d) => d.id)

      if (
        eligibleRoles.length === 0 &&
        directReportIds.length === 0 &&
        headedDeptIds.length === 0
      ) {
        // 어떤 역할로도 결재 대기를 가질 수 없음 → 빈 결과
        where.id = '__NEVER_MATCH__'
      } else {
        // 1-pass: status=pending requisition 중 currentStep의 record가
        // 사용자 역할/관계와 매치되는 id만 추려낸 뒤, 메인 query는 그
        // id 집합으로 좁힌다. Prisma는 row-correlated 비교를 표현 못 함.
        const orFilter: Array<Record<string, unknown>> = []
        if (eligibleRoles.length > 0) {
          orFilter.push({
            approvalRecords: {
              some: { approverRole: { in: eligibleRoles }, status: 'pending' },
            },
          })
        }
        if (directReportIds.length > 0) {
          orFilter.push({
            AND: [
              { requesterId: { in: directReportIds } },
              {
                approvalRecords: {
                  some: { approverRole: 'direct_manager', status: 'pending' },
                },
              },
            ],
          })
        }
        if (headedDeptIds.length > 0) {
          orFilter.push({
            AND: [
              { departmentId: { in: headedDeptIds } },
              {
                approvalRecords: {
                  some: { approverRole: 'dept_head', status: 'pending' },
                },
              },
            ],
          })
        }

        const candidates = await prisma.requisition.findMany({
          where: {
            ...where,
            status: 'pending',
            OR: orFilter,
          },
          select: {
            id: true,
            currentStep: true,
            requesterId: true,
            departmentId: true,
            approvalRecords: {
              where: { status: 'pending' },
              select: { stepOrder: true, approverRole: true },
            },
          },
        })

        const matchingIds = candidates
          .filter((req) => {
            const current = req.approvalRecords.find(
              (r) => r.stepOrder === req.currentStep,
            )
            if (!current) return false
            if (
              current.approverRole === 'direct_manager' &&
              directReportIds.includes(req.requesterId)
            ) {
              return true
            }
            if (
              current.approverRole === 'dept_head' &&
              headedDeptIds.includes(req.departmentId)
            ) {
              return true
            }
            return (
              current.approverRole !== null &&
              eligibleRoles.includes(current.approverRole)
            )
          })
          .map((r) => r.id)

        if (matchingIds.length === 0) {
          where.id = '__NEVER_MATCH__'
        } else {
          where.id = { in: matchingIds }
          // myApprovals만 보는 흐름이라 status 강제 (draft/approved/rejected
          // 동시 조회는 의미 없음 — 사용자 status query는 무시).
          where.status = 'pending'
        }
      }
    }

    const [total, items] = await Promise.all([
      prisma.requisition.count({ where }),
      prisma.requisition.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          requester: { select: { id: true, name: true, nameEn: true } },
          position: { select: { id: true, titleKo: true, titleEn: true } },
          approvalRecords: {
            orderBy: { stepOrder: 'asc' },
            include: {
              approver: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ])

    return apiPaginated(items, buildPagination(page, limit, total))
  },
  perm(MODULE.RECRUITMENT, ACTION.VIEW),
)

// ─── POST /api/v1/recruitment/requisitions ─────────────────
export const POST = withPermission(
  async (req: NextRequest, _context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)

    const {
      companyId,
      departmentId,
      title,
      headcount,
      jobLevel,
      employmentType,
      justification,
      requirements,
      urgency,
      targetDate,
      positionId,
      submitForApproval,
    } = parsed.data

    try {
      // 채용 요청 번호 생성 (REQ-YYYYMM-NNN)
      const now = new Date()
      const prefix = `REQ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
      const lastReq = await prisma.requisition.findFirst({
        where: { reqNumber: { startsWith: prefix } },
        orderBy: { reqNumber: 'desc' },
      })
      const seq = lastReq
        ? parseInt(lastReq.reqNumber.split('-')[2] ?? '0') + 1
        : 1
      const reqNumber = `${prefix}-${String(seq).padStart(3, '0')}`

      // 결재 플로우 결정 (urgency에 따라)
      const flowName =
        urgency === 'urgent' ? '임원급 채용' : '일반 채용 승인'
      const approvalFlow = await prisma.approvalFlow.findFirst({
        where: { module: 'recruitment', name: flowName, deletedAt: null },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      })

      const status = submitForApproval ? 'pending' : 'draft'
      const currentStep = submitForApproval ? 1 : 0

      const requisition = await prisma.requisition.create({
        data: {
          reqNumber,
          companyId,
          departmentId,
          requesterId: user.employeeId,
          positionId: positionId ?? null,
          title,
          headcount,
          jobLevel: jobLevel ?? null,
          employmentType,
          justification,
          requirements: requirements ?? null,
          urgency,
          targetDate: targetDate ? new Date(targetDate) : null,
          status,
          currentStep,
          approvalFlowId: approvalFlow?.id ?? null,
          // 결재 요청 시 승인 레코드 생성
          ...(submitForApproval && approvalFlow
            ? {
                approvalRecords: {
                  create: approvalFlow.steps.map((step) => ({
                    stepOrder: step.stepOrder,
                    approverRole: step.approverRole ?? 'hr_admin',
                    status: 'pending',
                  })),
                },
              }
            : {}),
        },
        include: {
          company: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          approvalRecords: { orderBy: { stepOrder: 'asc' } },
        },
      })

      return apiSuccess(requisition, 201)
    } catch (err) {
      throw handlePrismaError(err)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.CREATE),
)
