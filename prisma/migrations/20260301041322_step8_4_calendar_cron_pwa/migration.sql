-- AlterTable
ALTER TABLE "interview_schedules" ADD COLUMN     "calendar_event_id" TEXT,
ADD COLUMN     "teams_auto_scheduled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "leave_promotion_logs" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "step" INTEGER NOT NULL,
    "remaining_days" DECIMAL(65,30) NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_promotion_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leave_promotion_logs_employee_id_year_step_key" ON "leave_promotion_logs"("employee_id", "year", "step");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_employee_id_endpoint_key" ON "push_subscriptions"("employee_id", "endpoint");

-- AddForeignKey
ALTER TABLE "leave_promotion_logs" ADD CONSTRAINT "leave_promotion_logs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
