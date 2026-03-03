-- AlterTable
ALTER TABLE "profile_change_requests" ADD COLUMN     "document_path" VARCHAR(500),
ADD COLUMN     "reason" TEXT;

-- CreateTable
CREATE TABLE "employee_profile_extensions" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "bio" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languages" JSONB,
    "certifications" JSONB,
    "socialLinks" JSONB,
    "pronouns" VARCHAR(30),
    "timezone" VARCHAR(50),
    "avatar_path" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_profile_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "relationship" VARCHAR(30) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_visibilities" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "personal_phone" VARCHAR(10) NOT NULL DEFAULT 'manager',
    "personal_email" VARCHAR(10) NOT NULL DEFAULT 'team',
    "birth_date" VARCHAR(10) NOT NULL DEFAULT 'team',
    "address" VARCHAR(10) NOT NULL DEFAULT 'private',
    "emergency_contact" VARCHAR(10) NOT NULL DEFAULT 'manager',
    "bio" VARCHAR(10) NOT NULL DEFAULT 'public',
    "skills" VARCHAR(10) NOT NULL DEFAULT 'public',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_visibilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_profile_extensions_employee_id_key" ON "employee_profile_extensions"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "profile_visibilities_employee_id_key" ON "profile_visibilities"("employee_id");

-- AddForeignKey
ALTER TABLE "employee_profile_extensions" ADD CONSTRAINT "employee_profile_extensions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_visibilities" ADD CONSTRAINT "profile_visibilities_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
