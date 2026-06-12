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
