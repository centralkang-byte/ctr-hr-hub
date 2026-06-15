# PR2 — 휴가 레거시 이중테이블 완전 퇴출 (read-path 단일화)

> S317 PR1(#201 보안 핫픽스) 후속. 레거시 `EmployeeLeaveBalance` **읽기 전수 제거** → `LeaveYearBalance`(SSOT) 단일화 + 사용률 denominator 통일.
> 2026-06-15 · branch: `fix/leave-dual-table-purge` (PR1 #201 머지 후 main 기준) · CEO 결정 반영

## 배경 / Ground-truth (grep+3-agent 매핑 실측)

- 레거시 `EmployeeLeaveBalance`(table `employee_leave_balances`) = **런타임 쓰기 0건** (Phase 6에 전 쓰기 `LeaveYearBalance`로 이전). create/update/upsert/delete grep 전무 → **read-only stale**.
- 신 SSOT `LeaveYearBalance`: `entitled`(부여)·`used`(사용)·`carriedOver`(이월)·`adjusted`(조정)·`pending`. key = `(employeeId, leaveTypeDefId, year)`. 레거시 key = `(employeeId, policyId, year)`.
- **이미 마이그 완료(무변경)**: `home/summary`·`leave/requests/[id]/approve`(쓰기 raw SQL)·`offboarding/me`·`offboarding/complete-offboarding`·`teams-actions`(쓰기)·`accrualEngine.getEmployeeLeaveBalance`·`my/page.tsx`·`leave/admin`(이미 가용분 denominator ✓).
- **crossboarding.ts** = 주석(설계문서)만, 쿼리 없음 → 무변경.

## CEO 결정 (2026-06-15 AskUserQuestion)

1. **방향**: PR2 진행.
2. **사용률 denominator** = **가용분 기준** → `rate = used / (entitled + carriedOver + adjusted)`.
   - 현 불일치: `leave/admin`=가용분 ✓ / `dashboard/summary` primary=`used/entitled`만 ❌ / 레거시=`used/grantedDays`.

## ⚠️ 플랜 게이트 결정 필요 (CEO 승인)

- **annual-only 통일** (권장): 모든 사용률 계산을 `leaveTypeDef.code = 'annual'`(연차)만으로 집계.
  - 근거: ① turnover 위험 factor가 문자열로 **"연차 미사용"** ② 선례(offboarding·my-space·complete-offboarding 모두 `code==='annual'`) ③ 병가·경조사가 "휴가 사용률" KPI를 희석하지 않음.
  - 현 레거시 reads = **전 유형 합산**(레거시 테이블은 유형 개념 없음). annual-only 전환 = denominator 변경과 별개의 2차 의미변화 → 수치 추가 시프트.
  - 대안: "전 유형 합산" 보존(최소 변화). 단 그럴 거면 leave/admin과 일관 유지.
  - → **헬퍼에 옵션화**해서 CEO 선택에 따라 1-라인 토글.
- **ON_LEAVE 포함**: 현 동작(`activeAssignmentWhere` = `status:'ACTIVE'`만) **보존**. 휴직자 휴가사용률 포함 정책은 별 트랙(out of scope).

## 범위 (편집 대상 = 레거시 reader 10곳)

| # | 파일 | 현 레거시 read | 스코프 | 조치 |
|---|---|---|---|---|
| 1 | `analytics/attendance/overview/route.ts:42` | findMany granted/used | company ✓(PR1) | → leaveYearBalance + 헬퍼 |
| 2 | `lib/analytics/ai-report/data-collector.ts:163` | findMany granted/used | company ✓(PR1) | → leaveYearBalance + 헬퍼 |
| 3 | `analytics/prediction/burnout/route.ts:83` | findMany granted/used | empIds ✓ | → 헬퍼 |
| 4 | `analytics/prediction/turnover/route.ts:102` | findMany granted/used | empIds ✓ | → 헬퍼 |
| 5 | `analytics/team-health/overview/route.ts:100` | findMany granted/used | memberIds ✓ | → 헬퍼 |
| 6 | `dashboard/summary/route.ts` `calcAvgLeaveUsage` | primary=entitled만 / fallback=legacy | company ✓ | denominator 가용분 통일 + **레거시 fallback 삭제** |
| 7 | 🔒 `lib/analytics/predictive/burnout.ts:109` | findMany granted/used | **무스코프** | unlock→헬퍼; 호출자(calculate/employee-risk) 단일 employeeId |
| 8 | `lib/analytics/predictive/turnoverRisk.ts:88` | findMany granted | **무스코프** | → 헬퍼 |
| 9 | `lib/analytics/predictive/teamHealth.ts:124` | findMany granted/used | memberIds(부분) | → 헬퍼 |
| 10 | `lib/teams-bot.ts:128` `handleLeaveBalance` | findMany by policy, remaining=granted-used | **무스코프** | → leaveYearBalance by leaveTypeDef, remaining=available-used-pending (user-facing Teams `/휴가`) |

> #7~#10 무스코프는 **per-employeeId** 쿼리라 PR1의 집계-누출(타법인 합산 노출)과 클래스가 다름(본인 데이터, 전출 시 잔여행 합산 edge만). 마이그 김에 정합하되 과도 스코프 지양.

## SSOT 헬퍼 신설

`src/lib/leave/utilization.ts` (순수+얇은 쿼리 헬퍼, 부수효과 무):
- `leaveAvailable(b) = b.entitled + b.carriedOver + b.adjusted`
- `leaveUtilizationRate(used, available) → available>0 ? used/available : 0`
- `LEAVE_YEAR_WHERE_ANNUAL = { leaveTypeDef: { code: 'annual' } }` (옵션 합성)
- 집계 헬퍼: `aggregateLeaveUtilization(rows)` → per-employee {available, used, rate} map
- denominator·annual-only 정의를 **단일 지점**에 고정 (10곳 중복 제거).

## 비범위 (Out of scope — follow-up)

- 레거시 `EmployeeLeaveBalance` 모델/테이블 **DROP** = 별 schema migration(공유 prod·zero-apply 함정 [[hrhub-migrations-no-zero-apply]]). PR2는 **read-nowhere**까지만; 모델은 schema에 잔존.
- `activeAssignmentWhere` 4중복 → companyFilter SSOT 추출 = 선택적(scope 팽창 주의, 별 cleanup).
- ON_LEAVE 포함, crossboarding 정산 구현.

## 검증 계획

- `npx tsc --noEmit` 0 · `npm run lint` 0
- **라이브 DB proof**: 마이그 전/후 사용률 수치 비교 — denominator(가용분) + annual-only 영향 정량화(CTR/CTR-CN 별). PR1처럼 타법인 격리 재확인.
- e2e: 값-격리 가드(비-SUPER HR이 본인 법인 수치만 — PR1 패턴) + Teams `/휴가` 잔여 정합.
- 멀티롤 dogfood: `super@`(통합뷰) + `hr@ctr.co.kr` + `hr@ctr-cn.com`(타법인 격리).
- **Codex Gate 1**(이 플랜) → HIGH/P0-P1 반영 → **Gate 2**(구현 후, /verify).

## 리스크

- denominator 가용분 + annual-only → 표시 사용률 **하향 시프트**(분모↑·유형축소). 의도된 정정이나 CEO에 수치 변화 사전 고지(라이브 proof).
- 예측 점수(turnover/burnout) = `analytics/calculate` 배치가 `turnoverRiskScore`/`burnoutScore` 기록 → 재계산 시 점수 변동. 의도됨.
- `predictive/burnout.ts` PROTECTED unlock → 편집 → 세션 후 자동 재잠금.

---

## Codex Gate 1 결과 반영 (2026-06-15, P0 1 · P1 8 · P2 3 — 전부 valid)

### 검증으로 확정된 데이터 모델 (스키마+seed SSOT)
- `LeaveTypeDef`는 **법인별** 모델 (`companyId String?`, `@@unique([companyId, code])`).
- seed: **글로벌 annual def**(`companyId:null`, seed.ts:2787) **AND 법인별 annual def**(krAnnual·cnAnnual, seed.ts:2685/2763) **혼재**.
- 예측 헬퍼는 **이미 `companyId`를 받음**: `calculateBurnoutScore(id, companyId)`·`calculateTurnoverRisk(id, companyId)`·`calculateTeamHealth(deptId, companyId)` (쿼리에서 안 쓸 뿐) → P0 스코프 수정 저비용.

### P0 — #7~#10 무스코프 읽기 반드시 회사 스코프 (preserve 방침 폐기)
- **결정**: 모든 사용률 LeaveYearBalance 읽기에 row-level annual+company 필터 적용:
  `leaveTypeDef: { code: 'annual', companyId: { in: [companyId, null] } }`
  → 자사 annual def + 글로벌 annual def 포함, **타사 def 제외**(전출자 잔여행 차단). 글로벌/법인별 혼재 모두 대응.
- 집계 라우트(#1~#6): companyId를 헬퍼에 전달(이미 보유). #3~#5는 empIds/memberIds도 회사필터됨(belt+suspenders).
- 예측 헬퍼(#7~#9): 시그니처의 companyId를 leave 쿼리에 사용.
- `teams-bot.ts`(#10): 인증 사용자의 **현재 회사 컨텍스트 + 본인 employeeId** 검증 후 동일 필터. (현재 회사 컨텍스트 획득 경로 = 구현 시 확인.)

### P1 (전부 반영)
1. **annual-only = 플랜 게이트 종료조건** — CEO 승인 + metric별 적용표(아래) 확정 후 구현. 헬퍼는 **명시적 mode 인자**(런타임 모호 토글 금지).
2. annual 필터 = 위 P0 company-scoped 필터로 충족(법인별 def 중복·대소문자·비활성 차단). `code` 사용(선례 일치); `category` 필드 별도 존재는 무시.
3. **집계 단위 + 0분모 정책 명시**: 직원별로 먼저 `available = Σ(entitled+carriedOver+adjusted)`·`used = Σused` → 그 다음 rate. **각 metric의 기존 집계방식 보존**(dashboard=직원별 rate 평균 / leave/admin=부서 Σ/Σ — 행평균↔합산을 임의 전환 금지). `available <= 0` → **null/제외**(0% 위장 금지). 음수 adjusted→음수분모·NaN/Infinity 차단.
4. **pending**: 사용률 = `used/available`(분자에 pending 미포함). teams 잔여 = `available - used - pending`(음수 표시 clamp).
5. **연도 정책 보존**: 현 `getFullYear()` 현재연도 필터 유지(기존 동작). Dec-Jan 분배는 write-path(approve startYear/endYear)에 의존 — **변경 안 함**, 문서화만.
6. **dashboard fallback 삭제**: SSOT 쿼리만 좁은 `try/catch` → `null` + 구조화 error log. 라우트 전체 실패/`0` 위장 금지.
7. **정적 게이트**: 구현 후 `rg`로 모델명·`employee_leave_balances`·relation accessor·raw SQL 잔존 = **0** 검증(허용 잔존 없음).
8. **before/after = 동일성 아님**: 법인별 fixture 기대값 계산(all-types 제외분·carriedOver/adjusted·annual=0·available<=0·전출자) 대비.

### P2 (반영)
- PROTECTED `predictive/burnout.ts` = 동일 PR 원자 적용(분리 불필요). unlock 기록·호출자 영향·재계산 시점·롤백 PR에 명시.
- 헬퍼 = **순수 산술 함수**(leaveAvailable/rate) + **Prisma where/aggregation builder** 분리(경계 테스트 용이).
- 운영: 위험점수는 다음 recompute에만 갱신 → 배포 직후 신·구 혼재. 일괄 재계산 또는 timestamp 표시 운영노트.

### metric별 적용표 (annual-only + 가용분 + 회사스코프)
| metric | 집계단위(보존) | 분모 | annual | 회사스코프 |
|---|---|---|---|---|
| attendance/overview leaveUsageRate | 전사 Σused/Σavailable | 가용분 | only | companyId 필터 |
| ai-report | 동상 | 가용분 | only | companyId |
| prediction/burnout·turnover (route) | per-emp rate | 가용분 | only | empIds+def |
| team-health (route+lib) | per-team Σ/Σ | 가용분 | only | memberIds+def |
| dashboard calcAvgLeaveUsage | **직원별 rate 평균(보존)** | 가용분 | only | companyId |
| predictive/burnout·turnoverRisk (lib) | per-emp | 가용분 | only | companyId(시그니처) |
| teams-bot 잔여 | per-emp 표시 | available-used-pending | only | requester company |
