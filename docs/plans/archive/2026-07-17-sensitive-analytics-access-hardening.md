# Sensitive Analytics Access Hardening

> Date: 2026-07-17
> Status: Complete
> Decision source: S341 CEO decision in `2026-07-12-launch-readiness-audit-triage.md`

## Objective

Restrict succession planning and gender pay gap data to `HR_ADMIN` and
`SUPER_ADMIN`, then make the approved HR-only reports discoverable without
mislabeling the existing talent pool.

## Current Risk

- `/succession` has no page ACL and therefore any authenticated role can reach its
  shell. Its APIs reject unauthorized users, but the page-level information
  architecture fails open.
- `/analytics/gender-pay-gap` inherits the broad `/analytics` `MANAGER_UP` ACL.
- Both gender pay gap APIs use the general analytics `VIEW` permission, which is
  intentionally granted to managers and executives for other dashboards.
- `/api/v1/employees/[id]/insights` returns succession readiness, notes, and the
  target position under the general employee `VIEW` permission. Employees can
  retrieve their own entry, and managers/executives can retrieve same-company
  entries.
- The command palette is a hardcoded, unfiltered menu list and exposes succession
  navigation to roles that cannot use it.
- The legacy `scripts/qa-fix-perms.ts` grants `succession:read` to `MANAGER` and
  `EXECUTIVE`. The master seed does not grant it, but it also does not remove
  excess role-permission rows, so shared databases may retain the old access.
- The report has no navigation entry, so authorized HR users must know the URL.

## Scope

1. Add specific page ACL rules for `/succession` and
   `/analytics/gender-pay-gap` before the broad `/analytics` rule.
2. Add a specific API ACL rule for `/api/v1/analytics/gender-pay-gap` before the
   broad analytics API rule.
3. Add an HR-only API ACL for `/api/v1/succession`, independent of database
   permission rows, so every succession API is fail-closed for non-HR roles.
4. Add explicit HR-role checks to both gender pay gap handlers as defense in
   depth. For the cached JSON route, an outer `withAuth` role gate must run before
   `withCache`; otherwise a cache hit skips the inner permission and role checks.
   Existing manager/executive cache entries do not require invalidation because
   the new outer gate rejects those roles before any cache lookup.
5. Resolve the current navigation label mismatch by linking `Talent Pool` to
   `/recruitment/talent-pool` and adding a distinct `Succession Planning` item for
   `/talent/succession`, both inside the existing HR-only recruitment section.
6. Add the gender pay gap report under the HR-only `Performance & Compensation`
   navigation section using the existing `nav.insights.genderPayGap` key.
7. Return `successionEntry: null` from employee insights for every non-HR role and
   skip the succession query entirely for those requests.
8. Filter command-palette menu and recent-page results through `findRouteRule`, so
   the same route ACL controls both middleware access and search visibility.
9. Remove every non-HR succession grant from the master seed and
   `scripts/qa-fix-perms.ts`, including the latent executive export grant. Add a
   narrowly scoped, confirmation-gated cleanup script that only deletes
   `succession:*` role-permission rows for `EMPLOYEE`, `MANAGER`, and
   `EXECUTIVE`. Run it in dry-run mode first, inspect exact targets, and execute
   only after explicit database-write approval.
10. Add unit coverage for ACL roles and prefix ordering, plus role-boundary E2E
   coverage for both succession aliases, the gender pay gap page, and both APIs.
   Add employee-insights API coverage proving succession data is absent for
   `EMPLOYEE`, `MANAGER`, and `EXECUTIVE` while remaining available to HR when a
   seeded entry exists.

## Non-goals

- Do not change the broad analytics access policy.
- Do not change individual `/api/v1/succession/*` handler logic or tenant filters;
  the API prefix ACL and corrected role-permission data enforce the approved
  policy centrally.
- Do not change sidebar sections, section ordering, or unrelated navigation items.
- Do not change gender pay gap calculations, cache key/scope, export format, or
  tenant filtering.
- Do not add or edit translation keys.

## Expected Files

- `src/lib/rbac/rbac-spec.ts`
- `src/config/navigation.ts` (protected; unlock only for this task)
- `src/app/api/v1/analytics/gender-pay-gap/route.ts`
- `src/app/api/v1/analytics/gender-pay-gap/export/route.ts`
- `src/app/api/v1/employees/[id]/insights/route.ts`
- `src/components/command-palette/CommandPalette.tsx`
- `prisma/seed.ts`
- `scripts/qa-fix-perms.ts`
- `scripts/revoke-non-hr-succession-permissions.ts`
- `tests/unit/rbac/rbac-consistency.test.ts`
- `e2e/api/analytics-compliance-org.spec.ts`
- `e2e/api/employee-insights-cross-company.spec.ts`
- `e2e/api/peer-review-succession-competency.spec.ts`
- `e2e/flows/rbac-boundary.spec.ts`

## Verification

1. `npx vitest run tests/unit/rbac/rbac-consistency.test.ts`
2. `npx tsc --noEmit`
3. `npm run lint` with no new warnings
4. Verify both `MANAGER` and `EXECUTIVE` receive 403 from the JSON and export APIs,
   including a cached-route request. Verify HR remains 200.
5. Verify representative succession API requests return 403 for `EMPLOYEE`,
   `MANAGER`, and `EXECUTIVE`, regardless of legacy permission rows. Verify both
   `/succession` and `/talent/succession` follow the same page policy.
6. Run the succession permission cleanup in dry-run mode, record exact rows, then
   run the confirmed cleanup and verify no non-HR `succession:*` rows remain.
   Browser tests must also prove command-palette results and sidebar navigation
   hide succession/gender-pay-gap from non-HR roles and show them to HR.
7. Targeted API E2E when the local test environment is available:
   `npx playwright test e2e/api/analytics-compliance-org.spec.ts e2e/api/employee-insights-cross-company.spec.ts e2e/api/peer-review-succession-competency.spec.ts --project=api`
8. Targeted browser RBAC E2E when the local test environment is available:
   `npx playwright test e2e/flows/rbac-boundary.spec.ts --project=browser`
9. Independent diff review with all P0/P1 findings fixed before commit.

## Rollback

Revert the implementation commit. No schema or migration changes are involved.
The permission cleanup only removes obsolete non-HR `succession:*` grants; if
the product policy is later reversed, restore those grants through the master seed
or a separately reviewed permission change rather than reverting unrelated data.

## Completion Evidence

- Shared DB cleanup dry-run found exactly one obsolete row:
  `EXECUTIVE:succession:export`. The confirmed transaction deleted it and the
  follow-up dry-run returned `none`.
- Independent Gate 2 review: GO, no P0/P1 findings.
- Production build: pass with `NODE_OPTIONS=--max-old-space-size=8192`.
- TypeScript, lint, and `git diff --check`: pass; lint retained the existing
  warning baseline with no new warning from this change.
- Unit tests: 32 passed, including cache-HIT-before-auth and direct-export
  handler regression coverage.
- Targeted API E2E: 15 passed for gender pay gap and succession role boundaries;
  8 passed for real-candidate employee-insights visibility.
- Targeted browser E2E: 12 passed for page ACLs, sidebar visibility, command
  palette results, and stale recent-page filtering.
