# Phase 2 Close-out — HR Hub 디자인 마이그레이션 핵심 컴포넌트

> 작성: 2026-05-18 (Session 225+). 브랜치 `refactor/hr-hub-phase2` `61882a22`.
> 선행: Phase 1 (Workday Navy 토큰) PR #54 머지 → `main` `4a7909a8`.
> SSOT 계획: `docs/plans/active/2026-05-18-phase2-core-components.md`.
> 본 문서 = Phase 2 종료 기록 + Phase 3a 진입 prerequisites.

## 1. 범위와 원칙 (재확인)

Phase 1이 색·radius·shadow **토큰**을 Workday Navy로 교체(shadcn 시맨틱
자동 전파). Phase 2는 (P0) Phase 1 이월 잔존 violet 정리 + (P1) 시그니처
컴포넌트 패턴 이식 + (P2) 도메인색을 Workday `--wt` 팔레트 SSOT로 통합.

불변 원칙: 백엔드(prisma/API/lib/middleware/RLS) 미변경 · i18n 키 추가만
허용 · 다크모드는 부분 취급(별도 다크 Phase 이월) · DO NOT TOUCH 준수.

## 2. P0 — Phase 1 이월 잔존 (완료)

| 항목 | 커밋 | 결과 |
|---|---|---|
| P0-1 ui/sheet·dialog 하드코딩 섀도우 토큰화 | `83c5f1bb` | violet-indigo 리터럴 → `shadow-primary-tinted`(navy) |
| P0-2 (축소·확정) | `83c5f1bb` | `ctr-primary` var 전환 **철회**(13파일/11곳 다크 흰글자 회귀) → Phase 1 고정 navy 유지. `ProfileSidebar` 아바타 `text-[#003953]`(양모드 AA 8.82)만 선반영 |

이월: `text-ctr-primary` 다크 가독성·레거시 토큰 bg/fg 분리 = 별도 다크 Phase.

## 3. P1 — 시그니처 컴포넌트 7건 (완료)

| # | 컴포넌트 | 커밋 | 카나리 | 핵심 결정·known-deferred |
|---|---|---|---|---|
| P1-1 | WdStatStrip (4-card KPI) | `074d3604` | leave/admin | ss-card variant → Phase1 토큰 매핑 |
| P1-2 | WdStatusChips (인라인 칩) | `6116d82b` | employees | tone accent/warn/danger/success/zero |
| P1-3 | WdSummaryLead (요약 문장형) | `13ae2cbb` | performance/cycles | 신규 hex 0, foreground/destructive 토큰만 |
| P1-4 | EmptyState 정합 | `a1392064` | 82 사용처 | props 정합(icon/title/sub/action/size/standalone) 후방호환 |
| P1-5 | WdDrawer 정합 | `77762bf0` | leave | 현 Sheet 기반 래퍼 매핑. **다크 lavender** primary 버튼(known-deferred) |
| P1-6a | EmployeeMiniCard | `e69a4f22` +hotfix `a1940fa3` | /org DirectoryView | HoverCard, 3 icon-only 액션·빈행 제거 |
| P1-6b | EmployeeInspector | `cc51ddc9` (결정문 `ee40e2de`) | EmployeesPage | **α: dead ApprovalInbox 아닌 라이브 DetailPanel 인플레이스 리스킨**. 순수 표현 컴포넌트, slide chrome=기존 DetailPanel 재사용. **다크 lavender** CTA(known-deferred) |
| P1-7 | BulkActionBar | `e887b969`→재타겟 `5539ffd6`→E2E `3b409a99` | shared/approval/BulkApproveBar | dead ApprovalInboxClient(One Hub 리다이렉트) 발견 → 라이브 BulkApproveBar 리스킨. E2E 3 passed(롤별). **다크 lavender** primary(known-deferred) |

전건: tsc 0 · lint clean · Codex Gate 2 HIGH 0 · 카나리 라이트 풀 + 다크 스모크.

## 4. P2 — 도메인색 Workday wt SSOT 통합 (완료, 3분리)

`--wt-1~8` = `globals.css :root`(라이트만, oklch→getComputedStyle 권위적 변환,
F1 swatch 사용자 승인). tailwind `wt.1~8`/`chart.1~6` 매핑. 다크 wt 미정의 =
known-deferred 합류.

| 단계 | 커밋 | 통합 대상 | 비고 |
|---|---|---|---|
| P2a-status | `1956d9e1` | `status.ts` info→`hsl(var(--wt-7))` steel / accent→`hsl(var(--wt-4))` purple | badge.tsx `dark:` 폴백으로 다크 회귀 0. info 명도+18%p |
| P2a-avatar | `e9251022` | `wt-avatar.ts` `wtAvatarColor(id)`(charCodeSum%8 안정해시) + `wtDeptColor(idx)`, `WT_ORDER` 교차순 | DirectoryView/DeptFlowNode `AVATAR_PALETTE` 제거. 같은 직원=어디서나 같은 색 |
| P2b-chart | `61882a22` | `chart.ts` SSOT + `chart-colors.ts` @deprecated shim | 아래 §4.1 상세 |

