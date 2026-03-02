-- AlterTable
ALTER TABLE "applicants" ADD COLUMN     "birth_date" TIMESTAMP(3),
ADD COLUMN     "talent_pool_consent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "job_postings" ADD COLUMN     "is_internal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "position_id" TEXT,
ADD COLUMN     "requisition_id" TEXT;

-- AlterTable
ALTER TABLE "positions" ADD COLUMN     "is_filled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "requisitions" (
    "id" TEXT NOT NULL,
    "req_number" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "position_id" TEXT,
    "title" VARCHAR(200) NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "jobLevel" VARCHAR(20),
    "employmentType" VARCHAR(30) NOT NULL,
    "justification" TEXT NOT NULL,
    "requirements" JSONB,
    "urgency" VARCHAR(20) NOT NULL DEFAULT 'normal',
    "target_date" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "approval_flow_id" TEXT,
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisition_approvals" (
    "id" TEXT NOT NULL,
    "requisition_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "approver_id" TEXT,
    "approver_role" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "comment" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requisition_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_pool_entries" (
    "id" TEXT NOT NULL,
    "applicant_id" TEXT NOT NULL,
    "source_posting_id" TEXT,
    "pool_reason" VARCHAR(30) NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "consent_given" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_pool_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_duplicate_logs" (
    "id" TEXT NOT NULL,
    "candidate_a_id" TEXT NOT NULL,
    "candidate_b_id" TEXT NOT NULL,
    "match_type" VARCHAR(30) NOT NULL,
    "match_score" DOUBLE PRECISION NOT NULL,
    "resolution" VARCHAR(20),
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_duplicate_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "requisitions_req_number_key" ON "requisitions"("req_number");

-- CreateIndex
CREATE INDEX "requisitions_company_id_idx" ON "requisitions"("company_id");

-- CreateIndex
CREATE INDEX "requisitions_department_id_idx" ON "requisitions"("department_id");

-- CreateIndex
CREATE INDEX "requisitions_requester_id_idx" ON "requisitions"("requester_id");

-- CreateIndex
CREATE INDEX "requisitions_status_idx" ON "requisitions"("status");

-- CreateIndex
CREATE INDEX "requisition_approvals_requisition_id_idx" ON "requisition_approvals"("requisition_id");

-- CreateIndex
CREATE INDEX "requisition_approvals_approver_id_idx" ON "requisition_approvals"("approver_id");

-- CreateIndex
CREATE INDEX "talent_pool_entries_applicant_id_idx" ON "talent_pool_entries"("applicant_id");

-- CreateIndex
CREATE INDEX "talent_pool_entries_status_idx" ON "talent_pool_entries"("status");

-- CreateIndex
CREATE INDEX "talent_pool_entries_expires_at_idx" ON "talent_pool_entries"("expires_at");

-- CreateIndex
CREATE INDEX "candidate_duplicate_logs_candidate_a_id_idx" ON "candidate_duplicate_logs"("candidate_a_id");

-- CreateIndex
CREATE INDEX "candidate_duplicate_logs_candidate_b_id_idx" ON "candidate_duplicate_logs"("candidate_b_id");

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisition_approvals" ADD CONSTRAINT "requisition_approvals_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisition_approvals" ADD CONSTRAINT "requisition_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_pool_entries" ADD CONSTRAINT "talent_pool_entries_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "applicants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_pool_entries" ADD CONSTRAINT "talent_pool_entries_source_posting_id_fkey" FOREIGN KEY ("source_posting_id") REFERENCES "job_postings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_duplicate_logs" ADD CONSTRAINT "candidate_duplicate_logs_candidate_a_id_fkey" FOREIGN KEY ("candidate_a_id") REFERENCES "applicants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_duplicate_logs" ADD CONSTRAINT "candidate_duplicate_logs_candidate_b_id_fkey" FOREIGN KEY ("candidate_b_id") REFERENCES "applicants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
