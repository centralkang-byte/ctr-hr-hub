-- CreateTable
CREATE TABLE IF NOT EXISTS "bulk_movement_executions" (
  "id" VARCHAR(36) NOT NULL,
  "company_id" VARCHAR(36) NOT NULL,
  "movement_type" VARCHAR(50) NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "total_rows" INTEGER NOT NULL,
  "applied_rows" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
  "executed_by" VARCHAR(36) NOT NULL,
  "executed_at" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "error_details" JSONB,

  CONSTRAINT "bulk_movement_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_bme_company" ON "bulk_movement_executions"("company_id");
CREATE INDEX "idx_bme_executed_at" ON "bulk_movement_executions"("executed_at");

-- AddForeignKey (only if companies and employees tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
    ALTER TABLE "bulk_movement_executions" ADD CONSTRAINT "fk_bme_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') THEN
    ALTER TABLE "bulk_movement_executions" ADD CONSTRAINT "fk_bme_executor" FOREIGN KEY ("executed_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
