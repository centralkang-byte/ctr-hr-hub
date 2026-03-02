// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/m365/provision
// M365 계정 프로비저닝
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { m365ProvisionSchema } from '@/lib/schemas/m365'
import { provisionM365Account } from '@/lib/integrations/m365-account'
import type { SessionUser } from '@/types'

// ─── POST /api/v1/m365/provision ────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = m365ProvisionSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { employeeId, email, displayName, licenses } = parsed.data

    // Determine companyId — SUPER_ADMIN uses employee's company, others use own
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
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

    if (!employee) {
      throw badRequest('해당 구성원을 찾을 수 없습니다.')
    }

    const employeeCompanyId = ((employee.assignments[0] as any)?.companyId as string | undefined) ?? user.companyId // eslint-disable-line @typescript-eslint/no-explicit-any

    // Non-super-admin must belong to same company
    if (user.role !== ROLE.SUPER_ADMIN && user.companyId !== employeeCompanyId) {
      throw badRequest('다른 법인의 구성원에 대해 작업할 수 없습니다.')
    }

    // Call mock M365 provisioning
    const result = await provisionM365Account(email, displayName)

    // Create provisioning log record
    const log = await prisma.m365ProvisioningLog.create({
      data: {
        companyId: employeeCompanyId,
        employeeId,
        email,
        actionType: 'PROVISION',
        status: result.success ? 'M365_SUCCESS' : 'M365_FAILED',
        licensesRevoked: [],
        convertToSharedMailbox: false,
        errorMessage: result.errorMessage ?? null,
        executedBy: user.id,
      },
    })

    // Audit log
    const meta = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.id,
      action: ACTION.CREATE,
      resourceType: MODULE.SETTINGS,
      resourceId: log.id,
      companyId: employeeCompanyId,
      changes: {
        type: 'M365_PROVISION',
        email,
        displayName,
        licenses,
        success: result.success,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    })

    return apiSuccess({
      log,
      m365Result: result,
    }, 201)
  },
  perm(MODULE.SETTINGS, ACTION.CREATE),
)
