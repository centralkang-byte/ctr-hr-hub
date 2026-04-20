-- Sync soft-delete drift for positions + hr_documents (drop is_active, add deleted_at).
-- Staging/prod already in this state via Session 175b `db push --accept-data-loss`;
-- this migration exists so `prisma migrate deploy` on clean DBs reaches the same state.
-- See issue #12 for broader soft-delete drift tracking across ~20 tables.

-- ─── positions ─────────────────────────────────────────────
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'positions'
      AND column_name = 'is_active'
  ) THEN
    UPDATE "positions"
    SET "deleted_at" = NOW()
    WHERE "is_active" = false
      AND "deleted_at" IS NULL;
  END IF;
END $$;

ALTER TABLE "positions" DROP COLUMN IF EXISTS "is_active";

-- ─── hr_documents ──────────────────────────────────────────
ALTER TABLE "hr_documents" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hr_documents'
      AND column_name = 'is_active'
  ) THEN
    UPDATE "hr_documents"
    SET "deleted_at" = NOW()
    WHERE "is_active" = false
      AND "deleted_at" IS NULL;
  END IF;
END $$;

ALTER TABLE "hr_documents" DROP COLUMN IF EXISTS "is_active";
