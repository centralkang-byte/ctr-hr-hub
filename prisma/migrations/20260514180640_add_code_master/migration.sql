-- IS_SY02 호환 통합 코드 마스터 (Stage B of IS_PE01 legacy ERP migration)
-- 다국어(ko/en/zh/vi/es) + 시계열(start/endDate) + 활성/정렬 + 외부매핑 reference 5개
-- 운영팀이 신규 코드를 schema migration 없이 직접 등록 가능하도록 설계

-- 1. 코드 분류 (CodeGroup) — IS_SY02 헤더 대응
CREATE TABLE "code_groups" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ref1_label" TEXT,
    "ref2_label" TEXT,
    "ref3_label" TEXT,
    "ref4_label" TEXT,
    "ref5_label" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "code_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "code_groups_code_key" ON "code_groups"("code");

-- 2. 코드 상세 (CodeItem) — IS_SY02 상세 대응
CREATE TABLE "code_items" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "label_en" TEXT,
    "label_zh" TEXT,
    "label_vi" TEXT,
    "label_es" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "start_date" DATE,
    "end_date" DATE,
    "ref_1" TEXT,
    "ref_2" TEXT,
    "ref_3" TEXT,
    "ref_4" TEXT,
    "ref_5" TEXT,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "code_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "code_items_group_id_code_key" ON "code_items"("group_id", "code");
CREATE INDEX "code_items_group_id_is_active_idx" ON "code_items"("group_id", "is_active");

ALTER TABLE "code_items" ADD CONSTRAINT "code_items_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "code_groups"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
