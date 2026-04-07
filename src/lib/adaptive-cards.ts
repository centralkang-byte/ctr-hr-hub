// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Adaptive Card JSON Builders (7종)
// Teams Adaptive Card 템플릿을 JSON으로 생성
// ═══════════════════════════════════════════════════════════

import { env } from '@/lib/env'
import { serverT } from '@/lib/server-i18n'
import type { Locale } from '@/i18n/config'

const APP_URL = env.NEXTAUTH_URL || 'https://hr.ctr.co.kr'

interface CardAction {
  type: 'Action.Submit' | 'Action.OpenUrl'
  title: string
  url?: string
  data?: Record<string, unknown>
  style?: 'positive' | 'destructive' | 'default'
}

function wrapCard(body: unknown[], actions: CardAction[] = []) {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body,
    actions,
  }
}

function headerBlock(title: string, subtitle?: string) {
  const items: unknown[] = [
    {
      type: 'TextBlock',
      text: title,
      weight: 'Bolder',
      size: 'Medium',
      wrap: true,
    },
  ]
  if (subtitle) {
    items.push({
      type: 'TextBlock',
      text: subtitle,
      size: 'Small',
      color: 'Accent',
      spacing: 'None',
    })
  }
  return { type: 'Container', items }
}

function factSet(facts: { title: string; value: string }[]) {
  return { type: 'FactSet', facts }
}

// ─── 1. 휴가 승인 카드 ──────────────────────────────────────

export async function buildLeaveApprovalCard(locale: Locale, data: {
  requestId: string
  employeeName: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason?: string
}) {
  const t = (key: string, params?: Record<string, string | number>) => serverT(locale, key, params)

  return wrapCard(
    [
      headerBlock(
        await t('teams.leaveApproval.title'),
        await t('teams.leaveApproval.subtitle', { name: data.employeeName }),
      ),
      factSet([
        { title: await t('teams.leaveApproval.applicant'), value: data.employeeName },
        { title: await t('teams.leaveApproval.type'), value: data.leaveType },
        { title: await t('teams.leaveApproval.period'), value: `${data.startDate} ~ ${data.endDate}` },
        { title: await t('teams.leaveApproval.days'), value: await t('teams.leaveApproval.daysUnit', { count: data.days }) },
        ...(data.reason ? [{ title: await t('teams.leaveApproval.reason'), value: data.reason }] : []),
      ]),
    ],
    [
      {
        type: 'Action.Submit',
        title: await t('teams.leaveApproval.approve'),
        style: 'positive',
        data: {
          action: 'approve',
          cardType: 'LEAVE_APPROVAL',
          referenceId: data.requestId,
        },
      },
      {
        type: 'Action.Submit',
        title: await t('teams.leaveApproval.reject'),
        style: 'destructive',
        data: {
          action: 'reject',
          cardType: 'LEAVE_APPROVAL',
          referenceId: data.requestId,
        },
      },
      {
        type: 'Action.OpenUrl',
        title: await t('teams.leaveApproval.viewInHub'),
        url: `${APP_URL}/leave/admin`,
      },
    ],
  )
}

// ─── 2. 평가 기한 알림 카드 ──────────────────────────────────

export async function buildPerfEvalReminderCard(locale: Locale, data: {
  cycleName: string
  dueDate: string
  pendingCount: number
  evaluatorName: string
}) {
  const t = (key: string, params?: Record<string, string | number>) => serverT(locale, key, params)

  return wrapCard(
    [
      headerBlock(await t('teams.evalReminder.title'), data.cycleName),
      factSet([
        { title: await t('teams.evalReminder.evaluator'), value: data.evaluatorName },
        { title: await t('teams.evalReminder.pending'), value: await t('teams.evalReminder.pendingUnit', { count: data.pendingCount }) },
        { title: await t('teams.evalReminder.deadline'), value: data.dueDate },
      ]),
      {
        type: 'TextBlock',
        text: await t('teams.evalReminder.deadlineWarning'),
        wrap: true,
        color: 'Warning',
      },
    ],
    [
      {
        type: 'Action.OpenUrl',
        title: await t('teams.evalReminder.openInHub'),
        url: `${APP_URL}/performance/results`,
      },
    ],
  )
}

// ─── 3. 이탈 위험 경고 카드 ──────────────────────────────────

export async function buildAttritionRiskCard(locale: Locale, data: {
  employeeName: string
  department: string
  riskScore: number
  riskFactors: string[]
  employeeId: string
}) {
  const t = (key: string, params?: Record<string, string | number>) => serverT(locale, key, params)

  return wrapCard(
    [
      headerBlock(await t('teams.attritionRisk.title'), `${data.employeeName} (${data.department})`),
      factSet([
        { title: await t('teams.attritionRisk.riskScore'), value: `${data.riskScore}/100` },
        { title: await t('teams.attritionRisk.department'), value: data.department },
      ]),
      {
        type: 'TextBlock',
        text: await t('teams.attritionRisk.factors', { factors: data.riskFactors.join(', ') }),
        wrap: true,
        size: 'Small',
      },
    ],
    [
      {
        type: 'Action.OpenUrl',
        title: await t('teams.attritionRisk.viewDetail'),
        url: `${APP_URL}/analytics/attrition`,
      },
    ],
  )
}

// ─── 4. 온보딩 태스크 기한 카드 ──────────────────────────────

