// ═══════════════════════════════════════════════════════════
// CTR HR Hub — P11 Test Helpers
// notifications (read, preferences, filters), push subscribe,
// monitoring, terminals CRUD/clock, cron jobs, manager-hub
// (performance/team-health/dotted-line-reports),
// teams integration, search, tax-brackets, hr-documents,
// m365 status
// ═══════════════════════════════════════════════════════════

import { ApiClient, type ApiResult } from './api-client'
import type { APIRequestContext } from '@playwright/test'
import { parseApiResponse } from './api-client'

// ─── Path Constants ──────────────────────────────────────

const NOTIFICATIONS = '/api/v1/notifications'
const NOTIF_PREFS = '/api/v1/notifications/preferences'
const NOTIF_READ_ALL = '/api/v1/notifications/read-all'
const NOTIF_UNREAD_COUNT = '/api/v1/notifications/unread-count'

const PUSH_SUBSCRIBE = '/api/v1/push/subscribe'
const PUSH_VAPID = '/api/v1/push/vapid-key'

const MONITORING_HEALTH = '/api/v1/monitoring/health'
const MONITORING_METRICS = '/api/v1/monitoring/metrics'

const TERMINALS = '/api/v1/terminals'
const TERMINAL_CLOCK = '/api/v1/terminals/clock'

const CRON_OVERDUE = '/api/v1/cron/overdue-check'
const CRON_EVAL_REMINDER = '/api/v1/cron/eval-reminder'
const CRON_NUDGE = '/api/v1/cron/nudge-batch'
const CRON_ORG_SNAPSHOT = '/api/v1/cron/org-snapshot'
const CRON_LEAVE_PROMO = '/api/v1/cron/leave-promotion'
const CRON_LOA_RETURN = '/api/v1/cron/loa-return-reminder'
const CRON_AUTO_ACK = '/api/v1/cron/auto-acknowledge'
const CRON_SCHED_COMP = '/api/v1/cron/apply-scheduled-comp'

const MANAGER_HUB_PERF = '/api/v1/manager-hub/performance'
const MANAGER_HUB_HEALTH = '/api/v1/manager-hub/team-health'
const MANAGER_HUB_DOTTED = '/api/v1/manager-hub/dotted-line-reports'

const TEAMS_CONFIG = '/api/v1/teams/config'
const TEAMS_CHANNELS = '/api/v1/teams/channels'
const TEAMS_DIGEST = '/api/v1/teams/digest'
const TEAMS_RECOGNITION = '/api/v1/teams/recognition'
const TEAMS_WEBHOOK = '/api/v1/teams/webhook'
const TEAMS_BOT = '/api/v1/teams/bot'

const SEARCH_EMPLOYEES = '/api/v1/search/employees'
const SEARCH_COMMAND = '/api/v1/search/command'
const TAX_BRACKETS = '/api/v1/tax-brackets'
const HR_DOCUMENTS = '/api/v1/hr-documents'
const M365_STATUS = '/api/v1/m365/status'

// ─── Uniqueness Helper ──────────────────────────────────

const ts = () => Date.now() % 100000

// ═══════════════════════════════════════════════════════════
// SEED RESOLVERS
// ═══════════════════════════════════════════════════════════

/**
 * Resolve a notification ID from the current user's notifications.
 * Returns the first notification's id, or undefined if empty.
 */
export async function resolveNotificationId(c: ApiClient): Promise<string | undefined> {
  const res = await c.get<Array<{ id: string }>>(NOTIFICATIONS)
  if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
    return res.data[0]?.id
  }
  return undefined
}

/**
 * Resolve a terminal ID from the existing terminals list.
 */
export async function resolveTerminalId(c: ApiClient): Promise<string | undefined> {
  const res = await c.get<Array<{ id: string }>>(TERMINALS)
  if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
    return res.data[0]?.id
  }
  return undefined
}

/**
 * Resolve an HR document ID from the existing documents list.
 */
