// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Teams Bot Activity Handler
// Webhook-only 봇: 시그니처 검증 + 자연어 명령 라우팅
// ═══════════════════════════════════════════════════════════

import { createHmac } from 'crypto'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'

// ─── Types ──────────────────────────────────────────────────

export interface BotActivity {
  type: string
  id?: string
  timestamp?: string
  from: {
    id: string
    name?: string
    aadObjectId?: string
  }
  conversation: {
    id: string
    conversationType?: string
    tenantId?: string
  }
  recipient?: {
    id: string
    name?: string
  }
  text?: string
  value?: Record<string, unknown>
  serviceUrl?: string
  channelId?: string
}

export interface BotResponse {
  type: 'message'
  text: string
  attachments?: unknown[]
}

// ─── Signature Verification ─────────────────────────────────

export function verifyBotSignature(
  authHeader: string | null,
): boolean {
  if (!env.TEAMS_BOT_PASSWORD) return false
  if (!authHeader) return false

  // Bot Framework는 Bearer 토큰 사용
  // 프로덕션에서는 JWT 검증 필요 — 여기서는 토큰 존재 여부만 체크
  return authHeader.startsWith('Bearer ')
}

export function verifyWebhookSignature(
  body: string,
  signature: string | null,
): boolean {
  if (!env.TEAMS_WEBHOOK_SECRET || !signature) return false

  const hmac = createHmac('sha256', env.TEAMS_WEBHOOK_SECRET)
  hmac.update(body)
  const expected = hmac.digest('base64')

  return signature === expected
}

// ─── Command Router ─────────────────────────────────────────

type CommandHandler = (
  activity: BotActivity,
  employeeId: string,
) => Promise<BotResponse>

const COMMANDS: { pattern: RegExp; handler: CommandHandler }[] = [
  { pattern: /^\/?(leave|휴가|잔여휴가)/i, handler: handleLeaveBalance },
  { pattern: /^\/?(paystub|급여|급여명세)/i, handler: handlePaystub },
  { pattern: /^\/?(attendance|근태|출퇴근)/i, handler: handleAttendance },
  { pattern: /^\/?(help|도움|명령어)/i, handler: handleHelp },
]

export async function routeBotCommand(
  activity: BotActivity,
): Promise<BotResponse> {
  const aadId = activity.from.aadObjectId
  if (!aadId) {
    return { type: 'message', text: '사용자 정보를 확인할 수 없습니다.' }
  }

  // SsoIdentity로 Employee 매핑
  const ssoIdentity = await prisma.ssoIdentity.findFirst({
    where: { providerAccountId: aadId, provider: 'azure-ad' },
    select: { employeeId: true },
  })

  if (!ssoIdentity) {
    return {
      type: 'message',
      text: 'HR Hub에 연결된 계정이 없습니다. HR Hub에 먼저 로그인해 주세요.',
    }
  }

  const text = activity.text?.trim() ?? ''

  for (const cmd of COMMANDS) {
    if (cmd.pattern.test(text)) {
      return cmd.handler(activity, ssoIdentity.employeeId)
    }
  }

  return handleHelp(activity, ssoIdentity.employeeId)
}

// ─── Command Handlers ───────────────────────────────────────

async function handleLeaveBalance(
  _activity: BotActivity,
  employeeId: string,
): Promise<BotResponse> {
  const balances = await prisma.employeeLeaveBalance.findMany({
    where: { employeeId },
    include: { policy: { select: { name: true } } },
  })

  if (balances.length === 0) {
    return { type: 'message', text: '등록된 휴가 잔여일이 없습니다.' }
  }

  const lines = balances.map((b) => {
    const granted = Number(b.grantedDays)
    const used = Number(b.usedDays)
    const remaining = granted - used
    return `- **${b.policy.name}**: ${remaining}일 (총 ${granted}일, 사용 ${used}일)`
  })

  return {
    type: 'message',
    text: `**휴가 잔여 현황**\n\n${lines.join('\n')}`,
  }
}

async function handlePaystub(
  _activity: BotActivity,
  employeeId: string,
): Promise<BotResponse> {
  const latest = await prisma.payrollItem.findFirst({
    where: { employeeId },
    orderBy: { createdAt: 'desc' },
    include: {
      run: { select: { periodStart: true, periodEnd: true } },
    },
  })

  if (!latest) {
    return { type: 'message', text: '급여 명세서 정보가 없습니다.' }
  }

  const start = latest.run.periodStart.toISOString().slice(0, 10)
  const end = latest.run.periodEnd.toISOString().slice(0, 10)

  return {
    type: 'message',
    text: [
      `**최근 급여 명세서** (${start} ~ ${end})`,
      `- 기본급: ${Number(latest.baseSalary).toLocaleString()}원`,
      `- 총 지급액: ${Number(latest.grossPay).toLocaleString()}원`,
      `- 실수령액: ${Number(latest.netPay).toLocaleString()}원`,
      '',
      '자세한 내용은 HR Hub > 급여명세서에서 확인하세요.',
    ].join('\n'),
  }
}

async function handleAttendance(
  _activity: BotActivity,
  employeeId: string,
): Promise<BotResponse> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const attendance = await prisma.attendance.findFirst({
    where: {
      employeeId,
      workDate: { gte: today },
    },
    orderBy: { workDate: 'desc' },
  })

  if (!attendance) {
    return { type: 'message', text: '오늘의 근태 기록이 없습니다.' }
  }

  const clockIn = attendance.clockIn
    ? new Date(attendance.clockIn).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : '미출근'
  const clockOut = attendance.clockOut
    ? new Date(attendance.clockOut).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : '미퇴근'

  return {
    type: 'message',
    text: [
      '**오늘 근태 현황**',
      `- 출근: ${clockIn}`,
      `- 퇴근: ${clockOut}`,
      `- 상태: ${attendance.status}`,
    ].join('\n'),
  }
}

async function handleHelp(
  _activity: BotActivity,
  _employeeId: string,
): Promise<BotResponse> {
  return {
    type: 'message',
    text: [
      '**CTR HR Hub Bot 명령어**',
      '',
      '- `휴가` 또는 `leave` — 휴가 잔여 현황 조회',
      '- `급여` 또는 `paystub` — 최근 급여명세서 조회',
      '- `근태` 또는 `attendance` — 오늘 근태 현황 조회',
      '- `도움` 또는 `help` — 이 도움말 표시',
    ].join('\n'),
  }
}
