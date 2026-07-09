// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Settings Audit Log API (H-3 → Wave 1 확장)
// GET /api/v1/settings-audit-log — paginated audit trail
// HR_ADMIN+ only. 설정 계열 resourceType 전체 + global(null) 행 포함.
// 비-SUPER에게 global 행은 actor 마스킹 + changes 미반환 (타 테넌트 운영 노출 차단).
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { forbidden } from '@/lib/errors'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { resolveCompanyId } from '@/lib/api/companyFilter'

export const dynamic = 'force-dynamic'

// 설정 계열 resourceType allowlist — settings 라우트들이 logAudit에 쓰는 값 전수 (Wave 1)
const SETTINGS_RESOURCE_TYPES = [
  'CompanyProcessSetting',
  'tenantSetting',
  'workflowRule',
  'notification_trigger',
  'emailTemplate',
  'termOverride',
  'tenantEnumOption',
  'exportTemplate',
  'customField',
  'ApprovalFlow',
  'PromotionSetting',
  'EvaluationSetting',
  'CompensationSetting',
  'AttendanceSetting',
  'settingsBackup',
]

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    // HR_ADMIN or SUPER_ADMIN only
    if (user.role !== ROLE.HR_ADMIN && user.role !== ROLE.SUPER_ADMIN) {
      return apiError(forbidden('설정 변경 이력은 HR 관리자만 조회할 수 있습니다.'))
    }

    try {
      const { searchParams } = new URL(req.url)
      const category = searchParams.get('category')
      const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
      const offset = parseInt(searchParams.get('offset') ?? '0')
      // SUPER: companyId 파라미터로 대상 법인 선택 가능 / 그 외: 자사 강제
      const companyId = resolveCompanyId(user, searchParams.get('companyId'))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = { // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma where clause dynamic type
        resourceType: { in: SETTINGS_RESOURCE_TYPES },
        // global(null) 설정 변경도 전 법인에 적용되므로 함께 노출
        OR: [{ companyId }, { companyId: null }],
      }

      if (category) {
        where.changes = {
          path: ['category'],
          equals: category.toUpperCase(),
        }
      }

      const [rows, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit,
          skip: offset,
          select: {
            id: true,
            action: true,
            resourceType: true,
            resourceId: true,
            companyId: true,
            changes: true,
            createdAt: true,
            actor: { select: { id: true, name: true, employeeNo: true } },
            company: { select: { id: true, name: true, code: true } },
          },
        }),
        prisma.auditLog.count({ where }),
      ])

      // 비-SUPER: global(null) 행의 actor 신원·changes 값 마스킹
      // (설정 내용은 자사에도 적용되지만, 타 테넌트/플랫폼 운영자의 신원·활동 시각은 노출 금지)
      const isSuper = user.role === ROLE.SUPER_ADMIN
      const logs = rows.map((log) =>
        !isSuper && log.companyId === null
          ? { ...log, actor: null, changes: null }
          : log,
      )

      return apiSuccess({ logs, total, limit, offset })
    } catch (err) {
      console.error('[Settings Audit Log GET]', err)
      return apiError(err)
    }
  },
  // 선재결함 수정: 'SETTINGS'(대문자)가 시드 권한 'settings'와 불일치 → HR_ADMIN 상시 403이었음
  perm(MODULE.SETTINGS, ACTION.VIEW),
)
