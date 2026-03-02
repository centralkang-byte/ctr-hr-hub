-- CreateEnum
CREATE TYPE "KedoDocumentType" AS ENUM ('EMPLOYMENT_CONTRACT', 'SUPPLEMENTARY_AGREEMENT', 'TRANSFER_ORDER', 'VACATION_ORDER', 'DISMISSAL_ORDER', 'SALARY_CHANGE', 'DISCIPLINARY_ORDER');

-- CreateEnum
CREATE TYPE "KedoSignatureLevel" AS ENUM ('PEP', 'UNEP', 'UKEP');

-- CreateEnum
CREATE TYPE "KedoDocumentStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURE', 'SIGNED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MilitaryCategory" AS ENUM ('OFFICER', 'SOLDIER', 'RESERVIST', 'EXEMPT');

-- CreateEnum
CREATE TYPE "MilitaryFitness" AS ENUM ('FIT_A', 'FIT_B', 'FIT_C', 'FIT_D', 'UNFIT');

-- CreateEnum
CREATE TYPE "GdprConsentPurpose" AS ENUM ('EMPLOYMENT_PROCESSING', 'PAYROLL_PROCESSING', 'BENEFITS_ADMINISTRATION', 'PERFORMANCE_MANAGEMENT', 'TRAINING_RECORDS', 'HEALTH_SAFETY', 'MARKETING_COMMUNICATION', 'THIRD_PARTY_TRANSFER');

-- CreateEnum
CREATE TYPE "GdprConsentStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "GdprRequestType" AS ENUM ('ACCESS', 'RECTIFICATION', 'ERASURE', 'PORTABILITY', 'RESTRICTION', 'OBJECTION');

