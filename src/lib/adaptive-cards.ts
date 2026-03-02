// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Adaptive Card JSON Builders (7종)
// Teams Adaptive Card 템플릿을 JSON으로 생성
// ═══════════════════════════════════════════════════════════

import { env } from '@/lib/env'

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

export function buildLeaveApprovalCard(data: {
  requestId: string
  employeeName: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason?: string
}) {
  return wrapCard(
    [
      headerBlock('휴가 승인 요청', `${data.employeeName}님의 휴가 신청`),
      factSet([
        { title: '신청자', value: data.employeeName },
        { title: '유형', value: data.leaveType },
        { title: '기간', value: `${data.startDate} ~ ${data.endDate}` },
        { title: '일수', value: `${data.days}일` },
        ...(data.reason ? [{ title: '사유', value: data.reason }] : []),
      ]),
    ],
    [
      {
        type: 'Action.Submit',
        title: '승인',
        style: 'positive',
        data: {
          action: 'approve',
          cardType: 'LEAVE_APPROVAL',
          referenceId: data.requestId,
        },
      },
      {
        type: 'Action.Submit',
        title: '반려',
        style: 'destructive',
        data: {
          action: 'reject',
          cardType: 'LEAVE_APPROVAL',
          referenceId: data.requestId,
        },
      },
      {
        type: 'Action.OpenUrl',
        title: 'HR Hub에서 보기',
        url: `${APP_URL}/leave/admin`,
      },
    ],
  )
}

// ─── 2. 평가 기한 알림 카드 ──────────────────────────────────

export function buildPerfEvalReminderCard(data: {
  cycleName: string
  dueDate: string
  pendingCount: number
  evaluatorName: string
}) {
  return wrapCard(
    [
      headerBlock('평가 기한 알림', `${data.cycleName}`),
      factSet([
        { title: '평가자', value: data.evaluatorName },
        { title: '미완료', value: `${data.pendingCount}건` },
        { title: '마감일', value: data.dueDate },
      ]),
      {
        type: 'TextBlock',
        text: '마감일까지 평가를 완료해 주세요.',
        wrap: true,
        color: 'Warning',
      },
    ],
    [
      {
        type: 'Action.OpenUrl',
        title: 'HR Hub에서 열기',
        url: `${APP_URL}/performance/results`,
      },
    ],
  )
}

// ─── 3. 이탈 위험 경고 카드 ──────────────────────────────────

export function buildAttritionRiskCard(data: {
  employeeName: string
  department: string
  riskScore: number
  riskFactors: string[]
  employeeId: string
}) {
  return wrapCard(
    [
      headerBlock('이탈 위험 경고', `${data.employeeName} (${data.department})`),
      factSet([
        { title: '위험 점수', value: `${data.riskScore}/100` },
        { title: '부서', value: data.department },
      ]),
      {
        type: 'TextBlock',
        text: `주요 요인: ${data.riskFactors.join(', ')}`,
        wrap: true,
        size: 'Small',
      },
    ],
    [
      {
        type: 'Action.OpenUrl',
        title: '상세 보기',
        url: `${APP_URL}/analytics/attrition`,
      },
    ],
  )
}

// ─── 4. 온보딩 태스크 기한 카드 ──────────────────────────────

export function buildOnboardingTaskCard(data: {
  taskId: string
  taskTitle: string
  employeeName: string
  dueDate: string
  assignee: string
}) {
  return wrapCard(
    [
      headerBlock('온보딩 태스크 마감 임박', data.taskTitle),
      factSet([
        { title: '신규입사자', value: data.employeeName },
        { title: '담당자', value: data.assignee },
        { title: '마감일', value: data.dueDate },
      ]),
    ],
    [
      {
        type: 'Action.Submit',
        title: '완료하기',
        style: 'positive',
        data: {
          action: 'complete',
          cardType: 'ONBOARDING_TASK_DUE',
          referenceId: data.taskId,
        },
      },
      {
        type: 'Action.OpenUrl',
        title: 'HR Hub에서 보기',
        url: `${APP_URL}/onboarding`,
      },
    ],
  )
}

// ─── 5. 챗봇 에스컬레이션 카드 ──────────────────────────────

export function buildChatbotEscalationCard(data: {
  sessionId: string
  employeeName: string
  question: string
  escalatedAt: string
}) {
  return wrapCard(
    [
      headerBlock('챗봇 에스컬레이션', `${data.employeeName}님 문의`),
      {
        type: 'TextBlock',
        text: data.question,
        wrap: true,
        maxLines: 3,
      },
      factSet([
        { title: '직원', value: data.employeeName },
        { title: '에스컬레이션', value: data.escalatedAt },
      ]),
    ],
    [
      {
        type: 'Action.Submit',
        title: '담당자 배정',
        style: 'positive',
        data: {
          action: 'assign',
          cardType: 'CHATBOT_ESCALATION',
          referenceId: data.sessionId,
        },
      },
      {
        type: 'Action.OpenUrl',
        title: 'HR Hub에서 보기',
        url: `${APP_URL}/hr-chat/sessions/${data.sessionId}`,
      },
    ],
  )
}

// ─── 6. 주간 다이제스트 카드 ────────────────────────────────

export function buildWeeklyDigestCard(data: {
  weekRange: string
  newHires: number
  onLeave: number
  pendingEvals: number
  attritionRisks: number
  pendingApprovals: number
}) {
  return wrapCard(
    [
      headerBlock('주간 HR 다이제스트', data.weekRange),
      {
        type: 'ColumnSet',
        columns: [
          {
            type: 'Column',
            width: 'stretch',
            items: [
              { type: 'TextBlock', text: '신규입사', size: 'Small', color: 'Accent' },
              { type: 'TextBlock', text: `${data.newHires}명`, weight: 'Bolder', size: 'ExtraLarge' },
            ],
          },
          {
            type: 'Column',
            width: 'stretch',
            items: [
              { type: 'TextBlock', text: '휴가중', size: 'Small', color: 'Accent' },
              { type: 'TextBlock', text: `${data.onLeave}명`, weight: 'Bolder', size: 'ExtraLarge' },
            ],
          },
          {
            type: 'Column',
            width: 'stretch',
            items: [
              { type: 'TextBlock', text: '평가 대기', size: 'Small', color: 'Warning' },
              { type: 'TextBlock', text: `${data.pendingEvals}건`, weight: 'Bolder', size: 'ExtraLarge' },
            ],
          },
        ],
      },
      factSet([
        { title: '이탈 위험', value: `${data.attritionRisks}명` },
        { title: '승인 대기', value: `${data.pendingApprovals}건` },
      ]),
    ],
    [
      {
        type: 'Action.OpenUrl',
        title: '대시보드 열기',
        url: `${APP_URL}/analytics`,
      },
    ],
  )
}

// ─── 7. 칭찬/인정 카드 ──────────────────────────────────────

export function buildRecognitionCard(data: {
  senderName: string
  receiverName: string
  value: string
  message: string
}) {
  return wrapCard(
    [
      headerBlock('동료 칭찬', `${data.senderName} → ${data.receiverName}`),
      {
        type: 'TextBlock',
        text: `"${data.message}"`,
        wrap: true,
        style: 'default',
      },
      factSet([
        { title: '핵심가치', value: data.value },
        { title: '보낸 사람', value: data.senderName },
        { title: '받는 사람', value: data.receiverName },
      ]),
    ],
  )
}
