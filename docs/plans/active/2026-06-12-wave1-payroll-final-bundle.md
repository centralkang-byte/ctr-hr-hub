# Wave 1 — 급여 마지막 묶음 (adjustments · bank-transfers · close-attendance)

> 세션: S289 (2026-06-12) · 스택 base = `design/wave1-payroll-ia` (#158) → 새 브랜치 `design/wave1-payroll-final`
> 원칙: 프로토 = 픽셀 SSOT · **기능 절대 보존** · **백엔드 절대 보존**(API/prisma/lib/middleware 무수정)
> residual(#157) 18줄이 "별 세션"으로 빼둔 묶음 + 캠페인 메모리 "payroll 마지막 묶음" = 이 PR로 Wave 1 급여 종결.

## 감사 출처·신뢰도 (S289)

3-라우트 갭 감사 워크플로(23 에이전트) + **적대 검증**. ⚠ **검증 패스가 비-워크트리 옛 main(#53)을 읽어** WdDrawer·플랜·§5.4를 "부재"로 오판 → 드로어 전환을 거짓 드롭/불가 판정함([[hrhub-workflow-subagent-stale-cwd]]). **메인 세션이 내 워크트리에서 3파일·WdDrawer·§5.4·토큰을 직접 ground-truth로 재검증** → 라인번호 전부 일치 확인, 드로어 전환 = 유효(§5.4 의무)로 복원. 아래는 교정 완료본.

**Codex Gate 1 반영 (NO-GO → 수정)**: HIGH 3(드로어 submit 경로·reset 계약·375px 미범위) + MED 4(CLOSE-8 수제모달·STATUS_FG 적용법·i18n 스택 충돌·visual 미등록). 토큰은 "전부 실존, 날조 없음" 확인(stale 교정 검증됨). 반영: 드로어 = **인라인**(부모 state 유지), 375px = 데스크톱 우선 재정의, 아래 각 항목 갱신.

## 대상 (프로토 매핑)

| 라우트 | 파일(줄) | 프로토 | 정합 방식 |
|---|---|---|---|
| /payroll/adjustments | AdjustmentsClient.tsx (611) | **1:1 존재** ManualAdjustPage `page-round3.jsx:246-350` | 토큰/패턴 + 드로어 (IA 차이=기능보존, 갭 아님) |
| /payroll/bank-transfers | BankTransfersClient.tsx (608) | 전용 없음 (PayrollMgmtPage STEP5) | 패턴 단위 |
| /payroll/close-attendance | CloseAttendanceClient.tsx (483) | 전용 없음 (PayrollMgmtPage STEP1) | 패턴 단위 |

## A. adjustments

- **ADJ-1** (P1, ALL-1): 헤더 `:267` `p-6 bg-background min-h-screen` → `mx-auto max-w-7xl p-4 space-y-4` + 56px 아이콘 타일(`h-14 w-14 rounded-[14px] bg-accent text-primary` + Layers 26px) + `TYPOGRAPHY.pageTitle` + 13px 부제. breadcrumb `:270` 제거(토픽바 담당). 참조 = PayrollSimulationClient:794-805.
- **ADJ-2** (P1, ALL-4): raw `text-emerald-600`/`text-red-500` `:321,327,333,436` → `text-[#006b39]`/`text-[#b71824]` (DESIGN.md 예외#1 AA ink). 양/음 조건 무변경.
- **ADJ-3** (P1, ALL-3): EmptyState 더블아이콘+기본sub `:283-287, 393-397` → `<EmptyState icon={Layers|FileText} title={…} sub="" />` (수동 아이콘 div 제거).
- **ADJ-4** (P1, §5.4 핵심): Create 중앙 모달 `:477-606`(직원/유형/카테고리/금액/사유/증빙 입력폼) → **인라인 WdDrawer 전환**(Codex HIGH 반영 — 신규 컴포넌트 추출 안 함). `{showForm && <div MODAL>}` 블록을 `<WdDrawer open={showForm} onClose={…} closeDisabled={submitting} primary secondary>`로 교체, **`form`·`handleCreate`·전 state는 AdjustmentsClient에 그대로 유지**(추출 시 reset 계약 깨짐 — Codex HIGH-2). 기존 `<form ref={formRef} onSubmit={handleCreate}>` + hidden submit(`<button type="submit" className="hidden">`) 유지, **WdDrawer `primary.onClick = () => formRef.current?.requestSubmit()`** → native `required` 검증 + Enter 제출 보존(Codex HIGH-1). **reset = 성공 시에만**(현행 :208 유지, open 시 reset 추가 금지 — 취소·재열기 값 유지 동작 보존). overlay/focus-trap/ESC 자동 → **ADJ-5 흡수**.
- **ADJ-6** (P2, ALL-2): 보조 버튼 `:378-385`(검토전환)·`:584-589`(cancel) → `cn(BUTTON_VARIANTS.secondary, …)`. primary(:373,594)는 이미 정합.
- **ADJ-7** (P2, a11y): icon-only `:456-461`(Trash2 삭제) → `aria-label={tCommon('delete')}` + `type="button"`. 모달 close(:482)는 ADJ-4가 자동 해소.
- **ADJ-8** (P2, ALL-5): summary 3카드 `:317-338` inline `text-xl` → `TYPOGRAPHY.statLabel`/`.stat` + `tabular-nums`. **WdStatStrip 미적용 유지(3개)**.
- **ADJ-9** (P3, 선택): `ADJUSTMENT_TYPE_COLORS` inline hex `:75-81,421-427` = DESIGN.md **예외#3(급여 유형 도메인색)** 해당 + 이미 컴포넌트 상수 → 기본 유지. inline `style`만 거슬리면 chart.ts 이전(색 동일 보존). **우선순위 최하 — 이연 가능**.

## B. bank-transfers

- **BANK-1** (P1, ALL-1): 헤더 `:259` `space-y-6 p-6` + `:263` `text-2xl` inline + `:264` 인라인 아이콘 → 표준 래퍼 + 56px 타일(Building2) + `TYPOGRAPHY.pageTitle`.
- **BANK-2** (P1, ALL-4): raw 팔레트 `:289`(amber-600)·`:295,357`(emerald-600)·`:360,550,594`(red-500)·`:426`(bg-emerald-600 진행바)·`:545-547`(emerald tint) → status.ts 시맨틱(success ink/destructive/warning). 진행바 fill = success/destructive 토큰.
- **BANK-3** (P2, ALL-2): processResult 버튼 `:405` `bg-emerald-600 hover:bg-emerald-700 text-white` 하드코딩 → `BUTTON_VARIANTS.primary` (Create/Generate/Submit는 이미 정합).
- **BANK-4** (P1, ALL-3): EmptyState 더블아이콘 `:325-326` → `icon={FileSpreadsheet}` prop + `sub=""`.
- **BANK-5** (P1, ALL-5): KPI 4카드 `:279-304`(총배치/대기/완료/총액 = 실수치 4) → **WdStatStrip** (정확히 4 ✓, GL-4 선례). tone 의미별.
- **BANK-6** (P1, §5.4): Create Dialog `:452-520`(은행/포맷/노트 입력폼) → **인라인 WdDrawer 전환**(`handleCreate`/`newBatch` state·reset 흐름 무변경 — 현행 reset-on-success `:182` 유지, open-reset 추가 금지). primary는 `handleCreate` 직접 호출(이 폼은 select 위주·`required` 없음 → requestSubmit 불요, 단 빈 노트 허용 동작 보존). Detail Dialog `:523-605`(읽기전용 items 테이블) = **유지**(조회 전용 = §5.4 예외).

## C. close-attendance

- **CLOSE-1** (P1, ALL-1): 헤더 `:180` `p-6 bg-background min-h-screen` + `:184` breadcrumb + `:185` text-2xl → 표준 래퍼 + 56px 타일(Calendar) + `TYPOGRAPHY.pageTitle`. **월/연 select·refresh(:190-221)는 헤더 우측 보존**.
- **CLOSE-2** (P2, ALL-4): KPI 아이콘 raw `:315`(emerald)·`:322`(amber)·`:329`(red) → `STATUS_FG` 토큰. 근무시간 시계 amber(경고 의미 오용) → muted/info 보정.
- **CLOSE-3** (P2, ALL-4): 미확정 패널 amber raw 다중 `:338-366`(border/bg/text/divide) → warning 시맨틱(D17 bg/text 분리: `bg-warning-bright/15`·`text-ctr-warning`).
- **CLOSE-4** (P2, ALL-4): 진행바 inline hex `:305`(`#059669`·`#004964`·`#00BFA5` gradient) → success(100%)·primary 토큰. 고아 teal `#00BFA5` 제거(토큰 부재).
- **CLOSE-5** (P2, a11y): 진행바 `:300-308` → `role="progressbar"` + `aria-valuenow={confirmedPct}` + min/max + `aria-label`(기존 confirmedRatio 키 재사용).
- **CLOSE-6** (P2, ALL-2): 보조 버튼 `:217`(refresh)·`:268`(unlock)·`:457`(cancel) → `BUTTON_VARIANTS.secondary`/`ghost`.
- **CLOSE-7** (P2, a11y): refresh icon-only `:210-220` → `aria-label={tCommon('refresh')}`(존재) + `type="button"`.
- **CLOSE-8** (P2, §5.4 confirm 예외): 확정 모달 `:397-479` 수제 div(overlay·focus-trap·ESC·aria-modal 전무) → **shadcn `Dialog`/`DialogContent` 프리미티브로 래핑**(Codex MED 반영 — overlay만 추가는 a11y 미해결). `open={!!confirmModal} onOpenChange`로 제어, checkbox(excludeUnconfirmed)·요약·핸들러(`handleClose`)는 children으로 그대로 이전(ConfirmDialog는 checkbox 불가라 Dialog 프리미티브 채택). 기능·excludeUnconfirmed 흐름 무변경.
- **CLOSE-9** (P2, ALL-3): loading/empty 혼재 `:386-390` → loading=spinner, empty=EmptyState 분리.
- **CLOSE-10** (P2, ALL-4): closed-at `:376` + 모달 카운트 `:427,431` raw → AA ink 토큰.

## 토큰 적용법 (Codex MED 반영)

- **text 색**(ADJ-2·BANK-2·CLOSE-10): raw 팔레트 → **AA-ink arbitrary 클래스** `text-[#006b39]`(success)·`text-[#b71824]`(error)·`text-ctr-warning`(warning) (DESIGN.md 예외#1). 이건 정적 Tailwind 클래스라 className 직접 사용 OK.
- **아이콘 색**(CLOSE-2): `STATUS_FG`는 **JS hex 객체**(클래스명 아님) → className 동적 삽입 금지. `style={{ color: STATUS_FG.success }}` 또는 위 arbitrary 클래스로. 근무시간 시계는 `text-muted-foreground`로 보수 보정.
- **bg/진행바**: `bg-warning-bright/15`·`bg-[#008b4e]`·`bg-primary` 등 실존 토큰. role=progressbar는 **track div(외곽)** 에 적용(fill 아님, Codex LOW).

## 의도적 편차 (Pixel Gate 기록 예정)

- IA 차이: adjustments = run-스코프 CRUD(프로토 결재워크플로보다 풍부), bank/close = 프로토 전용 페이지 부재 → **기능 보존, 갭 아님**.
- 도메인 색(ADJUSTMENT_TYPE_COLORS, 진행바) = DESIGN.md 예외#3.
- 국기/이모지 = 해당 라우트 원래 없음(N/A).

## i18n (메인 루프 단일 소유)

기존 키 재사용 최우선(aria-label: `common.delete`/`close`/`refresh` 존재 확인). EmptyState 맥락 title 신규 추정 3개(run 목록·조정 테이블·배치 목록·근태 빈상태) — 에이전트가 기존 키 grep 후 신규만 보고, **5로케일 일괄 반영**. messages/*.json 직접 편집은 메인 루프만.

## 모바일/375px (Codex HIGH-3 정정)

이 3라우트(급여 관리자 워크플로)는 **데스크톱 우선 admin 라우트** — accessibility.md Tier-1(출퇴근/휴가/결재/알림/대시보드) 아님. 풀 모바일 reflow(adjustments `w-72` 2열·bank 가로카드 등)는 **Phase 4 이연**(캠페인 "모바일 reflow Tier-1 미착수" 정합). 본 PR 모바일 목표 = **무회귀**(기존 레이아웃 유지, 새 WdDrawer는 `width:100%` 자동 풀폭이라 모바일 OK). QA의 "375px"는 **신규 요소(드로어·EmptyState·WdStatStrip) 깨짐 없음 확인**으로 한정(전면 reflow 작업 아님).

## 브랜치/PR

- **스택 on `design/wave1-payroll-ia`(#158)** — WdDrawer·warm 버튼·EmptyState·status 토큰이 전부 스택에만 존재(main엔 부재) → main 분기 불가. 스택: `main ← #157 ← #158 ← (이 PR)`.
- **파일 중복 (Codex MED 정정)**: 대상 **TSX는 #157/#158과 무중복**. 단 `messages/*.json` 5개는 #157·#158도 편집 → 본 PR은 **#158 tip 위에서 새 키 additive append**라 스택 내 충돌 없음(기존 키 미편집). **머지는 스택 순서(#157→#158→이 PR) 준수** 필수 — 순서 어기면 i18n 충돌.

## 검증 게이트

1. `npx tsc --noEmit` 0 · `npm run lint` 0
2. i18n 신규 키 5로케일 parity + 전 키 resolve
3. e2e flows/payroll 회귀(신규 기능 없음 → 기존 가드 green) + **드로어 플로우 가드 신설**(adjustments·bank create 드로어 open→submit, #144 선례)
4. **Pixel Gate(패턴 단위)**: `python3 -m http.server 8077 -d _design-reference` side-by-side 1440/375, 라우트별 편차 기록
5. 멀티롤 UI QA: `super@`(global 무관, 3라우트 정상) + `hr@`(3라우트 전부 + 드로어 open/submit/취소) · 375px reflow
6. visual (Codex MED 정정): adjustments는 기존 spec 갱신 + **bank-transfers·close-attendance 신규 spec 등록**(현재 미등록). hydration 레이스로 베이스라인 불안정 시 [[hrhub-visual-baseline-traps]] → spec 추가하되 베이스라인 best-effort/defer(로컬 게이트, Pixel Gate가 1차 검증).
7. **Codex Gate 2**

## 함정

- 드로어 전환은 입력 state 유실 위험 — `handleCreate`/form state/POST 흐름 1:1 보존, closeDisabled로 제출 중 닫기 차단(PayrollCreateDrawer 패턴).
- `npm run build` 금지(dev 서버 worktree) [[hrhub-build-poisons-dev-next]]
- recharts 없음(차트 라우트 아님) → 헤드리스 rAF 무관, 단 visual hydration 레이스 주의 [[hrhub-visual-baseline-traps]]
- 워크플로 에이전트 stale cwd — 후속 감사 시 절대 워크트리 경로 핀 [[hrhub-workflow-subagent-stale-cwd]]
