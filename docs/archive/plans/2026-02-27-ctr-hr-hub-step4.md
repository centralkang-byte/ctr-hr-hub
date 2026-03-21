# CTR HR Hub STEP4 — 근태 + 휴가 + 단말기 + 교대근무 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 노동법 엔진 완성 + 출퇴근 관리(웹/단말기) + 휴가 신청/승인 워크플로우 + 교대근무 시프트표 구현

**Architecture:** Server Component(session/권한체크) → Client Component(fetch+렌더) 패턴 유지. API는 withPermission → Zod parse → Prisma → apiSuccess 패턴. 복합 변경은 반드시 $transaction.

**Tech Stack:** Next.js 14 App Router, Prisma, recharts(기설치), shadcn/ui, zod v4, react-hook-form, date-fns

---

## 코드 패턴 참조

### Server Page 패턴
```tsx
// page.tsx
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { XxxClient } from './XxxClient'

export default async function XxxPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return <XxxClient user={user} />
}
```

### API Route 패턴
```ts
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess, apiError, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { MODULE, ACTION } from '@/lib/constants'
import { prisma } from '@/lib/prisma'

export const GET = withPermission(
  async (req, _ctx, user) => {
    // ... query prisma ...
    return apiSuccess(data)
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW)
)
```

### 알림 발송 패턴 (fire-and-forget)
```ts
import { sendNotification } from '@/lib/notifications'
sendNotification({
  employeeId: managerId,
  triggerType: 'LEAVE_REQUESTED',
  title: t('leave.notification.requested'),
  body: `${employee.name} 님이 휴가를 신청했습니다`,
  link: '/leave/team',
})
```

---

## Phase 1: 스키마 마이그레이션 + 노동법 엔진

### Task 1.1: Prisma 스키마 보완 마이그레이션
기존 모델에 누락된 필드 추가:

**Attendance:**
- `clockOutMethod ClockMethod? @map("clock_out_method")` 추가

**AttendanceTerminal:**
- `apiSecret String @map("api_secret")` 추가

**LeaveRequest:**
- `halfDayType String? @map("half_day_type")` 추가 (AM/PM/null)

**LeavePolicy:**
- `minUnit String @default("FULL_DAY") @map("min_unit")` 추가 (FULL_DAY/HALF_DAY/HOUR)

실행: `npx prisma migrate dev --name step4_schema_additions`

### Task 1.2: 노동법 엔진 — types.ts 생성
`src/lib/labor/types.ts` 신규 생성:
- `LaborConfig` 인터페이스 (country_code, standard_hours_weekly/daily, overtime_threshold, max_overtime, overtime_rates[], leave_types[], mandatory_break, night_shift, probation, severance)
- `OvertimeRate` { label, multiplier, condition }
- `LeaveTypeConfig` { type, days_per_year, accrual_rule, paid }
- `BreakRule` { threshold_minutes, break_minutes }
- `NightShiftRule` { start_hour, end_hour }
- `OvertimeCalculation` { regular_hours, overtime_hours, breakdown[] }
- 함수 시그니처: `getLaborConfig()`, `calculateOvertime()`, `calculateLeaveAccrual()`

### Task 1.3: 노동법 7개국 파일 업데이트
각 파일에 `laborConfig: LaborConfig` export 추가 (기존 LaborModule 유지):

- **kr.ts**: 주40h, OT threshold 40, max OT 12, rates(weekday=1.5, weekend=1.5, holiday=2.0, night+0.5), 연차 15일(근속가산), SICK 무급, MATERNITY 90일
- **us.ts**: 주40h, OT=1.5(FLSA), PTO 정책
- **cn.ts**: 주40h, rates(weekday=1.5, weekend=2.0, holiday=3.0), N+1 퇴직금
- **in.ts**: 주48h, OT=2.0, CASUAL 12일/SICK 12일/EARNED 15일
- **eu.ts**: 주40h, rates(weekday=1.5, weekend=2.0), 연차 20-26일
- **tr.ts**: 주45h, OT=1.5, 연차 14-26일
- **mx.ts**: 주48h, first9h=2.0/after9h=3.0, 연차 12일+매년2일

