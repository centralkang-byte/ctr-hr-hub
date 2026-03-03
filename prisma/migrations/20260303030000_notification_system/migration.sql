-- B11: notification_system migration
-- Add 3 new fields to notifications table
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "priority" VARCHAR(10) NOT NULL DEFAULT 'normal';
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "channels" TEXT[] NOT NULL DEFAULT '{}';

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS "notification_preferences" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "quiet_hours_start" VARCHAR(5),
    "quiet_hours_end" VARCHAR(5),
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Seoul',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- Create unique index on employee_id for notification_preferences
CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_employee_id_key" ON "notification_preferences"("employee_id");

-- Add foreign key constraint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create teams_webhook_configs table
CREATE TABLE IF NOT EXISTS "teams_webhook_configs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "channel_name" VARCHAR(100) NOT NULL,
    "webhook_url" VARCHAR(500) NOT NULL,
    "event_types" TEXT[] NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_webhook_configs_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraint for teams_webhook_configs
ALTER TABLE "teams_webhook_configs" ADD CONSTRAINT "teams_webhook_configs_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