### 4.1 P2b-chart — N1 색 매핑 표 (M1: Codex Gate 2 보정 반영)

**보정 이력 (디자인 결정 갱신)**: P2b 착수 시 원안 매핑은 카테고리 10색
전부 wt로 리맵(원안: idx2→wt-5 forest / idx3→wt-6 gold / idx4→wt-4 purple).
Codex Gate 2 1차 리뷰가 **P2 의미색 회귀**를 catch — `CHART_THEME.colors[N]`을
다수 소비처가 **위치 고정 의미색**으로 사용 중임을 발견:
- `CompaRatioTab` idx4=위험적색·idx3=저보상황색·idx2=적정녹색 + ReferenceLine 경고
- `SuccessionDashboard` READY_NOW=idx2(녹) · `AttritionTrend/Radar`·`predictive`
  turnoverRisk·`EmployeeRiskDetail`·attendance absent_count = idx4(적) 위험 인코딩

블랭킷 리맵은 사용자 **Q3 "의미색 유지" 원칙**(RISK/HEATMAP/STATUS
success-warning-danger 보존 결정)과 모순. 원안 매핑표는 "차트색=순수 카테고리"
라는 **틀린 전제** 하에 도출됨. → **보정**: idx 2/3/4 = 시맨틱 hex 보존,
순수 카테고리 idx만 wt 통합. 2차 Codex Gate 2 clean.

| series idx | 기존 hex | 결정 | 결과 색 |
|---|---|---|---|
| 0 | `#6366f1` violet | `--wt-1` 카테고리 | navy `#004964` |
| 1 | `#a5b4fc` violet-lt | `--wt-3` 카테고리 | terracotta `#c25237` |
| 2 | `#16a34a` green | **보존** 의미색 success | `#16a34a` (불변) |
| 3 | `#f59e0b` amber | **보존** 의미색 warning | `#f59e0b` (불변) |
| 4 | `#e11d48` rose | **보존** 의미색 danger | `#e11d48` (불변) |
| 5 | `#64748b` slate | `--wt-2` 카테고리 | teal `#007866` |
| 6 | `#7c3aed` purple | `--wt-8` 카테고리 | coral `#b3505b` |
| 7 | `#0ea5e9` sky | `--wt-7` 카테고리 | steel `#2c6194` |
| 8 | `#84cc16` lime | `--wt-1` 순환 | navy (재사용) |
| 9 | `#f97316` orange | `--wt-3` 순환 | terracotta (재사용) |

불변(미적용): `axis`/`grid`/`tooltip`/`legend`/`responsive`, `CHART_COLORS`
grid/text/background/danger/warning/success/neutral, `RISK_COLORS`,
`HEATMAP_COLORS` — HEAD와 byte-identical 검증. 죽은 코드 `CHART_THEME_DARK`/
`CHART_COLORS_DARK`(소비처 0) 제거 → 제거 = 다크 회귀 0 증명.

### 4.2 M2 — 시맨틱 ↔ 카테고리 이종 배열 가이드라인 (영구)

`CHART_THEME.colors`(및 `CHART_COLORS.secondary`)는 **혼합 배열**이다:
idx 2/3/4 = 의미색(success/warning/danger 위치 고정), 나머지 = wt 카테고리.
미래에 차트 색을 추가할 때:

- **시맨틱 의미 필요**(좋음/나쁨·위험도·합격/탈락 등): idx 2/3/4 슬롯을
  쓰거나, 더 명확히는 `RISK_COLORS`(low/medium/high/critical) ·
  `HEATMAP_COLORS`(녹→황→적 스펙트럼) · `status.ts` 시맨틱 토큰을 직접 사용.
  새 시맨틱 색을 카테고리 배열 다른 idx에 끼워 넣지 말 것.
- **단순 카테고리**(시리즈 구분만): wt 슬롯 확장. 현재 0/1/5/6~9가 wt이며,
  `wtSlotColor(10..)`는 `WT_ORDER` 교차순으로 자동 순환 — 그대로 사용.
- 동일 가이드 요약이 `src/lib/styles/chart.ts` 헤더 주석에도 명시됨(상호 참조).

## 5. N1/N2 표준 정착 위치 (사전커밋)

| 표준 | 커밋 | 위치 |
|---|---|---|
| P1-7+ 카나리 표준 (N1 7레이어 / N2 E2E) | `5b63e2d9` | `CLAUDE.md` "## 카나리 작업 표준" |
| P2 토큰통합 트랙 변형 (N1 색매핑표 / N2 시각회귀 3축 / 변환 수동금지·swatch 사전보고) | `71ee4786` | `CLAUDE.md` "### P2 토큰통합 트랙 변형" + `DESIGN_RULES.md` §13 인근 |
| Phase 3 작업 표준 (Q1 P0~P3 / Q2 4단계게이트+3경량화 / Q3 case-by-case) | `838ee2bd` | `CLAUDE.md` "## Phase 3 작업 표준" |

