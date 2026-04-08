// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compliance / Settings / Org / Misc Test Helpers
// Thin wrappers around ApiClient for settings CRUD,
// compliance GDPR/regional, audit, org, notifications,
// delegation, and skills modules.
// ═══════════════════════════════════════════════════════════

import { ApiClient, type ApiResult } from './api-client'

// ─── Path Constants ──────────────────────────────────────

const SET = '/api/v1/settings'
const COMP = '/api/v1/compliance'
const AUD = '/api/v1/audit'
const ORG = '/api/v1/org'
const NOTIF = '/api/v1/notifications'
const DELEG = '/api/v1/delegation'
const SKILL = '/api/v1/skills'

// ─── Uniqueness Helper ──────────────────────────────────

const ts = () => Date.now() % 100000

// ═══════════════════════════════════════════════════════════
// BUILDERS
// ═══════════════════════════════════════════════════════════

export function buildWorkflow(prefix: string) {
  return {
    workflowType: 'LEAVE_APPROVAL',
    name: `E2E ${prefix} WF ${ts()}`,
    steps: [
      { stepOrder: 1, approverType: 'DIRECT_MANAGER', canSkip: false },
    ],
  }
}

export function buildEmailTemplate(prefix: string) {
  return {
    eventType: `E2E_${prefix}_${ts()}`,
    channel: 'EMAIL' as const,
    locale: 'ko',
    subject: `E2E ${prefix} Subject ${ts()}`,
    body: `E2E ${prefix} Body content for testing`,
    variables: [],
    isActive: true,
  }
}

export function buildEnumOption(prefix: string) {
  return {
    enumGroup: 'CONTRACT_TYPE',
    optionKey: `e2e_${prefix}_${ts()}`,
    label: `E2E ${prefix} Option`,
    sortOrder: 99,
  }
}

export function buildCustomField(prefix: string) {
  return {
    entityType: 'EMPLOYEE',
    fieldKey: `e2e_${prefix}_${ts()}`,
    fieldLabel: `E2E ${prefix} Field`,
    fieldType: 'TEXT' as const,
    isRequired: false,
    isSearchable: false,
    isVisibleToEmployee: true,
    sortOrder: 99,
  }
}

export function buildExportTemplate(prefix: string) {
  return {
    entityType: 'EMPLOYEE',
    name: `E2E ${prefix} Export ${ts()}`,
    columns: [
      { key: 'name', label: '이름' },
      { key: 'email', label: '이메일' },
    ],
    fileFormat: 'XLSX' as const,
    isDefault: false,
  }
}

export function buildNotifTrigger(prefix: string) {
  return {
    eventType: `e2e.test.${prefix}.${ts()}`,
    template: `E2E trigger template for ${prefix}`,
    channels: ['IN_APP'] as const,
    isActive: true,
  }
}

export function buildApprovalFlow(prefix: string) {
  return {
    name: `E2E ${prefix} Flow ${ts()}`,
    module: 'leave',
    description: `E2E approval flow for ${prefix}`,
    steps: [
      { approverType: 'DIRECT_MANAGER', isRequired: true },
    ],
  }
}

export function buildTermOverride(prefix: string) {
  return {
    termKey: `e2e_${prefix}_${ts()}`,
    labelKo: `E2E ${prefix} 용어`,
    labelEn: `E2E ${prefix} Term`,
  }
}

export function buildDpia(prefix: string) {
  return {
    title: `E2E ${prefix} DPIA ${ts()}`,
    description: `E2E DPIA assessment for ${prefix}`,
    riskLevel: 'MEDIUM' as const,
  }
}

export function buildConsent(employeeId: string) {
  return {
    employeeId,
    purpose: 'TRAINING_RECORDS' as const,
    legalBasis: 'E2E test consent',
  }
}

export function buildRetentionPolicy(prefix: string) {
  return {
    category: 'TRAINING_RECORDS' as const,
    retentionMonths: 36,
    description: `E2E ${prefix} retention policy`,
    autoDelete: false,
    anonymize: true,
  }
}

export function buildGdprRequest(employeeId: string) {
  return {
    employeeId,
    requestType: 'ACCESS' as const,
    description: 'E2E test data access request',
  }
}

export function buildDepartment(prefix: string, companyId: string) {
  return {
    companyId,
    code: `E2E${prefix}${ts()}`.slice(0, 20),
    name: `E2E ${prefix} Dept`,
  }
}

// ═══════════════════════════════════════════════════════════
// SETTINGS WRAPPERS
// ═══════════════════════════════════════════════════════════

