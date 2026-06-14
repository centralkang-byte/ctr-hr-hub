# Wave 1 IA — PR-4b Attendance-rate % engine — 2026-06-14 (rev4, post-Codex-Gate1 ×3 — sound-to-implement)

> rev4 = rev3 + Codex r3 fixes: LOA `company_id=$cid`(테넌트 누출 차단)·effective_date DATE 비교·departments LEFT JOIN
> (미배정 직원 보존)·aggregate 판정순서(Σdenom=0 우선)·leave generate_series 윈도우 제한·unsupported point null/0 명시.
> + r4 fixes: roster `d.id AS department_id`(교차법인/삭제 부서 null화)·dept rate-point에 denom/cohort 추가(계약 일치).
> **Codex Gate 1 ×4 완료 — sound-to-implement.**

> Stacked on **PR-4 (#181, branch `feat/wave1-attendance-admin-trends`)** — adds the deferred 출근율% block to the
> same `AttendanceTrendsTab`. Spec source = `docs/plans/active/2026-06-13-wave1-pr4-attendance-trends.md`
> "DEFERRED → PR-4b". CEO decisions locked 2026-06-14. rev3 folds in Codex Gate 1 round-1 (6×P1) **and round-2**
> (1×P0 schema, 7×P1 boundary/contract). Core approach: **eligible-date intersection in SQL `generate_series`;**
> present counted only on eligible dates; pure TS engine owns formula+aggregation.

## CEO decisions (locked)
1. **Two formulas by `JobCategoryCode`** (on active-primary `EmployeeAssignment`):
   - **PRODUCTION → STRICT**: `NORMAL ÷ 소정근로일` (지각·조퇴·휴가 전부 차감).
   - **OFFICE · MANAGEMENT · R_AND_D · null(미지정) → EXCUSED**: `(NORMAL+LATE+EARLY_OUT) ÷ (소정근로일 − 승인휴가)`.
2. **shiftEnabled 법인 v1 제외** (PR-4c). 3. **추세 = 직군별 2선** (관리직군 vs 생산직), 부서 칸 = 혼합 1값.
4. **미지정 직군 = 면제**, `미분류 N명` 표기.

## Schema facts grounded (Codex r2 P0)
- `Employee`에 **`company_id`·`status` 컬럼 없음** — hire_date/resign_date/deleted_at만. **법인·재직상태 = `employee_assignments`**
  (`ea.company_id`, `ea.status` = EmployeeStatus TEXT: ACTIVE|ON_LEAVE|RESIGNED|TERMINATED).
- `Attendance @@unique([employeeId, workDate])` → emp-day당 1행, **attendance JOIN fan-out 없음**(leave만 fan-out 위험).
  `work_date` = UTC-자정 `DateTime`. `clock_in/out` = UTC `timestamp(3)`.
- `LeaveOfAbsence`: `deleted_at` 있음, idx `[companyId,status]`·`[startDate]`. dates = `@db.Date`.
- `resignDate` = **마지막 근무일**(lastWorkingDate) → 경계 **inclusive**.

## Eligible-date predicate (SQL `generate_series`, per emp-day)
date `d`가 employee의 eligible day ⇔ 모두 만족:
- `EXTRACT(DOW FROM d) NOT IN (0,6)` (Mon–Fri).
- `d >= hire_date::date` **AND** `(resign_date IS NULL OR d <= resign_date::date)` (퇴사일 inclusive — r2-P1-2).
- `d < today::date` (회사 tz `today`; generate_series 상한 = today exclusive → 현재 월 자동 cap, 미래일 0).
- `NOT EXISTS` Holiday(`h.company_id=$cid AND h.date::date=d`) **및** DesignatedLeaveDay(동일).
- `NOT EXISTS` LeaveOfAbsence(`loa.employee_id=emp AND loa.deleted_at IS NULL AND loa.status IN
  ('APPROVED','ACTIVE','RETURN_REQUESTED','COMPLETED') AND d >= loa.start_date::date AND d <= loaEnd`) where
  **`loaEnd` (inclusive, r2-P1-3)** = `CASE status WHEN ACTIVE|RETURN_REQUESTED → today::date ;
  COMPLETED → COALESCE(actual_end_date, expected_end_date, today)::date ;
  APPROVED → COALESCE(expected_end_date, today)::date END`. (CANCELLED|REJECTED 제외.)

## Feeder SQL (rev3 — fan-out-safe; r2-P1-4/M8/M9)
CTE 순서 고정: `roster` → `cal`(generate_series) → `leave_by_day`(pre-agg, cap) → `eligible`(predicate) →
final LEFT JOIN attendance/leave (둘 다 emp-day 1:1). 12개월(GROUP BY emp, ym)·30일(GROUP BY emp) **두 쿼리**.

```sql
WITH roster AS ( -- DISTINCT ON: 직원당 active-primary 1건. 법인/상태 = ea, 입퇴사 = employees
  SELECT DISTINCT ON (ea.employee_id)
    ea.employee_id, d.id AS department_id, d.name AS department_name, jc.code AS job_category_code,
    e.hire_date, e.resign_date    -- d.id(NOT ea.department_id): 교차법인/삭제 부서는 LEFT JOIN으로 null 처리 (r4-P1)
  FROM employee_assignments ea
  JOIN employees e   ON e.id = ea.employee_id AND e.deleted_at IS NULL          -- Employee엔 company/status 없음
  LEFT JOIN departments d ON d.id = ea.department_id AND d.company_id = $cid     -- nullable dept: 미배정도 보존 (r3-P1)
  LEFT JOIN job_categories jc ON jc.id = ea.job_category_id AND jc.company_id = $cid
  WHERE ea.company_id = $cid AND ea.is_primary = true AND ea.end_date IS NULL
    AND ea.effective_date <= $today::date AND ea.status IN ('ACTIVE','ON_LEAVE') -- DATE 비교(r3-P1) · ON_LEAVE 포함
  ORDER BY ea.employee_id, ea.effective_date DESC, ea.id DESC
),
cal AS (SELECT generate_series($winStart::date, $today::date - 1, interval '1 day')::date AS d),
leave_by_day AS ( -- per emp-day [0,1] cap (r2-P1-4): 먼저 집계 후 1:1 JOIN → attendance 배증 방지
  SELECT lr.employee_id, g.d::date AS d,
         LEAST(1.0, SUM(CASE WHEN lr.half_day_type IN ('AM','PM')
                              AND lr.start_date::date = lr.end_date::date THEN 0.5 ELSE 1.0 END)) AS frac
  FROM leave_requests lr
  JOIN roster r ON r.employee_id = lr.employee_id
  CROSS JOIN LATERAL generate_series(GREATEST(lr.start_date::date, $winStart::date),
                                     LEAST(lr.end_date::date, $today::date - 1), interval '1 day') g(d)  -- 윈도우 제한(r3-LOW)
  WHERE lr.company_id = $cid AND lr.status = 'APPROVED'
    AND lr.end_date::date >= $winStart::date AND lr.start_date::date < $today::date  -- overlap prefilter
  GROUP BY lr.employee_id, g.d::date
),
eligible AS ( SELECT r.employee_id, r.department_id, r.department_name, r.job_category_code, c.d,
    to_char(c.d,'YYYY-MM') AS ym
  FROM roster r CROSS JOIN cal c
  WHERE EXTRACT(DOW FROM c.d) NOT IN (0,6)
    AND c.d >= r.hire_date::date AND (r.resign_date IS NULL OR c.d <= r.resign_date::date)
    AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.company_id=$cid AND h.date::date=c.d)
    AND NOT EXISTS (SELECT 1 FROM designated_leave_days dl WHERE dl.company_id=$cid AND dl.date::date=c.d)
    AND NOT EXISTS (SELECT 1 FROM leave_of_absences loa WHERE loa.company_id=$cid AND loa.employee_id=r.employee_id
        AND loa.deleted_at IS NULL AND loa.status IN ('APPROVED','ACTIVE','RETURN_REQUESTED','COMPLETED')
        AND c.d >= loa.start_date::date AND c.d <= (CASE
            WHEN loa.status IN ('ACTIVE','RETURN_REQUESTED') THEN $today::date
            WHEN loa.status = 'COMPLETED' THEN COALESCE(loa.actual_end_date, loa.expected_end_date, $today::date)
            ELSE COALESCE(loa.expected_end_date, $today::date) END))
)
SELECT e.department_id, e.department_name, e.job_category_code, e.employee_id, e.ym /*12mo only*/,
  COUNT(*)::int AS elig_days,
  COALESCE(SUM(lbd.frac),0)::float8 AS leave_days,
  COUNT(a.*) FILTER (WHERE a.status='NORMAL')::int AS normal_elig,
  COUNT(a.*) FILTER (WHERE a.status IN ('NORMAL','LATE','EARLY_OUT'))::int AS present_elig
FROM eligible e
LEFT JOIN leave_by_day lbd ON lbd.employee_id=e.employee_id AND lbd.d=e.d
LEFT JOIN attendances a ON a.employee_id=e.employee_id AND a.company_id=$cid AND a.work_date=e.d /*UTC-자정 = date, 인덱스 친화*/
GROUP BY e.department_id, e.department_name, e.job_category_code, e.employee_id, e.ym;
```
`$winStart` = trendStart(12mo) 또는 deptStart(30d). present/normal은 **eligible date에서만** 집계(r1-P1-1). leaveDays는
EXCUSED denom용; STRICT는 미사용(공유 feeder 단순성 — L12; EXPLAIN 병목이면 EXCUSED만 leave JOIN).

## Pure engine `src/lib/attendance/eligibility.ts` (unit-tested)
- `formulaForJobCategory(code): 'EXCUSED'|'STRICT'` (PRODUCTION→STRICT, else/null→EXCUSED).
- `employeePair(formula,{eligDays,leaveDays,normalElig,presentElig}): {num,denom,clamped}`:
  EXCUSED `denom=max(0,eligDays−leaveDays); raw=presentElig` · STRICT `denom=eligDays; raw=normalElig` ·
  `num=min(raw,denom); clamped=raw>denom`.
- `aggregate(pairs,{minCohort=5}): {rate:number|null; denom:number|null; cohort:number; suppressed:boolean}`.
  `cohort = #distinct emp with denom>0`(=**eligibleCohort**). **판정 순서(r3-P1, 모순 제거)**:
  ① `Σdenom===0` ⇒ `{rate:null, denom:0, cohort:0, suppressed:false}`(데이터 없음). ② else `cohort<minCohort` ⇒
  `{rate:null, denom:null, cohort, suppressed:true}`(표본 억제). ③ else `{rate:Σnum/Σdenom, denom:Σdenom, cohort,
  suppressed:false}`. ⇒ `rate≠null`이면 `denom≠null` 보장.

## Orchestration `src/lib/attendance/rate.ts`
`getAttendanceRate(companyId, now)`:
- `roster` **항상** 실행(부서 universe·headcount용; support와 무관 — r2-P1-6).
- **support guard (M9)**: `shiftEnabled || standardDaysPerWeek!==5` ⇒ rate 미산출(모든 point `suppressed=false,
  rate=null`), `rateMeta.supported=false, reason='SHIFT'|'NON_STANDARD_WEEK'`. roster/dept universe는 그대로 반환.
- supported면 12mo·30d feeder 실행 → engine:
  - `rateTrend[month] = { management: agg(EXCUSED pairs), production: agg(STRICT pairs) }` (월·시리즈별 suppress).
    **추세·classMix·rosterCount = 미배정(dept null) 직원 포함** (r3-P1; LEFT JOIN dept). basisNote =
    **"현재 재직자 기준 과거 기록"**(생존자 편향 — r1-P1-2 라벨; hire/resign span이 입사 전 월 0 처리).
  - `deptRates: Map<deptId,{rate,denom,cohort,suppressed}>` (30d, 혼합, suppress) — **`department_id NOT NULL`만 집계**
    (미배정 직원은 추세엔 포함, 부서 칸엔 제외 — r3-P1).
- `rateMeta = { supported, reason?, cohortMin:5, rosterCount, unclassifiedCount, anomalyCount, classMix:{management,
  production} }`. **`rosterCount`(표시) vs point.cohort(eligibleCohort, 억제 게이트) 분리**(r2-P1-5).
  `anomalyCount` = 12mo feeder에서 `clamped` emp-month 수(단일 정의 — M8/M10), UI meta 노트로 표시.

## Merge `/attendance/admin/trends` (r2-P1-6 — dept universe 통합)
`getAttendanceTrends` ∥ `getAttendanceRate`. **departments[] universe = roster depts ∪ PR-4 attendance depts**
(support 무관) — 저출근/무출근 부서도 유지(r1-P1-4). 각 행: 운영지표(PR-4 쿼리, 없으면 0/null·기존 cohort 규칙
유지) + dept rate-point(rate; dept가 roster에 없거나 unsupported/억제면 null). 응답 추가: `DeptTrendRow`에
`attendanceRate:number|null`·`attendanceRateDenom:number|null`·`attendanceRateCohort:number`·
`attendanceRateSuppressed:boolean`(공통 rate-point 계약 일치 — unsupported/미배정/억제 모두 고정 tuple, r4-P2),
`rateTrend`, `rateMeta`. Route unchanged.

## Frontend `AttendanceTrendsTab.tsx`
- Block A: `출근율` 칸(혼합, suppressed→"표본 적음", null+!supported→"교대제 제외" 등 구분). 노트(M7): "부서 출근율 =
  직군 정책 혼합(가중)".
- NEW 12mo **2선** 블록(관리직군/생산직; CSS 막대 또는 recharts+CHART_COLORS). subtitle = "현재 재직자 기준". 월별
  `suppressed`만 "표본 적음" gap.
- 노트: `미분류 N명`, `데이터 이상 N건`(anomalyCount>0), `!supported`면 rate 블록 자리에 설명 EmptyState(운영 A/B/C는
  계속 렌더). 3-state 재사용.

## API/UI 계약 (r2-P1-7)
각 rate point = `{ rate:number|null, denom:number|null, cohort:number, suppressed:boolean }`. `rate=null` 사유 구분:
`suppressed=true`(표본<5, denom=null) / `rate=null && !suppressed && supported`(eligible 0 → denom=0,cohort=0) /
`rateMeta.supported=false`(미지원 → **모든 point `{rate:null, denom:null, cohort:0, suppressed:false}` 고정**, r3-LOW).
UI는 `suppressed`에만 "표본 적음"; `!supported`엔 "교대제 제외/표준근무주 아님".

## RBAC·멀티테넌트·캐시 — PR-4 동일
`withPermission(perm(ATTENDANCE,APPROVE))` + 명시 HR_ADMIN/SUPER_ADMIN, EXECUTIVE 제외, `resolveCompanyId`, 미캐시.
모든 feeder/CTE `company_id=$cid` + 조인 tenant 명시(r1-P1-5); attendance/leave/holiday/LOA는 roster emp-set 통해 join.

## Date cast 규칙 (r2-M8)
calendar-only timestamp(hire/resign/holiday/designated/leave) → `column::date`. `today`/`winStart` = `'YYYY-MM-DD'::date`.
`generate_series(...)::date`. half-day = `start_date::date=end_date::date`. **attendance는 `a.work_date=e.d`**(UTC-자정
equality, `::date` 미적용 → `[companyId,workDate]` 인덱스 유지) + `a.company_id=$cid`.

## Index / Gate 2 (r2-M11)
모델 변경 없음(PR-4 인덱스 재사용). **Gate 2 = 두 feeder `EXPLAIN (ANALYZE, BUFFERS)` 실데이터.** 후보(병목 시 별
migration): `leave_of_absences (company_id, employee_id, status, start_date)`,
`leave_requests (company_id, employee_id, start_date, end_date)`. 수백명×365일 ≈ 10–20만 중간행(PG 내부)·출력은 grouped
유한 — 수용 가능, range JOIN 배증만 주의.

## Files (~7)
1. **NEW** `eligibility.ts`(pure) · 2. **NEW** `eligibility.test.ts`(vitest) · 3. **NEW** `rate.ts`(feeders+guard) ·
4. **EDIT** `trends.ts`(∥ rate, dept universe 통합, types) · 5. **EDIT** `AttendanceTrendsTab.tsx` ·
6. **EDIT** `messages/{ko,en,zh,es,vi}.json`(add-only `attendance.trend.rate*`) ·
7. **EDIT** `e2e/api/attendance-trends.spec.ts`(rate shape·2선·dept 칸·suppress·tenant 격리·RBAC·seed sanity:
   PRODUCTION STRICT denom≠OFFICE EXCUSED·LOA/holiday 제외·resign inclusive).

## 휴가 일수 불변식 (locked — r3-P1 #4)
`fraction = 0.5` **iff** `half_day_type ∈ {AM,PM} AND start_date::date = end_date::date`; 그 외(다일·null) = 평일당 1.0.
다일 요청에 halfDayType가 들어간 비정상 입력은 **전일 1.0으로 처리**(API가 다일 반차를 막지 않음 — 최대 0.5 과차감,
드묾·문서화). per-day `LEAST(1.0, SUM)` cap이 중복 신청을 흡수.

## 알려진 follow-up (Codex Gate2 P1-1 — 디퍼)
**PR-4 운영지표 SQL의 work_date tz ~1일 시프트** (선재 버그, 이번에 발견). 실측: 모든 날짜 컬럼이 naive
`timestamp`로 "현지자정-as-UTC wall-clock" 저장(KST자정=`…15:00`), `parseDateOnly`는 UTC자정 반환 → PR-4의
30일/6개월 `work_date` 범위·`date_trunc('month')`가 ~1일/월경계 어긋남. **rolling 카운트엔 무시할 수준**이고
PR-4(#181)는 이미 dogfood 승인됨 → 이번 PR-4b(=rate 엔진, tz-정확)에선 PR-4의 lock된 쿼리 재작성 안 함(회귀
리스크·범위). 후속: trends.ts Block A/B/C work_date에 `localDate()`(rate.ts 동일 패턴) 적용 + 윈도우 바운드를
현지자정 인스턴트로. rate 엔진은 영향 없음(이미 KST-exact). → [[hrhub-attendance-naive-timestamp-tz]]

## v1 한계 (UI+PR)
12mo = 현재 재직자 기준 과거 기록(생존자 편향; 퇴사자·과거 부서/직군 소급 미반영 — deferred). 평일=Mon–Fri 가정;
`standardDaysPerWeek≠5`/교대제 = rate 미산출. 휴가/출근 동일일 충돌 = 일별 clamp + `anomalyCount` 표기.

## Verification
`npm run test:unit`(eligibility.test green) · tsc=0 · lint=0 · `prisma migrate status`(PR-4 pending만) · **Codex Gate 1
×3 통과(rev4)** · **Codex Gate 2**(+`EXPLAIN ANALYZE`) · **Pixel Gate** · 멀티롤 도그푸드(super@/hr@: 생산직 부서 STRICT
rate < 사무직; employee-a@ 403) · 실데이터 렌더 확인 후 done.
