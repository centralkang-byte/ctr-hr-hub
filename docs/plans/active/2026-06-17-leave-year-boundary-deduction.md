# Leave Year-Boundary Deduction Fix (P1 data corruption)

> Date: 2026-06-17 · S322 · Status: APPROVED — implementing
> Policy (CEO 2026-06-17, after Codex Gate 1): **charge to START year** (Approach 1).
> Rationale: in the realistic case (Dec request for Dec→Jan leave) next-year's balance row
> doesn't exist yet, so strict date-split degenerates to start-year anyway. Start-year-everywhere
> is no-schema, ~7 files, and trivially consistent. Codex pushed date-split→persist (schema
> migration); CEO chose the simpler equivalent.

## 1. The bug (confirmed in code)

`leave_year_balances`: one row per `(employeeId, leaveTypeDefId, year)`. The approve route
deducts with raw SQL keyed on `year IN (startYear, endYear)` and applies the **full** `days`
to **every** matching row → a cross-year leave (Dec 28→Jan 3, 10d) deducts up to 20 days.
`src/app/api/v1/leave/requests/[id]/approve/route.ts:74-84`.

Plus: (a) **atomicity** — balance UPDATE and status→APPROVED are separate statements (not one
tx); (b) **lifecycle inconsistency** — create uses `new Date().getFullYear()` (current year),
approve uses start+end, reject uses start, cancel uses start→end fallback; (c) **dead handlers**
— `leave-approved/rejected/cancelled.handler.ts` are subscribed (`events/bootstrap.ts:62-64`)
but **0 publishers** → dead code with the same latent single-row/full-days bug.

## 2. Fix — single SSOT: balance year = START date's calendar year

### 2.1 New helper (testable)
`src/lib/leave/leaveBalanceYear.ts`:
```ts
export function getLeaveBalanceYear(date: Date | string): number  // new Date(date).getUTCFullYear()
```
UTC year matches the naive-UTC date storage and equals `getFullYear()` on the UTC runtime
(Vercel/prod). Single SSOT used by all four lifecycle routes so create/approve/reject/cancel
always agree (even for a request lingering PENDING across New Year — year comes from the
immutable `request.startDate`, not "now").

### 2.2 Routes — all on start-year, all in one `$transaction`, claim-status-first
- **create** (`requests/route.ts`): balance lookup `year: startYear` (was current year). Pending
  increment unchanged (already in tx).
- **approve** (`approve/route.ts`): rewrite into one `$transaction`:
  1. claim: `updateMany({where:{id, status:'PENDING', companyId}, data:{APPROVED...}})`, throw if
     count 0 (prevents concurrent double-approve — a latent bug the old order allowed);
  2. deduct: raw `UPDATE … year = ${startYear} AND (used+days) <= entitled+carried+adjusted RETURNING id`;
     if 0 rows → distinguish missing-row vs insufficient, throw (rolls back the claim);
  This makes balance+status atomic and concurrency-safe.
- **reject** (`reject/route.ts`): already start-year + tx; switch to `getLeaveBalanceYear`, add the
  same status-claim guard for symmetry/concurrency.
- **cancel** (`cancel/route.ts`): `findBalance` → start-year only (drop the endYear fallback, dead
  under start-year policy). Scenarios A/B/C unchanged otherwise (single-row restore is now correct).

### 2.3 Remove dead handlers (same track, same latent bug — [[feedback-decision-gating]])
Delete `leave-approved/rejected/cancelled.handler.ts` + their imports/subscribes in
`events/bootstrap.ts`. Keep the inert `LEAVE_*` type stubs in `types.ts` (`LEAVE_REQUESTED` is
reserved-for-future; no mutating code remains). Routes are the sole balance SSOT.

## 3. Files
- `src/lib/leave/leaveBalanceYear.ts` (new)
- `src/app/api/v1/leave/requests/route.ts` (create: start-year lookup)
- `src/app/api/v1/leave/requests/[id]/approve/route.ts` (atomic + start-year + claim)
- `src/app/api/v1/leave/requests/[id]/reject/route.ts` (helper + claim)
- `src/app/api/v1/leave/requests/[id]/cancel/route.ts` (findBalance start-year)
- `src/lib/events/bootstrap.ts` (remove 3 imports + 3 subscribes)
- delete `src/lib/events/handlers/leave-{approved,rejected,cancelled}.handler.ts`
- `tests/unit/leave/leave-balance-year.test.ts` (new)

## 4. Verification
- `npx tsc --noEmit` 0 · `npm run lint` 0 · vitest leave suites green
- Detection query (existing corruption — prod disposable [[hrhub-prod-db-disposable-prelaunch]],
  expect ~0): approved cross-year requests where a year row shows full-days double-charge / orphaned pending.
- Live dogfood: Dec-28→Jan-3 balance-type request → approve → assert ONLY start-year row -days,
  end-year row untouched, pending zeroed; reject/cancel restore exactly; concurrent double-approve blocked.
- Codex Gate 2 (money-adjacent + multi-tenant → mandatory)

## 5. Out of scope (flagged)
- Strict date-split + persisted allocation (Codex's option B) — follow-up only if far-future
  cross-year bookings (next-year row already exists at create) become material.
- negative-balance / 연초 자동갱신 / 마이너스 상환 policy — separate leave track.
