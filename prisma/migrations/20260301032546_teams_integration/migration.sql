-- AlterEnum
ALTER TYPE "AiFeature" ADD VALUE 'EXECUTIVE_REPORT';

-- AlterEnum
ALTER TYPE "NotificationChannel" ADD VALUE 'TEAMS';

-- CreateTable
CREATE TABLE "teams_integrations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "team_id" TEXT,
    "channel_id" TEXT,
    "webhook_url" TEXT,
    "bot_enabled" BOOLEAN NOT NULL DEFAULT false,
    "presence_sync" BOOLEAN NOT NULL DEFAULT false,
    "digest_enabled" BOOLEAN NOT NULL DEFAULT false,
    "digest_day" INTEGER NOT NULL DEFAULT 1,
    "digest_hour" INTEGER NOT NULL DEFAULT 9,
    "connected_at" TIMESTAMP(3),
    "connected_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams_card_actions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "notification_id" TEXT,
    "card_type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "teams_message_id" TEXT,
    "action_taken" TEXT,
    "action_by" TEXT,
    "action_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_card_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_integrations_company_id_key" ON "teams_integrations"("company_id");

-- CreateIndex
CREATE INDEX "teams_card_actions_company_id_card_type_idx" ON "teams_card_actions"("company_id", "card_type");

-- CreateIndex
CREATE INDEX "teams_card_actions_reference_id_idx" ON "teams_card_actions"("reference_id");

-- AddForeignKey
ALTER TABLE "teams_integrations" ADD CONSTRAINT "teams_integrations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams_card_actions" ADD CONSTRAINT "teams_card_actions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams_card_actions" ADD CONSTRAINT "teams_card_actions_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams_card_actions" ADD CONSTRAINT "teams_card_actions_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
