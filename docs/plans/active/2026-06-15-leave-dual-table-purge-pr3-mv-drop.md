# 2026-06-15 — 휴가 이중테이블 purge PR3: MV repoint + 번아웃 분류 픽스 + DROP

## 배경 / 문제

PR #140(쓰기 일원화)·#202(route read 마이그)로 레거시 `employee_leave_balances`는
**런타임 write=0 / app read=0** 으로 확인됨(grep ground-truth, 유일 잔존 = 일회용 마이그 스크립트·seed).

그러나 PR #202 "휴가 사용률 레거시 이중테이블 **완전** 퇴출"은 **SQL MV 레이어를 놓침**.
두 MV가 아직 죽은 테이블을 읽음:

| MV | 위치 | 소비 (queries.ts) | 영향 |
|---|---|---|---|
| `mv_burnout_risk` | `scripts/db/sql/mv_analytics.sql:141` `FROM employee_leave_balances` | `getBurnoutRiskList/Count` | **번아웃 warning/critical 임계 입력** |
| `mv_team_health` | `:235` `FROM employee_leave_balances elb` | `getTeamHealthList` | `avg_unused_leave_days` 표시 |

**P1 (표시 아닌 분류 오류):** `mv_burnout_risk` 의 `unused_days`(레거시 stale)가 분류 조건:
- warning = {고강도주≥4, **unused_days≥45**, 1:1공백≥30} 중 ≥2
- critical = 위 3개 전부

write=0 이후 `unused_days`는 시드값에 동결 → **누가 번아웃으로 분류되는지 자체가 틀림.**
또한 MV가 테이블을 참조하는 한 `DROP TABLE` 불가.

부수: MV refresh cron은 CRON_SECRET 부재로 사망(S279) → MV는 06-10 스냅샷 동결. (별 블로커)

## CEO 결정 (2026-06-15)

- 레거시 퇴출 **제대로** 완결 = MV repoint + 테이블 DROP + seed 정리 (한 PR)
- 번아웃 임계값 = **하향 조정** (연차-only repoint 시 `≥45일`은 도달불가 ~ 연차 최대 25일)

## annual-only SSOT (PR #202, `src/lib/leave/utilization.ts`)

- annual = `leaveTypeDef.code = 'annual'`
- available = `entitled + carriedOver + adjusted` (floor 0)
- remaining(표시) = `entitled + carriedOver + adjusted - used - pending`
- rate = `used / available` (available≤0 → null)
- 회사 스코프 = 자사 annual def **OR** 글로벌(null) def, 타사 제외 (전출자 누출 차단)

## 변경 (5~6 파일)

### 1. `scripts/db/sql/mv_analytics.sql` — MV repoint (SSOT)
- **mv_burnout_risk**: `leave_unused` CTE → LATERAL(또는 CTE+ea조인)로 `leave_year_balances lyb`
  `JOIN leave_type_defs ltd ON ltd.id=lyb.leave_type_def_id AND ltd.code='annual'
   AND (ltd.company_id = ea.company_id OR ltd.company_id IS NULL)`,
  `lyb.year = EXTRACT(YEAR FROM CURRENT_DATE)`.
  - `unused_days` = `SUM(entitled+carried_over+adjusted-used-pending)` (annual, 표시 유지)
  - 신규 `available_days`=`SUM(entitled+carried_over+adjusted)`, `used_days`=`SUM(used)` (rate용)
  - 임계: `unused_days >= 45` → **연차 미사용률** `(available>0 AND used/available < 0.3)` (제안; CEO 확정)
- **mv_team_health**: 휴가 LATERAL 동일 repoint(annual-only, self|global). `avg_unused_leave_days` 의미 유지.
- 두 MV 모두 `DROP MATERIALIZED VIEW IF EXISTS` 선행 idempotent 유지.

### 2. prisma migration (신규) — `DROP TABLE employee_leave_balances;`
- MV re-apply **후** 실행해야 함 (의존성 제거 후). 순서 어기면 의존성 에러 = 안전 실패.
- 훅 차단 → `/unlock-protected prisma/migrations`.

### 3. `prisma/schema.prisma`
- `model EmployeeLeaveBalance` 제거 (2236~)
- 관계 제거: `Employee.employeeLeaveBalances`(1403), `LeavePolicy.employeeLeaveBalances`(2230)

### 4. seed 정리 (레거시 write 제거)
- `prisma/seeds/04-leave.ts`(upsert ×2 블록), `25-leave-enhancement.ts`(×2), `27-fix-4-data.ts`(×1)
- `08-notifications.ts` `.count()` → 제거 또는 leaveYearBalance로

