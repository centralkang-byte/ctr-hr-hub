-- ================================================================
-- A2-2: Update current_employee_view with position, job, manager
-- ================================================================

CREATE OR REPLACE VIEW "current_employee_view" AS
SELECT
    e."id",
    e."employee_no",
    e."name",
    e."name_en",
    e."birth_date",
    e."gender",
    e."nationality",
    e."email",
    e."phone",
    e."emergency_contact",
    e."emergency_contact_phone",
    e."hire_date",
    e."resign_date",
    e."photo_url",
    e."locale",
    e."timezone",
    e."attrition_risk_score",
    e."is_high_potential",
    e."high_potential_since",
    e."onboarded_at",
    e."created_at",
    e."updated_at",
    e."deleted_at",
    e."contract_number",
    e."contract_start_date",
    e."contract_end_date",
    e."contract_auto_convert_date",
    e."probation_start_date",
    e."probation_end_date",
    e."probation_status",
    -- assignment fields
    a."company_id",
    a."department_id",
    a."job_grade_id",
    a."job_category_id",
    a."employment_type",
    a."contract_type",
    a."status",
    a."position_id",
    a."is_primary",
    a."id"              AS "assignment_id",
    a."effective_date",
    a."change_type",
    -- position + job fields (A2-2)
    p."title_ko"        AS "position_title",
    p."title_en"        AS "position_title_en",
    p."code"            AS "position_code",
    j."title_ko"        AS "job_title",
    j."title_en"        AS "job_title_en",
    -- manager lookup via solid-line reporting
    mgr_ea."employee_id" AS "manager_employee_id"
FROM "employees" e
LEFT JOIN "employee_assignments" a
    ON a."employee_id" = e."id"
   AND a."end_date" IS NULL
   AND a."is_primary" = true
LEFT JOIN "positions" p
    ON a."position_id" = p."id"
LEFT JOIN "jobs" j
    ON p."job_id" = j."id"
LEFT JOIN "positions" mgr_pos
    ON p."reports_to_position_id" = mgr_pos."id"
LEFT JOIN "employee_assignments" mgr_ea
    ON mgr_pos."id" = mgr_ea."position_id"
   AND mgr_ea."is_primary" = true
   AND mgr_ea."end_date" IS NULL;