### Task 1.4: 노동법 index.ts 확장
- `getLaborConfig(countryCode)` 함수 추가
- `calculateOvertime(config, weeklyHours)` → OvertimeCalculation 반환
- `calculateLeaveAccrual(config, type, tenureMonths)` → 일수 반환
- `getMandatoryBreak(config, workedMinutes)` → 휴게 분 반환

### Task 1.5: Zod 스키마 생성
`src/lib/schemas/attendance.ts`:
- clockInSchema, clockOutSchema
- attendanceUpdateSchema (HR 수정용, reason 필수)
- workScheduleSchema (생성/수정)
- employeeScheduleSchema

`src/lib/schemas/leave.ts`:
- leaveRequestSchema (유형, 시작일, 종료일, halfDayType, 사유)
- leavePolicySchema (유형, 일수, 법인, 유급여부, 이월, minUnit)
- leaveBulkGrantSchema (대상직원[], 유형, 일수)
- leaveApproveSchema, leaveRejectSchema(사유필수)

`src/lib/schemas/terminal.ts`:
- terminalClockSchema (employee_code, clock_type, timestamp, method)
- terminalCreateSchema (이름, 위치, 법인, 유형)

`src/lib/schemas/holiday.ts`:
- holidaySchema (날짜, 이름, 법인, 유형, 대체휴일여부)

`src/lib/schemas/shift.ts`:
- shiftAssignSchema (직원, 날짜, 시프트코드)
- shiftRosterQuerySchema (year, month)

### Task 1.6: i18n 키 추가
`src/lib/i18n/ko.ts`에 근태/휴가/단말기/교대 관련 한국어 텍스트 추가

---

## Phase 2: 근무일정 + 공휴일 관리

### Task 2.1: 근무일정 API
- `GET /api/v1/work-schedules` — 법인별 목록 (companyId 필터)
- `POST /api/v1/work-schedules` — 생성 (HR_ADMIN)
- `GET /api/v1/work-schedules/[id]` — 상세
- `PUT /api/v1/work-schedules/[id]` — 수정
- `DELETE /api/v1/work-schedules/[id]` — 삭제 (soft delete)

### Task 2.2: 직원 일정 배정 API
- `POST /api/v1/employees/[id]/schedules` — 배정 (effective_from 필수, 기간 중복 체크)
- `GET /api/v1/employees/[id]/schedules` — 직원 일정 조회

### Task 2.3: 공휴일 API
- `GET /api/v1/holidays` — 법인+연도별 목록
- `POST /api/v1/holidays` — 생성
- `GET /api/v1/holidays/[id]` — 상세
- `PUT /api/v1/holidays/[id]` — 수정
- `DELETE /api/v1/holidays/[id]` — 삭제

### Task 2.4: 근무일정 설정 UI
`/settings/work-schedules`: DataTable + 생성/수정 폼 Dialog
- 이름, 코드, 유형(FIXED/FLEXIBLE/SHIFT), 시작~종료, 휴게, 야간여부, 법인

### Task 2.5: 공휴일 설정 UI
`/settings/holidays`: DataTable + 연도 선택 + CRUD Dialog
- 날짜, 이름, 법인, 유형(공휴일/대체휴일/창립기념일)

---

## Phase 3: 출퇴근

### Task 3.1: 출퇴근 API (직원)
- `GET /api/v1/attendance/today` — 오늘 내 출퇴근 (Attendance 조회, 미퇴근 건 포함)
- `POST /api/v1/attendance/clock-in` — 출근
  - Redis 중복 체크 (같은 날 미퇴근 건 있으면 경고)
  - 유형: OFFICE/REMOTE/FIELD
  - 지각 판정: clockIn > 스케줄 시작시간 + 10분 → LATE
- `POST /api/v1/attendance/clock-out` — 퇴근
  - 오늘 최신 미퇴근 건 찾아 clock_out 업데이트
  - total_minutes 계산 (getMandatoryBreak 차감)
  - overtime_minutes 계산 (getLaborConfig 기준)
- `GET /api/v1/attendance/weekly-summary` — 이번 주 일별 시간 + 합계 + OT
- `GET /api/v1/attendance/monthly/[year]/[month]` — 월간 달력 데이터