export async function buildOnboardingTaskCard(locale: Locale, data: {
  taskId: string
  taskTitle: string
  employeeName: string
  dueDate: string
  assignee: string
}) {
  const t = (key: string, params?: Record<string, string | number>) => serverT(locale, key, params)

  return wrapCard(
    [
      headerBlock(await t('teams.onboarding.title'), data.taskTitle),
      factSet([
        { title: await t('teams.onboarding.newHire'), value: data.employeeName },
        { title: await t('teams.onboarding.assignee'), value: data.assignee },
        { title: await t('teams.onboarding.deadline'), value: data.dueDate },
      ]),
    ],
    [
      {
        type: 'Action.Submit',
        title: await t('teams.onboarding.complete'),
        style: 'positive',
        data: {
          action: 'complete',
          cardType: 'ONBOARDING_TASK_DUE',
          referenceId: data.taskId,
        },
      },
      {
        type: 'Action.OpenUrl',
        title: await t('teams.onboarding.viewInHub'),
        url: `${APP_URL}/onboarding`,
      },
    ],
  )
}

// ─── 5. 챗봇 에스컬레이션 카드 ──────────────────────────────

export async function buildChatbotEscalationCard(locale: Locale, data: {
  sessionId: string
  employeeName: string
  question: string
  escalatedAt: string
}) {
  const t = (key: string, params?: Record<string, string | number>) => serverT(locale, key, params)

  return wrapCard(
    [
      headerBlock(
        await t('teams.chatbotEscalation.title'),
        await t('teams.chatbotEscalation.subtitle', { name: data.employeeName }),
      ),
      {
        type: 'TextBlock',
        text: data.question,
        wrap: true,
        maxLines: 3,
      },
      factSet([
        { title: await t('teams.chatbotEscalation.employee'), value: data.employeeName },
        { title: await t('teams.chatbotEscalation.escalation'), value: data.escalatedAt },
      ]),
    ],
    [
      {
        type: 'Action.Submit',
        title: await t('teams.chatbotEscalation.assign'),
        style: 'positive',
        data: {
          action: 'assign',
          cardType: 'CHATBOT_ESCALATION',
          referenceId: data.sessionId,
        },
      },
      {
        type: 'Action.OpenUrl',
        title: await t('teams.chatbotEscalation.viewInHub'),
        url: `${APP_URL}/hr-chat/sessions/${data.sessionId}`,
      },
    ],
  )
}

// ─── 6. 주간 다이제스트 카드 ────────────────────────────────

export async function buildWeeklyDigestCard(locale: Locale, data: {
  weekRange: string
  newHires: number
  onLeave: number
  pendingEvals: number
  attritionRisks: number
  pendingApprovals: number
}) {
  const t = (key: string, params?: Record<string, string | number>) => serverT(locale, key, params)

  return wrapCard(
    [
      headerBlock(await t('teams.digest.title'), data.weekRange),
      {
        type: 'ColumnSet',
        columns: [
          {
            type: 'Column',
            width: 'stretch',
            items: [
              { type: 'TextBlock', text: await t('teams.digest.newHires'), size: 'Small', color: 'Accent' },
              { type: 'TextBlock', text: await t('teams.digest.countPeople', { count: data.newHires }), weight: 'Bolder', size: 'ExtraLarge' },
            ],
          },
          {
            type: 'Column',
            width: 'stretch',
            items: [
              { type: 'TextBlock', text: await t('teams.digest.onLeave'), size: 'Small', color: 'Accent' },
              { type: 'TextBlock', text: await t('teams.digest.countPeople', { count: data.onLeave }), weight: 'Bolder', size: 'ExtraLarge' },
            ],
          },
          {
            type: 'Column',
            width: 'stretch',
            items: [
              { type: 'TextBlock', text: await t('teams.digest.pendingEvals'), size: 'Small', color: 'Warning' },
              { type: 'TextBlock', text: await t('teams.digest.countItems', { count: data.pendingEvals }), weight: 'Bolder', size: 'ExtraLarge' },
            ],
          },
        ],
      },
      factSet([
        { title: await t('teams.digest.attritionRisk'), value: await t('teams.digest.countPeople', { count: data.attritionRisks }) },
        { title: await t('teams.digest.pendingApprovals'), value: await t('teams.digest.countItems', { count: data.pendingApprovals }) },
      ]),
    ],
    [
      {
        type: 'Action.OpenUrl',
        title: await t('teams.digest.openDashboard'),
        url: `${APP_URL}/analytics`,
      },
    ],
  )
}

// ─── 7. 칭찬/인정 카드 ──────────────────────────────────────

export async function buildRecognitionCard(locale: Locale, data: {
  senderName: string
  receiverName: string
  value: string
  message: string
}) {
  const t = (key: string, params?: Record<string, string | number>) => serverT(locale, key, params)

  return wrapCard(
    [
      headerBlock(await t('teams.recognition.title'), `${data.senderName} → ${data.receiverName}`),
      {
        type: 'TextBlock',
        text: `"${data.message}"`,
        wrap: true,
        style: 'default',
      },
      factSet([
        { title: await t('teams.recognition.coreValue'), value: data.value },
        { title: await t('teams.recognition.sender'), value: data.senderName },
        { title: await t('teams.recognition.receiver'), value: data.receiverName },
      ]),
    ],
  )
}
