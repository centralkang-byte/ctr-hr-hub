import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { taxBracketSeedSchema } from '@/lib/schemas/tax-bracket'
import { TAX_COUNTRY_MAP, SUPPORTED_TAX_COUNTRIES } from '@/lib/tax'
import type { SessionUser } from '@/types'

// ─── POST /api/v1/tax-brackets/seed ─────────────────────
// Seed default tax brackets for a country from lib/tax/ data.
// Skips if brackets already exist for that country + company.

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = taxBracketSeedSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { countryCode } = parsed.data

    // Validate country is supported
    if (!SUPPORTED_TAX_COUNTRIES.includes(countryCode)) {
      throw badRequest(
        `지원하지 않는 국가 코드입니다: ${countryCode}. 지원 국가: ${SUPPORTED_TAX_COUNTRIES.join(', ')}`,
      )
    }

    const effectiveCompanyId =
      user.role === ROLE.SUPER_ADMIN
        ? ((body as Record<string, unknown>).companyId as string) ?? user.companyId
        : user.companyId

    // Check if brackets already exist for this country + company
    const existingCount = await prisma.taxBracket.count({
      where: {
        companyId: effectiveCompanyId,
        countryCode,
      },
    })

    if (existingCount > 0) {
      throw badRequest(
        `해당 국가(${countryCode})의 세금 구간이 이미 ${existingCount}건 존재합니다. 기존 데이터를 삭제 후 다시 시도하세요.`,
      )
    }

    const defaultBrackets = TAX_COUNTRY_MAP[countryCode]
    if (!defaultBrackets || defaultBrackets.length === 0) {
      throw badRequest(`해당 국가(${countryCode})의 기본 세금 데이터가 없습니다.`)
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    try {
      const result = await prisma.taxBracket.createMany({
        data: defaultBrackets.map((bracket) => ({
          companyId: effectiveCompanyId,
          countryCode,
          taxType: bracket.taxType,
          name: bracket.name,
          bracketMin: bracket.bracketMin,
          bracketMax: bracket.bracketMax,
          rate: bracket.rate,
          fixedAmount: bracket.fixedAmount,
          effectiveFrom: today,
          effectiveTo: null,
          description: bracket.description ?? null,
          deletedAt: null,
        })),
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.tax_bracket.seed',
        resourceType: 'tax_bracket',
        resourceId: countryCode,
        companyId: effectiveCompanyId,
        changes: { countryCode, count: result.count },
        ip,
        userAgent,
      })

      return apiSuccess(
        { countryCode, seededCount: result.count },
        201,
      )
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.CREATE),
)
