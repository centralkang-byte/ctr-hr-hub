-- Talent Pool companyId tenant-scope (plan: docs/plans/active/2026-06-18-talent-pool-multitenant.md)
-- 근본: TalentPoolEntry·Applicant 에 회사 없음(지원→공고 경유) → 인재 풀 3 라우트 + 타임라인 전사 PII 누출.
--       비정규화 company_id anchor 추가로 직접 스코핑(수동 등록·다법인 후보 모두 명확).
-- 2026-06-18 공유 DB에 수동 적용 예정(psql/MCP) — 이 파일은 기록 + 재실행 안전(idempotent) 버전.
-- ⚠️ `prisma migrate deploy`를 이 DB에 돌릴 경우 먼저:
--    npx prisma migrate resolve --applied 20260618120000_add_talent_pool_company_id
--    (전 구문 idempotent이므로 그냥 실행돼도 무해)
-- Codex Gate 1: latest-wins 귀속 금지 — sourcePosting 우선, 없으면 지원 법인 distinct=1 일 때만 자동, 아니면 중단.

-- ── Phase 1: expand (구코드 배포 중에도 안전 — 구 writer 는 company_id NULL 로 둠) ──

ALTER TABLE "talent_pool_entries" ADD COLUMN IF NOT EXISTS "company_id" TEXT;

CREATE INDEX IF NOT EXISTS "talent_pool_entries_company_id_idx"
  ON "talent_pool_entries"("company_id");

-- ── Backfill ① : source_posting 의 회사 (등록 출처 = 가장 강한 anchor) ──
UPDATE "talent_pool_entries" tpe
SET "company_id" = jp."company_id"
FROM "job_postings" jp
WHERE tpe."source_posting_id" = jp."id"
  AND tpe."company_id" IS NULL;

-- ── Pre-backfill 가드 (Codex Gate1 P0): source 없는 행이 2+ 법인에 지원했으면
--    임의 귀속 금지 — 수동 매핑 요구(중단). ──
DO $$
DECLARE ambiguous_count integer;
BEGIN
  SELECT count(*) INTO ambiguous_count FROM (
    SELECT tpe.id
    FROM talent_pool_entries tpe
    JOIN applications a ON a.applicant_id = tpe.applicant_id
    JOIN job_postings jp ON jp.id = a.posting_id
    WHERE tpe.company_id IS NULL
    GROUP BY tpe.id
    HAVING count(DISTINCT jp.company_id) > 1
  ) x;
  IF ambiguous_count > 0 THEN
    RAISE EXCEPTION 'talent_pool companyId backfill ABORT: % rows span 2+ companies w/o source_posting — manual-map required', ambiguous_count;
  END IF;
END $$;

-- ── Backfill ② : source 없는 행 — 지원 법인이 단 하나일 때만 그 법인으로 (위 가드 통과 보장) ──
UPDATE "talent_pool_entries" tpe
SET "company_id" = (
  SELECT jp."company_id"
  FROM "applications" a
  JOIN "job_postings" jp ON jp."id" = a."posting_id"
  WHERE a."applicant_id" = tpe."applicant_id"
  GROUP BY jp."company_id"
  LIMIT 1
)
WHERE tpe."company_id" IS NULL
  AND EXISTS (SELECT 1 FROM "applications" a2 WHERE a2."applicant_id" = tpe."applicant_id");

-- ── Post-backfill 가드: NULL 잔존 = source 도 지원이력도 없는 행 → 수동 매핑(비-SUPER 영구 비가시 방지) ──
DO $$
DECLARE null_count integer;
BEGIN
  SELECT count(*) INTO null_count FROM talent_pool_entries WHERE company_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'talent_pool companyId backfill ABORT: % rows unresolvable (no source_posting, no applications) — manual-map required', null_count;
  END IF;
END $$;

-- ── 회사별 active 중복 가드 (부분 유니크 인덱스 전): 같은 (회사, 후보) active 2+ 존재 시 중단 ──
DO $$
DECLARE dup_count integer;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT company_id, applicant_id
    FROM talent_pool_entries
    WHERE status = 'active'
    GROUP BY company_id, applicant_id
    HAVING count(*) > 1
  ) x;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'talent_pool active-dup ABORT: % (company,applicant) pairs have 2+ active entries — resolve first', dup_count;
  END IF;
END $$;

-- ── 회사별 active 단일 보장(동시 POST race 백스톱; 다법인 동일후보는 허용 = company_id 포함) ──
CREATE UNIQUE INDEX IF NOT EXISTS "talent_pool_entries_company_active_applicant_key"
  ON "talent_pool_entries"("company_id", "applicant_id")
  WHERE status = 'active';

-- ── FK (backfill 검증 후; idempotent) — tenant anchor 라 RESTRICT (SET NULL=비가시화, CASCADE=후보보존데이터 대량삭제) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'talent_pool_entries_company_id_fkey'
  ) THEN
    ALTER TABLE "talent_pool_entries"
      ADD CONSTRAINT "talent_pool_entries_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Phase 2: contract (이 PR 코드 배포 후에만 — 구 POST 는 company_id 미기록이라 배포 전 NOT NULL 은 등록을 깨뜨림) ──
-- 절차(Codex Gate1 P1): ① 구 인스턴스 종료 확인 → ② NULL 행 재-backfill → ③ NULL count 0 확인 → ④ SET NOT NULL → ⑤ Prisma companyId String?→String.
-- ALTER TABLE "talent_pool_entries" ALTER COLUMN "company_id" SET NOT NULL;
