-- CreateTable
CREATE TABLE "grade_title_mappings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "job_grade_id" TEXT NOT NULL,
    "employee_title_id" TEXT NOT NULL,

    CONSTRAINT "grade_title_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "grade_title_mappings_company_id_job_grade_id_key" ON "grade_title_mappings"("company_id", "job_grade_id");

-- AddForeignKey
ALTER TABLE "grade_title_mappings" ADD CONSTRAINT "grade_title_mappings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_title_mappings" ADD CONSTRAINT "grade_title_mappings_job_grade_id_fkey" FOREIGN KEY ("job_grade_id") REFERENCES "job_grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_title_mappings" ADD CONSTRAINT "grade_title_mappings_employee_title_id_fkey" FOREIGN KEY ("employee_title_id") REFERENCES "employee_titles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