### Task 3.2: 출퇴근 API (매니저/HR)
- `GET /api/v1/attendance/team` — 팀원 오늘 현황 (MANAGER)
- `GET /api/v1/attendance/admin` — 전사 현황 + KPI (HR_ADMIN, CompanySelector)
- `PUT /api/v1/attendance/[id]` — 근태 수동 수정 (HR_ADMIN)
  - 수정 사유 필수
  - audit_logs 기록 (이전값 → 변경값)

### Task 3.3: 출퇴근 UI — 직원
`/attendance`:
- 오늘 카드: 출근 버튼(파란) / 근무중 타이머+퇴근 버튼(빨간) / 완료 시간 표시
- 주간 요약: 일별 막대 그래프 (기준 시간 점선) + 합계/OT
- 월간 달력: 날짜셀 (출퇴근 시간 + 상태 아이콘: 정상=🟢, 지각=🟡, 조퇴=🟠, 결근=🔴, 휴가=🔵, 재택=🏠)

### Task 3.4: 출퇴근 UI — 매니저
`/attendance/team`:
- 팀원 DataTable (이름/출근/퇴근/상태/유형)
- 미출근 직원 bg-ctr-warning/5 하이라이트
- 주간 팀 요약: 평균 근무시간 vs 기준, OT 경고 (45h🟡, 52h🔴)

### Task 3.5: 출퇴근 UI — HR Admin
`/attendance/admin`:
- CompanySelector + 법인별 대시보드
- KPI 카드 3개: 지각률/결근률/평균 OT
- 이상 근태 목록 (지각/조퇴/미출근 필터)
- 근태 수동 수정 Dialog (직원→날짜→시간수정→사유입력)
- 초과근무 경고 대시보드 (45h=🟡, 52h=🔴)

---

## Phase 4: 단말기 연동

### Task 4.1: 단말기 인증 미들웨어 업데이트
`src/lib/terminal.ts` 수정:
- `verifyTerminal(req)`: X-Terminal-ID + X-Terminal-Secret 헤더 → DB 매칭
- `generateTerminalSecret()`: crypto.randomUUID()
- 기존 `TERMINAL_API_SECRET` env 방식 제거 → DB 기반으로 전환

### Task 4.2: 단말기 출퇴근 API
- `POST /api/v1/terminals/clock` — 단말기 전용 (withPermission 아닌 verifyTerminal 인증)
  - employee_code → employees 매칭 (같은 법인)
  - IN: attendance INSERT + clockInMethod
  - OUT: 오늘 최신 미퇴근 건 업데이트 + total/overtime 계산
  - IN 중복: 기존 건 23:59 자동 퇴근 + 새 출근
  - OUT 없이 다음날 IN: 전날 건 23:59 자동 퇴근

### Task 4.3: 단말기 관리 API
- `GET /POST /api/v1/terminals` — 목록/등록 (자동 ID+Secret 생성)
- `GET /PUT /DELETE /api/v1/terminals/[id]` — 상세/수정/삭제
- `POST /api/v1/terminals/[id]/regenerate-secret` — Secret 재발급

### Task 4.4: 단말기 설정 UI
`/settings/terminals`:
- DataTable: 단말기명/ID/위치/법인/상태/마지막통신
- 등록 Dialog + Secret 표시 (1회만)
- Secret 재발급 확인 Dialog
- 마지막 통신 > 24h → "오프라인" 뱃지

---

## Phase 5: 휴가 관리

### Task 5.1: 휴가 정책 API
- `GET /POST /api/v1/leave/policies` — 법인별 정책 CRUD
- `GET /PUT /DELETE /api/v1/leave/policies/[id]`

### Task 5.2: 휴가 잔여/부여 API
- `GET /api/v1/leave/balances` — 내 잔여 (유형별)
- `GET /api/v1/leave/balances/[employeeId]` — 직원 잔여 (HR)
- `POST /api/v1/leave/bulk-grant` — 대량 부여 (HR, $transaction)

### Task 5.3: 휴가 신청/승인 API
- `POST /api/v1/leave/requests` — 신청 (잔여 검증 + PENDING)
  - 잔여 < 신청일수: 400 Bad Request
  - pendingDays 가산
