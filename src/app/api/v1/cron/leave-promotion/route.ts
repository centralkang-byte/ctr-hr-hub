// CRON: secured by CRON_SECRET header, not user session
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/cron/leave-promotion
// 연차 사용촉진 (한국 근로기준법 §61) — 2단계 자동 통보
//   step 1 = 사용기간 종료 6개월 전 1차 촉구 (10일 윈도우)
//   step 2 = 사용기간 종료 2개월 전 2차 통보(리마인더·감사 기록)
// ※ step 2 는 §61 사용자(회사) 강제지정 행위가 아니라 감사 기록 +
//   HR 액션 트리거. 근로자 사용시기 지정 상태는 미모델링(범위 외).
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyCronSecret } from '@/lib/cron-auth'
import { sendNotification } from '@/lib/notifications'
import { apiSuccess, apiError } from '@/lib/api'
import { unauthorized } from '@/lib/errors'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import { resolveByLeaveType } from '@/lib/leave/resolveLeaveTypeDefId'
import { formatToTz, parseDateOnly } from '@/lib/timezone'
import {
  resolveLeaveYearEnd,
  leaveYearEndYear,
  subMonthsUtc,
} from '@/lib/leave/leave-year-end'

const KST = 'Asia/Seoul'
const DAY_MS = 24 * 60 * 60 * 1000
const STAGE1_WINDOW_DAYS = 9 // 6개월 전 기준일 ~ +9일 = 10일 inclusive 윈도우

// 회사별 연차 LeaveTypeDef + accrualBasis 캐시 (cron 1회 실행 내 N+1 방지)
interface AnnualConfig {
  leaveTypeDefId: string
  accrualBasis: string
}

