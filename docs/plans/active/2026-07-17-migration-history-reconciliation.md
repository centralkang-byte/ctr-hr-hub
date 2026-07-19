# Migration History Reconciliation and S342 Release Preflight

> Date: 2026-07-17
> Status: Completed
> Scope: Existing shared PostgreSQL migration metadata, current-schema drift repair, CTR-CN attendance timezone, and isolated concurrency verification

> **Historical execution record — do not rerun.** The shared database completed this
> sequence in S343. Imperative details below document the safety gates used during that
> run; they are not reusable instructions for another environment. See section 8 before
> any clean-bootstrap or environment-recovery work.

## 1. Objective

Restore Prisma migration history for the existing shared database without replaying SQL that was already applied through historical `db push` or manual patches. Then close the remaining S342 release blockers:

1. reconcile one failed migration and baseline twenty-two of the twenty-three unrecorded migrations;
2. execute the original pending trend-index migration, align both tenant-anchor relations with `RESTRICT`, and neutralize one orphan migration object;
3. set the CTR-CN attendance timezone to `Asia/Shanghai`;
4. run the opt-in database concurrency suites against a dedicated test database.

Two `prisma/schema.prisma` clarifications are required:

- make `TalentPoolEntry.company` explicitly `onDelete: Restrict`, matching the live DB, historical migration, and tenant-anchor policy;
- make `EmployeeOffboarding.company` explicitly `onDelete: Restrict`; its historical migration intended `RESTRICT`, while an earlier `db push` left the live FK at `SET NULL`, so the forward reconciliation migration must strengthen that one physical constraint.

## 2. Ground truth captured before writes

- Prisma CLI: `7.5.0`.
- `prisma migrate status`: 49 migration directories, 23 reported as unapplied.
- `_prisma_migrations`: 25 completed rows plus one failed row, `20260302180319_a_benefit_claims`.
- The failed migration stopped on a then-missing `exchange_rates.updated_at` column. Its three benefit tables and the final Prisma model shape now exist, so the migration was completed later through schema synchronization.
- Live DB to `schema.prisma` diff initially contains exactly:
  - missing `attendances(company_id, work_date)` index;
  - missing `leave_requests(company_id, status, start_date)` index;
  - Prisma's implicit optional-relation default expects `ON DELETE SET NULL`, but `talent_pool_entries.company_id` is a PII tenant anchor and the live DB plus historical migration intentionally use `ON DELETE RESTRICT`. The schema relation must be made explicit; the DB constraint must not be weakened.
- `bulk_movement_executions` is absent from the live DB and has no schema or code consumer. The old migration creates it. The compensating migration may drop it only when it is empty; any rows cause a hard failure for manual inspection.
- `employee_offboarding.company_id` has zero NULL rows, so changing its delete action from `SET NULL` to the intended `RESTRICT` does not require data repair.
- Two unrecorded migrations also contain RLS side effects that Prisma schema diff cannot see. Live DB has no helper functions, policies, `ENABLE RLS`, or `FORCE RLS` state on `employee_rrns`, `employee_addresses`, `employee_bank_accounts`, `korea_social_insurance`, or `employee_statutory_status`. This matches the recorded decision to defer global RLS reapplication until post-launch tenant-context plumbing exists. The compensating migration must preserve that decision for clean databases instead of silently enabling a partial five-table RLS island.
- Data checks passed:
  - no duplicate payroll run key;
  - no duplicate attendance employee/work-date key;
  - all 5 offboarding rows have `company_id`;
  - the one talent-pool row has `company_id`.

## 3. Migration metadata baseline applied

The following 23 migrations were marked as applied with
`prisma migrate resolve --applied`. This recorded the already-materialized state and did
not execute their SQL.

1. `20260302180319_a_benefit_claims` — failed history row, schema manually completed later
2. `20260303012711_a_kpi_dashboard`
3. `20260303020416_b_b8_skill_matrix`
4. `20260303024832_a_b7_global_payroll`
5. `20260303030000_notification_system`
6. `20260320110806_add_worklocation_locale_costcenter`
7. `20260321000000_add_bulk_movement_executions` — intentionally neutralized by the repair migration
8. `20260327200000_job_grade_refactor_titles`
9. `20260327300000_add_grade_title_mapping`
10. `20260328021902_add_loa_payroll_adjustment_link`
11. `20260328100000_add_leave_of_absence`
12. `20260329152829_add_simulation_scenarios`
13. `20260420000000_sync_soft_delete_drift`
14. `20260504051141_add_department_head_employee_id`
15. `20260514180640_add_code_master`
16. `20260514182825_extend_employee_legacy_fields`
17. `20260514223310_add_employee_supporting_models`
18. `20260608185616_add_payroll_run_unique`
19. `20260610090000_add_employee_offboarding_company_id`
20. `20260610141459_attendance_policy_gates`
21. `20260614110501_add_file_uploads`
22. `20260615222236_drop_employee_leave_balances`
23. `20260618120000_add_talent_pool_company_id` — live FK already matches the intended `RESTRICT` policy

At execution time, `20260613120000_attendance_leave_trend_idx` was intentionally not
resolved because its two indexes were genuinely absent. `prisma migrate deploy` then
executed that original migration before the new reconciliation migration.

The run was configured to stop immediately on any unexpected migration state. A partial
metadata baseline would have remained resumable because these resolve commands executed
no schema SQL.