// ─── Workflows ──────────────────────────────────────────

export function listWorkflows(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${SET}/workflows`, params)
}

export function createWorkflow(c: ApiClient, data: ReturnType<typeof buildWorkflow>): Promise<ApiResult> {
  return c.post(`${SET}/workflows`, data)
}

export function getWorkflow(c: ApiClient, id: string): Promise<ApiResult> {
  return c.get(`${SET}/workflows/${id}`)
}

export function updateWorkflow(c: ApiClient, id: string, data: Record<string, unknown>): Promise<ApiResult> {
  return c.put(`${SET}/workflows/${id}`, data)
}

export function deleteWorkflow(c: ApiClient, id: string): Promise<ApiResult> {
  return c.del(`${SET}/workflows/${id}`)
}

export function restoreWorkflow(c: ApiClient, id: string): Promise<ApiResult> {
  return c.post(`${SET}/workflows/${id}/restore`, {})
}

// ─── Email Templates ────────────────────────────────────

export function listEmailTemplates(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${SET}/email-templates`, params)
}

export function createEmailTemplate(c: ApiClient, data: ReturnType<typeof buildEmailTemplate>): Promise<ApiResult> {
  return c.post(`${SET}/email-templates`, data)
}

export function getEmailTemplate(c: ApiClient, id: string): Promise<ApiResult> {
  return c.get(`${SET}/email-templates/${id}`)
}

export function updateEmailTemplate(c: ApiClient, id: string, data: Record<string, unknown>): Promise<ApiResult> {
  return c.put(`${SET}/email-templates/${id}`, data)
}

export function deleteEmailTemplate(c: ApiClient, id: string): Promise<ApiResult> {
  return c.del(`${SET}/email-templates/${id}`)
}

export function restoreEmailTemplate(c: ApiClient, id: string): Promise<ApiResult> {
  return c.post(`${SET}/email-templates/${id}/restore`, {})
}

// ─── Enums ──────────────────────────────────────────────

export function listEnums(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${SET}/enums`, params)
}

export function createEnum(c: ApiClient, data: ReturnType<typeof buildEnumOption>): Promise<ApiResult> {
  return c.post(`${SET}/enums`, data)
}

export function getEnum(c: ApiClient, id: string): Promise<ApiResult> {
  return c.get(`${SET}/enums/${id}`)
}

export function updateEnum(c: ApiClient, id: string, data: Record<string, unknown>): Promise<ApiResult> {
  return c.put(`${SET}/enums/${id}`, data)
}

export function deleteEnum(c: ApiClient, id: string): Promise<ApiResult> {
  return c.del(`${SET}/enums/${id}`)
}

// ─── Custom Fields ──────────────────────────────────────

export function listCustomFields(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${SET}/custom-fields`, params)
}

export function createCustomField(c: ApiClient, data: ReturnType<typeof buildCustomField>): Promise<ApiResult> {
  return c.post(`${SET}/custom-fields`, data)
}

export function deleteCustomField(c: ApiClient, id: string): Promise<ApiResult> {
  return c.del(`${SET}/custom-fields/${id}`)
}

// ─── Export Templates ───────────────────────────────────

export function listExportTemplates(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${SET}/export-templates`, params)
}

export function createExportTemplate(c: ApiClient, data: ReturnType<typeof buildExportTemplate>): Promise<ApiResult> {
  return c.post(`${SET}/export-templates`, data)
}

export function deleteExportTemplate(c: ApiClient, id: string): Promise<ApiResult> {
  return c.del(`${SET}/export-templates/${id}`)
}

// ─── Notification Triggers ──────────────────────────────

export function listNotifTriggers(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${SET}/notification-triggers`, params)
}

export function createNotifTrigger(c: ApiClient, data: ReturnType<typeof buildNotifTrigger>): Promise<ApiResult> {
  return c.post(`${SET}/notification-triggers`, data)
}

export function getNotifTrigger(c: ApiClient, id: string): Promise<ApiResult> {
  return c.get(`${SET}/notification-triggers/${id}`)
}

export function deleteNotifTrigger(c: ApiClient, id: string): Promise<ApiResult> {
  return c.del(`${SET}/notification-triggers/${id}`)
}

export function restoreNotifTrigger(c: ApiClient, id: string): Promise<ApiResult> {
  return c.post(`${SET}/notification-triggers/${id}/restore`, {})
}

// ─── Approval Flows ─────────────────────────────────────

