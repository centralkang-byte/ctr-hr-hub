# Design Wave 1 — Payroll Hub (/payroll) Proto Fidelity

> **Date**: 2026-06-10 · **Session**: S282
> **Track**: Design Wave campaign — Wave 1 두 번째 페이지 (홈 = PR #148 머지 완료, "다음 Wave 1 타깃 = payroll(P0)")
> **Pixel SSOT**: `_design-reference/page-placeholder-real.jsx` `PayrollMgmtPage` (:19-213) + `styles.css` (`.wd-stat-strip`·`.page-h`·`.seg`·`.wd-section-h`·`.tbl`·chip 패밀리)
> **원칙**: 백엔드/API/데이터 무변경 — 시각 구조·토큰만 프로토 정합. 기능 후퇴 0 (클릭 내비·anomaly/approval 표시·alert 배너 보존).

## Scope

급여 허브 `/payroll` 1페이지 (PayrollClient + PayrollPipeline + PayrollCalendar + PayrollCreateDialog). 나머지 payroll 라우트(review·approve·simulation 등 ~9k LOC)는 Wave 1 후속 PR.

### Gap inventory (proto vs 구현, 2026-06-10 실측)

| # | Gap | Proto spec | Current | Fix |
|---|-----|-----------|---------|-----|
| 1 | 페이지 헤더 골격 | `.page-h`: h1 + greet-sub, right = `.seg` 월 네비(ChevL·라벨·ChevR) + `.btn-primary` "새 사이클" 마지막. **아이콘 타일 없음** | 그라데이션 아이콘 타일(`bg-gradient-to-br from-primary to-primary-dim` — Wave 0 금지 클래스) + 커스텀 월 네비 + refresh + create | 아이콘 타일 제거, seg 스타일 월 네비, 주 액션 마지막 배치. refresh 버튼은 기능 보존(ghost icon 버튼, proto에 없으나 실데이터 필요) |
| 2 | KPI ≠ wd-stat-strip | `.wd-stat-strip` 4카드: 헤더(ico+라벨)/큰 값+단위/풋(delta) — ss-green·ss-red·ss-amber 톤 | 자체 KpiCard(라벨+우측 원형 아이콘 칩, text-lg) | **`WdStatStrip` 공용 컴포넌트로 교체** (Phase 2 구현 완료, LeaveAdminClient 선례). 총 실수령액(delta 풋)·완료 법인(success)·이상 항목(danger)·결재 대기(warning). KPI 클릭 내비(global·anomalies·my/tasks) 보존 → WdStatStrip에 `onClick` additive 확장 (기존 소비처 무영향) |
| 3 | 파이프라인 시각화 | 법인행 × 단계 **셀 그리드**: STEP 헤더 박스(bg-sunk, mono STEP N + 라벨), 셀 32px (done=green tint+Check / current=alertLevel색 1.5px 보더+Clock / future=dot), **지급일 칼럼**(date+D-day), 푸터 범례 4종(완료/진행 중/주의/이상) bg-sunk 바 | pill 배지 그리드(rounded-full + 상태 텍스트 라벨), 지급일 칼럼 없음, 범례 = done/active/pending/not_started | 셀 그리드 전환. **기능 보존**: 셀 클릭 내비(getClickUrl)·anomaly 카운트 배지·approval step 표시는 셀 내부/타이틀로 유지. 지급일 칼럼 추가(dashboard API가 이미 payDay·dDayPay 반환). 범례 = 프로토 4종(완료/진행 중/주의=amber/이상=red) |
| 4 | 빠른 실행 | `.wd-section-h` + `grid-3` **가로형 행 버튼**(36px 아이콘 사각 tint + 라벨 + mono sub "STEP N" + ArrowR) **6종**: 근태 마감·이상 검토·결재 대기·수동 조정·은행 이체·명세서 배포 | 세로 중앙정렬 카드 4종(원형 아이콘 위) — 은행 이체·명세서 배포 누락 | 가로형 6종으로 확장. 은행 이체 → `/payroll/bank-transfers`(라우트 존재). 명세서 배포 → 파이프라인에서 APPROVED/PAID run 있으면 `/payroll/{runId}/publish`, 없으면 disabled(이유 tooltip) |
| 5 | 일정 테이블 | Card("N년 N월 일정"+sub) + `.tbl`: 법인(정식명 fw-6)/근태 마감(mono)/지급일(mono fw-6)/현재 단계(small)/상태(**chip** danger·warning·success·info)/**D-day(지급일 기준)** right mono tnum | 자체 헤더+커스텀 pill(emerald/amber 하드코딩), D-day = 마감 기준 | 프로토 칼럼 구조 + `Badge` variant(시맨틱). D-day 칼럼 = 지급일 기준(프로토). 마감 임박/지연 정보는 기존 경고 배너(마감 기준)가 보존 — 기능 후퇴 없음 |
| 6 | 새 사이클 생성 = 중앙 Dialog | rules/design.md Form: 단일 단계 입력 폼 = **WdDrawer** (모달→드로어 인벤토리 #20) | PayrollCreateDialog (Dialog) | **WdDrawer 전환** (로직 무변경, WdField+htmlFor, closeDisabled=제출 중). 파일명 `PayrollCreateDrawer.tsx` |
| 7 | 색 하드코딩 | proto chip/semantic 토큰 | `emerald-*`·`amber-*` 산재 (rules/design.md 위반) | 시맨틱 토큰(`tertiary`·`ctr-warning`·`wd-orange`·`destructive`)/Badge variant로 정리 — D17 bg/text 분리 준수 |
| 8 | dead code | — | `PayrollKpiCards.tsx` 소비처 0 (grep 전수) | 같은 트랙 부수 dead code 삭제 (결정 게이팅 메모리 — 트랙 내 제거) |

### Out of scope
- 다른 payroll 라우트 reskin (review·approve·close-attendance·simulation·global·year-end·adjustments·bank-transfers·anomalies·import·me) — Wave 1 후속
- `PayrollAdjustDialog`·`BankTransfersClient` Dialog→Drawer (각 페이지 reskin PR에서, 인벤토리 #13·#19)
- 파이프라인 단계 정의 변경 — 구현 6칼럼(조정 2.5 포함)은 기능 SSOT, 시각 형태만 프로토 셀 그리드로
- 다크모드(Phase 4)·⌘K·모바일 reflow(Phase 4)

## Implementation

### Files (예상 ~8 + i18n 5)
1. `src/app/(dashboard)/payroll/PayrollClient.tsx` — 헤더 골격·WdStatStrip 교체·빠른 실행 6종·일정 카드 래핑 (#1,#2,#4)
2. `src/components/payroll/PayrollPipeline.tsx` — 셀 그리드 + 지급일 칼럼 + 프로토 범례 (#3)
3. `src/components/payroll/PayrollCalendar.tsx` — 프로토 .tbl 구조 + Badge variant (#5,#7)
4. `src/components/payroll/PayrollCreateDialog.tsx` → `PayrollCreateDrawer.tsx` (#6)
5. `src/components/shared/WdStatStrip.tsx` — `onClick` additive (#2; LeaveAdminClient 회귀 확인)
6. `src/components/payroll/PayrollKpiCards.tsx` — 삭제 (#8)
7. `messages/{ko,en,zh,vi,id}.json` — 신규 키 additive only (bankTransfer·publishPayslip 빠른실행, 범례 라벨 등)
8. `e2e/flows/payroll.spec.ts` — 드로어 전환 셀렉터 갱신 (있는 경우)

### 검증 게이트
- `npx tsc --noEmit` 0 · `npm run lint` 0
- **Pixel Gate**: `python3 -m http.server 8077 -d _design-reference` → proto `payroll` 페이지 vs `/payroll`(hr@ctr.co.kr) side-by-side, 차이 분류 기록
- e2e: `e2e/flows/payroll.spec.ts` + visual `07-payroll.visual.spec.ts` 스냅샷 갱신(payroll 분만, 로컬 macOS 게이트)
- 멀티롤 smoke: hr@(주 사용자) + super@(전사 뷰) — EMPLOYEE는 /payroll 미들웨어 차단(무관)
- Codex Gate 2 (/verify)

## Codex Gate 1 반영 (2026-06-10, P0 0·P1 6·P2 3 — 전부 수용)

| # | Finding | Resolution |
|---|---------|-----------|
| P1-1 | publish 퀵액션 run 선택 모호 — 잘못된 run 배포 위험 | **선택 월 파이프라인에서 APPROVED/PAID + payrollRunId 보유 run이 정확히 1개**일 때만 직접 이동. 0개/복수 = disabled + **가시적 sub 문구**(복수면 "파이프라인에서 법인별 선택"). 복수 법인 케이스는 파이프라인 셀 클릭(법인별 publish 내비)이 이미 커버. PAID 포함 = 명세서 발행 멱등(S270 실증) |
| P1-2 | 파이프라인 상태 매핑 명세 부족 | 기존 시맨틱 전량 보존 매핑표: done(currentStep>col)=green tint+Check / active(col≤step)=alertLevel색(red=danger·amber=ctr-warning·normal=primary) 1.5px 보더+Clock / pending·not_started=dot. anomaly(col4 active·미해결)=셀 내 카운트 배지(wd-orange) / approval(col5 active)=step x/y 표기. 클릭 URL=기존 getClickUrl 무변경(done·active만 클릭 가능) |
| P1-3 | 클릭 KPI/셀 a11y (`div onClick` 금지) | WdStatStrip additive `onClick` 시 루트를 `<button type="button">`로 렌더(키보드·focus ring), 없으면 기존 `<section>`. 파이프라인 셀은 기존 `<button>` 유지 |
| P1-4 | 파이프라인 모바일 오버플로 | 기존 `overflow-x-auto + min-w` 패턴 유지(지급일 칼럼 포함 ~840px). visual spec 07-payroll 의 모바일 뷰포트 케이스 갱신에 포함 |
| P1-5 | payDay/dDayPay null 계약 | `PipelineEntry`에 `closingDeadline·payDay: string\|null`, `dDayClosing·dDayPay: number\|null` 정식 선언(`as unknown` 캐스트 제거), null 렌더 = `—`. 날짜 표시 Intl(locale) 기존 패턴 |
| P1-6 | Drawer 제출 중 닫힘 경로 | WdDrawer `closeDisabled`가 ESC·overlay·X 전부 차단(S277 구현 확인). `secondary.disabled=loading` + primary 중복 제출 가드. 드로어 e2e에 제출 플로우 가드 |
| P2-7 | 월 네비와 생성 폼 기준 월 불일치 | 드로어 기본 yearMonth = **선택 월**(현재 now 고정 → 선택 월 전달). KPI/파이프라인/캘린더는 이미 동일 선택 월 소비 |
| P2-8 | refresh가 상태 초기화하는지 | fetchDashboard는 재조회만 — 선택 월·드로어 상태 보존(확인됨) |
| P2-9 | disabled 이유 tooltip-only 금지 | publish disabled 사유는 행 버튼 sub 텍스트(상시 가시)로 표기 |

**검증 추가 (Gate 1)**: `npm run build` 1회(머지 전) · 파이프라인 not_started/null payDay/복수 법인 케이스 확인 · 5로케일 신규 키 완전성 · 비인가 role 차단 회귀(rbac e2e 기존 커버 확인) · 스냅샷 diff가 payroll 분에 한정되는지 git diff 검사.

## Codex Gate 2 반영 (2026-06-10, P0 0·P1 0·P2 3 — 전부 수용)

| # | Finding | Resolution |
|---|---------|-----------|
| P2-1 | 캘린더 "현재 단계"가 `STEPS[currentStep-1]` 인덱스 매핑으로 한 단계 밀림 (CALCULATING=3 → "수동 조정") | **status 기반 매핑** `STATUS_STEP_SUB_KEY`로 교체 (settings의 statusToStep 오버라이드에도 안전) |
| P2-2 | Dialog→Drawer 전환으로 Enter 키 제출 회귀 | 드로어 body를 `<form onSubmit>` 래핑 + hidden submit (foot 버튼은 form 밖) |
| P2-3 | 허브 외 라우트(adjustments·anomalies·global·simulation) visual 베이스라인 무단 갱신 — 회귀 승인 위험 | 허브 6장(3뷰포트×라이트/다크)만 남기고 revert |

## Pixel Gate 기록 (proto vs 구현, 1440px hr@)

**정합 확인**: page-h 골격(타이틀+seg 월네비+주액션 마지막)·wd-stat-strip 4카드·파이프라인 셀 그리드(done 체크/active alert색 보더/future dot/지급일 D-day/범례 4종)·빠른 실행 6종 가로형·일정 테이블(6칼럼+chip). super@ 12법인 다행 그리드·모바일 375px 1열 reflow·드로어 풀폭 확인.

**의도된 편차 (기록)**:
1. **주 액션 버튼 색**: proto는 `data-tone="friendly"`가 `.btn-primary`를 warm 오렌지로 오버라이드 → 구현은 navy(`BUTTON_VARIANTS.primary`). **전역 버튼 토큰 결정(Wave 0/DESIGN.md 관할)이라 이 PR에서 변경 안 함 — CEO 결정 필요** (오렌지 부재 클래스와 동일 축).
2. KPI 값이 합성 문자열("1 / 1개") — proto는 단위만 축소 표기. i18n(5로케일 ICU) 단순성 우선.
3. 단계 헤더 "1단계"(기존 i18n 키) vs proto "STEP 1" — 로케일 정합 우선.
4. 빠른 실행 라벨 "승인 대기"(기존 키 보존, proto "결재 대기")·STEP 번호는 내부 단계 체계(은행 이체/명세서 배포 모두 STEP 5; proto는 5/6).
5. 범례가 카드 내 top-border 행 — proto는 full-width 풋터 바.

### 함정
- `messages/*.json` 키 추가만 (기존 키 편집/삭제 FORBIDDEN)
- Sidebar/MobileDrawer/navigation.ts 동결 — 미접촉
- visual 베이스라인은 payroll 분만 갱신 (전수 재생성은 wave당 1회 원칙 — Wave 1 홈 PR에서 완료)
- 파이프라인 클릭 내비·anomaly ring·approval pulse 기능은 시각 전환 후에도 동작 보존 (e2e로 가드)
- dashboard API 응답에 payDay/dDayPay가 PipelineEntry 타입에 미선언(현재 `as unknown` 캐스팅 — PayrollClient:163-166) → 타입 정식 선언으로 정리 (API 무변경)
