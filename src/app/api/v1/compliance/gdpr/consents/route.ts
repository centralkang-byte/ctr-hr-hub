// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GDPR Consent List & Create
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { gdprConsentSearchSchema, gdprConsentCreateSchema } from '@/lib/schemas/compliance'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = gdprConsentSearchSchema.safeParse(params)
    if (!parsed.success) throw badRequest('Invalid parameters', { issues: parsed.error.issues })

    const { page, limit, employeeId, purpose, status } = parsed.data
    const where = {
      companyId: user.companyId,
      ...(employeeId ? { employeeId } : {}),
      ...(purpose ? { purpose } : {}),
      ...(status ? { status } : {}),
    }

    const [consents, total] = await Promise.all([
      prisma.gdprConsent.findMany({
        where,
        include: { employee: { select: { id: true, name: true, employeeNo: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.gdprConsent.count({ where }),
    ])

    return apiPaginated(consents, buildPagination(page, limit, total))
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = gdprConsentCreateSchema.safeParse(body)
    if (!parsed.success) throw badRequest('Invalid request data', { issues: parsed.error.issues })

    // 멀티테넌트: 대상 직원이 본인 법인의 활성 primary 발령인지 검증 (임의 employeeId 차단)
    const owned = await prisma.employeeAssignment.findFirst({
      where: {
        employeeId: parsed.data.employeeId,
        companyId: user.companyId,
        isPrimary: true,
        endDate: null,
        effectiveDate: { lte: new Date() },
      },
      select: { id: true },
    })
    if (!owned) throw badRequest('본인 법인 재직 직원이 아닙니다.')

    try {
      const consent = await prisma.gdprConsent.create({
        data: {
          companyId: user.companyId,
          employeeId: parsed.data.employeeId,
          purpose: parsed.data.purpose,
          consentedAt: new Date(),
          legalBasis: parsed.data.legalBasis,
          ...(parsed.data.expiresAt ? { expiresAt: new Date(parsed.data.expiresAt) } : {}),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compliance.gdpr.consent.create',
        resourceType: 'gdprConsent',
        resourceId: consent.id,
        companyId: user.companyId,
        changes: { purpose: parsed.data.purpose, employeeId: parsed.data.employeeId },
        ip,
        userAgent,
      })

      return apiSuccess(consent, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPLIANCE, ACTION.CREATE),
)
