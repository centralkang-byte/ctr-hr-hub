// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Bulk Movement Template Download API
// GET /api/v1/bulk-movements/templates/[type]
// ═══════════════════════════════════════════════════════════

import { type NextRequest, NextResponse } from 'next/server'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { badRequest, forbidden } from '@/lib/errors'
import { isValidMovementType } from '@/lib/bulk-movement/types'
import type { MovementType } from '@/lib/bulk-movement/types'
import { getTemplate } from '@/lib/bulk-movement/templates'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { type } = await context.params

    if (!type || !isValidMovementType(type)) {
      throw badRequest(`지원하지 않는 발령 유형입니다: ${type}`)
    }

    const template = getTemplate(type as MovementType)

    // superAdminOnly 템플릿은 SUPER_ADMIN만 접근 가능
    if (template.superAdminOnly && user.role !== ROLE.SUPER_ADMIN) {
      throw forbidden('이 발령 유형은 최고관리자만 사용할 수 있습니다')
    }

    // CSV 생성: UTF-8 BOM + 헤더 + 예시 행
    const headers = template.columns.map((col) => col.key)
    const exampleValues = template.columns.map((col) => col.example)

    const csv = '\uFEFF' + headers.join(',') + '\n' + exampleValues.join(',') + '\n'

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="bulk-${type}-template.csv"`,
      },
    })
  },
  perm(MODULE.EMPLOYEES, ACTION.APPROVE),
)
