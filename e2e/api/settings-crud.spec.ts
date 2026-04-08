// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Settings CRUD API Tests
// Phase 2 P8: workflows, email-templates, enums, custom-fields,
// export-templates, notification-triggers, approval-flows,
// branding, company, modules, dashboard-layout, terms, webhooks
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import * as f from '../helpers/compliance-settings-fixtures'

// ═══════════════════════════════════════════════════════════
// HR_ADMIN — Workflow Lifecycle (soft-delete + restore)
// ═══════════════════════════════════════════════════════════

test.describe('Settings: HR_ADMIN Workflow Lifecycle', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let workflowId: string

  test('POST /workflows creates workflow', async ({ request }) => {
    const client = new ApiClient(request)
    const data = f.buildWorkflow('WF')
    const result = await f.createWorkflow(client, data)
    assertOk(result, 'create workflow')
    expect(result.data).toHaveProperty('id')
    workflowId = (result.data as Record<string, unknown>).id as string
  })

  test('GET /workflows returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listWorkflows(client)
    assertOk(result, 'list workflows')
    expect(Array.isArray(result.data)).toBe(true)
    expect((result.data as unknown[]).length).toBeGreaterThan(0)
  })

  test('GET /workflows/[id] returns detail', async ({ request }) => {
    test.skip(!workflowId, 'No workflow created')
    const client = new ApiClient(request)
    const result = await f.getWorkflow(client, workflowId)
    assertOk(result, 'get workflow detail')
    expect((result.data as Record<string, unknown>).id).toBe(workflowId)
  })

  test('PUT /workflows/[id] updates name', async ({ request }) => {
    test.skip(!workflowId, 'No workflow created')
    const client = new ApiClient(request)
    const result = await f.updateWorkflow(client, workflowId, { name: 'E2E Updated Name' })
    assertOk(result, 'update workflow')
  })

  test('DELETE /workflows/[id] soft-deletes', async ({ request }) => {
    test.skip(!workflowId, 'No workflow created')
    const client = new ApiClient(request)
    const result = await f.deleteWorkflow(client, workflowId)
    assertOk(result, 'delete workflow')
  })

  test('GET /workflows/[id] after delete returns 404', async ({ request }) => {
    test.skip(!workflowId, 'No workflow created')
    const client = new ApiClient(request)
    const result = await f.getWorkflow(client, workflowId)
    assertError(result, 404, 'workflow 404 after delete')
  })

  test('POST /workflows/[id]/restore restores', async ({ request }) => {
    test.skip(!workflowId, 'No workflow created')
    const client = new ApiClient(request)
    const result = await f.restoreWorkflow(client, workflowId)
    assertOk(result, 'restore workflow')
  })

  test('GET /workflows/[id] after restore returns 200', async ({ request }) => {
    test.skip(!workflowId, 'No workflow created')
    const client = new ApiClient(request)
    const result = await f.getWorkflow(client, workflowId)
    assertOk(result, 'workflow 200 after restore')
  })
})

// ═══════════════════════════════════════════════════════════
// HR_ADMIN — Email Template Lifecycle
// Note: email-templates don't filter deletedAt in GET,
// so after delete the record still appears. We verify deletedAt field.
// ═══════════════════════════════════════════════════════════

