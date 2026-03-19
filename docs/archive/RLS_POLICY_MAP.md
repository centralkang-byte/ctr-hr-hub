# CTR HR Hub — RLS Policy Map
<!-- Generated: Q-5e | 2026-03-15 | All 194 models classified -->

## Classification Summary

| Tier | Policy | Count |
|------|--------|-------|
| **T1: Company-Isolated** | `companyId = current_company_id()` | 68 |
| **T2: Global Config** | `companyId IS NULL OR companyId = current_company_id()` | 6 |
| **T3: System Tables** | No RLS (admin-only or cross-tenant by design) | 51 |
| **T4: Employee-Scoped** | `companyId` for HR/MGR + `employeeId` for EMPLOYEE | 69 |

> **Employee** has no direct `companyId` column — isolation is enforced via `EmployeeAssignment.companyId`.
> RLS on the `employees` table is applied via a subquery against `employee_assignments`.

---

## T1: Company-Isolated (68 models)

RLS policy: `"companyId" = current_company_id()` (SUPER_ADMIN bypasses all).

### Priority 1 — Critical HR Data

| Model | PostgreSQL Table | companyId Field | Priority |
|-------|-----------------|----------------|----------|
| EmployeeAssignment | employee_assignments | companyId | **P1** |
| PayrollRun | payroll_runs | companyId | **P1** |
| PerformanceReview | performance_reviews | companyId | **P1** |
| PerformanceCycle | (no @@map — `PerformanceCycle`) | companyId | **P1** |
| AttendanceApprovalRequest | attendance_approval_requests | companyId | P2 |
| AttendanceSetting | attendance_settings | companyId | P2 |
| AttendanceTerminal | attendance_terminals | companyId | P2 |
| BankTransferBatch | bank_transfer_batches | companyId | P2 |
| CalibrationRule | calibration_rules | companyId | P2 |
| CompensationSetting | compensation_settings | companyId | P2 |
| CompetencyLibrary | competency_library | companyId | P2 |
| CustomField | custom_fields | companyId | P3 |
| DataRetentionPolicy | data_retention_policies | companyId | P2 |
| Department | departments | companyId | P1 |
| DpiaRecord | dpia_records | companyId | P2 |
| EmailTemplate | email_templates | companyId | P3 |
| EmployeeLevelMapping | employee_level_mappings | companyId | P2 |
| EmsBlockConfig | (no @@map) | companyId | P3 |
| EvaluationSetting | evaluation_settings | companyId | P2 |
| ExportTemplate | export_templates | companyId | P3 |
| GdprConsent | gdpr_consents | companyId | **P1** |
| GdprRequest | gdpr_requests | companyId | **P1** |
| Holiday | holidays | companyId | P3 |
| HrDocument | hr_documents | companyId | P2 |
| JobCategory | job_categories | companyId | P3 |
| JobGrade | job_grades | companyId | P3 |
| JobPosting | job_postings | companyId | P2 |
| KedoDocument | kedo_documents | companyId | P2 |
| LeavePolicy | leave_policies | companyId | P2 |
| LeaveSetting | leave_settings | companyId | P2 |
| LeaveTypeDef | leave_type_defs | companyId | P2 |
| M365ProvisioningLog | m365_provisioning_logs | companyId | P3 |
| MandatoryTraining | mandatory_trainings | companyId | P2 |
| MandatoryTrainingConfig | mandatory_training_configs | companyId | P2 |
| MigrationJob | migration_jobs | companyId | P3 |
| OffboardingChecklist | offboarding_checklists | companyId | P2 |
| OnboardingSetting | onboarding_settings | companyId | P2 |
| OrgChangeHistory | org_change_history | companyId | P2 |
| OrgRestructurePlan | org_restructure_plans | companyId | P2 |
| OrgSnapshot | org_snapshots | companyId | P2 |
| PayAllowanceType | pay_allowance_types | companyId | P2 |
| PayDeductionType | pay_deduction_types | companyId | P2 |
| PayrollImportLog | payroll_import_logs | companyId | P2 |
| PayrollImportMapping | payroll_import_mappings | companyId | P2 |
| PiiAccessLog | pii_access_logs | companyId | **P1** |
| PromotionSetting | promotion_settings | companyId | P2 |
| PulseSurvey | pulse_surveys | companyId | P2 |
| RecruitmentCost | recruitment_costs | companyId | P2 |
| SalaryAdjustmentMatrix | salary_adjustment_matrix | companyId | **P1** |
| SalaryBand | salary_bands | companyId | **P1** |
| SeveranceInterimPayment | severance_interim_payments | companyId | **P1** |
| ShiftChangeRequest | shift_change_requests | companyId | P2 |
| ShiftGroup | shift_groups | companyId | P2 |
| ShiftPattern | shift_patterns | companyId | P2 |
| ShiftSchedule | shift_schedules | companyId | P2 |
| SkillGapReport | skill_gap_reports | companyId | P2 |
| SocialInsuranceConfig | (no @@map) | companyId | P2 |
| SocialInsuranceRecord | (no @@map) | companyId | **P1** |
| TaxBracket | tax_brackets | companyId | P2 |
| TeamsCardAction | teams_card_actions | companyId | P3 |
| TeamsIntegration | teams_integrations | companyId | P3 |
| TeamsWebhookConfig | teams_webhook_configs | companyId | P3 |
| TenantEnumOption | tenant_enum_options | companyId | P3 |
| TenantSetting | tenant_settings | companyId | P2 |
| TermOverride | term_overrides | companyId | P3 |
| TrainingCourse | training_courses | companyId | P2 |
| WorkflowRule | workflow_rules | companyId | P2 |
| WorkSchedule | work_schedules | companyId | P2 |
| AiReport | ai_reports | companyId | P2 |
| AnalyticsConfig | analytics_configs | companyId | P2 |
| AnalyticsSnapshot | analytics_snapshots | companyId | P2 |
| BenefitBudget | benefit_budgets | companyId | P2 |
| BenefitPlan | benefit_plans | companyId | P2 |
| BenefitPolicy | benefit_policies | companyId | P2 |

