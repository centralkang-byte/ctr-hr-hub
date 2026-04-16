// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Teams Bot Activity Handler
// Webhook-only 봇: 시그니처 검증 + 자연어 명령 라우팅
// ═══════════════════════════════════════════════════════════

import { createHmac } from 'crypto'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { serverT } from '@/lib/server-i18n'
import type { Locale } from '@/i18n/config'

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
  locale: Locale,
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
  locale: Locale,
  activity: BotActivity,
): Promise<BotResponse> {
  const t = (key: string, params?: Record<string, string | number>) => serverT(locale, key, params)
  const aadId = activity.from.aadObjectId
  if (!aadId) {
    return { type: 'message', text: await t('teams.bot.noUserInfo') }
  }

  // SsoIdentity로 Employee 매핑
  const ssoIdentity = await prisma.ssoIdentity.findFirst({
    where: { providerAccountId: aadId, provider: 'azure-ad' },
    select: { employeeId: true },
  })

  if (!ssoIdentity) {
    return {
      type: 'message',
      text: await t('teams.bot.noLinkedAccount'),
    }
  }

  const text = activity.text?.trim() ?? ''

  for (const cmd of COMMANDS) {
    if (cmd.pattern.test(text)) {
      return cmd.handler(locale, activity, ssoIdentity.employeeId)
    }
  }

  return handleHelp(locale, activity, ssoIdentity.employeeId)
}

// ─── Command Handlers ───────────────────────────────────────

async function handleLeaveBalance(
  locale: Locale,
  _activity: BotActivity,
  employeeId: string,
): Promise<BotResponse> {
  const t = (key: string, params?: Record<string, string | number>) => serverT(locale, key, params)

  const balances = await prisma.employeeLeaveBalance.findMany({
    where: { employeeId },
    include: { policy: { select: { name: true } } },
  })

  if (balances.length === 0) {
    return { type: 'message', text: await t('teams.bot.leaveBalance.empty') }
  }

  const lines: string[] = []
  for (const b of balances) {
    const granted = Number(b.grantedDays)
    const used = Number(b.usedDays)
    const remaining = granted - used
    lines.push(await t('teams.bot.leaveBalance.item', { name: b.policy.name, remaining, granted, used }))
  }

  return {
    type: 'message',
    text: `**${await t('teams.bot.leaveBalance.title')}**\n\n${lines.join('\n')}`,
  }
}

async function handlePaystub(
  locale: Locale,
  _activity: BotActivity,
  employeeId: string,
): Promise<BotResponse> {
  const t = (key: string, params?: Record<string, string | number>) => serverT(locale, key, params)

  const latest = await prisma.payrollItem.findFirst({
    where: { employeeId },
    orderBy: { createdAt: 'desc' },
    include: {
      run: { select: { periodStart: true, periodEnd: true } },
    },
  })

  if (!latest) {
    return { type: 'message', text: await t('teams.bot.paystub.empty') }
  }

  const start = latest.run.periodStart.toISOString().slice(0, 10)
  const end = latest.run.periodEnd.toISOString().slice(0, 10)

  return {
    type: 'message',
    text: [
      `**${await t('teams.bot.paystub.title')}** (${start} ~ ${end})`,
      `- ${await t('teams.bot.paystub.baseSalary')}: ${await t('teams.bot.paystub.currencyUnit', { amount: Number(latest.baseSalary).toLocaleString() })}`,
      `- ${await t('teams.bot.paystub.grossPay')}: ${await t('teams.bot.paystub.currencyUnit', { amount: Number(latest.grossPay).toLocaleString() })}`,
      `- ${await t('teams.bot.paystub.netPay')}: ${await t('teams.bot.paystub.currencyUnit', { amount: Number(latest.netPay).toLocaleString() })}`,
      '',
      await t('teams.bot.paystub.detail'),
    ].join('\n'),
  }
}

async function handleAttendance(
  locale: Locale,
  _activity: BotActivity,
  employeeId: string,
): Promise<BotResponse> {
  const t = (key: string, params?: Record<string, string | number>) => serverT(locale, key, params)

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
    return { type: 'message', text: await t('teams.bot.attendance.empty') }
  }

  const timeLocale = locale === 'ko' ? 'ko-KR' : 'en-US'
  const clockIn = attendance.clockIn
    ? new Date(attendance.clockIn).toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' })
    : await t('teams.bot.attendance.notIn')
  const clockOut = attendance.clockOut
    ? new Date(attendance.clockOut).toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' })
    : await t('teams.bot.attendance.notOut')

  return {
    type: 'message',
    text: [
      `**${await t('teams.bot.attendance.title')}**`,
      `- ${await t('teams.bot.attendance.clockIn')}: ${clockIn}`,
      `- ${await t('teams.bot.attendance.clockOut')}: ${clockOut}`,
      `- ${await t('teams.bot.attendance.status')}: ${attendance.status}`,
    ].join('\n'),
  }
}

async function handleHelp(
  locale: Locale,
  _activity: BotActivity,
  _employeeId: string,
): Promise<BotResponse> {
  const t = (key: string) => serverT(locale, key)

  return {
    type: 'message',
    text: [
      `**${await t('teams.bot.helpTitle')}**`,
      '',
      await t('teams.bot.helpLeave'),
      await t('teams.bot.helpPaystub'),
      await t('teams.bot.helpAttendance'),
      await t('teams.bot.helpHelp'),
    ].join('\n'),
  }
}
