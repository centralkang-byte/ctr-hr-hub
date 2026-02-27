// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/ai/resume-analysis
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { analyzeResume } from '@/lib/claude'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Validation Schema ───────────────────────────────────

const bodySchema = z.object({
  resumeText: z.string().min(1, '이력서 내용을 입력해주세요.'),
  jobTitle: z.string().min(1, '직무명을 입력해주세요.'),
  requirements: z.string().optional(),
  preferred: z.string().optional(),
  applicationId: z.string().uuid().optional(),
})

// ─── POST /api/v1/ai/resume-analysis ──────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { resumeText, jobTitle, requirements, preferred, applicationId } =
      parsed.data

    // If applicationId provided, verify it exists and user has access
    if (applicationId) {
      const companyFilter =
        user.role === ROLE.SUPER_ADMIN
          ? {}
          : { posting: { companyId: user.companyId } }

      const application = await prisma.application.findFirst({
        where: { id: applicationId, ...companyFilter },
      })

      if (!application) {
        throw notFound('지원 정보를 찾을 수 없습니다.')
      }
    }

    const result = await analyzeResume(
      { resumeText, jobTitle, requirements, preferred },
      user.companyId,
      user.employeeId,
    )

    // If applicationId provided, update AI scores on the application
    if (applicationId) {
      await prisma.application.update({
        where: { id: applicationId },
        data: {
          aiScreeningScore: result.overall_score,
          aiScreeningSummary: result.summary,
        },
      })
    }

    return apiSuccess(result)
  },
  perm(MODULE.RECRUITMENT, ACTION.CREATE),
)
