// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/m365/disable
// M365 계정 비활성화 (퇴사 프로세스)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { m365DisableSchema } from '@/lib/schemas/m365'
import {
  disableM365Account,
  revokeM365Licenses,
  convertToSharedMailbox,
  M365_LICENSES,
} from '@/lib/integrations/m365-account'
import type { SessionUser } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

// ─── POST /api/v1/m365/disable ──────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = m365DisableSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { employeeId, email, revokeAllLicenses, convertToShared } = parsed.data

    // Verify employee exists
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

    const employeeCompanyId = ((extractPrimaryAssignment(employee.assignments ?? []) as Record<string, any>)?.companyId as string | undefined) ?? user.companyId

    // Non-super-admin must belong to same company
    if (user.role !== ROLE.SUPER_ADMIN && user.companyId !== employeeCompanyId) {
      throw badRequest('다른 법인의 구성원에 대해 작업할 수 없습니다.')
    }

    const meta = extractRequestMeta(req.headers)
    const results: Array<{ actionType: string; logId: string; success: boolean }> = []

    // 1. Disable the M365 account
    const disableResult = await disableM365Account(email)

    const disableLog = await prisma.m365ProvisioningLog.create({
      data: {
        companyId: employeeCompanyId,
        employeeId,
        email,
        actionType: 'DISABLE',
        status: disableResult.success ? 'M365_SUCCESS' : 'M365_FAILED',
        licensesRevoked: [],
        convertToSharedMailbox: false,
        errorMessage: disableResult.errorMessage ?? null,
        executedBy: user.id,
      },
    })

    results.push({
      actionType: 'DISABLE',
      logId: disableLog.id,
      success: disableResult.success,
    })

    logAudit({
      actorId: user.id,
      action: ACTION.UPDATE,
      resourceType: MODULE.SETTINGS,
      resourceId: disableLog.id,
      companyId: employeeCompanyId,
      changes: {
        type: 'M365_DISABLE',
        email,
        success: disableResult.success,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    })

    // 2. Optionally revoke all licenses
    if (revokeAllLicenses) {
      const allLicenseIds = M365_LICENSES.map((l) => l.id)
      const revokeResult = await revokeM365Licenses(email, allLicenseIds)

      const revokeLog = await prisma.m365ProvisioningLog.create({
        data: {
          companyId: employeeCompanyId,
          employeeId,
          email,
          actionType: 'LICENSE_REVOKE',
          status: revokeResult.success ? 'M365_SUCCESS' : 'M365_FAILED',
          licensesRevoked: revokeResult.licensesRevoked ?? allLicenseIds,
          convertToSharedMailbox: false,
          errorMessage: revokeResult.errorMessage ?? null,
          executedBy: user.id,
        },
      })

      results.push({
        actionType: 'LICENSE_REVOKE',
        logId: revokeLog.id,
        success: revokeResult.success,
      })

      logAudit({
        actorId: user.id,
        action: ACTION.UPDATE,
        resourceType: MODULE.SETTINGS,
        resourceId: revokeLog.id,
        companyId: employeeCompanyId,
        changes: {
          type: 'M365_LICENSE_REVOKE',
          email,
          licensesRevoked: allLicenseIds,
          success: revokeResult.success,
        },
        ip: meta.ip,
        userAgent: meta.userAgent,
      })
    }

    // 3. Optionally convert to shared mailbox
    if (convertToShared) {
      const sharedResult = await convertToSharedMailbox(email)

      const sharedLog = await prisma.m365ProvisioningLog.create({
        data: {
          companyId: employeeCompanyId,
          employeeId,
          email,
          actionType: 'SHARED_MAILBOX_CONVERT',
          status: sharedResult.success ? 'M365_SUCCESS' : 'M365_FAILED',
          licensesRevoked: [],
          convertToSharedMailbox: true,
          errorMessage: sharedResult.errorMessage ?? null,
          executedBy: user.id,
        },
      })

      results.push({
        actionType: 'SHARED_MAILBOX_CONVERT',
        logId: sharedLog.id,
        success: sharedResult.success,
      })

      logAudit({
        actorId: user.id,
        action: ACTION.UPDATE,
        resourceType: MODULE.SETTINGS,
        resourceId: sharedLog.id,
        companyId: employeeCompanyId,
        changes: {
          type: 'M365_SHARED_MAILBOX_CONVERT',
          email,
          success: sharedResult.success,
        },
        ip: meta.ip,
        userAgent: meta.userAgent,
      })
    }

    return apiSuccess({ results })
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)
