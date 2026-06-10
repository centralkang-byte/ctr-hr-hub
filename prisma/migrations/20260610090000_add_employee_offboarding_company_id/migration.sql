-- Offboarding companyId tenant-scope (plan: docs/plans/active/2026-06-09-offboarding-companyid-tenant-scope.md)
-- 2026-06-10 공유 DB에 수동 적용 완료(psql) — 이 파일은 기록 + 재실행 안전(idempotent) 버전.
-- ⚠️ `prisma migrate deploy`를 이 DB에 돌릴 경우 먼저:
--    npx prisma migrate resolve --applied 20260610090000_add_employee_offboarding_company_id
--    (전 구문 idempotent이므로 그냥 실행돼도 무해 — Codex Gate2 P1 반영)
-- Codex Gate 1 (5 rounds): ownership = primary assignment effective AT started_at (temporal),
-- NOT the latest assignment (transfer = cross-tenant exposure) and NOT checklist.companyId
-- (seeds/flows may pick a cross-company checklist).

-- ── Phase 1: expand (구코드 배포 중에도 안전 — 구 writer는 NULL로 둠) ──

ALTER TABLE "employee_offboarding" ADD COLUMN IF NOT EXISTS "company_id" TEXT;

-- CONCURRENTLY는 트랜잭션 밖에서 실행 (수동 적용 시). migrate deploy 경유 시 일반 CREATE INDEX로 대체됨.
CREATE INDEX IF NOT EXISTS "employee_offboarding_company_id_idx"
  ON "employee_offboarding"("company_id");

-- ── Pre-backfill 가드 (Codex Gate2 P1: 주석 아닌 실행형 중단 조건) ──
-- started_at 시점 primary assignment가 2+ 겹치는 행 → 임의(latest-wins) 귀속 금지, 수동 매핑 요구.
DO $$
DECLARE ambiguous_count integer;
BEGIN
  SELECT count(*) INTO ambiguous_count FROM (
    SELECT eo.id
    FROM employee_offboarding eo
    JOIN employee_assignments a ON a.employee_id = eo.employee_id
      AND a.is_primary
      AND a.effective_date <= eo.started_at::date
      AND (a.end_date IS NULL OR a.end_date >= eo.started_at::date)
    WHERE eo.company_id IS NULL
    GROUP BY eo.id HAVING count(*) > 1
  ) x;
  IF ambiguous_count > 0 THEN
    RAISE EXCEPTION 'offboarding companyId backfill ABORT: % rows have 2+ overlapping primary assignments at started_at — manual-map required', ambiguous_count;
  END IF;
END $$;

-- ── Backfill: temporal — started_at 시점 assignment (::date 캐스트 — effective/end는 DATE) ──
UPDATE "employee_offboarding" eo
SET "company_id" = (
  SELECT a."company_id"
  FROM "employee_assignments" a
  WHERE a."employee_id" = eo."employee_id"
    AND a."is_primary"
    AND a."effective_date" <= eo."started_at"::date
    AND (a."end_date" IS NULL OR a."end_date" >= eo."started_at"::date)
  ORDER BY a."effective_date" DESC
  LIMIT 1
)
WHERE eo."company_id" IS NULL;

-- ── Post-backfill 가드: NULL 잔존 = 시작시점 발령 없는 행 → 수동 매핑 (직접 필터에서 영구 비가시 방지) ──
DO $$
DECLARE null_count integer;
BEGIN
  SELECT count(*) INTO null_count FROM employee_offboarding WHERE company_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'offboarding companyId backfill ABORT: % rows have no temporal primary assignment — manual-map required', null_count;
  END IF;
END $$;

-- 참고(수동 점검용): checklist 법인 불일치 = 데이터 위생 이슈 (checklist_id + company_id 함께 교정)
--   SELECT eo.id, eo.company_id, oc.company_id AS checklist_company
--   FROM employee_offboarding eo
--   JOIN offboarding_checklists oc ON oc.id = eo.checklist_id
--   WHERE eo.company_id IS DISTINCT FROM oc.company_id;
-- (2026-06-10 공유 DB 실측: 0행)

-- ── FK (backfill 검증 후; idempotent) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_offboarding_company_id_fkey'
  ) THEN
    ALTER TABLE "employee_offboarding"
      ADD CONSTRAINT "employee_offboarding_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Phase 2: contract (이 PR 코드 배포 후에만 — 구코드 create는 company_id 미기록이라
--    배포 전 NOT NULL은 offboarding/start를 깨뜨림) ──
-- ALTER TABLE "employee_offboarding" ALTER COLUMN "company_id" SET NOT NULL;
-- (이후 Prisma `companyId String?` → `String` follow-up)

-- ── 동반 변경 메모 ──
-- mv_analytics.sql의 mv_exit_reason_monthly 정의도 eo.company_id 직접으로 갱신됨.
-- 공유 DB엔 해당 MV 미생성(2026-06-10 실측 — MV 재적용은 별 트랙)이라 즉시 조치 불요;
-- 재적용 시 갱신된 정의가 자동 사용됨 (scripts/db/apply-analytics-mv).
