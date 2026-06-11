# Payroll SUPER cross-company write policy — implementation plan

> Branch: `fix/payroll-super-write-policy` stacked on `fix/payroll-run-super-scope` (PR #154, OPEN)
> Memory: [[hrhub-payroll-super-write-policy]] · [[hrhub-multitenant-leak-systemic]] · [[hrhub-payroll-approval-rbac]]

## CEO decision (2 gate questions, S285)
1. Review-stage writes (resolve/bulk-resolve/submit): **유지 — 전 법인 허용**.
2. Publish/money-movement (paid/notify/transfer): **전부 — 이체까지 SUPER**.

→ **SUPER_ADMIN = full cross-company payroll operator** (read + write everywhere, audited).
Non-SUPER stays **fail-closed** (own-company only) on every route — invariant, unchanged.

## House convention (proven by code + tests)
- **Destructive WRITE** → `403` *ownership-first*: load run by id (no company filter) → `notFound` if missing
  → `if (user.role !== ROLE.SUPER_ADMIN && run.companyId !== user.companyId) throw forbidden` **before** the
  status check → write using `run.companyId`. Canonical template = `src/app/api/v1/payroll/calculate/route.ts:44-50`.
  Already followed by: standalone `calculate`, `anomalies/.../resolve`, `bulk-resolve`, `submit-for-approval`,
  `approve`, `reject`. Pinned by `e2e/api/payroll-cross-tenant*.spec.ts` (batch2 header lines 7-9).
- **READ** → `404` scoped findFirst via `resolveCompanyFilter` (existence-oracle blocked). #154 pattern. NOT used for writes.

The 5 target routes currently (incorrectly) use the *read* pattern (`findFirst({where:{id,companyId:user.companyId}})`
→ `notFound`/404) on **write** endpoints. Fix = bring them to the canonical write guard (403 + SUPER carve-out).
This both implements the policy AND repairs a latent convention violation.

## Changes

### A. API — open 5 own-only writes to SUPER (manual guard, `run.companyId` for writes)
Each: replace own-only run-fetch with `findUnique({ where: { id } })` + `if (!run) notFound` +
`if (user.role !== ROLE.SUPER_ADMIN && run.companyId !== user.companyId) throw forbidden(...)` placed **before**
status checks; change any `companyId: user.companyId` in writes/audit to `run.companyId`. Add `ROLE`/`forbidden` imports as needed.

1. `runs/[id]/calculate/route.ts` (POST) — live caller `CloseAttendanceClient.tsx:161`. audit `companyId`→`run.companyId`. +ROLE.
2. `runs/[id]/paid/route.ts` (PUT) — caller `PayrollPublishDashboardClient.tsx:193`. audit→`run.companyId`. +ROLE,+forbidden.
3. `runs/[id]/items/[itemId]/route.ts` (PUT) — audit→`run.companyId`. +ROLE,+forbidden. (item still scoped `runId: id`.)
4. `[runId]/notify-unread/route.ts` (POST) — no companyId write; just guard. +ROLE,+forbidden.
5. `[runId]/export/transfer/route.ts` (GET, but WRITE — creates BankTransferBatch) — **batch `companyId: user.companyId`→`run.companyId`** (line ~75); guard. audit already `run.companyId`. +ROLE,+forbidden.

### B. API — delete dead route
- `runs/[id]/review/route.ts` (GET) — **0 callers** (review client fetches `/runs/[id]`, not this). Delete the file.

### C. UI — reverse #154 publish gate (API now permits SUPER cross-company)
- `PayrollPublishDashboardClient.tsx`: remove `isCrossCompany` (line 242) + its 3 usages — paid button `disabled`
  (274) & `title` span (270), notify button `disabled` (326) & `title` span (321), transfer item `disabled`/`title`
  (362-363) + stale comment (361). `user` becomes unused → `{ user: _user, runId }` (matches review/approve client siblings).
- No change to review/approve clients (no cross-company gating there; buttons already work for SUPER, unreachable for non-SUPER).
- **No new banner** (proto = pixel SSOT; audit log is the control). Note as optional follow-up only.

### D. Tests — lock in carve-out + ownership-first (N2 E2E)
Extend `e2e/api/payroll-cross-tenant.spec.ts`:
- Non-SUPER (CTR-CN HR) → CTR run: `paid`, `notify-unread`, `items` PUT, `export/transfer`, per-run `calculate` → **403** (ownership-first, status-independent).
- SUPER → CTR run: each **not 403** (carve-out; 200/400 by status ok). Mirror existing `attendance-reopen` carve-out test (lines 84-97).
Add fixtures if missing: `markPaid`, `adjustItem`, per-run `calculate` (note `postCalculate` currently hits the *standalone* endpoint).

## Guard / invariants
- 비-SUPER fail-closed: unchanged (each route keeps the `!== SUPER_ADMIN` block).
- `companyFilter.ts` PROTECTED — not modified (read-only use of `ROLE`).
- Ownership guard strictly **before** status check (no status-oracle leak).
- Minimize diff; no refactor of untouched logic.

## Codex Gate 1 (S285) — dispositions
- **Accept**: payslips/[id] PATCH (:80) add SUPER carve-out (matches its own GET :46 — same bug class, ③ sweep); add `logAudit` to notify-unread (policy=audited); strengthen e2e SUPER carve-out (assert NOT 403 **and** NOT 404, assert `run.companyId` on 200 — `!= 403` alone passes a broken-404).
- **Defer (CEO: 둘 다 분리)** → spawn follow-up chips, NOT in this PR:
  - transfer GET→POST + write-perm (GET that mutates; prefetch/CSRF). Out of scope = download-link UX rework.
  - runs/route.ts list(GET)+create(POST) SUPER all-company. #154 deliberately left list scoped (separate `/global`); create = distinct capability beyond CEO's "operate on existing runs" decision.
- Reject/none.

## Final scope (locked)
5 write routes + payslips PATCH carve-out + notify audit + delete dead review GET + reverse publish UI gate + e2e. Non-SUPER fail-closed unchanged.

## Verify — DONE (S285)
- `npx tsc --noEmit` → exit 0. `npm run lint` (changed files) → 0 errors, 1 pre-existing warning (publish client useCallback `t`, line 169 untouched).
- **Codex Gate 2**: 2 P1 (no P0) — both fixed: payslips PATCH audit log (`PAYSLIP_MARK_VIEWED`, non-owner only); per-route SUPER carve-out probes (paid/calculate via REVIEW→400 no-mutation, item-adjust via fake-item).
- **e2e** (`NODE_ENV=test`, dev server in-worktree): `payroll-cross-tenant.spec.ts` **16/16 pass** (5 new non-SUPER 403 + 5 new SUPER carve-out + existing). Adjacent (`batch2`, `approval-exports`, `operations`, `adjustments-anomalies`) **167 pass / 0 fail / 4 flaky-but-green / 8 skip**. `runs/[fake-uuid]→404` + batch2 403/404 split still green.
- Final sweep: no remaining own-only payroll WRITE route on the read-pattern. payslips-LIST + runs-LIST read-scope = deferred (chips task_8ecbb8f1, task_60a98a8e).
- UI: publish-page change = `disabled || isCrossCompany` removal + inline-span unwrap (tsc-clean, no layout/token change → no separate Pixel Gate). SUPER cross-company write capability proven at API layer by e2e.

## S286 follow-up — runs LIST/CREATE scope (was deferred chip task_60a98a8e)

### CEO decision (2 gate questions, S286)
1. **목록(GET /runs)**: **전 법인 열기** — `resolveCompanyFilter(user, ?companyId)`. SUPER 지정=해당 법인·미지정=전체; 비-SUPER fail-closed.
   운영자 모델 완성 — SUPER가 타 법인 run을 *찾아* 들어갈 수 있어야 #154 상세-read·S285 write가 의미. `/global`은 KRW 합계 대시보드(운영 worklist 아님).
2. **생성(POST /runs)**: **본인 법인 유지** — 미개방. 생성 드로어에 법인 선택기 없어 API만 열면 휴면(SUPER=CTR-HOLD 고정 생성); 생성은 최파괴적 쓰기(잘못된 법인 run). S285 "기존 run 운영" 범위 밖.

### Changes
- `runs/route.ts` GET: `companyId: user.companyId` → `...resolveCompanyFilter(user, url.searchParams.get('companyId'))`. companyId는 `payrollRunListSchema`에 없어 strip → searchParams 직접 read. import `resolveCompanyFilter`.
- `runs/route.ts` POST: 로직 불변. `user.companyId` 고정 유지 + 의도(생성 미개방) 명시 주석만 추가(재-flag 방지).
- `e2e/api/payroll-cross-tenant.spec.ts`: 신규 describe "runs list scope" 3 케이스 — 비-SUPER `?companyId` 무시(fail-closed)·SUPER `?companyId=CTR` 스코프·SUPER 미지정 전 법인 가시. `listRuns` fixture 신설(p12-fixtures).

### Verify — DONE (S286)
- `npx tsc --noEmit` → exit 0. `eslint`(3 changed files) → 0 errors.
- `payroll-cross-tenant.spec.ts` **19/19 pass** (신규 list-scope 3 포함; 동시-세션이 carve-out 6케이스를 status-agnostic으로 robust화한 버전과 정합).
- `payroll-operations.spec.ts`: GET-list·EMPLOYEE RBAC 등 **37 pass**. 잔여 2 실패 = `POST /runs` 2099-03/2099-04 **409 (공유 DB 선존 데이터)** — 본 변경 무관(POST 로직 불변·해당 run 선존 확인). 6 = serial cascade skip. [[hrhub-e2e-shared-seed-pollution]].
