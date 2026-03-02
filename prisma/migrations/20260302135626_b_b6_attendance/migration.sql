-- AlterTable
ALTER TABLE "attendance_settings" ADD COLUMN     "alert_thresholds" JSONB NOT NULL DEFAULT '{"caution":44,"warning":48,"blocked":52}',
ADD COLUMN     "enable_blocking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul';

-- CreateTable
CREATE TABLE "work_hour_alerts" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "total_hours" DOUBLE PRECISION NOT NULL,
    "alert_level" VARCHAR(20) NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolve_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_hour_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_hour_alerts_employee_id_week_start_idx" ON "work_hour_alerts"("employee_id", "week_start");

-- CreateIndex
CREATE INDEX "work_hour_alerts_alert_level_is_resolved_idx" ON "work_hour_alerts"("alert_level", "is_resolved");

-- CreateIndex
CREATE UNIQUE INDEX "work_hour_alerts_employee_id_week_start_alert_level_key" ON "work_hour_alerts"("employee_id", "week_start", "alert_level");

-- AddForeignKey
ALTER TABLE "work_hour_alerts" ADD CONSTRAINT "work_hour_alerts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
