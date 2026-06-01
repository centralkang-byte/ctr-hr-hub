# 법규 정합성 #2 — 퇴직금 주 15시간 자격 자동 검증

## Context

PR #43 매뉴얼 검토에서 발견된 시스템-법규 불일치. `payroll.md` §9 #16:
`severance.ts`의 자격 판정이 `tenureDays >= 365`만 확인하고, 근로자퇴직급여
보장법 §4① 단서의 두 번째 요건(**4주 평균 1주 소정근로시간 15시간 이상**)을
검증하지 않음. 주 15시간 미만 단시간 근로자가 자동 계산 대상에 포함되어
인사담당자 수동 제외에 의존 → 법정 비대상자에 퇴직금 산정 리스크.

`WorkSchedule.weeklyHours`(Decimal)가 `EmployeeSchedule`(effective-dated:
`effectiveFrom`/`effectiveTo`)로 Employee와 연결되어 있어 **데이터는 이미
존재**. Prisma 마이그레이션 불필요.

## 범위

매뉴얼이 명시한 `src/lib/payroll/severance.ts`(최종정산) 한정.
`src/lib/compliance/kr.ts`의 `calculateSeveranceInterim`/
`validateSeveranceEligibility`(중간정산)는 법적 근거(사유 게이트)가 달라
**별도 follow-up**으로 분리.

## Codex Gate 1 반영 (HIGH 2 / MED 4)

- **HIGH 1 반영**: §4① "**4주간 평균** 1주 소정근로시간 15시간" → 단일
  스케줄이 아니라 **퇴직일 직전 28일 윈도와 교차하는 EmployeeSchedule들의
  일수가중 평균** weeklyHours로 판정.
- **HIGH 2 — 범위 명시 제외**: 15h 이상/미만 반복 단시간 근로자의 *계속
  근로기간 재산정*은 매뉴얼 §9 #16(자격 게이트) 범위 밖. 본 PR은 **자격
  boolean만** 정합. 계속근로기간 재산정은 별도 "퇴직급여 산정엔진" 트랙으로
  Follow-up에 명시.
- **MED 반영**: ① null/미커버는 `ineligibleReason`과 구분되는
  `eligibilityWarning`로 감사추적 ② 겹침 tie-breaker `effectiveFrom` desc →
  `id` asc ③ 날짜 경계 KST date-only, 윈도 `[termDate-28d, termDate)`,
  `effectiveTo` inclusive(해당일 end-of-day) ④ `severance.ts` 반환부
  `Number()` 명시 변환.

## 설계

### 1. 신규 순수 함수 `src/lib/payroll/severance-eligibility.ts`
```
computeTrailingFourWeekAvgWeeklyHours(
  schedules: { id: string; effectiveFrom: Date; effectiveTo: Date | null; weeklyHours: number }[],
  terminationDate: Date,
): { avgWeeklyHours: number | null; coveredDays: number }
```
- 윈도 = `[termDate - 28d, termDate)` (KST date-only)
- 각 날짜에 적용되는 스케줄 = `effectiveFrom <= day` AND (`effectiveTo`
  null OR `day <= effectiveTo`); 겹치면 `effectiveFrom` 최신 → `id` asc
- 일수가중 평균 = Σ(day별 weeklyHours)/28. **28일 전부 커버 안 되면
  `null`(unknown)** — 부분 커버 분모는 평균 과대, 0-fill 은 부당 제외
  위험 → 양쪽 회피, 상위에서 감사 경고 후 수동 검증 (Codex Gate 2 R3)
```
evaluateSeveranceEligibility({ tenureDays, avgWeeklyHours }):
  { eligible: boolean; reason: string | null; warning: string | null }
```
- `tenureDays < 365` → `{ false, REASON_TENURE, null }`
- `avgWeeklyHours != null && avgWeeklyHours < 15` →
  `{ false, REASON_WEEKLY_HOURS, null }` (사유 상수, 조문 포함)
- `avgWeeklyHours == null` → `{ true, null, WARN_NO_SCHEDULE }`
  (자동 제외 안 함 — 법정급여 부당박탈 방지 + 감사 경고)
- 그 외 `{ true, null, null }`
- 순수·DB 무의존, 사유/경고는 모듈 상수 → 단위 테스트

### 2. `src/lib/payroll/severance.ts`
- 28일 윈도와 교차하는 `EmployeeSchedule` + `schedule.weeklyHours` 조회
  (`employeeSchedules` where `effectiveFrom <= termDate` AND
  (`effectiveTo == null` OR `effectiveTo >= termDate-28d`))
- `Number(schedule.weeklyHours)` 명시 변환 후 helper에 전달
- `const isEligible = tenureDays >= 365` →
  `evaluateSeveranceEligibility(...)` 결과의 `eligible` 사용
- 미달 시 기존 tenure-미달 경로와 동일 (severancePay 0, tax 0)

### 3. `src/lib/payroll/types.ts` — `SeveranceDetail` 가산 (additive)
- `avgWeeklyHours: number | null`
- `ineligibleReason: string | null`
- `eligibilityWarning: string | null`
기존 소비자(`payroll/severance/[employeeId]` route,
`complete-offboarding.ts`)는 가산만으로 영향 없음 (severancePay 0 경로 동일).

### 4. 회귀 테스트 (IRON RULE — P1 fix)
`tests/unit/payroll/severance-eligibility.test.ts`:
4주평균(단일/윈도내 변경/겹침 tie-break/커버0) + tenure<365 /
avg<15 / 둘 다 OK / `avg==14.999` / `avg==15.0` 경계 / `avg==null`+warning /
Decimal→number / effectiveTo inclusive 경계 / 28일 윈도 경계.

## 변경 파일 (4)
- 신규 `src/lib/payroll/severance-eligibility.ts`
- 수정 `src/lib/payroll/severance.ts`
- 수정 `src/lib/payroll/types.ts`
- 신규 `tests/unit/payroll/severance-eligibility.test.ts`

## 검증
1. `npx tsc --noEmit` 0 / `npm run lint` clean
2. unit 전 케이스 green
3. `git status` migrations 0
4. Codex Gate 2 `codex review --uncommitted` HIGH 0
5. `complete-offboarding.ts` 경로 수기 추적: hours-미달 시 severancePay 0
   분기 crash 없음 확인

## Follow-up
- **퇴직급여 산정엔진 트랙 (HIGH 2)**: 15h 이상/미만 반복 단시간 근로자의
  계속근로기간(`tenureDays`) 재산정 — 본 PR 범위 밖. 자격 boolean만 정합
- `kr.ts` interim 동일 갭 (별도 트랙, 법적 근거 상이)
- 매뉴얼 §9 #16 → 정합 완료 표기 (별도 docs PR 또는 본 PR 포함 검토)
