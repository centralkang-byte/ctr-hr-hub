-- CreateTable
CREATE TABLE "file_uploads" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "uploader_employee_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "declared_size" INTEGER,
    "actual_size" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "consumed_by_type" TEXT,
    "consumed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "file_uploads_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "file_uploads_company_id_uploader_employee_id_status_idx" ON "file_uploads"("company_id", "uploader_employee_id", "status");
-- CreateIndex
CREATE INDEX "file_uploads_status_expires_at_idx" ON "file_uploads"("status", "expires_at");