---

## T2: Global Config (6 models)

RLS policy: `"companyId" IS NULL OR "companyId" = current_company_id()`.
Nullable companyId = global default accessible to all tenants; non-null = company override.

| Model | PostgreSQL Table | Policy |
|-------|-----------------|--------|
| OnboardingTemplate | onboarding_templates | companyId nullable (global templates have NULL) |
| OffboardingTask | offboarding_tasks | NULL = global; non-null = company-specific |
| OnboardingTask | onboarding_tasks | NULL = global; non-null = company-specific |
| ApprovalFlow | approval_flows | NULL = global template |
| ApprovalFlowStep | approval_flow_steps | No direct companyId — via ApprovalFlow → T2-join |
| WorkflowStep | workflow_steps | Via WorkflowRule → companyId |

---

## T3: System Tables (51 models)

No RLS. These are either:
- Cross-tenant admin utilities (AuditLog, SystemConfig)
- Pure lookup/reference data (Enum tables, ExchangeRate, global competencies)
- Auth infrastructure (Role, Permission, SsoSession)

| Model | PostgreSQL Table | Reason |
|-------|-----------------|--------|
| Company | companies | Root tenant table — SUPER_ADMIN managed |
| Role | roles | Global RBAC — no tenant scope |
| Permission | permissions | Global RBAC |
| RolePermission | role_permissions | Global RBAC |
| AuditLog | audit_logs | Cross-tenant compliance — nullable companyId |
| ExchangeRate | exchange_rates | Global reference data |
| IncomeTaxRate | income_tax_rates | Global/country-level reference |
| InsuranceRate | insurance_rates | Global reference |
| NontaxableLimit | nontaxable_limits | Global reference |
| Competency | competency_library | Global competency framework |
| CompetencyCategory | competency_categories | Global reference |
| CompetencyIndicator | (no @@map) | Global reference |
| CompetencyLevel | (no @@map) | Global reference |
| CompetencyRequirement | (no @@map) | Global reference |
| Job | jobs | Global job catalog |
| Position | positions | Global position catalog |
| LeaveAccrualRule | leave_accrual_rules | Global rules |
| SsoIdentity | sso_identities | Auth infrastructure |
| SsoSession | sso_sessions | Auth infrastructure |
| EmployeeAuth | employee_auth | Auth infrastructure |
| EmployeeRole | employee_roles | RBAC mapping |
| NotificationTrigger | notification_triggers | Global trigger config |
| NotificationPreference | notification_preferences | Per-employee settings |
| BiasDetectionLog | bias_detection_logs | ML pipeline output |
| HrDocumentChunk | hr_document_chunks | Embedding chunks (no tenant) |
| CandidateDuplicateLog | candidate_duplicate_logs | Dedup system |
| MigrationLog | migration_logs | System log |
| MigrationJob | migration_jobs | System job |
| EntityTransfer | entity_transfers | Cross-entity admin |
| EntityTransferDataLog | entity_transfer_data_logs | System log |
| AiEvaluationDraft | ai_evaluation_drafts | System-generated |
| AiLog | ai_logs | System log |
| CalibrationSession | calibration_sessions | Cross-company calibration |
| CalibrationAdjustment | calibration_adjustments | Calibration data |
| Requisition | requisitions | Managed via JobPosting companyId |
| RequisitionApproval | requisition_approvals | Via Requisition |
| TalentPoolEntry | talent_pool_entries | Global talent pool |
| Application | applications | Via JobPosting |
| Applicant | applicants | Pre-hire, no company yet |
| InterviewSchedule | interview_schedules | Via Application |
| InterviewEvaluation | interview_evaluations | Via Application |

