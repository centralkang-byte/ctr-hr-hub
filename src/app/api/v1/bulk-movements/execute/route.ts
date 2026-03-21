// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Bulk Movement Execute API
// POST /api/v1/bulk-movements/execute
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden } from '@/lib/errors'
import { isValidMovementType } from '@/lib/bulk-movement/types'
import type { MovementType } from '@/lib/bulk-movement/types'
import { getTemplate } from '@/lib/bulk-movement/templates'
import { parseCSV } from '@/lib/bulk-movement/parser'
import { verifyValidationToken } from '@/lib/bulk-movement/validator'
import { executeMovements } from '@/lib/bulk-movement/executor'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null
    const validationToken = formData.get('validationToken') as string | null

    if (!file) throw badRequest('파일이 필요합니다.')
    if (!type) throw badRequest('발령 유형(type)이 필요합니다.')
    if (!validationToken) throw badRequest('검증 토큰이 필요합니다. 먼저 검증을 수행해 주세요.')

    if (!isValidMovementType(type)) {
      throw badRequest(`지원하지 않는 발령 유형입니다: ${type}`)
    }

    const template = getTemplate(type as MovementType)

    // superAdminOnly 템플릿은 SUPER_ADMIN만 접근 가능
    if (template.superAdminOnly && user.role !== ROLE.SUPER_ADMIN) {
      throw forbidden('이 발령 유형은 최고관리자만 사용할 수 있습니다')
    }

    // 파일 파싱
    const buffer = await file.arrayBuffer()

    // 토큰 검증 (파일 무결성 + 30분 만료)
    const tokenResult = verifyValidationToken(validationToken, buffer)
    if (!tokenResult.valid) {
      throw badRequest(tokenResult.reason ?? '검증 토큰이 유효하지 않습니다.')
    }

    // CSV 파싱 → ValidatedRow로 변환
    const rows = parseCSV(buffer)

    // 회사 범위 결정
    const userCompanyId = user.role === ROLE.SUPER_ADMIN ? '' : user.companyId

    try {
      const result = await executeMovements(
        type as MovementType,
        rows.map((r) => ({
          rowNum: r.rowNum,
          employeeId: '', // executor에서 re-validation으로 조회
          employeeNo: (r.raw['사번'] ?? '').trim(),
          employeeName: '',
          data: r.raw,
        })),
        user.id,
        userCompanyId,
        file.name,
      )

      return apiSuccess(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류'
      throw badRequest(`실행 중 오류가 발생하여 전체 롤백되었습니다: ${message}`)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.APPROVE),
)
