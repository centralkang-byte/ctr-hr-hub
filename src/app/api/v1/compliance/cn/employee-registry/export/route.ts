// ═══════════════════════════════════════════════════════════
// CTR HR Hub — CN Employee Registry (花名册) Export
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { generateEmployeeRegistry } from '@/lib/compliance/cn'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/compliance/cn/employee-registry/export ─
// Export employee registry (花名册) data for client-side Excel

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const companyId = user.companyId

    const registry = await generateEmployeeRegistry(companyId)

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'compliance.cn.employeeRegistry.export',
      resourceType: 'employeeRegistry',
      resourceId: companyId,
      companyId,
      changes: { totalCount: registry.totalCount },
      ip,
      userAgent,
    })

    const today = new Date()
    const dateStr = today.toISOString().split('T')[0]

    return apiSuccess({
      meta: {
        companyId,
        totalCount: registry.totalCount,
        generatedAt: registry.generatedAt,
        filename: `employee_registry_${dateStr}.xlsx`,
      },
      columns: [
        { key: 'employeeNo', label: '사번' },
        { key: 'name', label: '이름' },
        { key: 'nameEn', label: '영문 이름' },
        { key: 'gender', label: '성별' },
        { key: 'birthDate', label: '생년월일' },
        { key: 'hireDate', label: '입사일' },
        { key: 'department', label: '부서' },
        { key: 'jobGrade', label: '직급' },
        { key: 'employmentType', label: '고용 형태' },
        { key: 'status', label: '재직 상태' },
        { key: 'email', label: '이메일' },
      ],
      rows: registry.rows,
    })
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)