---

## T4: Employee-Scoped (69 models)

For HR_ADMIN/MANAGER: scoped to company via employee's EmployeeAssignment.
For EMPLOYEE role: scoped to own `employeeId = current_employee_id()`.

### Priority 1 — Highly Sensitive

| Model | PostgreSQL Table | employeeId | companyId | Notes |
|-------|-----------------|-----------|----------|-------|
| Employee | employees | id (self) | via EmployeeAssignment | ⚠️ Via subquery join |
| EmployeeOffboarding | employee_offboarding | employeeId | via Employee | P1 sensitive |
| ExitInterview | exit_interviews | employeeId+interviewerId | via Employee | Strict: managers cannot see |
| PayrollItem | payroll_items | — | via PayrollRun | Via PayrollRun.companyId |
| PayrollAdjustment | payroll_adjustments | employeeId | via PayrollRun | P1 |
| PayrollAnomaly | payroll_anomalies | employeeId | via PayrollRun | P1 |
| PayrollApproval | payroll_approvals | — | via PayrollRun | P1 |
| PayrollApprovalStep | payroll_approval_steps | — | via PayrollApproval | P1 |
| Payslip | payslips | employeeId | via PayrollRun | P1 |
| CompensationHistory | compensation_history | employeeId | — | P1 salary data |
| EmployeeLeaveBalance | employee_leave_balances | employeeId | — | P1 |
| LeaveRequest | leave_requests | employeeId | via LeavePolicy | P1 |
| EmployeeOnboarding | employee_onboarding | employeeId | companyId | P1 |
| BenefitClaim | benefit_claims | employeeId | — | P1 |
| YearEndSettlement | year_end_settlements | employeeId | — | P1 tax data |
| YearEndDeduction | year_end_deductions | employeeId | — | P1 |
| YearEndDeductionConfig | year_end_deduction_configs | — | companyId | P1 |
| YearEndDependent | year_end_dependents | — | via Settlement | P1 |
| YearEndDocument | year_end_documents | employeeId | — | P1 |
| WithholdingReceipt | withholding_receipts | employeeId | — | P1 |
| SocialInsuranceRecord | (no @@map) | employeeId | companyId | P1 |
| AllowanceRecord | allowance_records | employeeId | — | P1 |
| EmployeePayItem | employee_pay_items | employeeId | — | P1 |

