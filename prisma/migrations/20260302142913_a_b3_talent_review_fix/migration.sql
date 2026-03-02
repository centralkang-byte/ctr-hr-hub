-- CreateIndex
CREATE INDEX "ai_evaluation_drafts_evaluation_id_idx" ON "ai_evaluation_drafts"("evaluation_id");

-- CreateIndex
CREATE INDEX "ai_evaluation_drafts_employee_id_idx" ON "ai_evaluation_drafts"("employee_id");

-- CreateIndex
CREATE INDEX "ai_evaluation_drafts_reviewer_id_idx" ON "ai_evaluation_drafts"("reviewer_id");

-- CreateIndex
CREATE INDEX "ai_evaluation_drafts_company_id_idx" ON "ai_evaluation_drafts"("company_id");

-- CreateIndex
CREATE INDEX "bias_detection_logs_reviewer_id_idx" ON "bias_detection_logs"("reviewer_id");

-- CreateIndex
CREATE INDEX "bias_detection_logs_company_id_idx" ON "bias_detection_logs"("company_id");

-- AddForeignKey
ALTER TABLE "ai_evaluation_drafts" ADD CONSTRAINT "ai_evaluation_drafts_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "performance_evaluations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