## 4. Compensating migration applied

One protected migration was created after independent review. It is idempotent where
practical and contains only:

1. detect `bulk_movement_executions`; if it exists and contains rows, raise an exception; otherwise drop the empty table;
2. replace `employee_offboarding_company_id_fkey` only when its current delete action is not `RESTRICT`;
3. drop the 15 RLS policies introduced only by the two unrecorded employee-sensitive-data migrations;
4. remove `FORCE ROW LEVEL SECURITY` and disable RLS on their five tables;
5. drop `current_company_id()`, `current_user_role()`, and `current_employee_id()` only after those policies are removed. The deferred `scripts/db/sql/rls_setup.sql` remains the future RLS source and recreates the helpers when that separate project is approved.

All statements were wrapped in one explicit PostgreSQL transaction with local lock and
statement timeouts. The original pending trend-index migration used regular indexes;
this was acceptable for the inspected shared tables (`attendances` about 13.7k rows /
6.8 MB; `leave_requests` 252 rows). Post-deployment verification checked index
definitions plus `indisvalid`/`indisready`, not only names.

The migration changed no application tables beyond these known differences and edited no
historical migration files.

Post-deployment Gate 2 limitation: the guarded `count(*)` and `DROP TABLE` do not acquire an explicit `ACCESS EXCLUSIVE` lock before the count, so that branch is not a general-purpose cleanup for an environment where concurrent writers may still use `bulk_movement_executions`. The inspected shared database had no such table, so the branch did not execute. The applied migration is now checksum-immutable; do not run this reconciliation against another environment without an environment-specific preflight that stops writers or a replacement clean baseline.

After the 23 metadata resolves, `prisma migrate status` showed exactly two pending
migrations: `20260613120000_attendance_leave_trend_idx` and this reconciliation migration.
`prisma migrate deploy` executed them in timestamp order.

## 5. Verification gates

After deployment:

```bash
npx prisma migrate status
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma
```

Expected results:

- `Database schema is up to date`;
- no live DB to Prisma schema difference;
- all pre-write data invariants remain unchanged;
- benefit, attendance, leave, talent-pool, and offboarding objects remain present.
- the five deferred-RLS tables still report `relrowsecurity = false`, `relforcerowsecurity = false`, with no policies or helper functions.

## 6. CTR-CN timezone correction

The verified precondition was `Company.code = 'CTR-CN'` with
`Company.timezone = 'Asia/Shanghai'` and exactly one attendance setting.

Only that attendance-setting row was updated from `Asia/Seoul` to `Asia/Shanghai` in one
transaction. Before/after values were captured and the audit was rerun:

```bash
npx tsx scripts/audit-attendance-timezones.ts
```

Expected result: zero unsupported zones and zero unapproved setting/company mismatches.

## 7. Isolated concurrency verification

`TEST_DATABASE_URL` was absent. Homebrew PostgreSQL 17.9 and pgvector 0.8.2 were installed locally, and the PostgreSQL service was registered. Because the attendance harness requires a standalone `test` token, the dedicated database name must contain `test` delimited by `_` or `-` and must not equal `DATABASE_URL`.

Executed path:

1. verify the local PostgreSQL service and create a disposable database;
2. create `ctr_hr_hub_test_s342`;
3. use `prisma db push` to materialize the current Prisma schema; do not use the broken historical migration replay for this test database;
4. insert the global `HR_ADMIN` role required by both fixture builders;
5. set `RUN_DB_CONCURRENCY_TESTS=1` and `TEST_DATABASE_URL` only for the test process;
6. run both concurrency specs with a dedicated Playwright configuration that has no app server or shared-database setup;
7. confirm all 16 tests pass and fixture counts return to zero, including the final
   cross-company future-assignment rollback cases.

Do not point the concurrency suites at the shared DB, even temporarily.

## 8. Known separate debt: clean migration replay

Independent Gate 1 review confirmed that the historical migration chain cannot build an empty database:

- `20260302180319_a_benefit_claims` alters tables/columns created only by a later migration;
- `20260328021902_add_loa_payroll_adjustment_link` references `payroll_adjustments` absent from the migration chain and `leave_of_absences` created by the following migration.

This task must not rewrite or squash all 49 historical migrations. Its success criterion is that the existing shared DB becomes migration-current and accepts future additive migrations. A dedicated post-S342 baseline-consolidation project must archive/squash the broken history and prove empty-database replay separately.

## 9. Completion

Completed results:

- all 50 migrations are recorded as applied and the shared database reports up to date;
- the shared database and `prisma/schema.prisma` have no detected difference;
- the CTR-CN setting now matches `Asia/Shanghai`, and the audit passes for all 12 companies;
- all 16 isolated attendance/LOA concurrency tests pass with zero retained fixtures;
- TypeScript, Prisma validation, production build, 1,018 unit tests, and focused concurrency verification pass;
- lint exits successfully with only the repository's pre-existing warnings outside this change set;
- independent Gate 2 P1 findings were incorporated into the concurrency harness, and the applied-migration P2 reuse limitation is documented above.

The migration, timezone, and isolated-database preflight is complete. S345 resolved the
cross-module primary-assignment writer serialization blocker, and S346 closed the related
master-row deletion and Position-reference writer races recorded in the
attendance-correction plan. The separate clean-bootstrap debt in section 8 remains open.
