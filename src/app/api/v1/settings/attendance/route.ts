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
import { resolveCompanyId } from '@/lib/api/companyFilter'
import { z } from 'zod'
import type { SessionUser } from '@/types'

// ─── Zod 스키마 ────────────────────────────────────────────

// 시·분 범위까지 검증 (29:99 같은 값 차단)
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** IANA 타임존 검증 — supportedValuesOf는 UTC 등 유효 별칭을 빠뜨리므로 생성자 try/catch */
function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

const alertThresholdsSchema = z.object({
  caution: z.number().min(1).max(100),
  warning: z.number().min(1).max(100),
  blocked: z.number().min(1).max(168),
})

const flexWorkSchema = z.object({
  flexEnabled: z.boolean(),
  coreTimeStart: z.string().regex(HHMM_RE).optional(),
  coreTimeEnd: z.string().regex(HHMM_RE).optional(),
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
  timezone: z
    .string()
    .min(1)
    .max(64)
    .refine(isValidTimezone, { message: '유효한 IANA 타임존이 아닙니다.' })
    .optional(),
  // 기준 출퇴근 시간 — 지각/조퇴 판정 기준 (S276)
  workStartTime: z.string().regex(HHMM_RE).optional(),
  workEndTime: z.string().regex(HHMM_RE).optional(),
  // SUPER_ADMIN이 타법인 설정을 편집할 때만 의미 — resolveCompanyId로 검증
  companyId: z.string().uuid().optional(),
})

// ─── GET — 현재 법인 근태 설정 조회 ──────────────────────────

export const GET = withPermission(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      // SUPER_ADMIN은 ?companyId=로 타법인 설정 조회 (그 외 role은 자기 법인 강제)
      const { searchParams } = new URL(req.url)
      const companyId = resolveCompanyId(user, searchParams.get('companyId'))

      const setting = await prisma.attendanceSetting.findUnique({
        where: { companyId },
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
        workStartTime: setting?.workStartTime ?? '08:30',
        workEndTime: setting?.workEndTime ?? '17:30',
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

      // SUPER_ADMIN은 body.companyId로 타법인 설정 편집 (그 외 role은 자기 법인 강제) — r2-3
      const { companyId: requestedCompanyId, ...data } = parsed.data
      const companyId = resolveCompanyId(user, requestedCompanyId)

      // 임계값 유효성 검사 (caution < warning < blocked)
      if (data.alertThresholds) {
        const { caution, warning, blocked } = data.alertThresholds
        if (caution >= warning || warning >= blocked) {
          throw badRequest('경고 임계값은 주의 < 경고 < 차단 순서여야 합니다.')
        }
      }

      const existing = await prisma.attendanceSetting.findUnique({ where: { companyId } })

      const setting = await prisma.attendanceSetting.upsert({
        where: { companyId },
        create: {
          companyId,
          ...data,
        },
        update: {
          ...data,
        },
      })

      logAudit({
        actorId: user.employeeId,
        action: existing ? 'SETTINGS_UPDATE' : 'SETTINGS_CREATE',
        resourceType: 'AttendanceSetting',
        resourceId: setting.id,
        companyId,
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
