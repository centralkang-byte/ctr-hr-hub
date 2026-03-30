-- CreateTable
CREATE TABLE "simulation_scenarios" (
    "id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "company_id" TEXT,
    "mode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "parameters" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulation_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "simulation_scenarios_company_id_idx" ON "simulation_scenarios"("company_id");

-- CreateIndex
CREATE INDEX "simulation_scenarios_mode_idx" ON "simulation_scenarios"("mode");

-- CreateIndex
CREATE INDEX "simulation_scenarios_created_by_idx" ON "simulation_scenarios"("created_by");

-- AddForeignKey
ALTER TABLE "simulation_scenarios" ADD CONSTRAINT "simulation_scenarios_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
