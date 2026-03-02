// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/PUT /api/v1/audit/retention-policy
// 감사 로그 보존 정책 조회/설정
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { cacheGet, cacheSet } from '@/lib/redis'
import { retentionPolicySchema } from '@/lib/schemas/audit'
import type { SessionUser } from '@/types'

// Default retention: 730 days (2 years)
const DEFAULT_RETENTION_DAYS = 730

function retentionKey(companyId: string) {
  return `audit:retention:${companyId}`
}

export const GET = withPermission(
  async (_req: NextRequest, _context, user: SessionUser) => {
    const cached = await cacheGet<number>(retentionKey(user.companyId))
    return apiSuccess({
      retentionDays: cached ?? DEFAULT_RETENTION_DAYS,
    })
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = retentionPolicySchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    // Store in Redis with no TTL (persistent)
    await cacheSet(retentionKey(user.companyId), parsed.data.retentionDays)

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'audit.retention_policy.update',
      resourceType: 'audit_retention_policy',
      resourceId: user.companyId,
      companyId: user.companyId,
      changes: { retentionDays: parsed.data.retentionDays },
      ip,
      userAgent,
    })

    return apiSuccess({ retentionDays: parsed.data.retentionDays })
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)
