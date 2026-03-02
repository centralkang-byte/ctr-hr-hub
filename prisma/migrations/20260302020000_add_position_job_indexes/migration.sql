-- Add missing indexes on positions.job_id and positions.job_grade_id
-- These columns are FK lookup columns and benefit from indexing
CREATE INDEX "positions_job_id_idx" ON "positions"("job_id");
CREATE INDEX "positions_job_grade_id_idx" ON "positions"("job_grade_id");
