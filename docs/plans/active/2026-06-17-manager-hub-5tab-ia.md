# Manager-Hub 5-Tab IA 마이그레이션 (Wave 1 — team 클러스터)

> Status: PLAN (Codex Gate 1 대기) · 2026-06-17 (S323)
> 트랙: Wave 1 IA/백엔드 정합 — team 클러스터 (마지막 미착수 IA 클러스터)
> 관련 메모리: [[hrhub-wave1-ia-backend-gap]] · [[hrhub-leave-balance-dual-table]] · [[hrhub-attendance-naive-timestamp-tz]]

## 1. 문제 / 목표

`/manager-hub`는 현재 레거시 `ManagerInsightsHub.tsx`(392줄) — **탭 없는 단일 세로 스크롤** 대시보드
(KPI 4카드 + 팀건강 레이더 + 팀알림 + 성과등급분포 + AI추천 + dotted-line reports). 프로토타입
(`_design-reference/page-team-hub.jsx`)은 **5탭 IA**(개요/팀원/1:1·활동/성과/AI 추천)를 규정.

Wave 1 fidelity-map(`docs/plans/active/2026-06-12-wave1-page-ia-fidelity-map.md:96-100`)이 이 5탭 hub를
**adopt 대상**으로 명시. employees/attendance/leave/my-space/recruitment/performance/modal-drawer 클러스터는
모두 완료 — **team이 유일한 미착수 IA 클러스터**.

**목표**: 레거시 컴포넌트를 프로토 5탭 IA로 재구성. 기존 콘텐츠는 탭에 재배치(대부분 기존 엔드포인트 재사용),
프로토에만 있는 팀원 로스터·1:1/활동 탭은 백엔드 신설/래핑. CEO 정책 = "proto와 차이내지 말고 개발해서라도
넣어라" + "헤더 액션은 실제 동작해야(생략 금지)".

## 2. 현 상태 (ground-truth)

- 컴포넌트: `src/components/manager-hub/ManagerInsightsHub.tsx` — `tab`/`Tabs` 매치 0건(탭 없음).
- 페이지: `src/app/(dashboard)/manager-hub/page.tsx` — `ROLE_GROUPS.MANAGER_ONLY` 게이트(EXECUTIVE 제외), 나브 키 `team-hub`.
- 데이터 fetch(현재 5콜): `summary`·`team-health`·`alerts`·`performance` (병렬) + `DottedLineReportsCard`(자식).
- **AI 추천 = 엔드포인트 아님** — `summary` 임계값(미완료 1:1 / 초과근무>5h / 이직위험>0) 클라 파생.
- 기존 manager-hub 엔드포인트 6개: `summary`(+`?includeMembers=true`)·`team-health`·`alerts`·`performance`·`dotted-line-reports`·`pending-approvals`. **팀원 정의가 라우트마다 다름**(Codex G1): `summary`=`getAllReportIds`(cross-company 포함)·`team-health`/`pending-approvals`=primary position 2-step 직접조회(헬퍼 미사용)·`performance`/`alerts`=자체 로직 + cross-company filter. → "전부 동일 스코프" 전제는 틀림. members 로스터의 팀원 정의를 어느 것과 맞출지 §10에서 결정.
- 직속부하 헬퍼: `src/lib/employee/direct-reports.ts` — **`getDirectReportIds(managerId: string)`**(단일 문자열 인자! position hierarchy = `Position.reportsToPositionId`, same-company), **`getAllReportIds(args: {managerId, role, companyId})`**(객체 인자, +cross-company dotted-line). **시그니처 혼동 금지**(Codex G1 P1). CLAUDE.md: 조직위계 = reportsToPositionId, OneOnOne.managerId 아님.

## 3. 탭별 콘텐츠 매핑 (proto → 구현)

| 탭 | proto 내용 | 데이터 소스 | 갭 |
|---|---|---|---|
| **개요** | stat-strip 4 KPI + 팀건강 레이더 + AI추천 카드(+추천액션 3) + 팀원 미리보기 grid(8) | `summary`·`team-health` + 클라파생 AI + **`members`(신설)** | 미리보기 grid가 per-member overtime/leaveUsage 필요 → 로스터 |
| **팀원** | 로스터 테이블(이름·초과근무·연차사용률·성과등급·이직위험·상태·[1:1]) | **`members`(신설 — CRITICAL)** | 로스터 엔드포인트 부재 |
| **1:1·활동** | status-chips + 다가오는 1:1 + 보낸 칭찬 + 팀 주간일정 + 위임현황 | `cfr/one-on-ones`·`cfr/recognitions`(팀스코프 래핑)·`LeaveRequest`(주간)·`delegation` | 팀스코프 래퍼 + 주간 캘린더 집계 |
| **성과** | 성과등급분포 bar + MBO평균 progress | `performance` (그대로) | 없음 ✅ |
| **AI** | AI 인사이트 카드 + 면책 | 클라파생 추천 재사용 | 실 스케줄 AI = fidelity-map deferred(XL) |

