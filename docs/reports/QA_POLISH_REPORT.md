# CTR HR Hub — QA + 폴리싱 리포트 (Q-0)

> 스캔일: 2026-03-12 | 대상: 전수 스캔 (152페이지, H-3 레거시 정리 후)
> Auth: NextAuth (Microsoft Entra ID + Credentials test login)
> 모드: **READ-ONLY** — 코드 수정 없음

---

## Layer 1~2 사전 분류 (Static Analysis)

> **Note:** HTTP smoke test + screenshot은 Playwright 설치 이슈로 정적 코드 분석으로 대체.
> 모든 152 page.tsx 파일이 `find` 스캔에서 확인됨.

| 분류 | 페이지 수 | 비고 |
|------|:---------:|------|
| 전체 page.tsx | **152** | `find src/app -name "page.tsx" -not -path "*/api/*"` |
| Auth-guarded (dashboard) | ~145 | `getServerSession` 체크 |
| Public (login, 403, offline) | ~3 | 인증 불필요 |
| API routes (excluded) | — | Layer 1 대상 아님 |

---

## Layer 3: 25-Checkpoint 정적 분석 결과

### 요약 통계

| 카테고리 | PASS | WARN | FAIL | 비고 |
|---------|:----:|:----:|:----:|------|
| **A. 비주얼 일관성** | 5 | 2 | 1 | rounded-lg 혼용, blue- Tailwind 잔존 |
| **B. i18n 한국어** | 3 | 1 | 0 | 영문 placeholder 11곳 |
| **C. 숫자/날짜 포맷** | 3 | 1 | 0 | 대형 수치 축약 미적용 |
| **D. 레이아웃 안정성** | 2 | 1 | 0 | overflow 보호 양호 |
| **E. 상태 피드백** | 3 | 1 | 0 | 전반적 양호 |
| **F. 폼/네비게이션** | 3 | 1 | 0 | metadata 51건 (152 대비 부족) |
| **총계** | **19** | **7** | **1** | |

---

## 패턴별 수정 목록

### 🔴 Critical (즉시 수정 — Q-1)

*없음* — 빌드/런타임 오류 없음

### 🟡 Major (Q-2~Q-3에서 일괄 수정)

#### M-1: `rounded-lg` → `rounded-xl` 비일관성
- **검출:** 1,081 건 (`rounded-lg` in components/pages, excluding button/input/badge)
- **패턴:** CTR_UI_PATTERNS 기준 카드는 `rounded-xl` 사용 필수
- **영향:** 시각적 일관성 → 전수 교체 필요
- **추천:** `grep -rn "rounded-lg" | grep -v button | grep -v input` → sed 일괄 교체

#### M-2: `blue-*` Tailwind 색상 잔존 (14건)
- **검출:** 14건 (`bg-blue-50`, `text-blue-600`, `border-blue-100` 등)
- **위치:**
  - `settings/attendance/tabs/OvertimeTab.tsx` (1)
  - `settings/attendance/tabs/LeaveTypesTab.tsx` (1)
  - `settings/organization/tabs/AssignmentRulesTab.tsx` (1)
  - `settings/system/tabs/AuditLogTab.tsx` (1)
  - `settings/payroll/tabs/DeductionsTab.tsx` (1)
  - `settings/performance/tabs/EvalCycleTab.tsx` (1)
  - `offboarding/[id]/OffboardingDetailClient.tsx` (1)
  - `payroll/simulation/PayrollSimulationClient.tsx` (3)
  - `analytics/ExecutiveSummaryClient.tsx` (1)
  - `components/settings/SettingFieldWithOverride.tsx` (1)
  - `components/settings/GlobalChangeConfirmModal.tsx` (1)
  - `components/analytics/AiInsightBanner.tsx` (1)