-- CreateEnum
CREATE TYPE "GdprRequestStatus" AS ENUM ('GDPR_PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DataRetentionCategory" AS ENUM ('EMPLOYMENT_RECORDS', 'PAYROLL_DATA', 'PERFORMANCE_DATA', 'TRAINING_RECORDS', 'RECRUITMENT_DATA', 'HEALTH_SAFETY', 'DISCIPLINARY_RECORDS', 'LEAVE_RECORDS', 'AUDIT_LOGS');

-- CreateEnum
CREATE TYPE "DpiaStatus" AS ENUM ('DPIA_DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SocialInsuranceType" AS ENUM ('PENSION', 'MEDICAL', 'UNEMPLOYMENT', 'WORK_INJURY', 'MATERNITY_INS', 'HOUSING_FUND');

-- CreateEnum
CREATE TYPE "MandatoryTrainingType" AS ENUM ('SEXUAL_HARASSMENT_PREVENTION', 'WORKPLACE_HARASSMENT', 'DISABILITY_AWARENESS', 'OCCUPATIONAL_SAFETY', 'PERSONAL_INFO_PROTECTION');

-- CreateEnum
CREATE TYPE "SeveranceInterimReason" AS ENUM ('HOUSING_PURCHASE', 'HOUSING_LEASE', 'MEDICAL_EXPENSE', 'BANKRUPTCY', 'NATURAL_DISASTER', 'OTHER_APPROVED');

-- CreateEnum
CREATE TYPE "SeveranceInterimStatus" AS ENUM ('SIP_PENDING', 'SIP_APPROVED', 'SIP_REJECTED', 'SIP_PAID');

-- CreateEnum
CREATE TYPE "ShiftPatternType" AS ENUM ('TWO_SHIFT', 'THREE_SHIFT', 'DAY_NIGHT_OFF', 'FOUR_ON_TWO_OFF', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ShiftScheduleStatus" AS ENUM ('SCHEDULED', 'WORKED', 'ABSENT', 'SWAPPED');

-- CreateEnum
CREATE TYPE "ShiftChangeRequestStatus" AS ENUM ('SCR_PENDING', 'SCR_APPROVED', 'SCR_REJECTED');

-- CreateEnum
CREATE TYPE "PayItemCategory" AS ENUM ('FIXED', 'VARIABLE', 'INCENTIVE');

-- CreateEnum
CREATE TYPE "DeductionCategory" AS ENUM ('STATUTORY', 'VOLUNTARY');

-- CreateEnum
CREATE TYPE "PayItemCalcMethod" AS ENUM ('FIXED_AMOUNT', 'RATE', 'FORMULA', 'BRACKET');

-- CreateEnum
CREATE TYPE "PayItemType" AS ENUM ('ALLOWANCE', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('PERMANENT_TRANSFER', 'TEMPORARY_TRANSFER', 'SECONDMENT');

-- CreateEnum
CREATE TYPE "EntityTransferStatus" AS ENUM ('TRANSFER_REQUESTED', 'FROM_APPROVED', 'TO_APPROVED', 'EXEC_APPROVED', 'TRANSFER_PROCESSING', 'TRANSFER_COMPLETED', 'TRANSFER_CANCELLED');

-- CreateEnum
CREATE TYPE "TransferDataType" AS ENUM ('HR_MASTER', 'PAYROLL', 'LEAVE', 'PERFORMANCE', 'TENURE');

-- CreateEnum
CREATE TYPE "TransferDataStatus" AS ENUM ('DATA_PENDING', 'DATA_MIGRATED', 'DATA_FAILED');

-- CreateEnum
CREATE TYPE "BankTransferFormat" AS ENUM ('CSV', 'XML', 'EBCDIC');

-- CreateEnum
CREATE TYPE "BankTransferBatchStatus" AS ENUM ('DRAFT', 'GENERATING', 'GENERATED', 'SUBMITTED', 'PARTIALLY_COMPLETED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BankTransferItemStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('INCOME_TAX', 'LOCAL_TAX', 'SOCIAL_INSURANCE', 'PENSION', 'HEALTH_INSURANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "MigrationJobStatus" AS ENUM ('DRAFT', 'VALIDATING', 'VALIDATED', 'RUNNING', 'COMPLETED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "MigrationDataScope" AS ENUM ('EMPLOYEES', 'ATTENDANCE', 'PAYROLL', 'LEAVE', 'PERFORMANCE', 'ALL');

-- CreateEnum
CREATE TYPE "MigrationLogLevel" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "M365ActionType" AS ENUM ('PROVISION', 'DISABLE', 'LICENSE_REVOKE', 'SHARED_MAILBOX_CONVERT', 'REACTIVATE');

-- CreateEnum
CREATE TYPE "M365ActionStatus" AS ENUM ('M365_PENDING', 'M365_SUCCESS', 'M365_FAILED');

-- CreateEnum
CREATE TYPE "RecruitmentCostType" AS ENUM ('AD_FEE', 'AGENCY_FEE', 'REFERRAL_BONUS', 'ASSESSMENT_TOOL', 'TRAVEL', 'RELOCATION', 'SIGNING_BONUS', 'OTHER');

-- DropIndex
DROP INDEX "uq_process_settings_global";

-- CreateTable
CREATE TABLE "military_registrations" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "category" "MilitaryCategory" NOT NULL,
    "rank" TEXT,
    "specialty_code" TEXT,
    "fitness_category" "MilitaryFitness" NOT NULL,
    "military_office" TEXT,
    "registration_date" TIMESTAMP(3),
    "deregistration_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "military_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kedo_documents" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "document_type" "KedoDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "status" "KedoDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "signature_level" "KedoSignatureLevel",
    "signature_hash" TEXT,
    "signed_at" TIMESTAMP(3),
    "signed_by_id" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejected_by_id" TEXT,
    "rejection_reason" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kedo_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_insurance_configs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "insurance_type" "SocialInsuranceType" NOT NULL,
    "city" TEXT NOT NULL,
    "employer_rate" DECIMAL(65,30) NOT NULL,
    "employee_rate" DECIMAL(65,30) NOT NULL,
    "base_min" DECIMAL(65,30) NOT NULL,
    "base_max" DECIMAL(65,30) NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_insurance_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_insurance_records" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "insurance_type" "SocialInsuranceType" NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "base_salary" DECIMAL(65,30) NOT NULL,
    "employer_amount" DECIMAL(65,30) NOT NULL,
    "employee_amount" DECIMAL(65,30) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_insurance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gdpr_consents" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "purpose" "GdprConsentPurpose" NOT NULL,
    "status" "GdprConsentStatus" NOT NULL DEFAULT 'ACTIVE',
    "consented_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "legal_basis" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gdpr_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gdpr_requests" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "request_type" "GdprRequestType" NOT NULL,
    "status" "GdprRequestStatus" NOT NULL DEFAULT 'GDPR_PENDING',
    "description" TEXT,
    "deadline" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "completed_by_id" TEXT,
    "response_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gdpr_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_retention_policies" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "category" "DataRetentionCategory" NOT NULL,
    "retention_months" INTEGER NOT NULL,
    "description" TEXT,
    "auto_delete" BOOLEAN NOT NULL DEFAULT false,
    "anonymize" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dpia_records" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "processing_scope" TEXT,
    "risk_level" TEXT,
    "mitigations" TEXT,
    "status" "DpiaStatus" NOT NULL DEFAULT 'DPIA_DRAFT',
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dpia_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pii_access_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "access_type" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pii_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mandatory_trainings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "training_type" "MandatoryTrainingType" NOT NULL,
    "year" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "required_hours" DECIMAL(65,30) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mandatory_trainings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "severance_interim_payments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "reason" "SeveranceInterimReason" NOT NULL,
    "amount" DECIMAL(65,30),
    "years_of_service" DECIMAL(65,30),
    "avg_salary" DECIMAL(65,30),
    "status" "SeveranceInterimStatus" NOT NULL DEFAULT 'SIP_PENDING',
    "request_date" TIMESTAMP(3) NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "attachment_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "severance_interim_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_patterns" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pattern_type" "ShiftPatternType" NOT NULL,
    "slots" JSONB NOT NULL,
    "cycle_days" INTEGER NOT NULL,
    "weekly_hours_limit" DECIMAL(65,30),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_groups" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "shift_pattern_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_group_members" (
    "id" TEXT NOT NULL,
    "shift_group_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMP(3),

    CONSTRAINT "shift_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_schedules" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "shift_pattern_id" TEXT NOT NULL,
    "shift_group_id" TEXT,
    "work_date" TIMESTAMP(3) NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "slot_name" TEXT,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "is_night_shift" BOOLEAN NOT NULL DEFAULT false,
    "status" "ShiftScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_change_requests" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "target_employee_id" TEXT,
    "original_date" TIMESTAMP(3) NOT NULL,
    "requested_date" TIMESTAMP(3),
    "original_slot_index" INTEGER NOT NULL,
    "requested_slot_index" INTEGER,
    "reason" TEXT NOT NULL,
    "status" "ShiftChangeRequestStatus" NOT NULL DEFAULT 'SCR_PENDING',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_allowance_types" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "PayItemCategory" NOT NULL,
    "is_tax_exempt" BOOLEAN NOT NULL DEFAULT false,
    "tax_exempt_limit" DECIMAL(65,30),
    "is_included_in_annual" BOOLEAN NOT NULL DEFAULT true,
    "calculation_method" "PayItemCalcMethod" NOT NULL DEFAULT 'FIXED_AMOUNT',
    "default_amount" DECIMAL(65,30),
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_allowance_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_deduction_types" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "DeductionCategory" NOT NULL,
    "country_code" TEXT,
    "calculation_method" "PayItemCalcMethod" NOT NULL DEFAULT 'FIXED_AMOUNT',
    "rate" DECIMAL(65,30),
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_deduction_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_pay_items" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "item_type" "PayItemType" NOT NULL,
    "allowance_type_id" TEXT,
    "deduction_type_id" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_pay_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_transfers" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "from_company_id" TEXT NOT NULL,
    "to_company_id" TEXT NOT NULL,
    "transfer_type" "TransferType" NOT NULL,
    "transfer_date" TIMESTAMP(3) NOT NULL,
    "return_date" TIMESTAMP(3),
    "status" "EntityTransferStatus" NOT NULL DEFAULT 'TRANSFER_REQUESTED',
    "data_options" JSONB,
    "new_employee_no" TEXT,
    "new_department_id" TEXT,
    "new_job_grade_id" TEXT,
    "requested_by" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "from_approver" TEXT,
    "from_approved_at" TIMESTAMP(3),
    "to_approver" TEXT,
    "to_approved_at" TIMESTAMP(3),
    "executive_approver" TEXT,
    "executive_approved_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_transfer_data_logs" (
    "id" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "data_type" "TransferDataType" NOT NULL,
    "status" "TransferDataStatus" NOT NULL DEFAULT 'DATA_PENDING',
    "detail" JSONB,
    "migrated_at" TIMESTAMP(3),
    "error_msg" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_transfer_data_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transfer_batches" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "payroll_run_id" TEXT,
    "bank_code" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "format" "BankTransferFormat" NOT NULL DEFAULT 'CSV',
    "status" "BankTransferBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "file_url" TEXT,
    "result_file_url" TEXT,
    "generated_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_transfer_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transfer_items" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "employee_name" TEXT NOT NULL,
    "employee_no" TEXT NOT NULL,
    "bank_code" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "account_holder" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "status" "BankTransferItemStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "transferred_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_brackets" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "tax_type" "TaxType" NOT NULL,
    "name" TEXT NOT NULL,
    "bracket_min" DECIMAL(15,2) NOT NULL,
    "bracket_max" DECIMAL(15,2),
    "rate" DECIMAL(8,5) NOT NULL,
    "fixed_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_brackets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_jobs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source_type" TEXT NOT NULL,
    "data_scope" "MigrationDataScope" NOT NULL,
    "status" "MigrationJobStatus" NOT NULL DEFAULT 'DRAFT',
    "config" JSONB,
    "total_records" INTEGER NOT NULL DEFAULT 0,
    "processed_records" INTEGER NOT NULL DEFAULT 0,
    "success_records" INTEGER NOT NULL DEFAULT 0,
    "error_records" INTEGER NOT NULL DEFAULT 0,
    "validation_errors" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "migration_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_logs" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "level" "MigrationLogLevel" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "record_ref" TEXT,
    "detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "migration_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "m365_provisioning_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "action_type" "M365ActionType" NOT NULL,
    "status" "M365ActionStatus" NOT NULL DEFAULT 'M365_PENDING',
    "licenses_revoked" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "convert_to_shared_mailbox" BOOLEAN NOT NULL DEFAULT false,
    "error_message" TEXT,
    "executed_by" TEXT NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "m365_provisioning_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment_costs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "posting_id" TEXT,
    "applicant_source" "ApplicantSource" NOT NULL,
    "cost_type" "RecruitmentCostType" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "description" TEXT,
    "vendor_name" TEXT,
    "invoice_date" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruitment_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_settings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "methodology" TEXT NOT NULL DEFAULT 'MBO_BEI',
    "mbo_grades" JSONB NOT NULL DEFAULT '[]',
    "bei_grades" JSONB NOT NULL DEFAULT '[]',
    "overall_grade_enabled" BOOLEAN NOT NULL DEFAULT true,
    "overall_grade_method" TEXT NOT NULL DEFAULT 'WEIGHTED',
    "mbo_weight" INTEGER NOT NULL DEFAULT 60,
    "bei_weight" INTEGER NOT NULL DEFAULT 40,
    "forced_distribution" BOOLEAN NOT NULL DEFAULT false,
    "forced_distribution_type" TEXT NOT NULL DEFAULT 'SOFT',
    "distribution_rules" JSONB NOT NULL DEFAULT '[]',
    "review_process_order" JSONB NOT NULL DEFAULT '["self","manager","calibration"]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_settings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "job_levels" JSONB NOT NULL DEFAULT '[]',
    "promotion_rules" JSONB NOT NULL DEFAULT '[]',
    "promotion_cycle" TEXT NOT NULL DEFAULT 'ANNUAL',
    "promotion_month" INTEGER NOT NULL DEFAULT 1,
    "approval_chain" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensation_settings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "pay_components" JSONB NOT NULL DEFAULT '[]',
    "salary_bands" JSONB NOT NULL DEFAULT '[]',
    "raise_matrix" JSONB NOT NULL DEFAULT '[]',
    "bonus_type" TEXT NOT NULL DEFAULT 'GRADE_BASED',
    "bonus_rules" JSONB NOT NULL DEFAULT '[]',
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compensation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_settings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "standard_hours_per_day" INTEGER NOT NULL DEFAULT 8,
    "standard_days_per_week" INTEGER NOT NULL DEFAULT 5,
    "weekly_max_hours" INTEGER NOT NULL DEFAULT 52,
    "shift_enabled" BOOLEAN NOT NULL DEFAULT false,
    "flex_work" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_settings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "leave_types" JSONB NOT NULL DEFAULT '[]',
    "annual_leave_rule" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_settings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "checklist_template" JSONB NOT NULL DEFAULT '[]',
    "emotion_pulse" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "from_currency" TEXT NOT NULL,
    "to_currency" TEXT NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "effective_date" DATE NOT NULL,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_flows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "company_id" TEXT,
    "module" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_flow_steps" (
    "id" TEXT NOT NULL,
    "flow_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "approver_type" TEXT NOT NULL,
    "approver_role" TEXT,
    "approver_user_id" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "auto_approve_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_flow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "military_registrations_company_id_idx" ON "military_registrations"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "military_registrations_employee_id_key" ON "military_registrations"("employee_id");

-- CreateIndex
CREATE INDEX "kedo_documents_company_id_status_idx" ON "kedo_documents"("company_id", "status");

-- CreateIndex
CREATE INDEX "kedo_documents_employee_id_idx" ON "kedo_documents"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_insurance_configs_company_id_insurance_type_city_eff_key" ON "social_insurance_configs"("company_id", "insurance_type", "city", "effective_from");

-- CreateIndex
CREATE INDEX "social_insurance_records_company_id_year_month_idx" ON "social_insurance_records"("company_id", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "social_insurance_records_employee_id_insurance_type_year_mo_key" ON "social_insurance_records"("employee_id", "insurance_type", "year", "month");

-- CreateIndex
CREATE INDEX "gdpr_consents_company_id_status_idx" ON "gdpr_consents"("company_id", "status");

-- CreateIndex
CREATE INDEX "gdpr_consents_employee_id_idx" ON "gdpr_consents"("employee_id");

-- CreateIndex
CREATE INDEX "gdpr_requests_company_id_status_idx" ON "gdpr_requests"("company_id", "status");

-- CreateIndex
CREATE INDEX "gdpr_requests_employee_id_idx" ON "gdpr_requests"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "data_retention_policies_company_id_category_key" ON "data_retention_policies"("company_id", "category");

-- CreateIndex
CREATE INDEX "dpia_records_company_id_status_idx" ON "dpia_records"("company_id", "status");

-- CreateIndex
CREATE INDEX "pii_access_logs_company_id_created_at_idx" ON "pii_access_logs"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "pii_access_logs_target_id_idx" ON "pii_access_logs"("target_id");

-- CreateIndex
CREATE INDEX "pii_access_logs_actor_id_idx" ON "pii_access_logs"("actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "mandatory_trainings_company_id_training_type_year_key" ON "mandatory_trainings"("company_id", "training_type", "year");

-- CreateIndex
CREATE INDEX "severance_interim_payments_company_id_status_idx" ON "severance_interim_payments"("company_id", "status");

-- CreateIndex
CREATE INDEX "severance_interim_payments_employee_id_idx" ON "severance_interim_payments"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_patterns_company_id_code_key" ON "shift_patterns"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "shift_groups_company_id_shift_pattern_id_name_key" ON "shift_groups"("company_id", "shift_pattern_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "shift_group_members_shift_group_id_employee_id_key" ON "shift_group_members"("shift_group_id", "employee_id");

-- CreateIndex
CREATE INDEX "shift_schedules_company_id_work_date_idx" ON "shift_schedules"("company_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "shift_schedules_employee_id_work_date_key" ON "shift_schedules"("employee_id", "work_date");

-- CreateIndex
CREATE INDEX "shift_change_requests_company_id_status_idx" ON "shift_change_requests"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pay_allowance_types_company_id_code_key" ON "pay_allowance_types"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "pay_deduction_types_company_id_code_key" ON "pay_deduction_types"("company_id", "code");

-- CreateIndex
CREATE INDEX "employee_pay_items_employee_id_item_type_idx" ON "employee_pay_items"("employee_id", "item_type");

-- CreateIndex
CREATE INDEX "employee_pay_items_company_id_idx" ON "employee_pay_items"("company_id");

-- CreateIndex
CREATE INDEX "entity_transfers_employee_id_idx" ON "entity_transfers"("employee_id");

-- CreateIndex
CREATE INDEX "entity_transfers_from_company_id_status_idx" ON "entity_transfers"("from_company_id", "status");

-- CreateIndex
CREATE INDEX "entity_transfers_to_company_id_status_idx" ON "entity_transfers"("to_company_id", "status");

-- CreateIndex
CREATE INDEX "entity_transfer_data_logs_transfer_id_idx" ON "entity_transfer_data_logs"("transfer_id");

-- CreateIndex
CREATE INDEX "bank_transfer_batches_company_id_idx" ON "bank_transfer_batches"("company_id");

-- CreateIndex
CREATE INDEX "bank_transfer_batches_payroll_run_id_idx" ON "bank_transfer_batches"("payroll_run_id");

-- CreateIndex
CREATE INDEX "bank_transfer_items_batch_id_idx" ON "bank_transfer_items"("batch_id");

-- CreateIndex
CREATE INDEX "bank_transfer_items_employee_id_idx" ON "bank_transfer_items"("employee_id");

-- CreateIndex
CREATE INDEX "tax_brackets_company_id_country_code_idx" ON "tax_brackets"("company_id", "country_code");

-- CreateIndex
CREATE INDEX "tax_brackets_country_code_tax_type_idx" ON "tax_brackets"("country_code", "tax_type");

-- CreateIndex
CREATE UNIQUE INDEX "tax_brackets_company_id_country_code_tax_type_bracket_min_e_key" ON "tax_brackets"("company_id", "country_code", "tax_type", "bracket_min", "effective_from");

-- CreateIndex
CREATE INDEX "migration_jobs_company_id_idx" ON "migration_jobs"("company_id");

-- CreateIndex
CREATE INDEX "migration_logs_job_id_idx" ON "migration_logs"("job_id");

-- CreateIndex
CREATE INDEX "m365_provisioning_logs_company_id_idx" ON "m365_provisioning_logs"("company_id");

-- CreateIndex
CREATE INDEX "m365_provisioning_logs_employee_id_idx" ON "m365_provisioning_logs"("employee_id");

-- CreateIndex
CREATE INDEX "recruitment_costs_company_id_idx" ON "recruitment_costs"("company_id");

-- CreateIndex
CREATE INDEX "recruitment_costs_posting_id_idx" ON "recruitment_costs"("posting_id");

-- CreateIndex
CREATE INDEX "evaluation_settings_company_id_idx" ON "evaluation_settings"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_settings_company_id_key" ON "evaluation_settings"("company_id");

-- CreateIndex
CREATE INDEX "promotion_settings_company_id_idx" ON "promotion_settings"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_settings_company_id_key" ON "promotion_settings"("company_id");

-- CreateIndex
CREATE INDEX "compensation_settings_company_id_idx" ON "compensation_settings"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "compensation_settings_company_id_key" ON "compensation_settings"("company_id");

-- CreateIndex
CREATE INDEX "attendance_settings_company_id_idx" ON "attendance_settings"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_settings_company_id_key" ON "attendance_settings"("company_id");

-- CreateIndex
CREATE INDEX "leave_settings_company_id_idx" ON "leave_settings"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_settings_company_id_key" ON "leave_settings"("company_id");

-- CreateIndex
CREATE INDEX "onboarding_settings_company_id_idx" ON "onboarding_settings"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_settings_company_id_key" ON "onboarding_settings"("company_id");

-- CreateIndex
CREATE INDEX "exchange_rates_from_currency_to_currency_idx" ON "exchange_rates"("from_currency", "to_currency");

-- CreateIndex
CREATE INDEX "exchange_rates_effective_date_idx" ON "exchange_rates"("effective_date");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_from_currency_to_currency_effective_date_key" ON "exchange_rates"("from_currency", "to_currency", "effective_date");

-- CreateIndex
CREATE INDEX "approval_flows_company_id_idx" ON "approval_flows"("company_id");

-- CreateIndex
CREATE INDEX "approval_flows_module_idx" ON "approval_flows"("module");

-- CreateIndex
CREATE INDEX "approval_flow_steps_flow_id_idx" ON "approval_flow_steps"("flow_id");

-- AddForeignKey
ALTER TABLE "military_registrations" ADD CONSTRAINT "military_registrations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "military_registrations" ADD CONSTRAINT "military_registrations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kedo_documents" ADD CONSTRAINT "kedo_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kedo_documents" ADD CONSTRAINT "kedo_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kedo_documents" ADD CONSTRAINT "kedo_documents_signed_by_id_fkey" FOREIGN KEY ("signed_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kedo_documents" ADD CONSTRAINT "kedo_documents_rejected_by_id_fkey" FOREIGN KEY ("rejected_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_insurance_configs" ADD CONSTRAINT "social_insurance_configs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_insurance_records" ADD CONSTRAINT "social_insurance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_insurance_records" ADD CONSTRAINT "social_insurance_records_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gdpr_consents" ADD CONSTRAINT "gdpr_consents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gdpr_consents" ADD CONSTRAINT "gdpr_consents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gdpr_requests" ADD CONSTRAINT "gdpr_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gdpr_requests" ADD CONSTRAINT "gdpr_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gdpr_requests" ADD CONSTRAINT "gdpr_requests_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_retention_policies" ADD CONSTRAINT "data_retention_policies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dpia_records" ADD CONSTRAINT "dpia_records_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dpia_records" ADD CONSTRAINT "dpia_records_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pii_access_logs" ADD CONSTRAINT "pii_access_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pii_access_logs" ADD CONSTRAINT "pii_access_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pii_access_logs" ADD CONSTRAINT "pii_access_logs_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mandatory_trainings" ADD CONSTRAINT "mandatory_trainings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mandatory_trainings" ADD CONSTRAINT "mandatory_trainings_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "training_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "severance_interim_payments" ADD CONSTRAINT "severance_interim_payments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "severance_interim_payments" ADD CONSTRAINT "severance_interim_payments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "severance_interim_payments" ADD CONSTRAINT "severance_interim_payments_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_patterns" ADD CONSTRAINT "shift_patterns_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_groups" ADD CONSTRAINT "shift_groups_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_groups" ADD CONSTRAINT "shift_groups_shift_pattern_id_fkey" FOREIGN KEY ("shift_pattern_id") REFERENCES "shift_patterns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_group_members" ADD CONSTRAINT "shift_group_members_shift_group_id_fkey" FOREIGN KEY ("shift_group_id") REFERENCES "shift_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_group_members" ADD CONSTRAINT "shift_group_members_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_schedules" ADD CONSTRAINT "shift_schedules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_schedules" ADD CONSTRAINT "shift_schedules_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_schedules" ADD CONSTRAINT "shift_schedules_shift_pattern_id_fkey" FOREIGN KEY ("shift_pattern_id") REFERENCES "shift_patterns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_schedules" ADD CONSTRAINT "shift_schedules_shift_group_id_fkey" FOREIGN KEY ("shift_group_id") REFERENCES "shift_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_change_requests" ADD CONSTRAINT "shift_change_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_change_requests" ADD CONSTRAINT "shift_change_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_change_requests" ADD CONSTRAINT "shift_change_requests_target_employee_id_fkey" FOREIGN KEY ("target_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_change_requests" ADD CONSTRAINT "shift_change_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_allowance_types" ADD CONSTRAINT "pay_allowance_types_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_deduction_types" ADD CONSTRAINT "pay_deduction_types_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_pay_items" ADD CONSTRAINT "employee_pay_items_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_pay_items" ADD CONSTRAINT "employee_pay_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_pay_items" ADD CONSTRAINT "employee_pay_items_allowance_type_id_fkey" FOREIGN KEY ("allowance_type_id") REFERENCES "pay_allowance_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_pay_items" ADD CONSTRAINT "employee_pay_items_deduction_type_id_fkey" FOREIGN KEY ("deduction_type_id") REFERENCES "pay_deduction_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_transfers" ADD CONSTRAINT "entity_transfers_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_transfers" ADD CONSTRAINT "entity_transfers_from_company_id_fkey" FOREIGN KEY ("from_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_transfers" ADD CONSTRAINT "entity_transfers_to_company_id_fkey" FOREIGN KEY ("to_company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_transfers" ADD CONSTRAINT "entity_transfers_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_transfers" ADD CONSTRAINT "entity_transfers_from_approver_fkey" FOREIGN KEY ("from_approver") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_transfers" ADD CONSTRAINT "entity_transfers_to_approver_fkey" FOREIGN KEY ("to_approver") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_transfers" ADD CONSTRAINT "entity_transfers_executive_approver_fkey" FOREIGN KEY ("executive_approver") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_transfers" ADD CONSTRAINT "entity_transfers_new_department_id_fkey" FOREIGN KEY ("new_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_transfers" ADD CONSTRAINT "entity_transfers_new_job_grade_id_fkey" FOREIGN KEY ("new_job_grade_id") REFERENCES "job_grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_transfer_data_logs" ADD CONSTRAINT "entity_transfer_data_logs_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "entity_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transfer_batches" ADD CONSTRAINT "bank_transfer_batches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transfer_items" ADD CONSTRAINT "bank_transfer_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "bank_transfer_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_brackets" ADD CONSTRAINT "tax_brackets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migration_jobs" ADD CONSTRAINT "migration_jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migration_logs" ADD CONSTRAINT "migration_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "migration_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "m365_provisioning_logs" ADD CONSTRAINT "m365_provisioning_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_costs" ADD CONSTRAINT "recruitment_costs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruitment_costs" ADD CONSTRAINT "recruitment_costs_posting_id_fkey" FOREIGN KEY ("posting_id") REFERENCES "job_postings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_settings" ADD CONSTRAINT "evaluation_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_settings" ADD CONSTRAINT "promotion_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_settings" ADD CONSTRAINT "compensation_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_settings" ADD CONSTRAINT "attendance_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_settings" ADD CONSTRAINT "leave_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_settings" ADD CONSTRAINT "onboarding_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_flows" ADD CONSTRAINT "approval_flows_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_flow_steps" ADD CONSTRAINT "approval_flow_steps_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "approval_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