### 5. 죽은 스크립트
- `scripts/migrate-leave-balances.ts` 제거 (일회용·이미 실행됨·DROP 후 깨짐)

### 6. 배포 순서 (게이트)
1. mv_analytics.sql 편집 → `npx tsx scripts/db/apply-analytics-mv.ts` (live DB, STAGING_DB_CONFIRM, **CEO 게이트**)
2. `npx prisma migrate` (DROP table)

## 검증
- tsc 0 · lint 0 · build
- Codex Gate1(플랜) · Gate2(/verify) — analytics 멀티테넌트라 필수
- 라이브: 번아웃 리스트가 연차-only 미사용률로 재분류되는지 dogfood (가능 시)

## Codex Gate 1 반영 (Request Changes → 분할·수정)

**P0/P1 findings 수용 → 2-PR 분할:**

### PR3 (이번 세션) = MV repoint + 번아웃 분류 픽스 (DROP 없음, 독립 가치)
- `scripts/db/sql/mv_analytics.sql` 만 변경. live apply(`apply-analytics-mv.ts`, 게이트) 후 검증.
- **tenant-safe** (Gate1 P0#2): `leave_unused` CTE → **LATERAL**(outer `ea` 연결)로 전환,
  `ltd.company_id = ea.company_id OR ltd.company_id IS NULL`. 전출자 타사 잔액 합산 차단.
- **SSOT 정합 available** (Gate1 P1#4): `available = SUM(GREATEST(entitled+carried_over+adjusted, 0))`
  (per-balance floor — utilization.ts:19 `leaveAvailable` 정합). 음수 adjusted 행이 분모 상쇄 방지.
  `unused_days`(표시) = `SUM(entitled+carried_over+adjusted-used-pending)` (leaveRemaining 정합, floor 없음).
- **계절성** (Gate1 P1#5): 절대 `≥45` → 고정 `<0.3` 도 1월 오탐 확정. **pace-relative** 채택:
  `available>0 AND used/available < 0.5 * (EXTRACT(DOY FROM CURRENT_DATE)/365.0)`
  = "연중 경과 대비 절반 미만 페이스로 휴가 사용" (연초 거의 0건, 연말 <50% 사용 시 발화). 0.5 계수 = CEO 조정 여지.
- **검증** (Gate1 P2#8·#9): `available=0`/missing row → 조건 false 명시(GREATEST·NULLIF), live apply 후
  분류 건수 before/after·tenant 격리(법인별 count) 확인. SQL 회귀 노트.

### PR4 (후속, PR3 live 적용·검증 후) = DROP + 전수 정리
- **2-stage deploy 강제** (Gate1 P0#1): PR3 MV가 전 환경 적용·검증된 뒤에만 DROP migration 배포. DROP은 MV 의존 제거 후에만 성공.
- **누락 참조 전수** (Gate1 P1#3) — 구현 후 `rg employee_leave_balances` = 0 (생성client·과거migration·주석 allowlist 제외):
  - seed write: `04-leave.ts`(legacy 블록 + **L390 mirror loop를 직접 upsert로 재작성** — Gate1 P1#7),
    `seed-dev.ts:712`, `25-leave-enhancement.ts`, `27-fix-4-data.ts:107`(L133 신table 유지)
  - `08-notifications.ts` count → leaveYearBalance
  - `scripts/sanity-check.ts:61` raw SQL → leave_year_balances
  - `scripts/db/sql/rls_setup.sql:268` 정책 제거(휴면이나 재적용 깨짐 방지)
  - `src/types/index.ts:24` 타입 재export 제거
  - `scripts/migrate-leave-balances.ts` 삭제
- **pre-DROP 정합성 진단** (Gate1 P1#6): DROP 전 read-only 진단 — legacy row count vs leave_year_balances
  annual 커버리지, 미매핑 employee/policy/year, 합계 diff 로깅. prod disposable([[hrhub-prod-db-disposable-prelaunch]])이나 진단은 cheap insurance.
- `prisma generate` 후 tsc 0 확인.

## 리스크
- 임계값 의미변경(절대 45 → 비율 0.3): CEO 하향 확정. 조기연도 false-positive는 레거시도 동일(범위 밖).
- MV re-apply = 공유 Supabase 게이트. cron refresh 사망(별 블로커)이라 즉시효과는 수동 refresh 필요.
- annual def 회사 스코프 PR #202 정합 필수(전출자 누출).
- DROP 마이그는 MV re-apply 후에만 성공 — 순서 문서화.
