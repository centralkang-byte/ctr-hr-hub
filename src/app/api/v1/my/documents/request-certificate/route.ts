// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/my/documents/request-certificate
// 증명서 발급 신청 → HR 알림
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withAuth } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { sendNotification } from '@/lib/notifications'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

const requestSchema = z.object({
  type: z.enum(['EMPLOYMENT_CERT', 'CAREER_CERT', 'INCOME_CERT']),
  purpose: z.string().max(500).optional(),
})

const TYPE_LABELS: Record<string, string> = {
  EMPLOYMENT_CERT: '재직증명서',
  CAREER_CERT: '경력증명서',
  INCOME_CERT: '소득증명서',
}

export const POST = withAuth(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    // 본인 소속 회사 가져오기
    const employee = await prisma.employee.findUnique({
      where: { id: user.employeeId },
      select: {
        id: true,
        name: true,
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          select: { companyId: true },
        },
      },
    })

    const primary = extractPrimaryAssignment(employee?.assignments ?? [])
    const companyId = primary?.companyId ?? user.companyId

    try {
      const certRequest = await prisma.certificateRequest.create({
        data: {
          employeeId: user.employeeId,
          companyId,
          type: parsed.data.type,
          purpose: parsed.data.purpose ?? null,
        },
      })

      // HR Admin에게 알림 (해당 회사)
      const hrAdmins = await prisma.employee.findMany({
        where: {
          deletedAt: null,
          employeeRoles: {
            some: {
              role: { code: { in: ['HR_ADMIN', 'SUPER_ADMIN'] } },
              companyId,
            },
          },
        },
        select: { id: true },
      })

      for (const hr of hrAdmins) {
        sendNotification({
          employeeId: hr.id,
          triggerType: 'CERTIFICATE_REQUESTED',
          title: '증명서 발급 요청',
          body: `${employee?.name ?? '직원'}님이 ${TYPE_LABELS[parsed.data.type]}을 신청했습니다.`,
          link: `/employees/${user.employeeId}`,
          priority: 'normal',
          companyId,
        })
      }

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'certificate.request.create',
        resourceType: 'certificate_request',
        resourceId: certRequest.id,
        companyId,
        ip,
        userAgent,
      })

      return apiSuccess(certRequest, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
)
