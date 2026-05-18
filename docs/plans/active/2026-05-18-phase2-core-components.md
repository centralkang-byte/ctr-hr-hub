# Phase 2 — 핵심 컴포넌트 (HR Hub 디자인 마이그레이션)

> 선행: Phase 1 (Workday Navy 토큰) — PR #54 머지 완료 (`main`, squash 2026-05-17).
> 컨벤션: `CLAUDE.md` §Design Refactor. 각 Phase 별도 브랜치/PR.

## Context

Phase 1에서 색상·radius·shadow **토큰**을 Workday Navy로 교체해 shadcn 시맨틱
토큰으로 자동 전파시켰다. Phase 2의 목표는 `_design-reference/` 프로토타입의
**시그니처 컴포넌트 패턴**을 현 shadcn 기반 위에 구현해, 페이지들이 Phase 3에서
재사용할 공통 빌딩블록을 마련하는 것이다. 더불어 Phase 1에서 `src/components/ui/*`
가드·도메인 SSOT·DO NOT TOUCH로 **의도적으로 미룬 잔존 violet**을 정리한다.

원칙(불변): 백엔드(prisma/API/lib/middleware/RLS) 미변경. 다크모드는 Phase 2에서
부분 취급(아래 P0-2 한정). i18n 키 추가만 허용·기존 키 편집 금지.

## 작업 항목 (우선순위)

### P0 — Phase 1 이월 잔존 (가장 먼저)

**P0-1. ui/sheet·dialog 하드코딩 섀도우 토큰화** (Phase 2 첫 작업)
- `src/components/ui/sheet.tsx:34`, `src/components/ui/dialog.tsx:41`
  `shadow-[0_20px_40px_-5px_rgba(74,64,224,0.06)]` (violet-indigo 리터럴)
- → `shadow-primary-tinted` (Phase 1에서 navy `rgba(0,73,100,0.06)`로 이미 정의됨)
  토큰 클래스로 치환. `sm:rounded-2xl`은 Phase 1 radius(12px) 자동 적용 — 확인만.
- 검증: Dialog/Sheet 열어 그림자색 navy, 콘솔 0.

**P0-2. (축소·확정 — 2026-05-18)** 토큰 var 전환은 **철회**.
- 시도했던 `ctr-primary*`→`hsl(var(--…)/<alpha-value>)` 전환은 원래 좁은 버그
  (`text-ctr-primary` 다크 카드 1.39:1)는 고쳤으나, `bg-ctr-primary`+흰글자
  **13파일/11곳**(로그인 패널·주요 버튼·챗봇)이 다크에서 흰글자 on #818cf8 = 2.95:1
  **광범위 신규 회귀**. → **전면 철회**, `ctr-primary` 계열은 Phase 1 고정 navy hex 유지.
- **남긴 것(축소 P0-2)**: `ProfileSidebar` 아바타 2곳 `text-ctr-primary`→`text-[#003953]`
  (DESIGN.md 예외① WCAG AA text). 토큰 고정 상태에서 #003953 on #bedded =
  **라이트·다크 모두 8.82:1 AA**. 토큰값 변동과 무관하게 견고.
- **무회귀**: 토큰을 Phase 1 고정값으로 되돌렸으므로 13파일/foreground 11곳은
  main 대비 **변경 0 = 회귀 0**.
- **미해결·이월**: `text-ctr-primary` 다크 카드/로더 가독성(1.39), `EmployeeDetailClient`
  아바타 등 레거시 토큰 이중용도(bg/fg 분리 설계). 다크 본격 범위.

### 별도 다크모드 Phase (Phase 2 이후 이월)
다크모드 전면 재설계는 본 마이그레이션 범위 밖 — 후속 전담 Phase에서 통합 처리:
- 레거시 `ctr-primary` 계열 bg/fg 분리(예: `bg-primary text-primary-foreground`
  패턴 정착) — 영향: `bg-ctr-primary`+흰글자 **13파일/11곳**
- `text-ctr-primary` 다크 카드·로더 가독성(1.39:1) 정합
- 아바타 전수(`bg-ctr-primary-light`+text) — `ProfileSidebar`(이번 선반영) 외
  `EmployeeDetailClient.tsx:161` 포함 일괄 통일
- `.dark` 팔레트 자체(`--primary` indigo 등) 적정성 재검토
- 검증 기준: 라이트·다크 양모드 전 surface WCAG AA, 회귀 0

### P1 — 시그니처 컴포넌트 (shadcn 위 구현)

`_design-reference/`의 패턴을 shadcn 컴포넌트로 이식. 신규는 `src/components/shared/`
(또는 도메인 폴더), `ui/*`는 최소 확장만. `DESIGN_RULES.md` §3·§5 준수.

| 컴포넌트 | 프로토타입 소스 | 비고 |
|---|---|---|
| `WdStatStrip` (4-card KPI) | `.wd-stat-strip` / `.ss-card` (styles.css) | 색 variant: ss-card/green/amber/red/purple → 토큰 매핑 |
| `WdStatusChips` (인라인 칩) | `.wd-status-chips` / `.sc` | tone: accent/warn/danger/success/zero |
| `WdSummaryLead` (요약 문장형) | `.wd-summary-lead` | 성과 사이클류 |
| `EmptyState` 정합 | `ui.jsx EmptyState` + `.empty.standalone/.lg/.sm` | 현 프로젝트 EmptyState와 props 정합(icon/title/sub/action/size/standalone) |
| `WdDrawer` 정합 | `wd-drawer.jsx` (`WdField/WdRow/WdSectionH/WdNote`) | 현 Sheet 기반 래퍼로 매핑 |
| `EmployeeInspector` / `EmployeeMiniCard` | `inspector.jsx` | 우측 슬라이드 + hover 미니카드 |
| `BulkActionBar` | `inspector.jsx` `BulkActionBar` | sticky 하단, 체크박스 컬럼 연동 |