### Priority 2 — Important

| Model | PostgreSQL Table | Priority |
|-------|-----------------|----------|
| Attendance | attendances | P2 |
| AttendanceApprovalStep | attendance_approval_steps | P2 |
| PerformanceEvaluation | performance_evaluations | P2 |
| EmployeeSkillAssessment | employee_skill_assessments | P2 |
| PeerReviewNomination | peer_review_nominations | P2 |
| PeerReviewAnswer | peer_review_answers | P2 |
| MboGoal | (no @@map) | P2 |
| MboProgress | (no @@map) | P2 |
| TrainingEnrollment | training_enrollments | P2 |
| OneOnOne | (no @@map) | P2 |
| Recognition | (no @@map) | P2 |
| RecognitionLike | recognition_likes | P2 |
| ProfileChangeRequest | profile_change_requests | P2 |
| PulseResponse | pulse_responses | P2 |
| SuccessionPlan | succession_plans | P2 |
| SuccessionCandidate | succession_candidates | P2 |
| TurnoverRiskScore | turnover_risk_scores | P2 |
| BurnoutScore | burnout_scores | P2 |
| AttritionRiskHistory | attrition_risk_history | P2 |
| CollaborationScore | collaboration_scores | P2 |
| TeamHealthScore | team_health_scores | P2 |

### Priority 3 — Standard

| Model | PostgreSQL Table | Priority |
|-------|-----------------|----------|
| Notification | notifications | P3 |
| EmergencyContact | emergency_contacts | P3 |
| EmployeeBenefit | employee_benefits | P3 |
| EmployeeDocument | employee_documents | P3 |
| EmployeeHistory | employee_histories | P3 |
| EmployeeOffboardingTask | employee_offboarding_tasks | P3 |
| EmployeeOnboardingTask | employee_onboarding_tasks | P3 |
| EmployeeProfileExtension | employee_profile_extensions | P3 |
| EmployeeSchedule | employee_schedules | P3 |
| HrChatSession | hr_chat_sessions | P3 |
| HrChatMessage | hr_chat_messages | P3 |
| KpiDashboardConfig | kpi_dashboard_configs | P3 |
| LeavePromotionLog | leave_promotion_logs | P3 |
| LeaveYearBalance | leave_year_balances | P3 |
| MilitaryRegistration | military_registrations | P3 |
| OnboardingCheckin | onboarding_checkins | P3 |
| ProfileVisibility | profile_visibilities | P3 |
| PushSubscription | push_subscriptions | P3 |
| RewardRecord | reward_records | P3 |
| ShiftGroupMember | shift_group_members | P3 |
| WorkPermit | work_permits | P3 |
| WorkHourAlert | work_hour_alerts | P3 |
| ContractHistory | contract_histories | P3 |
| AssetReturn | asset_returns | P3 |
| ApprovalDelegation | approval_delegations | P3 |
| PayrollSimulation | payroll_simulations | P3 |
| DisciplinaryAction | disciplinary_actions | P3 |

---

## Implementation Notes

### Employee Table Special Handling
`employees` table has no `companyId`. RLS policy uses a subquery:
```sql
EXISTS (
  SELECT 1 FROM employee_assignments ea
  WHERE ea.employee_id = employees.id
  AND ea.company_id = current_company_id()
  AND ea.is_primary = true
  AND ea.end_date IS NULL
)
```

### SUPER_ADMIN Always Bypasses
All tables include: `CREATE POLICY "super_admin_bypass" ... USING (current_user_role() = 'SUPER_ADMIN')`.

### Incremental Migration
Phase 5e only enables RLS on **Priority 1 tables** (P1 marked above).
Priority 2 and 3 tables will be migrated in subsequent sessions.