export async function resolveHrDocumentId(c: ApiClient): Promise<string | undefined> {
  const res = await c.get<Array<{ id: string }>>(HR_DOCUMENTS)
  if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
    return res.data[0]?.id
  }
  return undefined
}

// ═══════════════════════════════════════════════════════════
// BUILDERS
// ═══════════════════════════════════════════════════════════

export function buildPushSubscription() {
  const t = ts()
  return {
    endpoint: `https://push.example.com/sub/${t}`,
    p256dh: `BPkVx_e2e_test_p256dh_key_${t}_xxxxxxxxxxxxxxxxx`,
    auth: `e2e_auth_${t}`,
  }
}

export function buildNotificationPrefs() {
  return {
    preferences: { leave: true, performance: true, attendance: false },
    quietHoursStart: '23:00',
    quietHoursEnd: '07:00',
    timezone: 'Asia/Seoul',
  }
}

export function buildTerminal() {
  const t = ts()
  return {
    terminalCode: `E2E-TERM-${t}`,
    terminalType: 'FINGERPRINT' as const,
    locationName: `E2E 테스트 출입구 ${t}`,
    ipAddress: '192.168.1.100',
  }
}

export function buildTerminalUpdate() {
  return {
    locationName: 'E2E 테스트 출입구 수정됨',
    ipAddress: '192.168.1.200',
  }
}

export function buildClockEvent(employeeNo: string, eventType: 'CLOCK_IN' | 'CLOCK_OUT') {
  return {
    employeeNo,
    eventType,
    timestamp: new Date().toISOString(),
    verificationMethod: 'FINGERPRINT' as const,
  }
}

export function buildTeamsConfig() {
  const t = ts()
  return {
    tenantId: `e2e-tenant-${t}`,
    teamId: `e2e-team-${t}`,
    channelId: `e2e-channel-${t}`,
    webhookUrl: `https://webhook.example.com/${t}`,
    botEnabled: false,
    presenceSync: false,
    digestEnabled: false,
    digestDay: 1,
    digestHour: 9,
  }
}

export function buildTeamsRecognition() {
  return {
    receiverAadId: '00000000-0000-4000-a000-000000000099',
    value: 'TEAMWORK',
    message: 'E2E test recognition message',
  }
}

export function buildTeamsWebhookPayload() {
  return {
    action: 'approve',
    cardType: 'LEAVE_REQUEST',
    referenceId: '00000000-0000-4000-a000-000000000099',
  }
}

export function buildBotActivity(type: 'conversationUpdate' | 'message') {
  return {
    type,
    ...(type === 'message' ? { text: '/help' } : {}),
    from: { id: 'e2e-user', name: 'E2E User' },
    conversation: { id: 'e2e-conv' },
    channelId: 'msteams',
  }
}

export function buildHrDocument() {
  const t = ts()
  return {
    title: `E2E HR Document ${t}`,
    docType: 'POLICY',
    contentText: `This is an E2E test HR document content ${t}. It contains multiple paragraphs for embedding chunk testing.`,
    version: '1.0',
    locale: 'ko',
  }
}

// ═══════════════════════════════════════════════════════════
// CRON HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Execute a cron GET request with x-cron-secret header.
 * Uses raw Playwright request (not ApiClient) for header control.
 */
export async function cronGet(request: APIRequestContext, path: string) {
  const secret = process.env.CRON_SECRET || 'test-cron-secret'
  const res = await request.get(path, {
    headers: { 'x-cron-secret': secret },
  })
  return parseApiResponse(res)
}

/**
 * Execute a cron POST request with x-cron-secret header.
 */
export async function cronPost(request: APIRequestContext, path: string) {
  const secret = process.env.CRON_SECRET || 'test-cron-secret'
  const res = await request.post(path, {
    headers: { 'x-cron-secret': secret },
  })
  return parseApiResponse(res)
}

/**
 * Execute a cron GET request WITHOUT x-cron-secret header.
 * Used to test auth enforcement.
 */
