-- Add Department.head_employee_id (FK to Employee) for approval dept_head step.
-- Session 200 follow-up: previously resolveApproverByRole's raw SQL referenced
-- d.head_id which never existed in schema → dept_head approval flow was dead.
-- Nullable + ON DELETE SET NULL: safe rollout, dept-head clear if employee hard-deleted.

ALTER TABLE "departments" ADD COLUMN "head_employee_id" TEXT;

ALTER TABLE "departments"
  ADD CONSTRAINT "departments_head_employee_id_fkey"
  FOREIGN KEY ("head_employee_id") REFERENCES "employees"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ───────────────────────────────────────────────────────────────────
-- Best-effort backfill: 부서별 head를 휴리스틱으로 채움.
-- 휴리스틱 (prisma/seeds/52-department-heads.ts와 동일):
--   부서 내 primary ACTIVE assignment 중,
--     1) Position.reports_to_position_id IS NULL (보고 종점), 또는
--     2) reports_to.department_id <> 자기 부서 (외부 상위에 보고 = 본부장/공장장)
--   결정론적 tie-break: employees.employee_no 오름차순 첫 번째.
--
-- 부서장이 식별 안 되는 부서는 head_employee_id NULL 유지 — 별도 admin UI로 지정.
-- 이미 head_employee_id가 set되어 있는 행(이 마이그레이션 직후엔 없음, 후속 재실행 보호용)은 보존.
WITH candidates AS (
  SELECT DISTINCT ON (ea.department_id)
    ea.department_id,
    ea.employee_id
  FROM employee_assignments ea
  JOIN positions p ON p.id = ea.position_id
  LEFT JOIN positions rp ON rp.id = p.reports_to_position_id
  JOIN employees e ON e.id = ea.employee_id
  WHERE ea.is_primary = true
    AND ea.end_date IS NULL
    AND ea.status = 'ACTIVE'
    AND ea.department_id IS NOT NULL
    AND (
      p.reports_to_position_id IS NULL
      OR (rp.department_id IS NOT NULL AND rp.department_id <> ea.department_id)
    )
  ORDER BY ea.department_id, e.employee_no ASC
)
UPDATE departments d
SET head_employee_id = c.employee_id
FROM candidates c
WHERE d.id = c.department_id
  AND d.head_employee_id IS NULL
  AND d.deleted_at IS NULL;