**keep-live(프로토보다 풍부 — 회귀 금지)**: ① 팀 알림(`alerts`, OVERTIME/BURNOUT/ATTRITION 실데이터) → **개요**에 보존(프로토 미존재지만 keep-live). ② `DottedLineReportsCard`(cross-company 점선/겸직 부하) → **팀원** 탭 로스터 하단 보존.

## 4. 백엔드 갭 스펙

### 4.1 `GET /api/v1/manager-hub/members` (신설 — CRITICAL)

직속부하 로스터. **RBAC** `perm(MODULE.EMPLOYEES, ACTION.VIEW)` + EMPLOYEE 거부(기존 manager-hub 라우트 패턴 동일).
**스코프** `getDirectReportIds(user.employeeId)`(단일 문자열 인자) → 결과를 active primary assignment `companyId = user.companyId`로 재필터(타 법인 0 노출). **`getAllReportIds` 미사용**(cross-company 포함되므로) — 단, summary 헤드카운트는 cross-company라 미세 불일치 가능 → §10 D3 결정. (Codex G1 P1·P2)

per-member 필드:
- `id`·`name`·`positionTitle`·`departmentName` — Employee + primary EmployeeAssignment.position
- `overtimeMinutesMonth` — `Attendance.overtimeMinutes` 당월 합. ⚠ `Attendance.workDate`는 **`DateTime`(@db.Date 아님)** — `new Date()` 범위 대신 기존 tz SQL 패턴(`src/lib/attendance/rate.ts:111` `((work_date AT TIME ZONE 'UTC') AT TIME ZONE tz)::date`) 따름. off-by-one 주의 [[hrhub-attendance-naive-timestamp-tz]] (Codex G1 P1).
- `leaveUsagePct` — **기존 SSOT 헬퍼 사용**: `src/lib/leave/utilization.ts`의 `leaveAvailable(...)`·`leaveUtilizationRate(used, available)`·`annualBalanceWhere(companyId)`. `LeaveYearBalance` 필드 = **`entitled`/`used`/`carriedOver`/`adjusted`/`pending`** (Float; `usedDays/grantedDays` 아님). ⚠ **`EmployeeLeaveBalance`는 S320 #205 DROP** + **`getLeaveBalanceYear`는 이 브랜치에 없음(#207 미머지)** — 둘 다 참조 금지 (Codex G1 P1).
- `performanceGrade` — **공개 게이트 필수**: 원시 `PerformanceEvaluation.emsBlock` 직접 노출 금지(published 플래그 없음). `PerformanceReview.finalGrade`를 **`notifiedAt != null`(통보됨)일 때만** 노출, 아니면 `null`('미공개'). per-member 등급을 `EMPLOYEES:VIEW` 라우트에 얹는 건 권한 표면 변화이므로 publication 게이트로 누수 차단 [[hrhub-perf-result-publication-gate]] (Codex G1 P1).
- `attritionRiskScore`(0-100) → risk band(LOW<40 / MEDIUM 40-69 / HIGH≥70, summary의 `>=70` 임계와 정합) + `isHighPotential`
- `status` — 오늘 출결(PRESENT/LEAVE/HALF_DAY/ABSENT) — summary `includeMembers` 로직 재사용

N+1 금지: reportIds 일괄 조회(`{ in: reportIds }`) 3-4쿼리. 페이지네이션(소팀이라 limit 50 단순, cursor 선택).

### 4.2 활동 탭 백엔드 (PR-2)

- 1:1: 팀스코프 — 기존 `cfr/one-on-ones`는 manager가 본인+팀 일부만(`employeeId` 파라미터 필요). 신설 `GET /manager-hub/activity/one-on-ones`(reportIds 일괄, scheduledAt desc, upcoming+recent) 또는 기존에 `?team=true`. **권장: 신설**(스코프 일관 + N+1 회피).
- 칭찬: `cfr/recognitions`는 전사 public. 신설 `GET /manager-hub/activity/recognitions`(receiverId IN reportIds) — manager가 팀에 보낸/팀이 받은 칭찬.
- 주간일정: `LeaveRequest`(reportIds, 이번주 APPROVED) 집계 → 휴가/반차. (외근/출장은 모델 부재 → 휴가만, 또는 '준비중').
- 위임: 기존 `delegation?type=delegated`(self) 재사용 — manager 본인 위임현황. ⚠ perm = `MODULE.LEAVE, ACTION.VIEW`(Codex G1 P2) — MANAGER seed가 `leave_read` 보유(prisma/seed.ts)라 동작하나, 활동 탭에서 별도 호출 시 권한 의존 명시.

## 5. 디자인 / 컨벤션 (rules/design.md, _design-reference/CLAUDE.md)