test.describe('Settings: HR_ADMIN Email Template Lifecycle', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let templateId: string

  test('POST /email-templates creates template', async ({ request }) => {
    const client = new ApiClient(request)
    const data = f.buildEmailTemplate('ETPL')
    const result = await f.createEmailTemplate(client, data)
    assertOk(result, 'create email template')
    expect(result.data).toHaveProperty('id')
    templateId = (result.data as Record<string, unknown>).id as string
  })

  test('GET /email-templates returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listEmailTemplates(client)
    assertOk(result, 'list email templates')
    expect(Array.isArray(result.data)).toBe(true)
  })

  test('GET /email-templates/[id] returns detail', async ({ request }) => {
    test.skip(!templateId, 'No template created')
    const client = new ApiClient(request)
    const result = await f.getEmailTemplate(client, templateId)
    assertOk(result, 'get email template detail')
  })

  test('PUT /email-templates/[id] updates subject', async ({ request }) => {
    test.skip(!templateId, 'No template created')
    const client = new ApiClient(request)
    const result = await f.updateEmailTemplate(client, templateId, { subject: 'E2E Updated Subject' })
    assertOk(result, 'update email template')
  })

  test('DELETE /email-templates/[id] soft-deletes (verify deletedAt)', async ({ request }) => {
    test.skip(!templateId, 'No template created')
    const client = new ApiClient(request)
    const delResult = await f.deleteEmailTemplate(client, templateId)
    assertOk(delResult, 'delete email template')
    // GET still returns (no deletedAt filter) — verify deletedAt is set
    const getResult = await f.getEmailTemplate(client, templateId)
    assertOk(getResult, 'get after delete')
    const item = getResult.data as Record<string, unknown>
    expect(item.deletedAt).toBeTruthy()
  })

  test('POST /email-templates/[id]/restore clears deletedAt', async ({ request }) => {
    test.skip(!templateId, 'No template created')
    const client = new ApiClient(request)
    const restoreResult = await f.restoreEmailTemplate(client, templateId)
    assertOk(restoreResult, 'restore email template')
    const getResult = await f.getEmailTemplate(client, templateId)
    assertOk(getResult, 'get after restore')
    const item = getResult.data as Record<string, unknown>
    expect(item.deletedAt).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════
// HR_ADMIN — Enum + Custom Field
// ═══════════════════════════════════════════════════════════

test.describe('Settings: HR_ADMIN Enum + Custom Field', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let enumId: string
  let fieldId: string

  test('POST /enums creates enum option', async ({ request }) => {
    const client = new ApiClient(request)
    const data = f.buildEnumOption('ENUM')
    const result = await f.createEnum(client, data)
    assertOk(result, 'create enum')
    expect(result.data).toHaveProperty('id')
    enumId = (result.data as Record<string, unknown>).id as string
  })

  test('GET /enums returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listEnums(client)
    assertOk(result, 'list enums')
    expect(Array.isArray(result.data)).toBe(true)
  })

  test('GET /enums?enumGroup=CONTRACT_TYPE filters', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listEnums(client, { enumGroup: 'CONTRACT_TYPE' })
    assertOk(result, 'list enums filtered')
  })

  test('PUT /enums/[id] updates label', async ({ request }) => {
    test.skip(!enumId, 'No enum created')
    const client = new ApiClient(request)
    const result = await f.updateEnum(client, enumId, { label: 'E2E Updated Label' })
    assertOk(result, 'update enum')
  })

  test('DELETE /enums/[id] deletes', async ({ request }) => {
    test.skip(!enumId, 'No enum created')
    const client = new ApiClient(request)
    const result = await f.deleteEnum(client, enumId)
    assertOk(result, 'delete enum')
  })

  test('POST /custom-fields creates field', async ({ request }) => {
    const client = new ApiClient(request)
    const data = f.buildCustomField('CF')
    const result = await f.createCustomField(client, data)
    assertOk(result, 'create custom field')
    expect(result.data).toHaveProperty('id')
    fieldId = (result.data as Record<string, unknown>).id as string
  })

  test('DELETE /custom-fields/[id] deletes', async ({ request }) => {
    test.skip(!fieldId, 'No field created')
    const client = new ApiClient(request)
    const result = await f.deleteCustomField(client, fieldId)
    assertOk(result, 'delete custom field')
  })
})

// ═══════════════════════════════════════════════════════════
// HR_ADMIN — Export Template + Notification Trigger
// ═══════════════════════════════════════════════════════════

