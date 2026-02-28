// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Email Template API
// GET: 이메일 템플릿 목록 / POST: 이메일 템플릿 생성
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiPaginated, buildPagination, apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { emailTemplateSearchSchema, emailTemplateCreateSchema } from '@/lib/schemas/settings'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = emailTemplateSearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, eventType, channel } = parsed.data
    const where = {
      companyId: user.companyId,
      ...(eventType ? { eventType } : {}),
      ...(channel ? { channel: channel as 'EMAIL' | 'PUSH' | 'IN_APP' } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.emailTemplate.findMany({
        where,
        orderBy: [{ eventType: 'asc' }, { channel: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.emailTemplate.count({ where }),
    ])

    return apiPaginated(items, buildPagination(page, limit, total))
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = emailTemplateCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const result = await prisma.emailTemplate.create({
        data: {
          companyId: user.companyId,
          eventType: parsed.data.eventType,
          channel: parsed.data.channel,
          locale: parsed.data.locale,
          subject: parsed.data.subject,
          body: parsed.data.body,
          variables: parsed.data.variables,
          isActive: parsed.data.isActive,
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.email_template.create',
        resourceType: 'emailTemplate',
        resourceId: result.id,
        companyId: user.companyId,
        changes: parsed.data,
        ip,
        userAgent,
      })

      return apiSuccess(result, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.CREATE),
)
