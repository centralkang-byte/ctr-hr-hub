/**
 * B1: 법인별 설정 조회 헬퍼
 * 글로벌 디폴트(companyId=null) fallback 패턴 구현
 */

import { prisma } from '@/lib/prisma'
import type {
  EvaluationSettings,
  PromotionSettings,
  CompensationSettings,
  AttendanceSettings,
  LeaveSettings,
  OnboardingSettings,
  SettingsResponse,
} from '@/types/settings'

type SettingsModelName =
  | 'evaluationSetting'
  | 'promotionSetting'
  | 'compensationSetting'
  | 'attendanceSetting'
  | 'leaveSetting'
  | 'onboardingSetting'

type SettingsTypeMap = {
  evaluationSetting: EvaluationSettings
  promotionSetting: PromotionSettings
  compensationSetting: CompensationSettings
  attendanceSetting: AttendanceSettings
  leaveSetting: LeaveSettings
  onboardingSetting: OnboardingSettings
}

/**
 * 법인별 설정 조회 — 법인 오버라이드 우선, 없으면 글로벌 디폴트(companyId=null) fallback
 */
export async function getCompanySettings<M extends SettingsModelName>(
  model: M,
  companyId: string
): Promise<SettingsResponse<SettingsTypeMap[M]>> {
  // 1. 법인 오버라이드 조회
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const override = await (prisma[model] as any).findFirst({
    where: { companyId },
  })

  if (override) {
    return { data: override as SettingsTypeMap[M], isOverride: true, companyId }
  }

  // 2. 글로벌 디폴트 fallback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const global = await (prisma[model] as any).findFirst({
    where: { companyId: null },
  })

  return { data: global as SettingsTypeMap[M], isOverride: false, companyId: null }
}

/**
 * 설정 오버라이드 존재 여부만 확인 (badge 표시용)
 */
export async function hasCompanyOverride(
  model: SettingsModelName,
  companyId: string
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = await (prisma[model] as any).count({ where: { companyId } })
  return count > 0
}

/**
 * 법인 오버라이드 생성 — 글로벌 값을 복사하여 법인 레코드 생성
 */
export async function createCompanyOverride(
  model: SettingsModelName,
  companyId: string
): Promise<void> {
  // 이미 존재하면 스킵
  if (await hasCompanyOverride(model, companyId)) return

  // 글로벌 디폴트 조회
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalDefault = await (prisma[model] as any).findFirst({
    where: { companyId: null },
  })

  if (!globalDefault) throw new Error(`No global default found for ${model}`)

  // id와 timestamps 제외하고 복사
  const { id: _id, createdAt: _c, updatedAt: _u, companyId: _co, ...rest } = globalDefault

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma[model] as any).create({
    data: { ...rest, companyId },
  })
}

/**
 * 법인 오버라이드 삭제 (글로벌로 복귀)
 */
export async function deleteCompanyOverride(
  model: SettingsModelName,
  companyId: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma[model] as any).deleteMany({ where: { companyId } })
}