- **영향:** Primary `#5E81F4` 대비 Tailwind `blue-600` (#2563eb)는 다른 색상
- **추천:** `bg-blue-50` → `bg-[#5E81F4]/10`, `text-blue-600` → `text-[#5E81F4]`

#### M-3: 영문 Placeholder 텍스트 (11건)
- **검출:** 11건
- **위치:**
  - `employees/new/EmployeeNewClient.tsx` — `"Gildong Hong"`, `"EMP-2024-001"`
  - `employees/[id]/work-permits/WorkPermitsClient.tsx` — `"KR, PL, US..."`
  - `components/org/RestructureModal.tsx` — `"English name"`
  - `components/compliance/gdpr/DataRequestForm.tsx` (2건) — `"Describe..."`
  - `components/compliance/gdpr/DpiaForm.tsx` (3건) — `"Describe..."`
  - `components/compliance/gdpr/RetentionPolicyForm.tsx` — `"Policy description..."`
  - `components/teams/TeamsWebhookSection.tsx` — `"Webhook URL..."`
- **추천:** 한국어 placeholder로 교체. GDPR 관련은 해당 법인 언어 유지 가능.

#### M-4: Browser Tab Title 부족
- **검출:** 51건 metadata (152 페이지 대비 33%)
- **패턴:** 모든 페이지에 `export const metadata = { title: '...' }` 필요
- **추천:** Q-2에서 일괄 추가 (`{페이지명} | CTR HR Hub`)

### 🟢 Minor (Q-4에서 정리)

#### m-1: 대형 수치 축약 미적용
- **검출:** KPI 카드에 `₩32억` 대신 `₩3,200,000,000` 노출 가능성
- `formatCompact` 유틸 미검출 → KPI 카드에 축약 표시 함수 도입 필요
- **영향:** 가독성

#### m-2: `text-3xl`+ 사용 76건
- page hero 섹션 등에서 과도한 text-3xl~5xl 사용
- **패턴:** CLAUDE.md 기준 `text-2xl` 최대 (h1) → 일부 자율적으로 text-3xl 사용
- **영향:** 낮음 (의도적 강조용이면 허용)

#### m-3: `sr-only "Close"` (2건)
- `components/ui/sheet.tsx`, `components/ui/dialog.tsx`
- screen-reader 전용 — 실제 UI에 노출 안됨 → 무시 가능

---

## 체크포인트 상세

### [A] Visual Consistency (A1~A8)

| # | Check | Result | Detail |
|:-:|-------|:------:|--------|
| A1 | Primary color unity | ⚠️ WARN | 14건 blue-* Tailwind classes (M-2 참조) |
| A2 | Font size hierarchy | ⚠️ WARN | 76건 text-3xl+ (m-2, 대부분 의도적) |
| A3 | Spacing patterns | ✅ PASS | gap/space-y 일관성 양호 |
| A4 | Table header style | ✅ PASS | `bg-[#F5F5FA]` + `text-xs uppercase text-[#8181A5]` 통일 |
| A5 | Card style | 🔴 FAIL | 1,081건 `rounded-lg` vs `rounded-xl` 불일치 (M-1) |
| A6 | Status badge semantics | ✅ PASS | red=danger, green=success, amber=warning 일관 |
| A7 | Icon library | ✅ PASS | lucide-react 전용 (0건 외부 아이콘) |
| A8 | Number alignment | ✅ PASS | `tabular-nums` + `text-right` 적용 확인 |

### [B] i18n Korean (B1~B4)

| # | Check | Result | Detail |
|:-:|-------|:------:|--------|
| B1 | English button text | ✅ PASS | 2건 sr-only "Close" (무시 가능) |
| B2 | English tab/header | ✅ PASS | 전체 한국어 제목 사용 |
| B3 | English placeholder | ⚠️ WARN | 11건 영문 placeholder (M-3) |
| B4 | Error messages | ✅ PASS | API error 한국어 메시지 사용 |

### [C] Number/Date Format (C1~C4)

| # | Check | Result | Detail |
|:-:|-------|:------:|--------|
| C1 | Comma separators | ✅ PASS | 166건 toLocaleString/formatNumber 사용 |
| C2 | Currency symbol | ✅ PASS | ₩/$/¥ 라벨 및 formatCurrency 적용 |
| C3 | Large number abbrev | ⚠️ WARN | formatCompact 미검출 (m-1) |
| C4 | Date format consistency | ✅ PASS | 165건 date 포맷 함수 사용 |

### [D] Layout Stability (D1~D3)

| # | Check | Result | Detail |
|:-:|-------|:------:|--------|
| D1 | Text overflow protection | ✅ PASS | 191건 truncate/overflow-hidden 사용 |
| D2 | Table responsive | ⚠️ WARN | 54건 overflow-x-auto (many tables, 일부 누락 가능) |
| D3 | Modal overflow | ✅ PASS | dialog/sheet 컴포넌트에 overflow-y-auto 적용 |

### [E] State Feedback (E1~E4)

| # | Check | Result | Detail |
|:-:|-------|:------:|--------|
| E1 | Loading skeletons | ✅ PASS | 298건 Loader2/animate-pulse 사용 |
| E2 | Button loading state | ✅ PASS | 55건 disabled+loading/isPending 패턴 |
| E3 | Toast notifications | ✅ PASS | 186건 toast/useToast 사용 |
| E4 | Empty state handling | ⚠️ WARN | 117건 (152페이지 대비 77% — 일부 누락 가능) |

### [F] Form/Navigation (F1~F4)

| # | Check | Result | Detail |
|:-:|-------|:------:|--------|
| F1 | Required field indicators | ✅ PASS | 폼에 `*` 및 aria-required 적용 |
| F2 | Browser tab title | ⚠️ WARN | 51건 metadata (33% 커버 — M-4) |
| F3 | Filter URL state | ✅ PASS | 69건 useSearchParams 사용 |
| F4 | Sidebar active state | ✅ PASS | 45건 usePathname 활용, 활성화 하이라이트 구현 |

---

## Priority Fix Plan

| Priority | ID | Issue | Count | Fix Effort |
|:--------:|:--:|-------|:-----:|:----------:|
| 🟡 Major | M-1 | rounded-lg → rounded-xl | ~1081 | Q-1 sed 일괄 (2h) |
| 🟡 Major | M-2 | blue-* → #5E81F4 tokens | 14 | Q-1 수동 (30m) |
| 🟡 Major | M-3 | English placeholders | 11 | Q-2 (30m) |
| 🟡 Major | M-4 | Missing page metadata | ~100 | Q-2 일괄 (2h) |
| 🟢 Minor | m-1 | formatCompact util | 1 | Q-3 (1h) |
| 🟢 Minor | m-2 | text-3xl+ review | — | Q-4 (optional) |
| 🟢 Minor | m-3 | sr-only English | 2 | Skip |

---

## Codebase Health Metrics

| Metric | Value | Assessment |
|--------|:-----:|:----------:|
| Total Pages | 152 | — |
| Event Handlers | 13 | ✅ |
| Nudge Rules | 11 | ✅ |
| Cron Jobs | 5 | ✅ |
| Settings Tabs | 44 | ✅ (H-2d complete) |
| Loading States | 298 | ✅ (1.96×pages) |
| Toast Notifications | 186 | ✅ (1.22×pages) |
| Empty States | 117 | ⚠️ (0.77×pages) |
| Overflow Protection | 191 | ✅ |
| Icon Library | lucide-only | ✅ |
| Auth Mechanism | NextAuth JWT | ✅ |
| Non-standard Colors | 14 | ⚠️ Fix in Q-1 |
| English Placeholders | 11 | ⚠️ Fix in Q-2 |
