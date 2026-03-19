// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/PUT /api/v1/settings/attendance
// 근태 설정: 근무유형, 52시간 관리, 교대근무 정책 (B6-1)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { badRequest, isAppError, handlePrismaError } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { z } from 'zod'
import type { SessionUser } from '@/types'

// ─── Zod 스키마 ────────────────────────────────────────────

const alertThresholdsSchema = z.object({
  caution: z.number().min(1).max(100),
  warning: z.number().min(1).max(100),
  blocked: z.number().min(1).max(168),
})

const flexWorkSchema = z.object({
  flexEnabled: z.boolean(),
  coreTimeStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  coreTimeEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  minDailyHours: z.number().min(1).max(24).optional(),
})

const attendanceSettingsUpdateSchema = z.object({
  standardHoursPerDay: z.number().min(1).max(24).optional(),
  standardDaysPerWeek: z.number().min(1).max(7).optional(),
  weeklyMaxHours: z.number().min(1).max(168).optional(),
  shiftEnabled: z.boolean().optional(),
  flexWork: flexWorkSchema.optional(),
  alertThresholds: alertThresholdsSchema.optional(),
  enableBlocking: z.boolean().optional(),
  timezone: z.string().min(1).max(64).optional(),
})

// ─── GET — 현재 법인 근태 설정 조회 ──────────────────────────

export const GET = withPermission(
  async (
    _req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const setting = await prisma.attendanceSetting.findUnique({
        where: { companyId: user.companyId },
      })

      // 글로벌 기본값 사용 또는 법인별 설정 반환
      const result = {
        standardHoursPerDay: setting?.standardHoursPerDay ?? 8,
        standardDaysPerWeek: setting?.standardDaysPerWeek ?? 5,
        weeklyMaxHours: setting?.weeklyMaxHours ?? 52,
        shiftEnabled: setting?.shiftEnabled ?? false,
        flexWork: (setting?.flexWork as Record<string, unknown> | null) ?? {
          flexEnabled: false,
          coreTimeStart: '10:00',
          coreTimeEnd: '16:00',
          minDailyHours: 8,
        },
        alertThresholds: (setting?.alertThresholds as Record<string, unknown> | null) ?? {
          caution: 44,
          warning: 48,
          blocked: 52,
        },
        enableBlocking: setting?.enableBlocking ?? false,
        timezone: setting?.timezone ?? 'Asia/Seoul',
        isCustom: !!setting,
      }

      return apiSuccess(result)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

// ─── PUT — 근태 설정 저장 ─────────────────────────────────────

export const PUT = withPermission(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const body: unknown = await req.json()
      const parsed = attendanceSettingsUpdateSchema.safeParse(body)
      if (!parsed.success) {
        throw badRequest('입력값이 올바르지 않습니다.', {
          issues: parsed.error.issues,
        })
      }

      const data = parsed.data

      // 임계값 유효성 검사 (caution < warning < blocked)
      if (data.alertThresholds) {
        const { caution, warning, blocked } = data.alertThresholds
        if (caution >= warning || warning >= blocked) {
          throw badRequest('경고 임계값은 주의 < 경고 < 차단 순서여야 합니다.')
        }
      }

      const existing = await prisma.attendanceSetting.findUnique({ where: { companyId: user.companyId } })

      const setting = await prisma.attendanceSetting.upsert({
        where: { companyId: user.companyId },
        create: {
          companyId: user.companyId,
          ...data,
        },
        update: {
          ...data,
        },
      })

      logAudit({
        actorId: user.id,
        action: existing ? 'SETTINGS_UPDATE' : 'SETTINGS_CREATE',
        resourceType: 'AttendanceSetting',
        resourceId: setting.id,
        companyId: user.companyId,
        changes: { updatedFields: Object.keys(data) },
        ...extractRequestMeta(req.headers),
      })

      return apiSuccess(setting)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)