export function listApprovalFlows(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${SET}/approval-flows`, params)
}

export function createApprovalFlow(c: ApiClient, data: ReturnType<typeof buildApprovalFlow>): Promise<ApiResult> {
  return c.post(`${SET}/approval-flows`, data)
}

export function deleteApprovalFlow(c: ApiClient, id: string): Promise<ApiResult> {
  return c.del(`${SET}/approval-flows?id=${id}`)
}

// ─── Read-Only Settings ─────────────────────────────────

export function getJobGrades(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${SET}/job-grades`, params)
}

export function getEmployeeTitles(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${SET}/employee-titles`, params)
}

export function getGradeTitleMappings(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${SET}/grade-title-mappings`, params)
}

export function getBranding(c: ApiClient): Promise<ApiResult> {
  return c.get(`${SET}/branding`)
}

export function updateBranding(c: ApiClient, data: Record<string, unknown>): Promise<ApiResult> {
  return c.put(`${SET}/branding`, data)
}

export function getCompanySettings(c: ApiClient): Promise<ApiResult> {
  return c.get(`${SET}/company`)
}

export function updateCompanySettings(c: ApiClient, data: Record<string, unknown>): Promise<ApiResult> {
  return c.put(`${SET}/company`, data)
}

export function getModules(c: ApiClient): Promise<ApiResult> {
  return c.get(`${SET}/modules`)
}

export function getDashboardLayout(c: ApiClient): Promise<ApiResult> {
  return c.get(`${SET}/dashboard-layout`)
}

export function updateDashboardLayout(c: ApiClient, data: Record<string, unknown>): Promise<ApiResult> {
  return c.put(`${SET}/dashboard-layout`, data)
}

// ─── Terms ──────────────────────────────────────────────

export function listTerms(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${SET}/terms`, params)
}

export function upsertTerm(c: ApiClient, data: ReturnType<typeof buildTermOverride>): Promise<ApiResult> {
  return c.post(`${SET}/terms`, data)
}

// ─── Teams Webhooks ─────────────────────────────────────

export function listTeamsWebhooks(c: ApiClient): Promise<ApiResult> {
  return c.get(`${SET}/teams-webhooks`)
}

export function createTeamsWebhook(c: ApiClient, data: Record<string, unknown>): Promise<ApiResult> {
  return c.post(`${SET}/teams-webhooks`, data)
}

// ═══════════════════════════════════════════════════════════
// COMPLIANCE WRAPPERS
// ═══════════════════════════════════════════════════════════

// ─── GDPR: DPIA ─────────────────────────────────────────

export function listDpia(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${COMP}/gdpr/dpia`, params)
}

export function createDpia(c: ApiClient, data: ReturnType<typeof buildDpia>): Promise<ApiResult> {
  return c.post(`${COMP}/gdpr/dpia`, data)
}

export function getDpia(c: ApiClient, id: string): Promise<ApiResult> {
  return c.get(`${COMP}/gdpr/dpia/${id}`)
}

export function updateDpia(c: ApiClient, id: string, data: Record<string, unknown>): Promise<ApiResult> {
  return c.put(`${COMP}/gdpr/dpia/${id}`, data)
}

// ─── GDPR: Consents ─────────────────────────────────────

export function listConsents(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${COMP}/gdpr/consents`, params)
}

export function createConsent(c: ApiClient, data: ReturnType<typeof buildConsent>): Promise<ApiResult> {
  return c.post(`${COMP}/gdpr/consents`, data)
}

export function revokeConsent(c: ApiClient, id: string): Promise<ApiResult> {
  return c.post(`${COMP}/gdpr/consents/${id}/revoke`, {})
}

// ─── GDPR: Retention ────────────────────────────────────

export function listRetentionPolicies(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${COMP}/gdpr/retention`, params)
}

export function createRetentionPolicy(c: ApiClient, data: ReturnType<typeof buildRetentionPolicy>): Promise<ApiResult> {
  return c.post(`${COMP}/gdpr/retention`, data)
}

// ─── GDPR: PII Access ───────────────────────────────────

export function listPiiAccess(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${COMP}/gdpr/pii-access`, params)
}

export function getPiiDashboard(c: ApiClient): Promise<ApiResult> {
  return c.get(`${COMP}/gdpr/pii-access/dashboard`)
}

// ─── GDPR: Requests ─────────────────────────────────────

export function listGdprRequests(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${COMP}/gdpr/requests`, params)
}

export function createGdprRequest(c: ApiClient, data: ReturnType<typeof buildGdprRequest>): Promise<ApiResult> {
  return c.post(`${COMP}/gdpr/requests`, data)
}

// ─── Regional: KR ───────────────────────────────────────

