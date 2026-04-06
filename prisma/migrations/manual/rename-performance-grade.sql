-- PerformanceGrade Enum Rename: E/M_PLUS/M/B -> O/E/M/S
-- CEO confirmed 4-grade system (2026-04-06)
-- ADR: decisions/2026-04-06-performance-grade-enum-fix.md
--
-- IMPORTANT: Execute statements IN ORDER to avoid collision (E->O before M_PLUS->E)

BEGIN;

-- Step 1: Rename enum values (order matters)
ALTER TYPE "PerformanceGrade" RENAME VALUE 'E' TO 'O';
ALTER TYPE "PerformanceGrade" RENAME VALUE 'M_PLUS' TO 'E';
ALTER TYPE "PerformanceGrade" RENAME VALUE 'B' TO 'S';
-- M stays unchanged

-- Step 2: Update string columns storing grade values

-- calibration_adjustments: stores grade in single-adjust, EMS blocks in batch-adjust
-- EMS blocks are multi-char ('1A','2B') so exact match is safe
UPDATE "calibration_adjustments" SET "original_block" = 'O' WHERE "original_block" = 'E';
UPDATE "calibration_adjustments" SET "original_block" = 'E' WHERE "original_block" = 'M_PLUS';
UPDATE "calibration_adjustments" SET "original_block" = 'S' WHERE "original_block" = 'B';
UPDATE "calibration_adjustments" SET "adjusted_block" = 'O' WHERE "adjusted_block" = 'E';
UPDATE "calibration_adjustments" SET "adjusted_block" = 'E' WHERE "adjusted_block" = 'M_PLUS';
UPDATE "calibration_adjustments" SET "adjusted_block" = 'S' WHERE "adjusted_block" = 'B';

-- salary_adjustment_matrices: merit matrix grade keys
UPDATE "salary_adjustment_matrices" SET "grade_key" = 'O' WHERE "grade_key" = 'E';
UPDATE "salary_adjustment_matrices" SET "grade_key" = 'E' WHERE "grade_key" = 'M_PLUS';
UPDATE "salary_adjustment_matrices" SET "grade_key" = 'S' WHERE "grade_key" = 'B';

-- compensation_history: grade snapshot at compensation time
UPDATE "compensation_history" SET "performance_grade_at_time" = 'O' WHERE "performance_grade_at_time" = 'E';
UPDATE "compensation_history" SET "performance_grade_at_time" = 'E' WHERE "performance_grade_at_time" = 'M_PLUS';
UPDATE "compensation_history" SET "performance_grade_at_time" = 'S' WHERE "performance_grade_at_time" = 'B';

-- performance_evaluations: freeform grade strings (manager eval writes here)
UPDATE "performance_evaluations" SET "performance_grade" = 'O' WHERE "performance_grade" = 'E';
UPDATE "performance_evaluations" SET "performance_grade" = 'E' WHERE "performance_grade" = 'M_PLUS';
UPDATE "performance_evaluations" SET "performance_grade" = 'S' WHERE "performance_grade" = 'B';
UPDATE "performance_evaluations" SET "competency_grade" = 'O' WHERE "competency_grade" = 'E';
UPDATE "performance_evaluations" SET "competency_grade" = 'E' WHERE "competency_grade" = 'M_PLUS';
UPDATE "performance_evaluations" SET "competency_grade" = 'S' WHERE "competency_grade" = 'B';

COMMIT;