- **탭 = Radix `Tabs`**(`@/components/ui/tabs`, `bg-muted/50 rounded-lg p-1`, `TabsList` aria-label, `overflow-x-auto` mobile). proto `wd-tab-bar`의 구현 SSOT. (패널 연결 tab이라 radiogroup 아님 — accessibility.md 결정표.)
- **주 액션 버튼 fill = `bg-warm`**(navy 금지). 헤더 액션 2개 모두 실동작:
  - **1:1 예약**(primary) → 1:1 생성 `WdDrawer`(중앙 Dialog 금지) 또는 `/performance` CFR 연결. **[결정필요 D1]** 위치.
  - **팀 공지**(Mail) → 실 타겟 필요. 팀 공지 백엔드 부재 시: 알림 compose 연결 또는 명시적 deferred. **[결정필요 D2]**.
- 입력 폼(1:1 예약 등) = `WdDrawer` + `WdField`(htmlFor). native 검증 회귀 주의([[hrhub-wddrawer-form-validation-regression]]).
- 로스터 테이블 모바일 = `data-label` reflow. 좌측 색보더 카드·그라데이션·이모지 금지. 하드코딩 hex 금지(차트 예외).
- 3-상태: loading 스켈레톤 / error toast / empty `<EmptyState>` (탭별). 프로토 mock 숫자 복사 금지 — 실API 또는 '준비중'.

## 6. RBAC / 멀티테넌트

- 페이지·신규 엔드포인트 = `MANAGER_ONLY`(EXECUTIVE 제외, 기존 page.tsx 유지) + `perm(EMPLOYEES, VIEW)`.
- 모든 신규 집계 라우트 = `getDirectReportIds`/`getAllReportIds` + companyId 스코프. **Codex Gate 2 필수**(멀티테넌트 신규 라우트 — leak-hunt 패턴). 글로벌(null) 쓰기 없음(읽기 전용).
- `navigation.ts`는 🔒 FROZEN — `/manager-hub` 나브(`team-hub`)는 이미 존재 → **나브 편집 불필요**. `messages/*.json` append-only — 신규 탭 라벨 키만 추가.

## 7. 권장 분할 (2 PR)

- **PR-1 — 5탭 shell + 개요/팀원/성과/AI + `members` 로스터 백엔드**: 데이터 완비된 4탭 + 로스터 엔드포인트. 사용가능한 hub 완성. (팀원 탭 + 개요 미리보기 grid가 로스터에 의존하므로 묶음.)
- **PR-2 — 1:1·활동 탭 + 활동 백엔드**: 팀스코프 1:1/칭찬/주간일정/위임 (백엔드 3-4 신설/래핑).

각 PR: tsc0·lint0·Codex G1(플랜)+G2(구현)·e2e(스코프 가드)·Pixel Gate(프로토 side-by-side).

## 8. 테스트 (신규 엔드포인트)

- `members`: manager가 **본인 직속부하만** 반환(타 부서/타 법인 0)·EMPLOYEE 403·필드 shape·leaveUsage가 `LeaveYearBalance` 기반(DROP된 테이블 미참조).
- 활동(PR-2): 팀스코프 1:1/칭찬(타팀 0)·위임 self.
- Pixel Gate: `python3 -m http.server 8077 -d _design-reference` → team hub 5탭 side-by-side.

## 9. 리스크 / 함정

- **stale 참조(Codex G1 해소)**: leaveUsage는 `leaveUtilizationRate`/`annualBalanceWhere` + `LeaveYearBalance.{used,entitled}` 사용(DROP된 `EmployeeLeaveBalance`·미머지 `getLeaveBalanceYear`·`usedDays/grantedDays` 전부 금지) — §4.1 반영.
- work_date naive-tz off-by-one(`DateTime`, @db.Date 아님; rate.ts tz SQL 패턴) — [[hrhub-attendance-naive-timestamp-tz]], §4.1.
- 성과등급 공개 누수 — `PerformanceReview.notifiedAt` publication 게이트 필수(원시 emsBlock 금지) — §4.1, [[hrhub-perf-result-publication-gate]].
- 프로토 활동탭 데이터 전부 mock — 숫자 복사 금지, 실API/'준비중'.
- 헤더 액션 D1/D2 미결 시 구현 막힘 — 플랜 승인 시 동시 결정.

## 10. CEO 결정 필요

- **[범위]** 2-PR 분할(권장) vs 단일 대형 PR vs 3-PR(shell→members→activity 분리)?
- **[D1]** 1:1 예약 헤더 액션: manager-hub 내 WdDrawer 신설 vs `/performance` CFR 1:1 화면 연결?
- **[D2]** 팀 공지 헤더 액션: 실 타겟(알림 compose 연결) vs 이번 범위 deferred(버튼 노출하되 추후)?
- **[D3]** (Codex G1) members 로스터 팀원 정의 = same-company 직속부하(`getDirectReportIds`)로 확정. summary 헤드카운트는 cross-company(`getAllReportIds`)라 미세 불일치 가능 — (a) 그대로 수용(로스터=법인내, KPI=전체) vs (b) summary도 same-company로 통일 vs (c) 로스터에 cross-company 부하 포함(멀티테넌트 문구와 충돌). **권장 (a)** + KPI 라벨에 주석.
