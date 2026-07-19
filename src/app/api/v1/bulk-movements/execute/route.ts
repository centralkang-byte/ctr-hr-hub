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
import { validateRows, verifyValidationToken } from '@/lib/bulk-movement/validator'
import { executeMovements } from '@/lib/bulk-movement/executor'
import { extractRequestMeta } from '@/lib/audit'
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

    // 실행(실무)은 HR_UP에 허용 — withPermission(EMPLOYEES.APPROVE)가 게이트.
    // 과거 결재 플로우(personnel_order=[ceo]) 기반 role 검사는 실행자=승인자를 혼용해
    // HR-only 페이지에서 HR이 실행 불가한 데드락을 만들었음 (S276 CEO 결정: 실행≠승인).
    // 상신→CEO 승인 정식 플로우는 별도 트랙 (급여 #126/#128 방식).

    // 파일 파싱
    const buffer = await file.arrayBuffer()

    // 토큰 검증 (파일 무결성 + 30분 만료)
    const tokenResult = verifyValidationToken(validationToken, buffer)
    if (!tokenResult.valid) {
      throw badRequest(tokenResult.reason ?? '검증 토큰이 유효하지 않습니다.')
    }

    // CSV 파싱
    const rows = parseCSV(buffer)

    // 회사 범위 결정
    const userCompanyId = user.role === ROLE.SUPER_ADMIN ? '' : user.companyId

    // 서버측 재검증 (SSOT) — 토큰은 파일 무결성만 보장하므로 데이터 신선도는
    // validateRows로 재확인하고, executor 입력(내부 UUID·canonical 필드)도 여기서 얻는다
    const validation = await validateRows(rows, template, userCompanyId, buffer)
    if (!validation.valid || validation.validatedRows.length === 0) {
      throw badRequest('CSV 재검증에 실패했습니다. 파일을 다시 검증해 주세요.', {
        errors: validation.errors,
      })
    }

    try {
      // 감사 로그는 executor 트랜잭션 내부에서 기록 (발령과 원자적 — S276)
      const meta = extractRequestMeta(req.headers)
      const result = await executeMovements(
        type as MovementType,
        validation.validatedRows,
        file.name,
        {
          actorEmployeeId: user.employeeId,
          companyId: user.companyId,
          authorizedCompanyId: userCompanyId || undefined,
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
      )

      return apiSuccess(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류'
      throw badRequest(`실행 중 오류가 발생하여 전체 롤백되었습니다: ${message}`)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.APPROVE),
)