## 6. known-deferred 보드 (별도 다크/폴리시 Phase 일괄 해소)

- **다크 lavender 3건**: P1-5 WdDrawer / P1-6b EmployeeInspector / P1-7
  BulkActionBar primary 버튼 — 공통 근인 `.dark --primary`(indigo) 미마이그레이션.
  컴포넌트는 토큰 올바르게 소비 = 회귀 아님.
- **`--primary-dim` navy-ink SSOT 통합 후보**: 15+ 소비처(Sidebar/button/
  KpiCard/OffCycle/MyProfile 그라디언트 등) = wt와 별도 navy-ink 체계.
  Phase 4 폴리시 또는 다크 Phase 진입 시 wt SSOT 통합 검토.
- **`chart-colors.ts` @deprecated shim**: 차트색 SSOT는 `lib/styles/chart.ts`로
  통합 완료. shim(소비처 8개 무변경 재export)은 Phase 3 페이지 마이그레이션
  트랙에서 import 경로를 `@/lib/styles/chart`로 정리하며 자연 제거.
- **(M5) 스테일 빌드 아티팩트 정리 — 별도 트랙**: `.next/types/routes.d 2.ts`·
  `validator 2.ts` 등 `" 2.ts"` 접미 중복(perms `-rw-------`, 구 타임스탬프)이
  `tsc --noEmit`에 Duplicate identifier 노이즈 유발. P2b 무관 dev 환경 이슈.
  스테일 아티팩트 정리 + `.gitignore`/tsconfig exclude 검토 = 별도 트랙.

## 7. 별도 트랙 누적 (Phase 2 무관·독립 진행)

- **P1-6c MiniCard/Inspector i18n 라벨 채움**: 임시 영문 → messages 신규 키
  5locale 추가 + caller prop 노출. 3건: (가) MiniCard 액션 aria-label
  (나) Inspector quick-actions aria-label (다) Inspector 섹션 라벨
  (BASIC INFO/QUICK STATS/Recent Activity). Codex P3 추적, 코드 주석 명시.
- **D4 EmployeesPage 다중선택 UI 신규**: 공유 `DataTable` rowSelection 도입 +
  광범위 회귀 audit 동반 = 시그니처 범위 초과. 색과 무의존, 순서 제약 없음.
- **별도 다크모드 Phase**: 레거시 `ctr-primary` bg/fg 분리(13파일/11곳) ·
  `text-ctr-primary` 다크 가독성 · 아바타 전수 통일 · `.dark` 팔레트(`--primary`
  indigo) 재검토. 검증 = 라이트·다크 양모드 전 surface WCAG AA, 회귀 0.

## 8. Phase 3a 진입 Prerequisites (표준 `838ee2bd`)

페이지별 적용은 Phase 3. Phase 3a는 audit부터:

- **Q1 — 차등 우선순위**: 모든 기능이 최종 목표, 인도 단위만 분할.
  - P0 = 매일 핵심 워크플로(입사·퇴사·조직변경·휴가·근태·급여 기본).
    P0 완료 = 실 운영 가능 마일스톤.
  - P1 = 주요 HR(평가·1:1·온보딩·리뷰 사이클·근속)
  - P2 = 리포팅·분석·인사이트(대시보드·KPI·차트·익스포트)
  - P3 = 운영도구·세팅·고급(권한·시스템 설정·특수 케이스)
  - Phase 3a audit → 페이지별 기능 list 추출 → CC가 P0~P3 추정 → 사용자 확정.
    우선순위 완료마다 라이브 사용·피드백 → 재조정 가능.
- **Q2 — 하이브리드 4단계 게이트 + 3 경량화** (상세 = CLAUDE.md §Phase 3 표준)
- **Q3 — case-by-case (운명 카드)**: 페이지별 리스킨 vs 재구축 판단.

## 9. Phase 2 → main PR 게이트 (다음 단계)

- **(M3) 카나리 라이브 시각 검증 1회 재시도**: PR→main 머지 직전 gstack 인증
  복구를 1회 시도 → `/analytics/workforce` 라이트 PNG 캡처(idx 0~5 시각 확인).
  인증 여전히 불안정 시 **SSOT 단언으로 최종 갈음**(P2a 패턴 동일,
  코드구조+computed-style 정량, 조작 금지).
- **(M4) 8+ 시리즈 페이지 추가 캡처 미실행**: A1에서 명시한 "법인 비교 차트 등"
  8+ 시리즈 동시 노출 페이지 추가 캡처는 본 트랙 미실행. 인증 복구 후
  **P3 페이지 마이그레이션 트랙에서 자연 확보** (idx 6~9는 동일 wtSlotColor
  SSOT 경유라 자동 적용 — 기능 정확성은 SSOT 단언으로 보증됨).
- 검증 통과 시 Phase 2 단일 PR 생성 → `main` 머지 → Phase 3a 사전커밋
  (Q1/Q2/Q3 표준 이미 `838ee2bd`) → Phase 3a audit 착수.