async function resolveAnnualConfig(
  companyId: string,
  cache: Map<string, AnnualConfig | null>,
): Promise<AnnualConfig | null> {
  if (cache.has(companyId)) return cache.get(companyId) ?? null

  const leaveTypeDefId = await resolveByLeaveType('ANNUAL', companyId)
  if (!leaveTypeDefId) {
    cache.set(companyId, null)
    return null
  }

  const rules = await prisma.leaveAccrualRule.findMany({
    where: { leaveTypeDefId, isActive: true, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { accrualBasis: true },
  })

  if (rules.length === 0) {
    cache.set(companyId, null)
    return null
  }
  if (rules.length > 1) {
    // 결정론: 최신 규칙 채택. 다중 활성 규칙은 설정 이상 → 모니터링 로그.
    console.warn(
      `[leave-promotion] company=${companyId} annual accrual rules ambiguous (${rules.length} active) — using newest`,
    )
  }

  const config: AnnualConfig = {
    leaveTypeDefId,
    accrualBasis: rules[0].accrualBasis,
  }
  cache.set(companyId, config)
  return config
}

export async function GET(req: NextRequest) {
  return handleLeavePromotion(req)
}

export async function POST(req: NextRequest) {
  return handleLeavePromotion(req)
}

async function handleLeavePromotion(req: NextRequest) {
  // verifyCronSecret(SSOT)이 x-cron-secret + Vercel-native Bearer 둘 다 수용.
  if (!verifyCronSecret(req)) return apiError(unauthorized('인증 실패'))

  const now = new Date()
  // KST 달력일 기준 (Vercel UTC 실행이 한국 로컬 날짜를 시프트하지 않도록)
  const todayKst = parseDateOnly(formatToTz(now, KST, 'yyyy-MM-dd'))
  const todayMs = todayKst.getTime()

  let sentCount = 0
  let skippedNoRule = 0
  let skippedAnniversaryBasis = 0

  // KR 법인 ACTIVE 직원 (§61 은 한국법)
  const employees = await prisma.employee.findMany({
    where: {
      deletedAt: null,
      assignments: {
        some: {
          status: 'ACTIVE',
          isPrimary: true,
          endDate: null,
          company: { countryCode: 'KR' },
        },
      },
    },
    select: {
      id: true,
      name: true,
      hireDate: true,
      assignments: {
        where: { status: 'ACTIVE', isPrimary: true, endDate: null },
        take: 1,
        select: { companyId: true },
      },
    },
  })

  const annualCache = new Map<string, AnnualConfig | null>()

  for (const emp of employees) {
    const companyId = extractPrimaryAssignment(emp.assignments)?.companyId
    if (!companyId) {
      skippedNoRule++
      continue
    }

    const annual = await resolveAnnualConfig(companyId, annualCache)
    if (!annual) {
      // 연차 유형/규칙 미설정 — silent skip 금지: 구조화 로그 + 카운트
      console.warn(
        `[leave-promotion] skip employee=${emp.id}: no active annual accrual rule for company=${companyId}`,
      )
      skippedNoRule++
      continue
    }

    // ── basis 별 처리 범위 ──────────────────────────────────────────
    // calendar_year: 사용기간 종료 = 12/31, 그리고
    //   accrualEngine 이 LeaveYearBalance.year = 동일 달력연도로 저장
    //   → 기간↔잔액 매핑이 결정론적. §61 자동 통보 가능.
    // hire_date_anniversary / 미상: LeaveYearBalance 모델에 입사기념일
    //   사용기간 키가 없어(처리 연도=임의 달력연도) 만료기간↔잔액을
    //   신뢰성 있게 매핑 불가. 잘못된 잔액으로 법정 통보·idempotency
    //   로그 오염을 막기 위해 구조화 skip(silent 금지). 입사기념일
    //   기준 §61 자동화는 accrual 모델의 기간 기록 확장 필요(별도 트랙).
    if (annual.accrualBasis !== 'calendar_year') {
      console.warn(
        `[leave-promotion] skip employee=${emp.id}: accrualBasis='${annual.accrualBasis}' not supported (calendar_year only); §61 anniversary automation requires accrual-period modeling`,
      )
      skippedAnniversaryBasis++
      continue
    }

    const periodEnd = resolveLeaveYearEnd(
      annual.accrualBasis,
      emp.hireDate,
      todayKst,
    )
    // calendar_year: 종료연도 = 부여 달력연도 → LeavePromotionLog.year
    // idempotency 와 LeaveYearBalance 조회 키가 일치.
    const yearKey = leaveYearEndYear(periodEnd)

    const balance = await prisma.leaveYearBalance.findUnique({
      where: {
        employeeId_leaveTypeDefId_year: {
          employeeId: emp.id,
          leaveTypeDefId: annual.leaveTypeDefId,
          year: yearKey,
        },
      },
      select: {
        entitled: true,
        carriedOver: true,
        adjusted: true,
        used: true,
        pending: true,
      },
    })
    if (!balance) continue

    const remaining =
      balance.entitled +
      balance.carriedOver +
      balance.adjusted -
      balance.used -
      balance.pending
    if (remaining <= 0) continue

    // §61 통보 시점 (사용기간 종료 기준, KST 달력일)
    const stage1Start = subMonthsUtc(periodEnd, 6).getTime()
    const stage1End = stage1Start + STAGE1_WINDOW_DAYS * DAY_MS
    const stage2Start = subMonthsUtc(periodEnd, 2).getTime()
    const periodEndMs = periodEnd.getTime()

    // stage = 알림 문구/키용 (1·2), stepCode = LeavePromotionLog 저장값.
    // stepCode 를 §61 네임스페이스(61·62)로 분리한다. 구 cron(60/30/10일,
    // 미등록·비동작)이 staging/dev 등에서 수동 호출돼 step 1/2/3 레거시
    // 행이 남아 있어도 unique([employeeId, year, step]) 충돌로 §61 법정
    // 통보가 누락되지 않도록 함(Codex Gate P1, 마이그레이션 불요).
    let stage: 1 | 2
    if (todayMs >= stage1Start && todayMs <= stage1End) {
      stage = 1
    } else if (todayMs >= stage2Start && todayMs < periodEndMs) {
      stage = 2
    } else {
      continue
    }
    const stepCode = stage === 1 ? 61 : 62

    // 이미 발송된 단계면 skip (매일 실행 중복 방지).
    const already = await prisma.leavePromotionLog.findUnique({
      where: {
        employeeId_year_step: {
          employeeId: emp.id,
          year: yearKey,
          step: stepCode,
        },
      },
      select: { id: true },
    })
    if (already) continue

    // 법정 통보는 "누락"보다 "중복"이 안전한 실패 모드 →
    // 통보를 먼저 발송하고, 그 다음 로그를 기록한다. 로그 기록 실패 시
    // (또는 함수 freeze) 다음 실행에서 재발송(중복 리마인더)되어
    // §61 통보가 silently 누락되지 않음(Codex Gate P1).
    // sendNotification 은 프로젝트 전역 fire-and-forget 패턴(공유 인프라
    // 변경 범위 외) — 발송 "시도"를 로그 commit 보다 선행시킨다.
    const pendingDays = balance.pending
    sendNotification({
      employeeId: emp.id,
      triggerType: 'LEAVE_PROMOTION',
      title:
        stage === 1
          ? '연차 사용촉진 1차 통보 (사용시기 지정 요청)'
          : '연차 사용촉진 2차 통보',
      body:
        stage === 1
          ? `${emp.name}님, 미사용 연차가 ${remaining}일 남아 있습니다. 근로기준법 §61에 따라 사용시기를 지정하여 통보해 주시기 바랍니다. (신청 중 ${pendingDays}일 별도)`
          : `${emp.name}님, 미사용 연차 ${remaining}일에 대한 사용시기 미지정분 2차 통보입니다. 사용기간 종료 전 사용을 권장드립니다. (신청 중 ${pendingDays}일 별도)`,
      titleKey: `notifications.leavePromotion.stage${stage}.title`,
      bodyKey: `notifications.leavePromotion.stage${stage}.body`,
      bodyParams: {
        name: emp.name,
        remainingDays: remaining,
        pendingDays,
      },
      link: '/leave',
    })

    try {
      await prisma.leavePromotionLog.create({
        data: {
          employeeId: emp.id,
          year: yearKey, // = 사용기간 종료 연도 (발송 시점 달력연도 아님)
          step: stepCode, // 61=§61 1차, 62=§61 2차 (레거시 1/2/3 과 비충돌)
          remainingDays: remaining,
        },
      })
    } catch {
      // 동시 실행 race 로 이미 기록됨 — 통보는 이미 발송 시도됨(안전)
    }

    sentCount++
  }

  return apiSuccess({
    processed: employees.length,
    sent: sentCount,
    skippedNoRule,
    skippedAnniversaryBasis,
  })
}
