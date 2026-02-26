// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Labor Module (Country-specific labor laws)
// ═══════════════════════════════════════════════════════════

import { krLaborModule } from '@/lib/labor/kr'
import { usLaborModule } from '@/lib/labor/us'
import { cnLaborModule } from '@/lib/labor/cn'
import { ruLaborModule } from '@/lib/labor/ru'
import { vnLaborModule } from '@/lib/labor/vn'
import { euLaborModule } from '@/lib/labor/eu'
import { mxLaborModule } from '@/lib/labor/mx'

// ─── Labor Module Interface ──────────────────────────────

export interface WorkHoursValidation {
  isValid: boolean
  message?: string
  weeklyHours: number
  maxWeeklyHours: number
}

export interface LaborModule {
  countryCode: string
  locale: string
  currency: string

  /** 주당 최대 근무시간 (연장 포함) */
  getOvertimeLimit(): number

  /** 최저시급 (현지 통화 기준) */
  getMinWage(): number

  /** 근무시간 유효성 검사 */
  validateWorkHours(weeklyHours: number): WorkHoursValidation

  /** 법정 연차 일수 (근속연수 기준) */
  getAnnualLeaveEntitlement(yearsOfService: number): number
}

// ─── Country Module Registry ─────────────────────────────

const laborModules: Record<string, LaborModule> = {
  KR: krLaborModule,
  US: usLaborModule,
  CN: cnLaborModule,
  RU: ruLaborModule,
  VN: vnLaborModule,
  PL: euLaborModule,  // CTR Europe is in Poland
  EU: euLaborModule,
  MX: mxLaborModule,
}

export function getLaborModule(countryCode: string): LaborModule {
  return laborModules[countryCode.toUpperCase()] ?? krLaborModule
}

export {
  krLaborModule,
  usLaborModule,
  cnLaborModule,
  ruLaborModule,
  vnLaborModule,
  euLaborModule,
  mxLaborModule,
}
