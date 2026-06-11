# Wave 1 — 급여 simulation + /payroll/me 묶음 프로토 정합

> 세션: S287 (2026-06-11) · 브랜치 `design/wave1-payroll-sim-mypay` (base d3b94377)
> 감사: 4-agent 갭 감사 + 48건 적대 검증 전건 통과 (워크플로 wf_9e66282d-f19, 상세 = /tmp/wave1-gaps-full.md)
> 원칙: **프로토 = 픽셀 SSOT, 기능 절대 보존** (현 구현이 프로토보다 풍부한 기능 = 갭 아님)

## 대상

| 페이지 | 프로토 | 현 구현 | 갭 |
|---|---|---|---|
| `/payroll/simulation` | `page-payroll-sim.jsx` (1:1) | 11파일 3,209줄 | SIM-1~17 + X 다수 |
| `/payroll/me` | `page-my-space.jsx:382-510` (1:1) | 176줄 | ME-1~11 |
| `/payroll/me/[runId]` + `PayStubBreakdown` | 패턴 단위 (#153 컨벤션 + 프로토 명세서 카드) | 320+264줄 | STUB-1~10, X-1(P2) |

## Workstream A — simulation (구현 에이전트 A)

1. **헤더·골격** (SIM-4): 래퍼 `mx-auto max-w-7xl p-4 space-y-4`(hub 미러), 56px 아이콘 타일(`h-14 w-14 rounded-[14px]` primary-container 계열), `TYPOGRAPHY.pageTitle` + 13px 부제. 우측 시나리오/저장/Excel 3액션 보존, `BUTTON_VARIANTS` 토큰화(SIM-11).
2. **모드 탭바** (SIM-1, P0): 커스텀 navy-fill 토글 → **Radix Tabs + TAB_STYLES** (세그먼트, DESIGN.md §5.5 — 프로토 언더라인 탭은 §5.5 금지라 채택 안 함). **Codex G1: TabsList만 쓰지 말고 6모드 전부 `TabsContent` 패널 연결 + `value={mode}`/`onValueChange` 제어 모드**. 모드 전환 시 `result`·`compareData`·`expandedRow`·에러 상태 일괄 정리. `aria-label` 필수.
3. **결과 카드 구조** (SIM-5, P0): naked 4카드 그리드 → 단일 결과 카드 + CardHead(title + 'N명 대상' sub) + kpi-grid. **4번째 지표(공제 변동) 유지 = 의도적 편차**(cols-3 프로토 대비, Pixel Gate에 기록). KPI 수치 = 프로토 스케일 + `tabular-nums` + 1px 보더.
4. **빈/로딩 상태** (SIM-2): 결과 패널 빈 상태 → `EmptyState` standalone size="lg" (레퍼런스 PayrollReviewClient.tsx:653). 결과-존재 분기는 카드 중첩 금지(검증자 교정). **Codex G1: 로딩은 EmptyState 금지 — skeleton 또는 `role="status" aria-live="polite"` 스피너 유지** (EmptyState = 진짜 빈 결과 전용).
5. **BULK 결과 비교 차트** (SIM-7, **Codex G1 P1 교정**): 프로토의 12개월 추이는 적용월 입력이 없는 현 API에선 가공 데이터(특히 bonusMonths는 일시금인데 월 반복으로 보임) → **'현재 월 vs 시뮬레이션 월' 2-막대 정직 비교로 축소**(recharts + CHART_THEME). 프로토 12-bar 대비 의도적 편차로 Pixel Gate 기록. 파생 로직 = 순수 헬퍼 추출.
6. **레이아웃** (SIM-8): 좌측 350px flex → 프로토 `320px+1fr` 그리드.
7. **색·토큰** (SIM-9, X-1, X-2): raw 팔레트 → 시맨틱 치환표 (red→destructive, emerald→tertiary/`text-[#006b39]`, amber 텍스트→ctr-warning, bg→`bg-warning-bright/15`·`bg-tertiary/10`). 히스토그램 범례-막대 색 일치(X-2).
8. **FxTab 국기 이모지 제거** (SIM-3): 통화코드 font-mono 텍스트만. (타 4파일 동일 패턴 = 별도 칩)
9. **기타**: ScenarioListSheet 모드 필터 pill radiogroup+`useArrowKeyNavigation`(SIM-14, X-5), 죽은 EmptyState 제거(SIM-15, X-6), ScenarioCompareView 타이포 토큰(SIM-16), 입력 카드 hover lift 제거(SIM-12), fragment key(SIM-15), 하드코딩 '만' 단위 i18n화(SIM-10, X-4), stale violet 주석 정리(X-7).

## Workstream B — /payroll/me (구현 에이전트 B)

1. **page-h 골격** (ME-3, P0): 아이콘+`text-2xl bold` → `TYPOGRAPHY.pageTitle` + greet-sub(미열람 N건 = wd-orange ink 강조 / 0건 = 안내 카피). 우측 = **연도 select**(클라 필터, 프로토 헤더 우측 슬롯 — 추가 기능이지만 프로토 명시 요소). **Codex G1 P1: hero·12개월 차트·전체 건수·그리드·전월 비교(MoM) 전부 동일 `filteredItems` 단일 소스에서 파생** — 연도 섞임 금지. (MoM 비교는 필터 무관 인접월이 더 정직하므로 hero/그리드 표기 시 전체 items 기준 인접월 사용 여부를 코드 주석으로 명시)
2. **최근 명세서 hero 카드** (ME-1, P0): `lg:grid-cols-[2fr_1fr]` 좌측. 3열 대형 수치(총지급/공제 destructive/실수령 primary) 22px font-mono tabular-nums + 11px uppercase 라벨 + PDF 버튼(기존 `/api/v1/payroll/me/${runId}/pdf` 재사용). **Codex G1 P1: PDF API는 PAID만 지원, 목록엔 APPROVED 포함 → 버튼은 `paidAt` 존재 + `payslipAvailable!==false` 둘 다 충족 시에만 노출**. 수당 breakdown 행 = 목록 API에 detail 없으므로 **생략**(mock 서사 날조 금지 — 의도적 편차 기록).
3. **12개월 추이 카드** (ME-2, P0): 우측. items 최근 12건 netPay div 막대(grid-cols-12, 최신=primary, 과거=primary-container 계열). 12건 미만이면 있는 만큼. 하단 정기 인상 각주 = 데이터 없음 → 생략.
4. **전체 명세서 섹션 헤더** (ME-8): `TYPOGRAPHY.sectionTitle` + 'N건' sub.
5. **카드·배지** (ME-5, ME-6, ME-9): NEW 배지 navy→accent 칩(Badge variant), 지급완료→variant="success", 'NEW' 리터럴 i18n(X-8), 금액 mono+tabular-nums, hover lift, 실수령 위 구분선.
6. **빈 상태** (ME-4): 수제 div → EmptyState. 도달 불가 EmptyState 죽은 코드 삭제.
7. **토큰·타이포** (ME-7, ME-10): emerald/amber→시맨틱, 래퍼 p-4 max-w-7xl 정렬.

## Workstream C — /payroll/me/[runId] + PayStubBreakdown (구현 에이전트 C)

1. **헤더** (STUB-1, P0): #153 [runId] 3페이지 컨벤션 미러, icon-only 백버튼 `aria-label`.
2. **3-스탯 요약 행** (STUB-2): 프로토 명세서 카드 시그니처(총지급/공제/실수령) 추가.
3. **타이포·토큰** (STUB-3, 4, 7, 8): 금액 mono+tabular-nums, emerald/red→시맨틱, radius·밀도 Wave 1 payroll 컨벤션, TYPOGRAPHY 상수.
4. **빈/에러 상태** (STUB-5, 6): EmptyState 적용, **빈 catch 2곳 → toast destructive**(error-handling 규칙), 다운로드 실패 무반응 해소. **Codex G1 P1: fetch 에러 시 `items=[]` 유지하면 notFound로 변질 → loading/error/empty 3분법 상태 분리**(components 규칙).
5. **날짜 표시** (STUB-9, X-9): raw ISO split → `formatToTz`(timezone.ts).
6. **normaliser SSOT 교체** (X-1 P2, **별도 커밋**): SSOT(normalise-detail.ts)에 `otherDeductions ?? 0` + 숫자 가드 흡수 → 로컬 사본 삭제·import 교체. **Codex G1 P2: "무영향" 단정 금지 — malformed 숫자 동작이 실제로 바뀜. `Number(x)||0` 대신 `Number.isFinite()` 기반 헬퍼 + 단위테스트 fixture(engine/legacy/already-normalised/NaN/otherDeductions) 동반 필수.**
7. STUB-10(PDF 라벨 vs .html): 라벨은 프로토와 동일 'PDF' 유지, **백엔드 PDF 정상화 = 별도 트랙 칩**.

## 횡단 규칙

- **i18n 단일 소유자** = 오케스트레이터(나). 에이전트는 `t('...')` 호출 + 필요 키 목록·ko 값(친근톤)만 반환, messages/*.json 5로케일 append는 내가 일괄. **기존 키 편집 금지**. ko 격식체 카피 친근톤 전환(SIM-13, ME-11)은 **값만** 수정. **Codex G1 P2: N명/N건/미열람 수량 문구는 문자열 결합 대신 ICU plural/{count} 변수 키 — 5로케일 변수명 동일 검증.**
- **Codex G1 P2 (모바일·차트 a11y)**: recharts 래퍼 `min-w-0` + 명시 높이(375px 0폭 방지), div 막대 차트에 접근 라벨/텍스트 요약, 헤더 3액션 모바일 wrap 확인.
- 동결 파일(Sidebar/MobileDrawer/navigation.ts) 불가침. PROTECTED 헤더 파일 불가침.
- 죽은 코드는 같은 트랙 제거 원칙(feedback-decision-gating) — 도달불가 EmptyState 3곳.
- API·prisma·lib 무변경 (예외: normalise-detail.ts 슈퍼셋 가드 흡수 1건 — Workstream C 별도 커밋).

## 검증 게이트

1. Codex Gate 1 (이 플랜) → 반영
2. 구현 → `npx tsc --noEmit` 0 · `npm run lint` 0
3. **Pixel Gate**: `python3 -m http.server 8077 -d _design-reference` 프로토 vs 구현 side-by-side (sim·me 1:1, stub 패턴 단위). 의도적 편차 기록: ① sim KPI 4지표(프로토 3) ② me 수당 breakdown 행 생략 ③ me 정기인상 각주 생략 ④ stub 1:1 프로토 부재.
4. UI QA 멀티롤: super@ + employee-a@ (me 페이지는 employee 시점이 본선) · 375px
5. e2e: 기존 my-space·golden-path 회귀 + simulation/me 스모크 가드 신설
6. Codex Gate 2 → /wrap-up (PR + STATUS.md)

## Out of scope (칩/이연)

- 백엔드 PDF 산출 정상화(STUB-10) · 국기 이모지 타 4파일(GlobalPayrollClient 등) · KPICard 전역 통합(SIM-6은 sim 내부만 정리) · 다른 payroll 잔여 라우트(anomalies·year-end·import·global 등) Wave 1 후속
