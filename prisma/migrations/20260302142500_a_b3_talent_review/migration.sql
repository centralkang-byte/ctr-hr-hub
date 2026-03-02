-- AlterEnum
ALTER TYPE "AiFeature" ADD VALUE 'EVAL_DRAFT_GENERATION';

-- AlterTable
ALTER TABLE "one_on_ones" ADD COLUMN     "sentiment_tag" TEXT;

-- AlterTable
ALTER TABLE "succession_candidates" ADD COLUMN     "development_note" TEXT,
ADD COLUMN     "ranking" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ai_evaluation_drafts" (
    "id" TEXT NOT NULL,
    "evaluation_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "draft_content" JSONB NOT NULL,
    "input_summary" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "manager_edits" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_evaluation_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bias_detection_logs" (
    "id" TEXT NOT NULL,
    "evaluation_cycle" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "bias_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "details" JSONB,
    "is_acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bias_detection_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ai_evaluation_drafts" ADD CONSTRAINT "ai_evaluation_drafts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_evaluation_drafts" ADD CONSTRAINT "ai_evaluation_drafts_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_evaluation_drafts" ADD CONSTRAINT "ai_evaluation_drafts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bias_detection_logs" ADD CONSTRAINT "bias_detection_logs_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bias_detection_logs" ADD CONSTRAINT "bias_detection_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
