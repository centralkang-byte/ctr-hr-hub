-- Reconcile schema objects that were historically applied via db push while
-- preserving the explicit post-launch deferral of the partial RLS rollout.
--
-- This migration targets the existing shared database history. The legacy
-- migration chain still requires a separate baseline-consolidation project
-- before it can bootstrap an empty database.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

-- The legacy bulk-movement table has no Prisma model or code consumer. Never
-- discard an environment's audit rows silently: an occupied table is a hard
-- stop that requires manual export and review.
DO $$
DECLARE
  orphan_row_count BIGINT;
BEGIN
  IF to_regclass('public.bulk_movement_executions') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.bulk_movement_executions'
      INTO orphan_row_count;

    IF orphan_row_count <> 0 THEN
      RAISE EXCEPTION
        'Refusing to drop bulk_movement_executions: % rows exist',
        orphan_row_count;
    END IF;

    EXECUTE 'DROP TABLE public.bulk_movement_executions RESTRICT';
  END IF;
END $$;

-- Offboarding company_id is a tenant anchor. Historical db push used Prisma's
-- optional-relation default (SET NULL), while the reviewed migration contract
-- requires RESTRICT. Replace only a missing or weaker constraint.
DO $$
DECLARE
  current_delete_action "char";
BEGIN
  SELECT c.confdeltype
    INTO current_delete_action
  FROM pg_constraint c
  WHERE c.conrelid = 'public.employee_offboarding'::regclass
    AND c.conname = 'employee_offboarding_company_id_fkey'
    AND c.contype = 'f';

  IF current_delete_action IS DISTINCT FROM 'r' THEN
    IF current_delete_action IS NOT NULL THEN
      ALTER TABLE "employee_offboarding"
        DROP CONSTRAINT "employee_offboarding_company_id_fkey";
    END IF;

    ALTER TABLE "employee_offboarding"
      ADD CONSTRAINT "employee_offboarding_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Two historical migrations enabled a five-table partial RLS island. The
-- application-wide tenant context required by those policies is explicitly
-- deferred until post-launch. Keep clean/current environments aligned with
-- that decision; the future scripts/db/sql/rls_setup.sql recreates them.
DROP POLICY IF EXISTS "rls_super_admin_employee_rrns" ON "employee_rrns";
DROP POLICY IF EXISTS "rls_hr_employee_rrns" ON "employee_rrns";
DROP POLICY IF EXISTS "rls_employee_own_employee_rrns" ON "employee_rrns";

DROP POLICY IF EXISTS "rls_super_admin_employee_addresses" ON "employee_addresses";
DROP POLICY IF EXISTS "rls_hr_employee_addresses" ON "employee_addresses";
DROP POLICY IF EXISTS "rls_employee_own_employee_addresses" ON "employee_addresses";

DROP POLICY IF EXISTS "rls_super_admin_employee_bank_accounts" ON "employee_bank_accounts";
DROP POLICY IF EXISTS "rls_hr_employee_bank_accounts" ON "employee_bank_accounts";
DROP POLICY IF EXISTS "rls_employee_own_employee_bank_accounts" ON "employee_bank_accounts";

DROP POLICY IF EXISTS "rls_super_admin_korea_social_insurance" ON "korea_social_insurance";
DROP POLICY IF EXISTS "rls_hr_korea_social_insurance" ON "korea_social_insurance";
DROP POLICY IF EXISTS "rls_employee_own_korea_social_insurance" ON "korea_social_insurance";

DROP POLICY IF EXISTS "rls_super_admin_employee_statutory_status" ON "employee_statutory_status";
DROP POLICY IF EXISTS "rls_hr_employee_statutory_status" ON "employee_statutory_status";
DROP POLICY IF EXISTS "rls_employee_own_employee_statutory_status" ON "employee_statutory_status";

ALTER TABLE "employee_rrns" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "employee_rrns" DISABLE ROW LEVEL SECURITY;

ALTER TABLE "employee_addresses" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "employee_addresses" DISABLE ROW LEVEL SECURITY;

ALTER TABLE "employee_bank_accounts" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "employee_bank_accounts" DISABLE ROW LEVEL SECURITY;

ALTER TABLE "korea_social_insurance" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "korea_social_insurance" DISABLE ROW LEVEL SECURITY;

ALTER TABLE "employee_statutory_status" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "employee_statutory_status" DISABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS public.current_company_id() RESTRICT;
DROP FUNCTION IF EXISTS public.current_user_role() RESTRICT;
DROP FUNCTION IF EXISTS public.current_employee_id() RESTRICT;

COMMIT;
