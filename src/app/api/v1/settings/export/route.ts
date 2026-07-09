// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Settings Export API (Wave 1 settings hub)
// GET /api/v1/settings/export — 설정 백업 JSON 다운로드
// 권한: settings:export (HR_ADMIN/SUPER_ADMIN)
// 스코프: 자사 + global(null) 행. SUPER만 companyId 파라미터로 대상 법인 선택.
// 필드 allowlist 명시 select — 시크릿(웹훅 URL 등) 테이블은 대상에서 제외.
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { AppError, forbidden } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { resolveCompanyId } from '@/lib/api/companyFilter'
import type { SessionUser } from '@/types'

export const dynamic = 'force-dynamic'

// 테이블별 행수 상한 — 초과 시 413 (한 테넌트의 비대 설정이 메모리 압박/벌크 유출 경로가 되지 않도록)
const MAX_ROWS_PER_TABLE = 2000

// 자사 행 + global(null companyId) 행
function companyOrGlobal(companyId: string) {
  return { OR: [{ companyId }, { companyId: null }] }
}

export const GET = withRateLimit(withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    // HR_ADMIN/SUPER_ADMIN only — settings_export 권한이 EXECUTIVE에도 시드되므로 명시 role 게이트 필수
    if (user.role !== ROLE.HR_ADMIN && user.role !== ROLE.SUPER_ADMIN) {
      return apiError(forbidden('설정 백업은 HR 관리자만 실행할 수 있습니다.'))
    }

    try {
      const companyId = resolveCompanyId(user, req.nextUrl.searchParams.get('companyId'))

      const [
        company,
        processSettings,
        termOverrides,
        enumOptions,
        emailTemplates,
        notificationTriggers,
        approvalFlows,
        jobGrades,
        gradeTitleMappings,
      ] = await Promise.all([
        prisma.company.findUnique({ where: { id: companyId }, select: { code: true, name: true } }),
        prisma.companyProcessSetting.findMany({
          where: companyOrGlobal(companyId),
          select: { settingType: true, settingKey: true, settingValue: true, description: true, companyId: true, updatedAt: true },
          take: MAX_ROWS_PER_TABLE + 1,
        }),
        prisma.termOverride.findMany({
          where: { companyId },
          select: { termKey: true, labelKo: true, labelEn: true, labelLocal: true, updatedAt: true },
          take: MAX_ROWS_PER_TABLE + 1,
        }),
        prisma.tenantEnumOption.findMany({
          where: { companyId, deletedAt: null },
          select: { enumGroup: true, optionKey: true, label: true, color: true, icon: true, sortOrder: true, isSystem: true },
          take: MAX_ROWS_PER_TABLE + 1,
        }),
        prisma.emailTemplate.findMany({
          where: { companyId, deletedAt: null },
          select: { eventType: true, locale: true, subject: true, body: true, variables: true, isActive: true, isSystem: true, updatedAt: true },
          take: MAX_ROWS_PER_TABLE + 1,
        }),
        prisma.notificationTrigger.findMany({
          where: { ...companyOrGlobal(companyId), deletedAt: null },
          select: { eventType: true, template: true, channels: true, isActive: true, companyId: true },
          take: MAX_ROWS_PER_TABLE + 1,
        }),
        prisma.approvalFlow.findMany({
          where: { ...companyOrGlobal(companyId), deletedAt: null },
          select: {
            name: true, description: true, module: true, isActive: true, companyId: true, updatedAt: true,
            steps: { select: { stepOrder: true, approverType: true }, orderBy: { stepOrder: 'asc' } },
          },
          take: MAX_ROWS_PER_TABLE + 1,
        }),
        prisma.jobGrade.findMany({
          where: { companyId, deletedAt: null },
          select: { code: true, name: true, nameEn: true, rankOrder: true, gradeType: true, minPromotionYears: true },
          take: MAX_ROWS_PER_TABLE + 1,
        }),
        prisma.gradeTitleMapping.findMany({
          where: { companyId },
          select: { jobGradeId: true, employeeTitleId: true },
          take: MAX_ROWS_PER_TABLE + 1,
        }),
      ])

      const sections = {
        processSettings,
        termOverrides,
        enumOptions,
        emailTemplates,
        notificationTriggers,
        approvalFlows,
        jobGrades,
        gradeTitleMappings,
      }

      for (const [name, rows] of Object.entries(sections)) {
        if (rows.length > MAX_ROWS_PER_TABLE) {
          throw new AppError(413, 'PAYLOAD_TOO_LARGE', `설정 데이터가 너무 큽니다(${name} ${MAX_ROWS_PER_TABLE}행 초과). 관리자에게 문의하세요.`)
        }
      }

      const meta = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'SETTINGS_EXPORT',
        resourceType: 'settingsBackup',
        resourceId: companyId,
        companyId,
        ...meta,
      })

      // 클라이언트가 Blob으로 다운로드 (compliance export 탭들과 동일 컨벤션)
      return apiSuccess({
        exportedAt: new Date().toISOString(),
        companyCode: company?.code ?? null,
        ...sections,
      })
    } catch (err) {
      return apiError(err)
    }
  },
  perm(MODULE.SETTINGS, ACTION.EXPORT),
), RATE_LIMITS.EXPORT)
