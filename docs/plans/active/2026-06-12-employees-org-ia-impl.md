# Employees-org IA Proto-Fidelity — Implementation (Wave 1 IA track, cluster 1)

> Branch `design/wave1-ia-employees` off `origin/main`. Per CEO decision ④ (S298),
> employees-org is the first cluster. CEO meta-correction: the canary N1/N2 rigor STAYS
> (this is a real multi-select bar), but a backend-less action is NOT a blocker — it's
> sequenced as its own feature, not dropped. Close gaps, don't leave them; don't bloat
> this PR.

---

## Scope

**PR-1 (canary, this doc's focus)**: employee-list checkbox row-select → `BulkActionBar`.
- Bar actions (proto `page-employees.jsx:313`): **엑셀 내보내기(선택)** + **일괄 발령(선택)**.
- **메시지 보내기** = (다) no backend → sequenced as the immediate NEXT feature (its own
  PR adds a 3rd `actions[]` entry; additive). NOT in this PR.

**Follow-up (same branch, after canary lands)**: detail `wd-worker-banner` header; 성과평가
tab re-home (`EmployeeInsightPanel` already ships, wire over the `comingSoon` placeholder).

**Deferred (backend / keep-live)**: proto multi-select filter dropdowns need the list API to
accept array filters → backend, out of "frontend-first". Live single-select + advanced panel +
`WdStatusChips` already filter well → keep-live this PR.

---

## N1 7-layer audit — bulk actions

| Action | ①Prisma | ②API | ③Perm | ④FE | ⑤UI | ⑥Feedback | ⑦State | Class | Work |
|---|---|---|---|---|---|---|---|---|---|
| 엑셀 내보내기(선택) | ✅ findMany | 🟡 `/employees/export` filters-only, no `ids` | ✅ EXPORT | 🟡 handleExport by filter | new bar btn | 🟡 exportLoading | n/a | **(나)** | +`ids` to schema+route (AND company scope) + bar wiring |
| 일괄 발령(선택) | ✅ bulk-movements execute | ✅ `/api/v1/bulk-movements/*` | ✅ | 🟡 top-btn navigate exists | new bar btn | ✅ on target page | n/a | **(가/나)** | bar → `router.push('/hr/bulk-movements?ids=…')` (+ optional preselect read) |
| 메시지 보내기(선택) | ❌ | ❌ | ❌ | ❌ | proto only | ❌ | ❌ | **(다)** | sequenced next feature — excluded here |

---

## Changes

### 1. `src/components/shared/DataTable.tsx` — additive opt-in row selection
Strictly additive; absent props → zero behavior change (matches existing `tableId`/`virtualScroll` opt-in pattern).
- New optional props: `selectable?: boolean`, `selectedKeys?: Set<string>`, `onToggleRow?(key,row)`, `onToggleAllVisible?(allSelected:boolean)`, `getSelectionKey?(row)=>string` (defaults to `rowKey`).
- When `selectable`: prepend a leading checkbox column — header = select-all-**visible** (`checked` / `'indeterminate'` via Radix `Checkbox`), per-row checkbox. Selection cell `onClick` `stopPropagation` so `onRowClick` (open panel) still fires elsewhere.
- Skeleton + empty header prepend an empty selection `<TableHead>` for column alignment.
- **Normal (paginated) mode only.** `selectable` + `virtualScroll` together = out of scope → ignore selection in virtual branch + comment. (Employees uses normal mode.)
- a11y: header checkbox `aria-label="전체 선택"`; row checkbox `aria-label` = per-row name.

### 2. `src/app/(dashboard)/employees/EmployeeListClient.tsx` — wire selection + bar
- `selected: Set<string>` (employee `id`). Gate on `isHrAdmin` (matches existing action gating — EMPLOYEE/MANAGER get no checkboxes/bar).
- Clear selection on page/filter/search change (avoid acting on now-hidden rows).
- `<BulkActionBar count onClear label={t('bulkSelectedCount',{count})} actions=[exportSelected, bulkMovement] clearAriaLabel=… />`.
  - `exportSelected`: `GET /api/v1/employees/export?ids=<joined>` download (anchor pattern, reuse existing).
  - `bulkMovement`: `router.push('/hr/bulk-movements?ids='+[...selected].join(','))`.

### 3. `src/lib/schemas/employee.ts` + `src/app/api/v1/employees/export/route.ts` — `ids`
- `employeeSearchSchema.extend({ ids: z.string().optional() })` (comma list; cap ~500).
- Export `where`: when `ids` present → `id: { in: ids.split(',') }` **AND** keep existing company-scope (`assignments.some.companyId` for non-super). **Security: ids must be ANDed with company scope, never bypass it** — a non-super user passing another company's id gets 0 rows.

### 4. i18n (add-only; ko + en/es/vi/zh) — `employee.*`
- `bulkSelectedCount` "{count}명 선택됨", `bulkExportSelected` "선택 내보내기", `bulkClearSelection` "선택 해제", `bulkSelectAll` "전체 선택". (`listBulkMovement` "일괄 발령" reused.) Never edit/delete frozen keys.

### 5. N2 E2E — `e2e/flows/employees-bulk-select.spec.ts`
- HR_ADMIN: /employees → check 2 rows → bar visible, "2명 선택됨" → 엑셀 내보내기 triggers `/export?ids=` → 일괄 발령 navigates to `/hr/bulk-movements`. clear → bar hides.
- EMPLOYEE (role-gated): no checkbox column / no bar.

---

## Codex Gate 1 — incorporated (2026-06-12)

- **HIGH1 (일괄 발령 ?ids = dead param)**: `BulkMovementsClient` is a 3-step CSV wizard (select→upload→confirm), no preselect. Preselect = a NEW "selected-employees → movement" input mode = its own feature. → **drop 일괄 발령 from the bar this PR**; bar ships with **엑셀 내보내기(선택) only**. `actions[]` grows additively as 일괄발령(preselect mode) + 메시지(messaging backend) land.
- **HIGH2 (export tenant scope)**: also company-scope `include.assignments.where` (not just `where`) for non-super — pre-existing multi-tenant leak; harden in this PR. `ids` ANDed with company scope.
- **MED3 (E2E role)**: `/employees` = HR_UP only → all viewers are HR_ADMIN/SUPER. Role-split test = non-HR (EMPLOYEE) gets **redirected to `/`** (not "list without checkboxes"). HR_ADMIN sees bar.
- **MED4 (perm gate)**: gate selection/bar on actual `employees:export` permission via `user.permissions` (not bare `isHrAdmin`).
- **MED5 (clear selection)**: clear on EVERY list query change (page/limit/sortBy/sortDir/filter/search) — clear at fetch start → selection only ever = current page rows (kills stale-id/export-unseen risk).
- **MED6 (alignment)**: single `hasSelectionCol` flag; prepend the selection col consistently across header / skeleton body / empty header / data rows.
- **MED7 (virtual+selectable)**: dev-mode assert/console.error if both set (no silent ignore).
- **LOW8**: dedicated `employeeExportSchema = employeeSearchSchema.extend({ ids })` for the export route only — keep the list contract clean.
- **LOW9**: `ui/checkbox.tsx` indicator renders `Minus` on `indeterminate` (additive; correct globally).

## Gates
tsc 0 · lint 0 · **N2 E2E pass (role-split)** · **Pixel Gate** (proto bar vs live, employees page) · multi-role dogfood (`super@` + `employee-a@`) · Codex G1 (this plan) + G2 (post-impl via /verify). DataTable is a high-blast shared component → assert no regression on existing consumers (additive-only).

---

## PR-2 — 상세 페이지 풀 프로토 전환 (구현 완료, 별도 PR)

> Branch `design/wave1-ia-employees-detail` off `design/wave1-ia-employees` (스택, base=#174). CEO 결정 = **풀 프로토 전환**(하이브리드/탭만 아님).

**변경 (6파일, +1036/−441)**:
- **NEW `EmployeeWorkerBanner.tsx`** — 프로토 `.wd-worker-banner`. `bg-gradient-to-br from-primary to-primary-dim` + warm radial(`bg-wd-orange/25`) + 흰 점패턴 + 뒤로(`직원 관리`) + 아바타 + 이름·영문·사번 + 메타(직위·부서·법인·상태점=`STATUS_FG` SSOT). 액션 = **정보 편집(HR)만**, 흰 pill+`text-primary-dim`(프로토 navy·AA). 메시지/발령서 = no-mock 드롭.
- **NEW `tabs/PerformanceTab.tsx`** — 인라인 성과평가. `/insights`+`/cfr/recognitions/employee/[id]` **독립 fetch**(한쪽 실패가 탭 안 비움). 3-KPI(`WdStatStrip md:grid-cols-3`: 최근등급·MBO평균·받은칭찬) + 섹션(목표 progressbar·**최근 평가 단건**·최근 원온원·승계준비도·받은 칭찬). `READINESS_CONFIG`·`MOOD_SCALE` SSOT만 재사용(InsightPanel 무수정).
- **EDIT `EmployeeDetailClient.tsx`** — `flex h-full` 사이드바 → 배너 + 풀폭 Radix Tabs. ProfileSidebar·모바일헤더 제거. 사이드바 고유(직속상사 링크·급여밴드)=프로필 탭 우측 레일로 이전, division/근무지/근속=고용정보 그리드 InfoRow 추가. 편집·오프보딩 무변경. 편집 경고 amber raw→`warning-bright`/`ctr-warning`+Info(이모지 제거).
- **DELETE `ProfileSidebar.tsx`** — 소비처 1곳뿐, 동일트랙 죽은코드.
- **i18n** — `performance.profileTab.*`(16) + `employee.detail*`(5) ×5로케일 add-only.
- **E2E** `e2e/flows/employee-detail-profile.spec.ts` — HR_ADMIN 배너·perf탭·프로필 dl 보존 / SUPER 크로스컴퍼니 안내 / EMPLOYEE 차단.

**Codex G1 HIGH 3 반영**: ① **크로스컴퍼니**(SUPER가 타 법인 직원 열면 `/insights` 404·`/recognitions` 200-empty) → `crossCompany = isSuperAdmin && employeeCompanyId !== viewerCompanyId`로 **fetch 전 명시 안내**("다른 법인…표시할 수 없어요", 빈상태 위장 금지). ② **Tier-2 동등성**(grade/payband=`canViewGrade`, 비상연락처=`canViewSensitive` 게이트 보존, 매니저 클릭 보존). ③ **2-소스 독립 상태**.

**의도된 프로토 편차 (defect 아님 — 리뷰 워크플로 confirmed-but-intentional)**:
- 최근 평가 = **단건**(`/insights`가 latestEval 1건 반환; 가짜 다행 이력 금지).
- 목표 = **goal progressbar**(proto 사이클 MBO 테이블 대신; API가 cycle 집계 미반환·goal-level이 더 actionable).
- **최근 원온원·승계준비도** = InsightPanel 재배치(proto+ — live 백엔드 존재, re-home 원칙).
- **메시지·발령서·경력이력** = 백엔드 부재 → no-mock 드롭/이연.
- KPI 라벨 케이싱·readiness/mood 폴백 = `WdStatStrip`/`InsightPanel` SSOT 일관(단일 surface 발산 회피).

**검증**: tsc 0 · lint 0 · 멀티롤 도그푸드(hr@ 실데이터 배너+perf 0에러 / super@ 크로스컴퍼니 안내 0에러) · 적대 리뷰 워크플로(20에이전트·6차원·confirmed 10→실수정 2[배너 navy·MOOD 가드]·나머지 intentional). G2=/verify.
