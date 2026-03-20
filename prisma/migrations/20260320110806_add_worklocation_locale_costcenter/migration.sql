-- B-2a: WorkLocation model
CREATE TABLE "work_locations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "timezone" TEXT,
    "address" TEXT,
    "location_type" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_locations_pkey" PRIMARY KEY ("id")
);

-- B-2b: workLocationId on EmployeeAssignment
ALTER TABLE "employee_assignments" ADD COLUMN "work_location_id" TEXT;

-- B-2e: costCenterCode on Department
ALTER TABLE "departments" ADD COLUMN "cost_center_code" TEXT;

-- Unique constraint for WorkLocation
CREATE UNIQUE INDEX "work_locations_company_id_code_key" ON "work_locations"("company_id", "code");

-- Foreign keys
ALTER TABLE "work_locations" ADD CONSTRAINT "work_locations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_work_location_id_fkey" FOREIGN KEY ("work_location_id") REFERENCES "work_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
