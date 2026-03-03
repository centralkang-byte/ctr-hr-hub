-- CreateTable
CREATE TABLE "leave_type_defs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100),
    "is_paid" BOOLEAN NOT NULL DEFAULT true,
    "allow_half_day" BOOLEAN NOT NULL DEFAULT true,
    "requires_proof" BOOLEAN NOT NULL DEFAULT false,
    "max_consecutive_days" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_type_defs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_accrual_rules" (
    "id" TEXT NOT NULL,
    "leave_type_def_id" TEXT NOT NULL,
    "accrual_type" VARCHAR(20) NOT NULL DEFAULT 'annual',
    "accrual_basis" VARCHAR(20) NOT NULL DEFAULT 'calendar_year',
    "rules" JSONB NOT NULL,
    "carry_over_type" VARCHAR(20) NOT NULL DEFAULT 'none',
    "carry_over_max_days" INTEGER,
    "carry_over_expiry_months" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_accrual_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_year_balances" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "leave_type_def_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "entitled" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "used" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carried_over" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adjusted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pending" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_year_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_approval_requests" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "request_type" VARCHAR(30) NOT NULL,
    "reference_id" TEXT,
    "title" VARCHAR(200) NOT NULL,
    "details" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "approval_flow_id" TEXT,
    "current_step" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_approval_steps" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "approver_id" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "comment" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leave_type_defs_company_id_code_key" ON "leave_type_defs"("company_id", "code");

-- CreateIndex
CREATE INDEX "leave_year_balances_employee_id_year_idx" ON "leave_year_balances"("employee_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "leave_year_balances_employee_id_leave_type_def_id_year_key" ON "leave_year_balances"("employee_id", "leave_type_def_id", "year");

-- CreateIndex
CREATE INDEX "attendance_approval_requests_requester_id_status_idx" ON "attendance_approval_requests"("requester_id", "status");

-- CreateIndex
CREATE INDEX "attendance_approval_requests_company_id_status_idx" ON "attendance_approval_requests"("company_id", "status");

-- CreateIndex
CREATE INDEX "attendance_approval_requests_company_id_request_type_status_idx" ON "attendance_approval_requests"("company_id", "request_type", "status");

-- CreateIndex
CREATE INDEX "attendance_approval_steps_request_id_step_order_idx" ON "attendance_approval_steps"("request_id", "step_order");

-- AddForeignKey
ALTER TABLE "leave_type_defs" ADD CONSTRAINT "leave_type_defs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_accrual_rules" ADD CONSTRAINT "leave_accrual_rules_leave_type_def_id_fkey" FOREIGN KEY ("leave_type_def_id") REFERENCES "leave_type_defs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_year_balances" ADD CONSTRAINT "leave_year_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_year_balances" ADD CONSTRAINT "leave_year_balances_leave_type_def_id_fkey" FOREIGN KEY ("leave_type_def_id") REFERENCES "leave_type_defs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_approval_requests" ADD CONSTRAINT "attendance_approval_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_approval_requests" ADD CONSTRAINT "attendance_approval_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_approval_steps" ADD CONSTRAINT "attendance_approval_steps_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "attendance_approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_approval_steps" ADD CONSTRAINT "attendance_approval_steps_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
