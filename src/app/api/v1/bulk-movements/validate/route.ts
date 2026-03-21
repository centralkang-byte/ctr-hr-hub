// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Bulk Movement Validate API
// POST /api/v1/bulk-movements/validate
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden } from '@/lib/errors'
import { isValidMovementType } from '@/lib/bulk-movement/types'
import type { MovementType } from '@/lib/bulk-movement/types'
import { getTemplate } from '@/lib/bulk-movement/templates'
import { parseCSV, validateHeaders } from '@/lib/bulk-movement/parser'
import { validateRows } from '@/lib/bulk-movement/validator'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null

    if (!file) throw badRequest('파일이 필요합니다.')
    if (!type) throw badRequest('발령 유형(type)이 필요합니다.')

    if (!isValidMovementType(type)) {
      throw badRequest(`지원하지 않는 발령 유형입니다: ${type}`)
    }

    const template = getTemplate(type as MovementType)

    // superAdminOnly 템플릿은 SUPER_ADMIN만 접근 가능
    if (template.superAdminOnly && user.role !== ROLE.SUPER_ADMIN) {
      throw forbidden('이 발령 유형은 최고관리자만 사용할 수 있습니다')
    }

    // CSV 파싱
    const buffer = await file.arrayBuffer()
    const rows = parseCSV(buffer)

    if (rows.length === 0) throw badRequest('데이터가 없습니다.')
    if (rows.length > 500) {
      throw badRequest('한 번에 최대 500건까지 업로드 가능합니다.')
    }

    // 헤더 검증
    const parsedHeaders = Object.keys(rows[0].raw)
    const missingHeaders = validateHeaders(parsedHeaders, template.columns)
    if (missingHeaders.length > 0) {
      throw badRequest(`필수 컬럼이 누락되었습니다: ${missingHeaders.join(', ')}`)
    }

    // 회사 범위 결정
    // SUPER_ADMIN: 빈 문자열 (전체 법인 접근)
    // HR_ADMIN: 자기 법인만
    const userCompanyId = user.role === ROLE.SUPER_ADMIN ? '' : user.companyId

    // 행 검증
    const result = await validateRows(rows, template, userCompanyId, buffer)

    return apiSuccess(result)
  },
  perm(MODULE.EMPLOYEES, ACTION.APPROVE),
)