- `GET /api/v1/leave/requests` — 내 신청 목록
- `GET /api/v1/leave/requests/[id]` — 상세
- `PUT /api/v1/leave/requests/[id]/approve` — 승인 (MANAGER)
  - $transaction: status=APPROVED + used_days 가산 + pendingDays 차감 + 알림
- `PUT /api/v1/leave/requests/[id]/reject` — 반려 (rejection_reason 필수)
  - pendingDays 차감 + 알림
- `PUT /api/v1/leave/requests/[id]/cancel` — 취소 (EMPLOYEE)
  - PENDING 취소: pendingDays 차감
  - APPROVED 취소: $transaction (used_days 차감 + status=CANCELLED)

### Task 5.4: 휴가 팀/전사 API
- `GET /api/v1/leave/team` — 팀 휴가 현황 (MANAGER)
- `GET /api/v1/leave/admin` — 전사 현황 (HR_ADMIN, CompanySelector)

### Task 5.5: 휴가 정책 설정 UI
`/settings/leave-policies`:
- DataTable: 유형/일수/법인/유급/이월/상태
- 생성/수정 Dialog

### Task 5.6: 휴가 UI — 직원
`/leave`:
- 잔여 요약 카드 (유형별 remaining/total)
- 신청 폼: 유형 선택, DateRangePicker, 반차(AM/PM), 사유, 잔여 실시간 표시
- 신청 이력 DataTable (상태 뱃지)

### Task 5.7: 휴가 UI — 매니저
`/leave/team`:
- 팀원 휴가 달력 (월간, 행=팀원, 승인=파란바, 대기=점선바)
- 미처리 신청 목록 (상단 알림 뱃지)
- 승인/반려 인라인 액션

### Task 5.8: 휴가 UI — HR Admin
`/leave/admin`:
- CompanySelector + 법인별 대시보드
- 부서별 사용률 Bar Chart (Recharts)
- 대량 부여 Dialog (직원 다중선택/부서 일괄 + 유형+일수)

---

## Phase 6: 교대근무

### Task 6.1: 교대근무 API
- `GET /api/v1/shift-roster/[year]/[month]` — 월간 시프트표 조회
- `PUT /api/v1/shift-roster/assign` — 시프트 배정 (employee_schedules INSERT, 기간 중복 방지)
- `GET /api/v1/shift-roster/warnings` — 배정 경고 체크
  - 야간→주간 연속 (11시간 미휴식)
  - 주당 근무시간 초과 예측

### Task 6.2: 교대근무 시프트표 UI
`/settings/shift-roster`:
- 월간 그리드: 행=직원, 열=날짜(1~31)
- 셀 클릭 → 시프트 드롭다운 (DAY/EVENING/NIGHT/OFF)
- 경고 배너 (저장 차단 없음, Phase 1)

---

## Phase 7: 검증 + 마무리

### Task 7.1: TypeScript 검증
- `npx tsc --noEmit` 에러 0개 확인

### Task 7.2: 사이드바 메뉴 + 라우팅
- 근태, 휴가, 설정 하위메뉴 추가

### Task 7.3: context.md 업데이트
- STEP4 생성 파일 목록
- 단말기 인증 방식 (DB 기반)
- 다음 STEP5 준비사항

---

## 완료 기준 (from spec)

- [ ] lib/labor/ 7개국 LaborConfig export + 계산 함수 동작
- [ ] 직원 출퇴근 버튼 + 실시간 타이머 + 상태 자동 판정
- [ ] 단말기 X-Terminal-ID/Secret 인증 + attendances 기록
- [ ] IN 중복 → 기존 건 자동 퇴근 처리
- [ ] total_hours (mandatory_break 차감) + overtime 계산
- [ ] 휴가 신청→승인→used_days 가산 워크플로우
- [ ] 반차(AM/PM) 지원 + 잔여 부족 시 신청 불가
- [ ] 팀 휴가 달력 (승인=실선, 대기=점선)
- [ ] HR 대량 부여 + 근태 수동 수정 + audit_logs
- [ ] 교대근무 시프트표 그리드 + 연속 배치 경고
- [ ] npx tsc --noEmit 에러 0개
