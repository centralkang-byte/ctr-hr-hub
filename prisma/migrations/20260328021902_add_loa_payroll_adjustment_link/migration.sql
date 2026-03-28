-- AlterTable
ALTER TABLE "payroll_adjustments" ADD COLUMN     "loa_id" TEXT,
ADD COLUMN     "loa_year_month" TEXT;

-- CreateIndex
CREATE INDEX "payroll_adjustments_loa_id_idx" ON "payroll_adjustments"("loa_id");

-- AddForeignKey
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_loa_id_fkey" FOREIGN KEY ("loa_id") REFERENCES "leave_of_absences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