- KPI 패턴 사용 규칙(A 스트립 / B 칩 / C 요약 / D hero / E 제거)은
  `_design-reference/DESIGN_RULES.md` §3 표를 SSOT로 따른다.
- 각 컴포넌트: Storybook 부재 → 실제 사용 페이지 1곳에 시범 적용 후 스냅샷.

### P2 — 도메인 색상 SSOT를 Workday wt 팔레트로 통합 (P1 다음, 5단계)

**결정 (사용자 2026-05-18)**: 도메인 하드코딩 색을 Workday `--wt-1`~`--wt-8`
워클릿 팔레트로 **통합**. 근거: wt 팔레트가 애초에 데이터 distinguishable 설계 →
일관성+식별성 동시 만족, Workday 톤 일관성 선호. (DESIGN.md의 "도메인색 분리"
원칙은 본 결정으로 상위 갱신 — wt 팔레트가 곧 도메인 식별 팔레트가 됨.)

먼저 `src/app/globals.css`에 `--wt-1`~`--wt-8`(+필요시 `--chart-3..6` 정합)을
Workday wt(oklch, `_design-reference/styles.css` L579-586) → HSL 변환해 추가하고,
tailwind에 매핑. 그 위에서 소비처를 토큰 참조로 전환:
- `src/lib/styles/chart.ts` — `colors`(6색) → wt-1~wt-6 매핑
- `src/components/analytics/chart-colors.ts` — primary/secondary 배열 동일 정렬
- `src/lib/styles/status.ts` — `info`/`accent` → Workday accent 토큰
- `src/components/org/DirectoryView.tsx`·`DeptFlowNode.tsx` — wt 팔레트 유사색
- `src/app/(dashboard)/my/total-rewards`(차트 stroke),
  `src/components/home/primitives/InsightStrip.tsx`·`StatCard.tsx` — wt 매핑
- WCAG AA 유지(D17): bg/text 분리 토큰 깨지지 않게 검증
→ 인사이트 페이지 실사용 색은 Phase 3에서 재평가.

### P1-6b 아키텍처 결정 (α 채택, 2026-05-18)

레퍼런스 `inspector.jsx`가 Radix Sheet가 아닌 **커스텀 backdrop+slide**이고,
EmployeesPage에 이미 `shared/DetailPanel`(커스텀 slide, role=dialog,
aria-label=직원명) + `EmployeeQuickPanel`(/api fetch) + onRowClick·URL
deeplink가 작동 중 → **α: DetailPanel 인플레이스 리스킨** 채택.
EmployeeInspector = 순수 표현 컴포넌트(banner/quick-actions/KV/quick-stats/
activity=EmptyState)만, slide chrome은 기존 DetailPanel 재사용.
**Q3(Sheet 기반) → 본 결정으로 상위 갱신** (오정보 기반이었음).
파생: sheet.tsx 무변경 → **A3(⑧ 회귀 스모크)·A4(SheetTitle) 불요**.
`shared/DetailPanel` 소비처 = EmployeeListClient 단 1곳(폭 조정 회귀
위험 0), 호출부에서 `w-[min(480px,92vw)]` 주입(레퍼런스 정합).

### 후속 트랙 (P1-6 파생)

- **P1-6c — MiniCard/Inspector 액션 i18n 라벨 채움**: P1-6a-hotfix에서
  EmployeeMiniCard 액션 Message/1:1 aria-label이 임시 영문(messages 키
  무수정 약속). P1-6b Inspector quick-actions도 동일 패턴 예상. messages
  신규 키 5locale 추가 + caller label prop 노출로 일괄 i18n 정합.
  (Codex P3 추적, 코드 주석 `// ... P1-6c` 명시됨.)

### 범위 밖 / 보류

- `src/components/layout/Sidebar.tsx:403` violet glow `rgba(99,102,241,0.25)` —
  **DO NOT TOUCH** (CLAUDE.md). 소유자 승인 전까지 미수정. 별건 이슈로만 기록.
- 페이지별 레이아웃·IA 교체는 **Phase 3**.

## 진행 방식

1. 브랜치 `refactor/hr-hub-phase2` (main 기준 분기)
2. P0-1 → P0-2 → P1(컴포넌트 단위 커밋) → P2(wt 팔레트 통합) 순.
   각 단계 종료 시 보고+사용자 승인 후 다음 진행.
3. Codex Gate 1(플랜) 이미 본 문서로 갈음 가능 / Gate 2(`codex review
   --uncommitted`) 커밋 전 필수, HIGH 0 확인.
4. 검증: `tsc --noEmit` 0 · `next lint` clean · 다크/라이트 토글 · 콘솔 0 ·
   변경 컴포넌트 시범 페이지 라이브 스냅샷. 단일 PR(컴포넌트 다수면 분할 가능).

## Verify (Phase 2 완료 기준)
- P0-1/P0-2 잔존 violet 0 (`grep rgba(74,64,224|99,102,241` in ui/* = 0,
  ctr-* 다크 대비 통과)
- 시그니처 컴포넌트가 최소 1개 실페이지에서 Workday 외관으로 렌더(스냅샷)
- 라이트·다크 모두 콘솔/시각 회귀 0