test.describe('Settings: HR_ADMIN Export Template + Notification Trigger', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let exportId: string
  let triggerId: string
  let triggerEventType: string

  test('POST /export-templates creates template', async ({ request }) => {
    const client = new ApiClient(request)
    const data = f.buildExportTemplate('EXP')
    const result = await f.createExportTemplate(client, data)
    assertOk(result, 'create export template')
    expect(result.data).toHaveProperty('id')
    exportId = (result.data as Record<string, unknown>).id as string
  })

  test('GET /export-templates returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listExportTemplates(client)
    assertOk(result, 'list export templates')
    expect(Array.isArray(result.data)).toBe(true)
  })

  test('DELETE /export-templates/[id] deletes', async ({ request }) => {
    test.skip(!exportId, 'No export template created')
    const client = new ApiClient(request)
    const result = await f.deleteExportTemplate(client, exportId)
    assertOk(result, 'delete export template')
  })

  test('POST /notification-triggers creates trigger', async ({ request }) => {
    const client = new ApiClient(request)
    const data = f.buildNotifTrigger('NTRIG')
    triggerEventType = data.eventType
    const result = await f.createNotifTrigger(client, data)
    assertOk(result, 'create notification trigger')
    expect(result.data).toHaveProperty('id')
    triggerId = (result.data as Record<string, unknown>).id as string
  })

  test('GET /notification-triggers returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listNotifTriggers(client)
    assertOk(result, 'list notification triggers')
    expect(Array.isArray(result.data)).toBe(true)
  })

  test('DELETE /notification-triggers/[id] soft-deletes (verify deletedAt)', async ({ request }) => {
    test.skip(!triggerId, 'No trigger created')
    const client = new ApiClient(request)
    const delResult = await f.deleteNotifTrigger(client, triggerId)
    assertOk(delResult, 'delete notification trigger')
    // GET still returns (no deletedAt filter) — verify deletedAt set
    const getResult = await f.getNotifTrigger(client, triggerId)
    assertOk(getResult, 'get trigger after delete')
    const item = getResult.data as Record<string, unknown>
    expect(item.deletedAt).toBeTruthy()
  })

  test('POST /notification-triggers/[id]/restore restores', async ({ request }) => {
    test.skip(!triggerId, 'No trigger created')
    const client = new ApiClient(request)
    const restoreResult = await f.restoreNotifTrigger(client, triggerId)
    assertOk(restoreResult, 'restore notification trigger')
    const getResult = await f.getNotifTrigger(client, triggerId)
    assertOk(getResult, 'get trigger after restore')
    const item = getResult.data as Record<string, unknown>
    expect(item.deletedAt).toBeNull()
  })

  test('POST /notification-triggers duplicate eventType returns error', async ({ request }) => {
    test.skip(!triggerEventType, 'No trigger event type')
    const client = new ApiClient(request)
    const data = {
      eventType: triggerEventType,
      template: 'Duplicate test',
      channels: ['IN_APP'] as const,
      isActive: true,
    }
    const result = await f.createNotifTrigger(client, data)
    // Expect conflict or validation error due to unique constraint (never 500)
    expect([400, 409]).toContain(result.status)
  })
})

// ═══════════════════════════════════════════════════════════
// HR_ADMIN — Approval Flows
// ═══════════════════════════════════════════════════════════

test.describe('Settings: HR_ADMIN Approval Flows', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  let flowId: string

  test('POST /approval-flows creates flow', async ({ request }) => {
    const client = new ApiClient(request)
    const data = f.buildApprovalFlow('AF')
    const result = await f.createApprovalFlow(client, data)
    assertOk(result, 'create approval flow')
    expect(result.data).toHaveProperty('id')
    flowId = (result.data as Record<string, unknown>).id as string
  })

  test('GET /approval-flows returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listApprovalFlows(client, { module: 'leave' })
    assertOk(result, 'list approval flows')
    expect(Array.isArray(result.data)).toBe(true)
  })

  test('DELETE /approval-flows?id= deletes', async ({ request }) => {
    test.skip(!flowId, 'No flow created')
    const client = new ApiClient(request)
    const result = await f.deleteApprovalFlow(client, flowId)
    assertOk(result, 'delete approval flow')
  })
})

// ═══════════════════════════════════════════════════════════
// HR_ADMIN — Read-Only + Branding
// ═══════════════════════════════════════════════════════════