export async function cronGetNoSecret(request: APIRequestContext, path: string) {
  const res = await request.get(path)
  return parseApiResponse(res)
}

/**
 * Execute a cron POST request WITHOUT x-cron-secret header.
 */
export async function cronPostNoSecret(request: APIRequestContext, path: string) {
  const res = await request.post(path)
  return parseApiResponse(res)
}

/**
 * Execute a cron POST request with WRONG x-cron-secret header.
 */
export async function cronPostWrongSecret(request: APIRequestContext, path: string) {
  const res = await request.post(path, {
    headers: { 'x-cron-secret': 'wrong-secret-value' },
  })
  return parseApiResponse(res)
}

/**
 * Execute a cron GET request with WRONG x-cron-secret header.
 */
export async function cronGetWrongSecret(request: APIRequestContext, path: string) {
  const res = await request.get(path, {
    headers: { 'x-cron-secret': 'wrong-secret-value' },
  })
  return parseApiResponse(res)
}

// ═══════════════════════════════════════════════════════════
// CRON PATH EXPORTS
// ═══════════════════════════════════════════════════════════

export const CRON_PATHS = {
  OVERDUE: CRON_OVERDUE,
  EVAL_REMINDER: CRON_EVAL_REMINDER,
  NUDGE: CRON_NUDGE,
  ORG_SNAPSHOT: CRON_ORG_SNAPSHOT,
  LEAVE_PROMO: CRON_LEAVE_PROMO,
  LOA_RETURN: CRON_LOA_RETURN,
  AUTO_ACK: CRON_AUTO_ACK,
  SCHED_COMP: CRON_SCHED_COMP,
} as const

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Notifications
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listNotifications(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(NOTIFICATIONS, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function markRead(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.put(`${NOTIFICATIONS}/${id}/read`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getUnreadCount(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(NOTIF_UNREAD_COUNT)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function markAllRead(c: ApiClient): Promise<ApiResult<any>> {
  return c.put(NOTIF_READ_ALL)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPreferences(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(NOTIF_PREFS)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function putPreferences(c: ApiClient, data: ReturnType<typeof buildNotificationPrefs>): Promise<ApiResult<any>> {
  return c.put(NOTIF_PREFS, data)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Push Subscribe
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function subscribe(c: ApiClient, data: ReturnType<typeof buildPushSubscription>): Promise<ApiResult<any>> {
  return c.post(PUSH_SUBSCRIBE, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function unsubscribe(c: ApiClient, data: { endpoint: string }): Promise<ApiResult<any>> {
  // DELETE with body — use raw request
  return c.post(PUSH_SUBSCRIBE, data) // Note: need special handling for DELETE with body
}

/**
 * DELETE /push/subscribe with body — ApiClient.del() doesn't support body.
 * Use raw Playwright request instead.
 */
export async function unsubscribeRaw(request: APIRequestContext, endpoint: string) {
  const res = await request.delete(PUSH_SUBSCRIBE, {
    data: { endpoint },
  })
  return parseApiResponse(res)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getVapidKey(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(PUSH_VAPID)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Monitoring
// ═══════════════════════════════════════════════════════════

/**
 * GET /monitoring/health — uses raw request since response
 * is NOT wrapped in { data: ... } envelope.
 */
export async function getHealthRaw(request: APIRequestContext) {
  const res = await request.get(MONITORING_HEALTH)
  const body = await res.json().catch(() => ({}))
  return {
    status: res.status(),
    ok: res.ok(),
    body: body as Record<string, unknown>,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMetrics(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(MONITORING_METRICS)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Terminals CRUD
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listTerminals(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(TERMINALS, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTerminal(c: ApiClient, data: ReturnType<typeof buildTerminal>): Promise<ApiResult<any>> {
  return c.post(TERMINALS, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTerminal(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${TERMINALS}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateTerminal(c: ApiClient, id: string, data: Record<string, unknown>): Promise<ApiResult<any>> {
  return c.put(`${TERMINALS}/${id}`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deleteTerminal(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.del(`${TERMINALS}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function regenerateSecret(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.post(`${TERMINALS}/${id}/regenerate-secret`)
}

/**
 * POST /terminals/clock — uses raw Playwright request for terminal header control.
 */
export async function clockEvent(
  request: APIRequestContext,
  terminalId: string,
  terminalSecret: string,
  data: ReturnType<typeof buildClockEvent>,
) {
  const res = await request.post(TERMINAL_CLOCK, {
    headers: {
      'x-terminal-id': terminalId,
      'x-terminal-secret': terminalSecret,
    },
    data,
  })
  return parseApiResponse(res)
}

/**
 * POST /terminals/clock without proper terminal headers.
 */
export async function clockEventNoAuth(request: APIRequestContext, data: ReturnType<typeof buildClockEvent>) {
  const res = await request.post(TERMINAL_CLOCK, { data })
  return parseApiResponse(res)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Manager Hub (NEW endpoints only)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getManagerPerformance(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(MANAGER_HUB_PERF)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTeamHealth(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(MANAGER_HUB_HEALTH)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDottedLineReports(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(MANAGER_HUB_DOTTED)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Teams Integration
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTeamsConfig(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(TEAMS_CONFIG)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function putTeamsConfig(c: ApiClient, data: ReturnType<typeof buildTeamsConfig>): Promise<ApiResult<any>> {
  return c.put(TEAMS_CONFIG, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTeamsChannels(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(TEAMS_CHANNELS)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTeamsDigest(c: ApiClient): Promise<ApiResult<any>> {
  return c.get(TEAMS_DIGEST)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function postTeamsDigest(c: ApiClient): Promise<ApiResult<any>> {
  return c.post(TEAMS_DIGEST)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function postTeamsRecognition(c: ApiClient, data: ReturnType<typeof buildTeamsRecognition>): Promise<ApiResult<any>> {
  return c.post(TEAMS_RECOGNITION, data)
}

/**
 * POST /teams/webhook — uses raw request for signature header.
 */
export async function postWebhookRaw(request: APIRequestContext, data: Record<string, unknown>, signature?: string) {
  const res = await request.post(TEAMS_WEBHOOK, {
    data,
    headers: {
      ...(signature ? { 'x-teams-signature': signature } : {}),
    },
  })
  return parseApiResponse(res)
}

/**
 * POST /teams/bot — uses raw request for authorization header.
 */
export async function postBotRaw(request: APIRequestContext, data: Record<string, unknown>, authHeader?: string) {
  const res = await request.post(TEAMS_BOT, {
    data,
    headers: {
      ...(authHeader ? { authorization: authHeader } : {}),
    },
  })
  return parseApiResponse(res)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Search
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function searchEmployees(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(SEARCH_EMPLOYEES, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function searchCommand(c: ApiClient, params: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(SEARCH_COMMAND, params)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — Tax Brackets
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listTaxBrackets(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(TAX_BRACKETS, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTaxBracket(c: ApiClient, data: Record<string, unknown>): Promise<ApiResult<any>> {
  return c.post(TAX_BRACKETS, data)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — HR Documents
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function listHrDocuments(c: ApiClient, params?: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(HR_DOCUMENTS, params)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createHrDocument(c: ApiClient, data: ReturnType<typeof buildHrDocument>): Promise<ApiResult<any>> {
  return c.post(HR_DOCUMENTS, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getHrDocument(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.get(`${HR_DOCUMENTS}/${id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateHrDocument(c: ApiClient, id: string, data: Record<string, unknown>): Promise<ApiResult<any>> {
  return c.put(`${HR_DOCUMENTS}/${id}`, data)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deleteHrDocument(c: ApiClient, id: string): Promise<ApiResult<any>> {
  return c.del(`${HR_DOCUMENTS}/${id}`)
}

// ═══════════════════════════════════════════════════════════
// WRAPPERS — M365 Status
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getM365Status(c: ApiClient, params: Record<string, string>): Promise<ApiResult<any>> {
  return c.get(M365_STATUS, params)
}
