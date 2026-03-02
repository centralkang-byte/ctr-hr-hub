// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/migration/templates
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { getRequiredFields, getSampleTemplate } from '@/lib/migration'
import type { SessionUser } from '@/types'

// ─── Query Schema ───────────────────────────────────────────

const querySchema = z.object({
  scope: z.enum(['EMPLOYEES', 'ATTENDANCE', 'PAYROLL', 'LEAVE', 'PERFORMANCE', 'ALL']).default('ALL'),
})

// ─── GET /api/v1/migration/templates ────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, _user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = querySchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { scope } = parsed.data

    if (scope === 'ALL') {
      // Return templates for all scopes
      const scopes = ['EMPLOYEES', 'ATTENDANCE', 'PAYROLL', 'LEAVE', 'PERFORMANCE'] as const
      const templates = scopes.map((s) => ({
        scope: s,
        requiredFields: getRequiredFields(s),
        sampleData: getSampleTemplate(s),
      }))

      return apiSuccess({ templates })
    }

    // Return template for a specific scope
    const requiredFields = getRequiredFields(scope)
    const sampleData = getSampleTemplate(scope)

    return apiSuccess({
      scope,
      requiredFields,
      sampleData,
    })
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)