test.describe('Settings: HR_ADMIN Read-Only + Branding', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET /job-grades returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getJobGrades(client)
    assertOk(result, 'list job grades')
  })

  test('GET /employee-titles returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getEmployeeTitles(client)
    assertOk(result, 'list employee titles')
  })

  test('GET /grade-title-mappings returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getGradeTitleMappings(client)
    assertOk(result, 'list grade-title mappings')
  })

  test('GET /branding returns settings', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getBranding(client)
    assertOk(result, 'get branding')
  })

  test('PUT /branding updates primaryColor', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.updateBranding(client, { primaryColor: '#e2e000' })
    assertOk(result, 'update branding')
  })

  test('GET /company returns settings', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getCompanySettings(client)
    assertOk(result, 'get company settings')
  })

  test('GET /modules returns enabled list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getModules(client)
    assertOk(result, 'get modules')
  })

  test('GET /dashboard-layout returns layout', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.getDashboardLayout(client)
    // May return 200 with null data if no layout configured
    expect([200, 404]).toContain(result.status)
  })
})

// ═══════════════════════════════════════════════════════════
// HR_ADMIN — Terms & Webhooks
// ═══════════════════════════════════════════════════════════

test.describe('Settings: HR_ADMIN Terms & Webhooks', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('HR_ADMIN') })

  test('POST /terms upserts term', async ({ request }) => {
    const client = new ApiClient(request)
    const data = f.buildTermOverride('TERM')
    const result = await f.upsertTerm(client, data)
    assertOk(result, 'upsert term')
  })

  test('GET /terms returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listTerms(client)
    assertOk(result, 'list terms')
  })

  test('GET /teams-webhooks returns list', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listTeamsWebhooks(client)
    assertOk(result, 'list teams webhooks')
  })

  test('POST /teams-webhooks creates webhook', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.createTeamsWebhook(client, {
      channelName: `E2E Webhook ${Date.now()}`,
      webhookUrl: 'https://e2e-test.example.com/webhook',
      isActive: true,
    })
    assertOk(result, 'create teams webhook')
  })
})

// ═══════════════════════════════════════════════════════════
// RBAC: EMPLOYEE Blocked
// ═══════════════════════════════════════════════════════════

test.describe('Settings RBAC: EMPLOYEE Blocked', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('GET /workflows returns 401/403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listWorkflows(client)
    expect([401, 403]).toContain(result.status)
  })

  test('POST /workflows returns 401/403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.createWorkflow(client, f.buildWorkflow('BLOCK'))
    expect([401, 403]).toContain(result.status)
  })

  test('POST /email-templates returns 401/403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.createEmailTemplate(client, f.buildEmailTemplate('BLOCK'))
    expect([401, 403]).toContain(result.status)
  })

  test('POST /enums returns 401/403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.createEnum(client, f.buildEnumOption('BLOCK'))
    expect([401, 403]).toContain(result.status)
  })

  test('POST /custom-fields returns 401/403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.createCustomField(client, f.buildCustomField('BLOCK'))
    expect([401, 403]).toContain(result.status)
  })

  test('PUT /branding returns 401/403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.updateBranding(client, { primaryColor: '#000000' })
    expect([401, 403]).toContain(result.status)
  })

  test('POST /approval-flows returns 401/403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.createApprovalFlow(client, f.buildApprovalFlow('BLOCK'))
    expect([401, 403]).toContain(result.status)
  })

  test('PUT /company returns 401/403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.updateCompanySettings(client, { probationMonths: 6 })
    expect([401, 403]).toContain(result.status)
  })
})

// ═══════════════════════════════════════════════════════════
// RBAC: MANAGER Blocked
// ═══════════════════════════════════════════════════════════

test.describe('Settings RBAC: MANAGER Blocked', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('GET /workflows returns 401/403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.listWorkflows(client)
    expect([401, 403]).toContain(result.status)
  })

  test('POST /workflows returns 401/403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.createWorkflow(client, f.buildWorkflow('MBLOCK'))
    expect([401, 403]).toContain(result.status)
  })

  test('POST /email-templates returns 401/403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.createEmailTemplate(client, f.buildEmailTemplate('MBLOCK'))
    expect([401, 403]).toContain(result.status)
  })

  test('POST /enums returns 401/403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.createEnum(client, f.buildEnumOption('MBLOCK'))
    expect([401, 403]).toContain(result.status)
  })

  test('POST /custom-fields returns 401/403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.createCustomField(client, f.buildCustomField('MBLOCK'))
    expect([401, 403]).toContain(result.status)
  })

  test('PUT /branding returns 401/403', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await f.updateBranding(client, { primaryColor: '#000000' })
    expect([401, 403]).toContain(result.status)
  })
})