export function listMandatoryTrainingKR(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${COMP}/kr/mandatory-training`, params)
}

export function getWorkHours(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${COMP}/kr/work-hours`, params)
}

export function getWorkHoursEmployees(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${COMP}/kr/work-hours/employees`, params)
}

export function getWorkHoursAlerts(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${COMP}/kr/work-hours/alerts`, params)
}

// ─── Regional: CN ───────────────────────────────────────

export function listSocialInsuranceConfig(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${COMP}/cn/social-insurance/config`, params)
}

export function listSocialInsuranceRecords(c: ApiClient, params: Record<string, string>): Promise<ApiResult> {
  return c.get(`${COMP}/cn/social-insurance/records`, params)
}

// ─── Regional: RU ───────────────────────────────────────

export function listKedo(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${COMP}/ru/kedo`, params)
}

export function listMilitary(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${COMP}/ru/military`, params)
}

export function getRuReport(c: ApiClient, type: string, params: Record<string, string>): Promise<ApiResult> {
  return c.get(`${COMP}/ru/reports/${type}`, params)
}

// ═══════════════════════════════════════════════════════════
// AUDIT WRAPPERS
// ═══════════════════════════════════════════════════════════

export function listAuditLogs(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${AUD}/logs`, params)
}

export function getAuditStats(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${AUD}/logs/stats`, params)
}

export function getAuditRetentionPolicy(c: ApiClient): Promise<ApiResult> {
  return c.get(`${AUD}/retention-policy`)
}

export function updateAuditRetentionPolicy(c: ApiClient, data: Record<string, unknown>): Promise<ApiResult> {
  return c.put(`${AUD}/retention-policy`, data)
}

// ═══════════════════════════════════════════════════════════
// ORG WRAPPERS
// ═══════════════════════════════════════════════════════════

export function listDepartments(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${ORG}/departments`, params)
}

export function createDepartment(c: ApiClient, data: ReturnType<typeof buildDepartment>): Promise<ApiResult> {
  return c.post(`${ORG}/departments`, data)
}

export function getDepartment(c: ApiClient, id: string): Promise<ApiResult> {
  return c.get(`${ORG}/departments/${id}`)
}

export function updateDepartment(c: ApiClient, id: string, data: Record<string, unknown>): Promise<ApiResult> {
  return c.put(`${ORG}/departments/${id}`, data)
}

export function deleteDepartment(c: ApiClient, id: string): Promise<ApiResult> {
  return c.del(`${ORG}/departments/${id}`)
}

export function getOrgTree(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${ORG}/tree`, params)
}

export function listCompanies(c: ApiClient): Promise<ApiResult> {
  return c.get(`${ORG}/companies`)
}

export function listOrgSnapshots(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${ORG}/snapshots`, params)
}

export function listOrgChangeHistory(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${ORG}/change-history`, params)
}

// ═══════════════════════════════════════════════════════════
// NOTIFICATIONS WRAPPERS
// ═══════════════════════════════════════════════════════════

export function listNotifications(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(NOTIF, params)
}

export function markNotifRead(c: ApiClient, id: string): Promise<ApiResult> {
  return c.put(`${NOTIF}/${id}/read`, {})
}

export function markAllNotifsRead(c: ApiClient): Promise<ApiResult> {
  return c.put(`${NOTIF}/read-all`, {})
}

export function getUnreadCount(c: ApiClient): Promise<ApiResult> {
  return c.get(`${NOTIF}/unread-count`)
}

export function getNotifPreferences(c: ApiClient): Promise<ApiResult> {
  return c.get(`${NOTIF}/preferences`)
}

// ═══════════════════════════════════════════════════════════
// DELEGATION WRAPPERS
// ═══════════════════════════════════════════════════════════

export function listDelegations(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(DELEG, params)
}

export function getEligibleDelegatees(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${DELEG}/eligible`, params)
}

export function createDelegation(c: ApiClient, data: Record<string, unknown>): Promise<ApiResult> {
  return c.post(DELEG, data)
}

// ═══════════════════════════════════════════════════════════
// SKILLS WRAPPERS
// ═══════════════════════════════════════════════════════════

export function listSkillAssessments(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${SKILL}/assessments`, params)
}

export function getSkillMatrix(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${SKILL}/matrix`, params)
}

export function getSkillRadar(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${SKILL}/radar`, params)
}

export function getGapReport(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${SKILL}/gap-report`, params)
}

export function getTeamAssessments(c: ApiClient, params?: Record<string, string>): Promise<ApiResult> {
  return c.get(`${SKILL}/team-assessments`, params)
}
