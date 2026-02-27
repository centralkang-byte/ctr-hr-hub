// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/profile/change-requests
// 직원 본인의 프로필 변경 요청 목록 조회 + 생성
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Allowed editable fields ────────────────────────────────

const ALLOWED_FIELDS = ['phone', 'emergencyContact', 'emergencyContactPhone'] as const
type AllowedField = (typeof ALLOWED_FIELDS)[number]

// ─── Zod Schema ─────────────────────────────────────────────

const createChangeRequestSchema = z.object({
  fieldName: z.enum(ALLOWED_FIELDS),
  newValue: z.string().min(1, '새 값을 입력해주세요.'),
})

// ─── GET — 내 변경 요청 목록 ──────────────────────────────────

export const GET = withPermission(
  async (
    _req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const requests = await prisma.profileChangeRequest.findMany({
      where: { employeeId: user.employeeId },
      orderBy: { createdAt: 'desc' },
      include: {
        reviewer: { select: { id: true, name: true } },
      },
    })

    return apiSuccess(requests)
  },
  perm(MODULE.EMPLOYEES, ACTION.UPDATE),
)

// ─── POST — 변경 요청 생성 ──────────────────────────────────

export const POST = withPermission(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const body: unknown = await req.json()
    const parsed = createChangeRequestSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('입력값이 올바르지 않습니다.', {
        issues: parsed.error.issues,
      })
    }

    const { fieldName, newValue } = parsed.data

    // Look up current employee to get old value
    const employee = await prisma.employee.findUnique({
      where: { id: user.employeeId },
      select: { phone: true, emergencyContact: true, emergencyContactPhone: true },
    })

    const oldValue = employee?.[fieldName as AllowedField] ?? null

    const request = await prisma.profileChangeRequest.create({
      data: {
        employeeId: user.employeeId,
        fieldName,
        oldValue,
        newValue,
        status: 'CHANGE_PENDING',
      },
    })

    return apiSuccess(request, 201)
  },
  perm(MODULE.EMPLOYEES, ACTION.UPDATE),
)
