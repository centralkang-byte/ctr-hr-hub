# B11: 알림 시스템 강화 + i18n 보완 + Teams 연동 완성 — 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 기존 알림 인프라를 강화하고(priority/metadata/debounce), 실제 비즈니스 이벤트 4+3개를 알림에 연결하며, 사용자별 알림 설정 UI와 Teams webhook 다중 채널을 추가한다.

**Architecture:** 기존 `Notification` 모델에 `priority`/`metadata`/`channels[]` 필드를 추가(additive migration)하고, `NotificationPreference`/`TeamsWebhookConfig` 2개 모델을 신규 생성한다. 기존 `notifications.ts` 디스패처를 5분 debounce + quiet hours + 사용자 설정 기반으로 강화한다. Supabase 패키지 미설치 확인 → 실시간 알림은 10초 폴링으로 구현한다.

**Tech Stack:** Next.js App Router, Prisma ORM, Tailwind CSS, lucide-react, next-intl

---

## 사전 확인 (시작 전 체크)

```bash
cd /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub
npx tsc --noEmit 2>&1 | tail -5   # 0 errors 확인
```

---

## Task 1: Prisma 스키마 확장

**Files:**
- Modify: `prisma/schema.prisma` (라인 2681 근처 `model Notification`)

### Step 1: Notification 모델에 3개 필드 추가

`model Notification` 블록에서 `channel` 필드 아래에 추가:

```prisma
model Notification {
  id          String              @id @default(uuid())
  employeeId  String              @map("employee_id")
  triggerType String              @map("trigger_type")
  title       String
  body        String
  channel     NotificationChannel
  isRead      Boolean             @default(false) @map("is_read")
  readAt      DateTime?           @map("read_at")
  link        String?
  createdAt   DateTime            @default(now()) @map("created_at")

  // B11 추가
  priority    String              @default("normal") @db.VarChar(10)
  metadata    Json?
  channels    String[]            @default([])

  employee  Employee             @relation(fields: [employeeId], references: [id])
  trigger   NotificationTrigger? @relation(fields: [triggerId], references: [id])
  triggerId String?              @map("trigger_id")

  teamsCardActions TeamsCardAction[]

  @@index([employeeId, isRead])
  @@map("notifications")
}
```

### Step 2: NotificationPreference 모델 추가

`model Notification` 블록 바로 아래에 추가:

```prisma
model NotificationPreference {
  id              String   @id @default(uuid())
  employeeId      String   @unique @map("employee_id")
  preferences     Json     @default("{}")
  quietHoursStart String?  @map("quiet_hours_start") @db.VarChar(5)
  quietHoursEnd   String?  @map("quiet_hours_end") @db.VarChar(5)
  timezone        String   @default("Asia/Seoul") @db.VarChar(50)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  employee Employee @relation(fields: [employeeId], references: [id])

  @@map("notification_preferences")
}
```

### Step 3: TeamsWebhookConfig 모델 추가

`model NotificationPreference` 바로 아래에 추가:

```prisma
model TeamsWebhookConfig {
  id          String   @id @default(uuid())
  companyId   String   @map("company_id")
  channelName String   @map("channel_name") @db.VarChar(100)
  webhookUrl  String   @map("webhook_url") @db.VarChar(500)
  eventTypes  String[] @default([]) @map("event_types")
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  company Company @relation(fields: [companyId], references: [id])

  @@map("teams_webhook_configs")
}
```

### Step 4: Company 모델에 역참조 추가

`model Company` 블록에서 기존 relation 목록에 추가:

```prisma
  teamsWebhookConfigs TeamsWebhookConfig[]
```

### Step 5: Employee 모델에 역참조 추가

`model Employee` 블록에서 기존 `notifications` 관계 아래에 추가:

```prisma
  notificationPreference NotificationPreference?
```

### Step 6: 마이그레이션 실행

```bash
npx prisma migrate dev --name notification_system
```

Expected: "Your database is now in sync with your schema" 메시지

### Step 7: 타입 오류 확인

```bash
npx tsc --noEmit 2>&1 | tail -10
```

Expected: 0 errors (신규 필드는 optional이므로 기존 코드 영향 없음)

### Step 8: 커밋

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(b11): notification_system 마이그레이션 (priority/metadata/channels + NotificationPreference + TeamsWebhookConfig)"
```

---

## Task 2: 알림 디스패처 강화

**Files:**
- Modify: `src/lib/notifications.ts`

현재 파일을 아래 내용으로 **완전히 교체**한다.

### Step 1: notifications.ts 전면 교체

```typescript
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Notification Dispatcher (B11 강화)
// debounce(5분) + quiet hours + per-user prefs + 3채널
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { sendTeamsMessage } from '@/lib/microsoft-graph'
import { sendEmail } from '@/lib/email'
import { subMinutes } from 'date-fns'

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface SendNotificationInput {
  employeeId: string
  triggerType: string
  title: string
  body: string
  link?: string
  priority?: NotificationPriority
  metadata?: Record<string, unknown>
  adaptiveCard?: Record<string, unknown>
  companyId?: string
}

// ─── Public API ───────────────────────────────────────────

/**
 * 알림을 fire-and-forget으로 발송합니다.
 */
export function sendNotification(input: SendNotificationInput): void {
  dispatchNotification(input).catch(() => {
    // fire-and-forget: 알림 실패가 비즈니스 로직에 영향 없어야 함
  })
}

/**
 * 여러 직원에게 동시에 알림 발송
 */
export function sendNotifications(inputs: SendNotificationInput[]): void {
  for (const input of inputs) {
    sendNotification(input)
  }
}

// ─── Core Dispatcher ─────────────────────────────────────

async function dispatchNotification(input: SendNotificationInput): Promise<void> {
  const priority = input.priority ?? 'normal'

  // 1. 5분 debounce: 동일 type + employee, 5분 이내 중복 방지
  const recent = await prisma.notification.findFirst({
    where: {
      employeeId: input.employeeId,
      triggerType: input.triggerType,
      createdAt: { gte: subMinutes(new Date(), 5) },
    },
    select: { id: true },
  })
  if (recent) return

  // 2. 사용자 알림 설정 조회
  const prefs = await prisma.notificationPreference.findUnique({
    where: { employeeId: input.employeeId },
  })

  // 3. quiet hours 체크 (urgent는 예외)
  if (priority !== 'urgent' && prefs && isQuietHours(prefs)) {
    // Quiet hours 중이면 인앱만 (조용히 기록)
    await createInAppRecord(input, priority)
    return
  }

  // 4. 이벤트별 사용자 채널 설정 조회
  const eventPrefs = prefs
    ? ((prefs.preferences as Record<string, Record<string, boolean>>)[input.triggerType] ?? null)
    : null

  const inAppEnabled = eventPrefs?.in_app !== false   // default: true
  const emailEnabled = eventPrefs?.email === true     // default: false
  const teamsEnabled = eventPrefs?.teams === true     // default: false

  // 5. Trigger 설정 조회 (전역 채널 설정)
  const trigger = await prisma.notificationTrigger.findFirst({
    where: { eventType: input.triggerType, isActive: true },
    select: { channels: true },
  })
  const globalChannels: string[] = (trigger?.channels as string[]) ?? ['IN_APP']

  const sentChannels: string[] = []
  const promises: Promise<void>[] = []

  // 6. IN_APP
  if (inAppEnabled || globalChannels.includes('IN_APP')) {
    promises.push(
      createInAppRecord(input, priority).then(() => { sentChannels.push('IN_APP') })
    )
  }

  // 7. EMAIL
  if (emailEnabled || globalChannels.includes('EMAIL')) {
    promises.push(sendEmailNotification(input).then(() => { sentChannels.push('EMAIL') }))
  }

  // 8. TEAMS (per-user 설정 또는 TeamsWebhookConfig)
  if (teamsEnabled || globalChannels.includes('TEAMS')) {
    promises.push(sendTeamsNotification(input, priority).then(() => { sentChannels.push('TEAMS') }))
  }

  await Promise.allSettled(promises)
}

// ─── Quiet Hours ──────────────────────────────────────────

function isQuietHours(prefs: { quietHoursStart?: string | null; quietHoursEnd?: string | null; timezone?: string }): boolean {
  if (!prefs.quietHoursStart || !prefs.quietHoursEnd) return false

  const now = new Date()
  const tz = prefs.timezone ?? 'Asia/Seoul'

  const timeStr = now.toLocaleTimeString('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) // "22:30"

  const [nowH, nowM] = timeStr.split(':').map(Number)
  const [startH, startM] = prefs.quietHoursStart.split(':').map(Number)
  const [endH, endM] = prefs.quietHoursEnd.split(':').map(Number)

  const nowTotal = nowH * 60 + nowM
  const startTotal = startH * 60 + startM
  const endTotal = endH * 60 + endM

  if (startTotal <= endTotal) {
    // e.g. 09:00 ~ 18:00
    return nowTotal >= startTotal && nowTotal < endTotal
  } else {
    // e.g. 22:00 ~ 08:00 (자정 걸침)
    return nowTotal >= startTotal || nowTotal < endTotal
  }
}

// ─── IN_APP ───────────────────────────────────────────────

async function createInAppRecord(
  input: SendNotificationInput,
  priority: NotificationPriority,
): Promise<void> {
  await prisma.notification.create({
    data: {
      employeeId: input.employeeId,
      triggerType: input.triggerType,
      title: input.title,
      body: input.body,
      channel: 'IN_APP',
      link: input.link ?? null,
      priority,
      metadata: input.metadata ?? undefined,
      channels: ['IN_APP'],
    },
  })
}

// ─── EMAIL ────────────────────────────────────────────────

async function sendEmailNotification(input: SendNotificationInput): Promise<void> {
  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    select: { email: true },
  })

  if (!employee?.email) return

  await sendEmail({
    to: employee.email,
    subject: input.title,
    htmlBody: `<p>${input.body}</p>${input.link ? `<p><a href="${input.link}">자세히 보기</a></p>` : ''}`,
  })
}

// ─── TEAMS ────────────────────────────────────────────────

async function sendTeamsNotification(
  input: SendNotificationInput,
  priority: NotificationPriority,
): Promise<void> {
  const promises: Promise<void>[] = []

  // 방법 1: 직접 DM (기존 SsoIdentity 기반)
  const ssoIdentity = await prisma.ssoIdentity.findFirst({
    where: { employeeId: input.employeeId, provider: 'azure-ad' },
    select: { providerAccountId: true },
  })

  if (ssoIdentity) {
    const card = buildSimpleAdaptiveCard(input, priority)
    promises.push(
      sendTeamsMessage(ssoIdentity.providerAccountId, `**${input.title}**\n\n${input.body}`, card)
        .then(() => undefined)
    )
  }

  // 방법 2: Webhook 채널 (TeamsWebhookConfig 기반)
  if (input.companyId) {
    const webhooks = await prisma.teamsWebhookConfig.findMany({
      where: {
        companyId: input.companyId,
        isActive: true,
        eventTypes: { has: input.triggerType },
      },
    })

    for (const webhook of webhooks) {
      promises.push(postToWebhook(webhook.webhookUrl, input, priority))
    }
  }

  await Promise.allSettled(promises)
}

async function postToWebhook(
  webhookUrl: string,
  input: SendNotificationInput,
  priority: NotificationPriority,
): Promise<void> {
  const card = buildSimpleAdaptiveCard(input, priority)

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: card,
        },
      ],
    }),
  })
}

function buildSimpleAdaptiveCard(
  input: SendNotificationInput,
  priority: NotificationPriority,
) {
  const priorityColor: Record<NotificationPriority, string> = {
    urgent: 'Attention',
    high: 'Warning',
    normal: 'Default',
    low: 'Default',
  }

  const card: Record<string, unknown> = {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: `🔔 ${input.title}`,
        weight: 'Bolder',
        size: 'Medium',
        color: priorityColor[priority],
        wrap: true,
      },
      {
        type: 'TextBlock',
        text: input.body,
        wrap: true,
        color: 'Default',
      },
    ],
    actions: input.link
      ? [
          {
            type: 'Action.OpenUrl',
            title: 'HR Hub에서 확인',
            url: `${process.env.NEXTAUTH_URL ?? ''}${input.link}`,
          },
        ]
      : [],
  }

  return card
}
```

### Step 2: TypeScript 오류 확인

```bash
npx tsc --noEmit 2>&1 | grep "notifications.ts" | head -20
```

Expected: 0 errors

### Step 3: 커밋

```bash
git add src/lib/notifications.ts
git commit -m "feat(b11): 알림 디스패처 강화 (debounce 5분, quiet hours, per-user prefs, webhook 채널)"
```

---

## Task 3: 알림 설정 API

**Files:**
- Create: `src/app/api/v1/notifications/preferences/route.ts`

### Step 1: 설정 GET/PUT API 생성

```typescript
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/PUT /api/v1/notifications/preferences
// 사용자 알림 수신 설정 조회/저장
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { unauthorized } from '@/lib/errors'
import type { SessionUser } from '@/types'

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return apiError(unauthorized())
    const user = session.user as SessionUser

    const prefs = await prisma.notificationPreference.findUnique({
      where: { employeeId: user.employeeId },
    })

    // 없으면 기본값 반환
    return apiSuccess(
      prefs ?? {
        employeeId: user.employeeId,
        preferences: {},
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        timezone: 'Asia/Seoul',
      },
    )
  } catch (error) {
    return apiError(error)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return apiError(unauthorized())
    const user = session.user as SessionUser

    const body = await req.json()
    const { preferences, quietHoursStart, quietHoursEnd, timezone } = body

    const updated = await prisma.notificationPreference.upsert({
      where: { employeeId: user.employeeId },
      create: {
        employeeId: user.employeeId,
        preferences: preferences ?? {},
        quietHoursStart: quietHoursStart ?? '22:00',
        quietHoursEnd: quietHoursEnd ?? '08:00',
        timezone: timezone ?? 'Asia/Seoul',
      },
      update: {
        ...(preferences !== undefined ? { preferences } : {}),
        ...(quietHoursStart !== undefined ? { quietHoursStart } : {}),
        ...(quietHoursEnd !== undefined ? { quietHoursEnd } : {}),
        ...(timezone !== undefined ? { timezone } : {}),
      },
    })

    return apiSuccess(updated)
  } catch (error) {
    return apiError(error)
  }
}
```

### Step 2: 타입 확인

```bash
npx tsc --noEmit 2>&1 | grep "preferences/route" | head -10
```

### Step 3: 커밋

```bash
git add src/app/api/v1/notifications/preferences/route.ts
git commit -m "feat(b11): 알림 설정 GET/PUT API (/api/v1/notifications/preferences)"
```

---

## Task 4: Teams Webhook Config API

**Files:**
- Create: `src/app/api/v1/settings/teams-webhooks/route.ts`
- Create: `src/app/api/v1/settings/teams-webhooks/[id]/route.ts`

### Step 1: 목록 + 생성 API

```typescript
// src/app/api/v1/settings/teams-webhooks/route.ts
// ═══════════════════════════════════════════════════════════
// GET /api/v1/settings/teams-webhooks  — 법인 Webhook 목록
// POST /api/v1/settings/teams-webhooks — Webhook 생성
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess, apiError } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { z } from 'zod'
import type { SessionUser } from '@/types'

const webhookSchema = z.object({
  channelName: z.string().min(1).max(100),
  webhookUrl: z.string().url().max(500),
  eventTypes: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
})

export const GET = withPermission(
  async (_req: NextRequest, _ctx, user: SessionUser) => {
    const webhooks = await prisma.teamsWebhookConfig.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: 'desc' },
    })

    // webhookUrl 마스킹 (앞 40자 + ***)
    const masked = webhooks.map((w) => ({
      ...w,
      webhookUrl: w.webhookUrl.length > 43
        ? w.webhookUrl.slice(0, 40) + '***'
        : w.webhookUrl.slice(0, -3) + '***',
    }))

    return apiSuccess(masked)
  },
  perm(MODULE.SETTINGS, ACTION.READ),
)

export const POST = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const body = await req.json()
    const parsed = webhookSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })
    }

    const webhook = await prisma.teamsWebhookConfig.create({
      data: { ...parsed.data, companyId: user.companyId },
    })

    return apiSuccess(webhook)
  },
  perm(MODULE.SETTINGS, ACTION.CREATE),
)
```

### Step 2: 단건 CRUD API

```typescript
// src/app/api/v1/settings/teams-webhooks/[id]/route.ts
// ═══════════════════════════════════════════════════════════
// PATCH/DELETE /api/v1/settings/teams-webhooks/[id]
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess, apiError } from '@/lib/api'
import { notFound } from '@/lib/errors'
import type { SessionUser } from '@/types'

type RouteContext = { params: Promise<{ id: string }> }

export const PATCH = withPermission(
  async (req: NextRequest, context: RouteContext, user: SessionUser) => {
    const { id } = await context.params
    const body = await req.json()

    const existing = await prisma.teamsWebhookConfig.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!existing) throw notFound('Webhook 설정을 찾을 수 없습니다.')

    const updated = await prisma.teamsWebhookConfig.update({
      where: { id },
      data: {
        ...(body.channelName !== undefined ? { channelName: body.channelName } : {}),
        ...(body.webhookUrl !== undefined ? { webhookUrl: body.webhookUrl } : {}),
        ...(body.eventTypes !== undefined ? { eventTypes: body.eventTypes } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    })

    return apiSuccess(updated)
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)

export const DELETE = withPermission(
  async (_req: NextRequest, context: RouteContext, user: SessionUser) => {
    const { id } = await context.params

    const existing = await prisma.teamsWebhookConfig.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!existing) throw notFound('Webhook 설정을 찾을 수 없습니다.')

    await prisma.teamsWebhookConfig.delete({ where: { id } })

    return apiSuccess({ deleted: true })
  },
  perm(MODULE.SETTINGS, ACTION.DELETE),
)
```

### Step 3: Teams Webhook 테스트 전송 API

**File:** `src/app/api/v1/settings/teams-webhooks/test/route.ts`

```typescript
// POST /api/v1/settings/teams-webhooks/test — 테스트 카드 전송
import { type NextRequest } from 'next/server'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (req: NextRequest, _ctx, _user: SessionUser) => {
    const body = await req.json()
    const { webhookUrl } = body

    if (!webhookUrl || typeof webhookUrl !== 'string') {
      throw badRequest('webhookUrl이 필요합니다.')
    }

    const testCard = {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            type: 'AdaptiveCard',
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            version: '1.4',
            body: [
              { type: 'TextBlock', text: '🔔 CTR HR Hub — 테스트 알림', weight: 'Bolder', size: 'Medium' },
              { type: 'TextBlock', text: 'Teams Webhook이 정상적으로 연결되었습니다.', wrap: true },
            ],
          },
        },
      ],
    }

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCard),
      })

      return apiSuccess({ success: res.ok, status: res.status })
    } catch {
      return apiSuccess({ success: false, error: '전송 실패' })
    }
  },
  perm(MODULE.SETTINGS, ACTION.CREATE),
)
```

### Step 4: 타입 확인

```bash
npx tsc --noEmit 2>&1 | grep "teams-webhook" | head -10
```

### Step 5: 커밋

```bash
git add src/app/api/v1/settings/teams-webhooks/
git commit -m "feat(b11): Teams Webhook Config API (CRUD + 테스트 전송)"
```

---

## Task 5: 알림 설정 UI (`/my/settings/notifications`)

**Files:**
- Create: `src/app/(dashboard)/my/settings/notifications/page.tsx`
- Create: `src/app/(dashboard)/my/settings/notifications/NotificationPreferenceClient.tsx`

### Step 1: Server page

```typescript
// src/app/(dashboard)/my/settings/notifications/page.tsx
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { NotificationPreferenceClient } from './NotificationPreferenceClient'

export default async function NotificationSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser

  return <NotificationPreferenceClient user={user} />
}
```

### Step 2: Client component

```typescript
// src/app/(dashboard)/my/settings/notifications/NotificationPreferenceClient.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Moon, Save, Check } from 'lucide-react'
import type { SessionUser } from '@/types'

interface EventPref {
  in_app: boolean
  email: boolean
  teams: boolean
}

interface Preferences {
  [eventType: string]: EventPref
}

const EVENT_GROUPS = [
  {
    label: '근태 / 휴가',
    events: [
      { key: 'leave_approved', label: '휴가 승인' },
      { key: 'leave_rejected', label: '휴가 반려' },
      { key: 'overtime_warning_48h', label: '주 48시간 경고' },
      { key: 'overtime_blocked_52h', label: '주 52시간 차단' },
      { key: 'leave_expiry_30d', label: '연차 소멸 30일 전' },
    ],
  },
  {
    label: '급여',
    events: [
      { key: 'payslip_issued', label: '급여명세서 발급' },
      { key: 'year_end_deadline', label: '연말정산 마감' },
    ],
  },
  {
    label: '교육 / 복리후생',
    events: [
      { key: 'mandatory_training_due', label: '법정교육 마감 30일 전' },
      { key: 'benefit_approved', label: '복리후생 승인' },
    ],
  },
  {
    label: '성과 / 분석',
    events: [
      { key: 'evaluation_deadline', label: '성과평가 마감' },
      { key: 'turnover_risk_critical', label: '이직위험 Critical' },
    ],
  },
]

const DEFAULT_PREF: EventPref = { in_app: true, email: false, teams: false }

interface Props {
  user: SessionUser
}

export function NotificationPreferenceClient({ user: _user }: Props) {
  const [preferences, setPreferences] = useState<Preferences>({})
  const [quietStart, setQuietStart] = useState('22:00')
  const [quietEnd, setQuietEnd] = useState('08:00')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const loadPrefs = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/notifications/preferences')
      const data = await res.json()
      if (data.data) {
        setPreferences((data.data.preferences as Preferences) ?? {})
        setQuietStart(data.data.quietHoursStart ?? '22:00')
        setQuietEnd(data.data.quietHoursEnd ?? '08:00')
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => { loadPrefs() }, [loadPrefs])

  const getEventPref = (key: string): EventPref =>
    preferences[key] ?? DEFAULT_PREF

  const toggleChannel = (eventKey: string, channel: keyof EventPref) => {
    setPreferences((prev) => ({
      ...prev,
      [eventKey]: {
        ...getEventPref(eventKey),
        [channel]: !getEventPref(eventKey)[channel],
      },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/v1/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences,
          quietHoursStart: quietStart,
          quietHoursEnd: quietEnd,
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-6">
        <Bell className="w-5 h-5 text-[#00C853]" />
        <h1 className="text-2xl font-bold text-[#1A1A1A]">알림 설정</h1>
      </div>

      {/* 채널 헤더 */}
      <div className="bg-white rounded-xl border border-[#E8E8E8] overflow-hidden mb-6">
        <div className="grid grid-cols-[1fr_80px_80px_80px] gap-4 px-5 py-3 bg-[#FAFAFA] border-b border-[#E8E8E8]">
          <span className="text-xs font-semibold text-[#999] uppercase tracking-wider">이벤트</span>
          <span className="text-xs font-semibold text-[#999] uppercase tracking-wider text-center">인앱</span>
          <span className="text-xs font-semibold text-[#999] uppercase tracking-wider text-center">이메일</span>
          <span className="text-xs font-semibold text-[#999] uppercase tracking-wider text-center">Teams</span>
        </div>

        {EVENT_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-5 py-2 bg-[#F5F5F5] border-b border-[#E8E8E8]">
              <span className="text-xs font-semibold text-[#666]">{group.label}</span>
            </div>
            {group.events.map((ev) => {
              const pref = getEventPref(ev.key)
              return (
                <div
                  key={ev.key}
                  className="grid grid-cols-[1fr_80px_80px_80px] gap-4 px-5 py-3.5 border-b border-[#F5F5F5] last:border-0 items-center"
                >
                  <span className="text-sm text-[#333]">{ev.label}</span>
                  {(['in_app', 'email', 'teams'] as const).map((ch) => (
                    <div key={ch} className="flex justify-center">
                      <button
                        onClick={() => toggleChannel(ev.key, ch)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          pref[ch]
                            ? 'bg-[#00C853] border-[#00C853]'
                            : 'bg-white border-[#D4D4D4] hover:border-[#00C853]'
                        }`}
                      >
                        {pref[ch] && <Check className="w-3 h-3 text-white" />}
                      </button>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* 방해금지 시간 */}
      <div className="bg-white rounded-xl border border-[#E8E8E8] p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Moon className="w-4 h-4 text-[#666]" />
          <h2 className="text-base font-semibold text-[#1A1A1A]">방해금지 시간</h2>
          <span className="text-xs text-[#999]">(urgent 알림 제외)</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="time"
            value={quietStart}
            onChange={(e) => setQuietStart(e.target.value)}
            className="px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10"
          />
          <span className="text-sm text-[#666]">~</span>
          <input
            type="time"
            value={quietEnd}
            onChange={(e) => setQuietEnd(e.target.value)}
            className="px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10"
          />
        </div>
      </div>

      {/* 저장 버튼 */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 bg-[#00C853] hover:bg-[#00A844] text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
      >
        {saved ? (
          <>
            <Check className="w-4 h-4" />
            저장됨
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            {saving ? '저장 중...' : '저장'}
          </>
        )}
      </button>
    </div>
  )
}
```

### Step 3: 타입 확인

```bash
npx tsc --noEmit 2>&1 | grep "my/settings/notifications" | head -10
```

### Step 4: 커밋

```bash
git add src/app/\(dashboard\)/my/settings/notifications/
git commit -m "feat(b11): 알림 설정 UI (/my/settings/notifications) — 이벤트별 채널 on/off + 방해금지 시간"
```

---

## Task 6: Teams Webhook 설정 UI 강화

**Files:**
- Modify: `src/app/(dashboard)/settings/teams/page.tsx` (기존 파일 확인 후 `TeamsSettingsPage` 컴포넌트 참조)
- Create or Modify: `src/components/teams/TeamsWebhookSection.tsx`

### Step 1: 기존 TeamsSettingsPage 내용 확인

```bash
cat src/components/teams/TeamsSettingsPage.tsx 2>/dev/null | head -50
```

### Step 2: Webhook 설정 섹션 컴포넌트 생성

**File:** `src/components/teams/TeamsWebhookSection.tsx`

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, TestTube, Webhook, Check, X } from 'lucide-react'

const ALL_EVENT_TYPES = [
  { key: 'overtime_blocked_52h', label: '52시간 차단' },
  { key: 'overtime_warning_48h', label: '48시간 경고' },
  { key: 'turnover_risk_critical', label: '이직위험 Critical' },
  { key: 'offer_accepted', label: '입사 수락' },
  { key: 'restructure_applied', label: '조직 개편 적용' },
  { key: 'leave_approved', label: '휴가 승인' },
  { key: 'payslip_issued', label: '급여명세서 발급' },
  { key: 'benefit_approved', label: '복리후생 승인' },
  { key: 'evaluation_deadline', label: '성과평가 마감' },
]

interface WebhookConfig {
  id: string
  channelName: string
  webhookUrl: string
  eventTypes: string[]
  isActive: boolean
}

export function TeamsWebhookSection() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([])
  const [adding, setAdding] = useState(false)
  const [newChannel, setNewChannel] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newEvents, setNewEvents] = useState<string[]>([])
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, boolean>>({})

  const loadWebhooks = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/settings/teams-webhooks')
      const data = await res.json()
      if (data.data) setWebhooks(data.data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadWebhooks() }, [loadWebhooks])

  const handleAdd = async () => {
    if (!newChannel || !newUrl) return
    try {
      const res = await fetch('/api/v1/settings/teams-webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName: newChannel, webhookUrl: newUrl, eventTypes: newEvents }),
      })
      if (res.ok) {
        setAdding(false)
        setNewChannel('')
        setNewUrl('')
        setNewEvents([])
        loadWebhooks()
      }
    } catch { /* ignore */ }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 Webhook 설정을 삭제할까요?')) return
    await fetch(`/api/v1/settings/teams-webhooks/${id}`, { method: 'DELETE' })
    loadWebhooks()
  }

  const handleTest = async (id: string, url: string) => {
    setTestingId(id)
    try {
      const res = await fetch('/api/v1/settings/teams-webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: url }),
      })
      const data = await res.json()
      setTestResult((prev) => ({ ...prev, [id]: data.data?.success ?? false }))
      setTimeout(() => setTestResult((prev) => { const n = { ...prev }; delete n[id]; return n }), 3000)
    } finally {
      setTestingId(null)
    }
  }

  const toggleEventType = (key: string) => {
    setNewEvents((prev) => prev.includes(key) ? prev.filter((e) => e !== key) : [...prev, key])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-[#00C853]" />
          <h3 className="text-base font-semibold text-[#1A1A1A]">Microsoft Teams Webhook</h3>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-sm bg-[#00C853] hover:bg-[#00A844] text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          채널 추가
        </button>
      </div>

      {/* 기존 webhook 목록 */}
      {webhooks.map((wh) => (
        <div key={wh.id} className="bg-white rounded-xl border border-[#E8E8E8] p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-[#1A1A1A]">{wh.channelName}</p>
              <p className="text-xs text-[#999] mt-0.5 font-mono">{wh.webhookUrl}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleTest(wh.id, wh.webhookUrl)}
                disabled={testingId === wh.id}
                className="flex items-center gap-1 text-xs border border-[#D4D4D4] hover:bg-[#F5F5F5] px-2.5 py-1.5 rounded-lg transition-colors"
              >
                {testResult[wh.id] !== undefined ? (
                  testResult[wh.id]
                    ? <><Check className="w-3 h-3 text-[#059669]" /> 성공</>
                    : <><X className="w-3 h-3 text-[#EF4444]" /> 실패</>
                ) : (
                  <><TestTube className="w-3 h-3" /> 테스트</>
                )}
              </button>
              <button
                onClick={() => handleDelete(wh.id)}
                className="p-1.5 text-[#999] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {wh.eventTypes.map((et) => {
              const ev = ALL_EVENT_TYPES.find((e) => e.key === et)
              return (
                <span key={et} className="text-xs px-2 py-0.5 bg-[#E8F5E9] text-[#00A844] rounded-full border border-[#E8F5E9]">
                  {ev?.label ?? et}
                </span>
              )
            })}
            {wh.eventTypes.length === 0 && (
              <span className="text-xs text-[#999]">선택된 이벤트 없음</span>
            )}
          </div>
        </div>
      ))}

      {/* 새 채널 추가 폼 */}
      {adding && (
        <div className="bg-white rounded-xl border border-[#00C853]/30 p-4 space-y-3">
          <input
            type="text"
            placeholder="채널명 (예: HR-알림)"
            value={newChannel}
            onChange={(e) => setNewChannel(e.target.value)}
            className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10"
          />
          <input
            type="url"
            placeholder="Webhook URL (https://outlook.office.com/...)"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm font-mono focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10"
          />
          <div>
            <p className="text-xs font-medium text-[#666] mb-2">전송할 이벤트</p>
            <div className="flex flex-wrap gap-2">
              {ALL_EVENT_TYPES.map((ev) => (
                <button
                  key={ev.key}
                  onClick={() => toggleEventType(ev.key)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    newEvents.includes(ev.key)
                      ? 'bg-[#00C853] text-white border-[#00C853]'
                      : 'bg-white text-[#666] border-[#D4D4D4] hover:border-[#00C853]'
                  }`}
                >
                  {ev.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="bg-[#00C853] hover:bg-[#00A844] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              저장
            </button>
            <button
              onClick={() => setAdding(false)}
              className="bg-white border border-[#D4D4D4] hover:bg-[#F5F5F5] text-[#333] px-4 py-2 rounded-lg text-sm transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

### Step 3: TeamsSettingsPage 기존 컴포넌트에 섹션 추가

기존 `src/components/teams/TeamsSettingsPage.tsx`를 읽고, 하단에 `<TeamsWebhookSection />` 추가

```typescript
// TeamsSettingsPage.tsx 내 import 추가
import { TeamsWebhookSection } from './TeamsWebhookSection'

// JSX 적절한 위치에 추가:
<TeamsWebhookSection />
```

### Step 4: 타입 확인

```bash
npx tsc --noEmit 2>&1 | grep -E "TeamsWebhook|teams-webhook" | head -10
```

### Step 5: 커밋

```bash
git add src/components/teams/ src/app/\(dashboard\)/settings/teams/
git commit -m "feat(b11): Teams Webhook 설정 UI (다중 채널 + 이벤트 선택 + 테스트 전송)"
```

---

## Task 7: 이벤트 연결 — 필수 4개

### 7-A: leave_approved / leave_rejected

**File:** `src/app/api/v1/leave/requests/[id]/approve/route.ts`

마지막 `return apiSuccess(updated)` 바로 앞에 추가:

```typescript
import { sendNotification } from '@/lib/notifications'

// 승인 후 신청자에게 알림
sendNotification({
  employeeId: request.employeeId,
  triggerType: 'leave_approved',
  title: '휴가가 승인되었습니다',
  body: `${updated.startDate.toLocaleDateString('ko-KR')} ~ ${updated.endDate?.toLocaleDateString('ko-KR') ?? ''} 휴가가 승인되었습니다.`,
  link: '/my/leave',
  priority: 'normal',
  metadata: { requestId: id, days: Number(request.days) },
  companyId: request.companyId,
})
```

**File:** `src/app/api/v1/leave/requests/[id]/reject/route.ts`

마지막 `return apiSuccess(updated)` 바로 앞에 추가:

```typescript
import { sendNotification } from '@/lib/notifications'

sendNotification({
  employeeId: request.employeeId,
  triggerType: 'leave_rejected',
  title: '휴가 신청이 반려되었습니다',
  body: `휴가 신청이 반려되었습니다. 사유: ${parsed.data.rejectionReason}`,
  link: '/my/leave',
  priority: 'normal',
  metadata: { requestId: id, reason: parsed.data.rejectionReason },
  companyId: request.companyId,
})
```

### 7-B: overtime_warning_48h / overtime_blocked_52h

**File:** `src/lib/attendance/workHourAlert.ts`

함수 내 `checkWorkHourAlert` 또는 upsert 이후에 추가:

파일 상단에 import 추가:
```typescript
import { sendNotification } from '@/lib/notifications'
```

`prisma.workHourAlert.upsert(...)` 호출 이후 (alertLevel이 'warning' 또는 'blocked'인 경우):

```typescript
// alertLevel이 경고 이상일 때만 알림 전송
if (alertLevel === 'warning' || alertLevel === 'blocked') {
  const triggerType = alertLevel === 'blocked'
    ? 'overtime_blocked_52h'
    : 'overtime_warning_48h'

  const title = alertLevel === 'blocked'
    ? `주간 근무시간 ${Math.round(weeklyHours)}시간 — 52시간 초과 차단`
    : `주간 근무시간 ${Math.round(weeklyHours)}시간 — 경고`

  sendNotification({
    employeeId,
    triggerType,
    title,
    body: `이번 주 누적 근무 ${Math.round(weeklyHours)}시간입니다. 근태 현황을 확인해주세요.`,
    link: '/my/attendance',
    priority: alertLevel === 'blocked' ? 'urgent' : 'high',
    metadata: { weeklyHours: Math.round(weeklyHours), alertLevel },
    companyId,
  })
}
```

### 7-C: payslip_issued

**File:** `src/app/api/v1/payroll/runs/[id]/approve/route.ts`

`prisma.$transaction(async (tx) => {...})` 완료 이후에 추가:

파일 상단에 import 추가:
```typescript
import { sendNotifications } from '@/lib/notifications'
```

트랜잭션 완료 후 (`await prisma.$transaction(...)` 아래):

```typescript
// 직원별 급여명세서 발급 알림 (fire-and-forget)
sendNotifications(
  run.payrollItems.map((item) => ({
    employeeId: item.employeeId,
    triggerType: 'payslip_issued',
    title: `${year}년 ${month}월 급여명세서가 발급되었습니다`,
    body: '급여명세서를 확인하세요.',
    link: '/my/payroll',
    priority: 'normal' as const,
    metadata: { year, month, payrollRunId: id },
    companyId: run.companyId,
  })),
)
```

### 7-D: turnover_risk_critical

**File:** `src/lib/analytics/predictive/turnoverRisk.ts`

파일 상단에 import 추가:
```typescript
import { sendNotification } from '@/lib/notifications'
```

`calculateTurnoverRisk` 함수의 `return { overallScore: Math.round(overallScore), riskLevel, signals, topFactors }` 바로 앞에 추가:

```typescript
// Critical 이직위험 → HR + 매니저 알림
if (riskLevel === 'critical') {
  // 직원 정보 + 관리자 조회
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      name: true,
      assignments: {
        where: { isPrimary: true, endDate: null },
        select: { companyId: true },
        take: 1,
      },
    },
  })

  const empCompanyId = employee?.assignments?.[0]?.companyId ?? companyId

  // HR Admin들에게 알림 (company의 hr_admin role 보유자)
  const hrAdmins = await prisma.employee.findMany({
    where: {
      assignments: { some: { companyId: empCompanyId, isPrimary: true, endDate: null } },
      employeeRoles: { some: { role: { code: 'HR_ADMIN' } } },
    },
    select: { id: true },
  })

  for (const hr of hrAdmins) {
    sendNotification({
      employeeId: hr.id,
      triggerType: 'turnover_risk_critical',
      title: `이직위험 Critical: ${employee?.name ?? employeeId}`,
      body: `이직 위험 점수 ${Math.round(overallScore)}점으로 Critical 수준입니다. 즉시 확인이 필요합니다.`,
      link: `/analytics/predictive/${employeeId}`,
      priority: 'urgent',
      metadata: { targetEmployeeId: employeeId, score: Math.round(overallScore), topFactors },
      companyId: empCompanyId,
    })
  }
}
```

### Step: 타입 확인

```bash
npx tsc --noEmit 2>&1 | head -20
```

### Step: 커밋

```bash
git add src/app/api/v1/leave/requests/ src/lib/attendance/workHourAlert.ts \
  src/app/api/v1/payroll/runs/ src/lib/analytics/predictive/turnoverRisk.ts
git commit -m "feat(b11): 필수 이벤트 4개 알림 연결 (leave, overtime, payslip, turnover_risk)"
```

---

## Task 8: 이벤트 연결 — 권장 3개

### 8-A: benefit_approved

**File:** `src/app/api/v1/benefit-claims/route.ts` (또는 approve API)

```bash
# 먼저 파일 확인
ls src/app/api/v1/benefit-claims/
```

benefit claim 승인 로직이 있는 곳에 추가:

```typescript
import { sendNotification } from '@/lib/notifications'

sendNotification({
  employeeId: claim.employeeId,
  triggerType: 'benefit_approved',
  title: '복리후생 신청이 승인되었습니다',
  body: '복리후생 신청이 처리되었습니다.',
  link: '/my/benefits',
  priority: 'normal',
  companyId: claim.companyId,
})
```

### 8-B: evaluation_deadline

**File:** `src/app/api/v1/performance/evaluations/route.ts` (마감 체크 API) 또는 배치 스크립트

평가 마감 30일 전 체크 로직에 추가 (기존 로직 확인 후 적용):

```typescript
sendNotification({
  employeeId: evaluateeId,
  triggerType: 'evaluation_deadline',
  title: '성과평가 마감 30일 전',
  body: '성과평가 제출 마감이 30일 남았습니다.',
  link: '/my/performance',
  priority: 'high',
  companyId,
})
```

### 8-C: onboarding_task_overdue

**File:** `src/app/api/v1/onboarding/checkin/route.ts` 또는 체크 로직

```typescript
sendNotification({
  employeeId: taskAssigneeId,
  triggerType: 'onboarding_task_overdue',
  title: '온보딩 태스크 기한 초과',
  body: `"${taskName}" 태스크가 기한을 초과했습니다.`,
  link: `/onboarding/${planId}`,
  priority: 'high',
  companyId,
})
```

### Step: 타입 확인

```bash
npx tsc --noEmit 2>&1 | head -20
```

### Step: 커밋

```bash
git add src/app/api/v1/benefit-claims/ src/app/api/v1/performance/
git commit -m "feat(b11): 권장 이벤트 연결 (benefit_approved, evaluation_deadline, onboarding_task_overdue)"
```

---

## Task 9: i18n — 알림 타입 키 추가

**Files:**
- Modify: `messages/ko.json`
- Modify: `messages/en.json`

### Step 1: ko.json notification.types 추가

`"notification"` 블록 안에 추가 (기존 키들 유지):

```json
"types": {
  "leave_approved": "휴가가 승인되었습니다",
  "leave_rejected": "휴가 신청이 반려되었습니다",
  "overtime_warning_48h": "주간 근무시간 경고 (48시간)",
  "overtime_blocked_52h": "주간 근무시간 초과 차단 (52시간)",
  "payslip_issued": "{month}월 급여명세서 발급",
  "turnover_risk_critical": "이직위험 Critical",
  "benefit_approved": "복리후생 승인",
  "evaluation_deadline": "성과평가 마감",
  "onboarding_task_overdue": "온보딩 태스크 기한 초과"
},
"priority": {
  "low": "낮음",
  "normal": "일반",
  "high": "높음",
  "urgent": "긴급"
},
"channels": {
  "in_app": "인앱",
  "email": "이메일",
  "teams": "Teams"
},
"preference": {
  "title": "알림 설정",
  "quietHours": "방해금지 시간",
  "quietHoursDesc": "설정된 시간 동안 긴급(urgent) 외 알림을 조용히 처리합니다",
  "save": "설정 저장",
  "saved": "저장됨"
}
```

### Step 2: en.json에 동일 구조 추가 (영문)

```json
"types": {
  "leave_approved": "Leave request approved",
  "leave_rejected": "Leave request rejected",
  "overtime_warning_48h": "Weekly hours warning (48h)",
  "overtime_blocked_52h": "Weekly hours blocked (52h)",
  "payslip_issued": "{month} payslip issued",
  "turnover_risk_critical": "Turnover risk: Critical",
  "benefit_approved": "Benefit claim approved",
  "evaluation_deadline": "Performance evaluation deadline",
  "onboarding_task_overdue": "Onboarding task overdue"
},
"priority": {
  "low": "Low",
  "normal": "Normal",
  "high": "High",
  "urgent": "Urgent"
},
"channels": {
  "in_app": "In-App",
  "email": "Email",
  "teams": "Teams"
},
"preference": {
  "title": "Notification Settings",
  "quietHours": "Quiet Hours",
  "quietHoursDesc": "Notifications except urgent will be silenced during quiet hours",
  "save": "Save Settings",
  "saved": "Saved"
}
```

### Step 3: 커밋

```bash
git add messages/ko.json messages/en.json
git commit -m "feat(b11): i18n 알림 타입 키 추가 (notification.types.*, priority, channels, preference)"
```

---

## Task 10: 빌드 검증 + context/SHARED.md 업데이트

### Step 1: TypeScript 전체 검증

```bash
npx tsc --noEmit 2>&1 | tail -10
```

Expected: 0 errors

### Step 2: 빌드 검증

```bash
npm run build 2>&1 | tail -20
```

Expected: "Compiled successfully" 또는 route 목록 정상 출력

### Step 3: context/SHARED.md에 B11 완료 내용 추가

`context/SHARED.md` 파일 끝에 추가:

```markdown
---

## Phase B — B11 완료 (2026-03-03) [B11 세션]

### B11: 알림 시스템 강화 + i18n 보완 + Teams 연동 완성

> 검증: `tsc --noEmit` ✅ 0 errors | `npm run build` ✅ 성공

**DB Migration — 3개 모델 변경 (notification_system)**:
- `Notification`: priority, metadata, channels[] 필드 추가
- `NotificationPreference` 신규: employeeId unique, preferences JSON, quietHours 설정
- `TeamsWebhookConfig` 신규: companyId+channelName+webhookUrl+eventTypes

**핵심 함수**:
- `sendNotification()` — debounce(5분) + quiet hours + per-user prefs + 3채널
- `sendNotifications()` — 다건 일괄 발송
- `postToWebhook()` — TeamsWebhookConfig 기반 채널 webhook 전송
- `buildSimpleAdaptiveCard()` — priority-aware Adaptive Card 생성

**API Routes (신규)**:
- `GET/PUT /api/v1/notifications/preferences` — 사용자 알림 설정
- `GET/POST /api/v1/settings/teams-webhooks` — Webhook 목록/생성
- `PATCH/DELETE /api/v1/settings/teams-webhooks/[id]` — Webhook 수정/삭제
- `POST /api/v1/settings/teams-webhooks/test` — 테스트 전송

**UI (신규/강화)**:
- `/my/settings/notifications` — 이벤트별 채널 on/off + 방해금지 시간
- `/settings/teams` → `TeamsWebhookSection` 추가 (다중 채널 관리)

**i18n**:
- `notification.types.*` 9개 이벤트 타입 키 추가 (ko/en)
- `notification.priority.*`, `notification.channels.*`, `notification.preference.*` 추가

**알림 연결 상태**:
✅ 연결 완료:
- `leave_approved` → `src/app/api/v1/leave/requests/[id]/approve/route.ts`
- `leave_rejected` → `src/app/api/v1/leave/requests/[id]/reject/route.ts`
- `overtime_warning_48h`, `overtime_blocked_52h` → `src/lib/attendance/workHourAlert.ts`
- `payslip_issued` → `src/app/api/v1/payroll/runs/[id]/approve/route.ts`
- `turnover_risk_critical` → `src/lib/analytics/predictive/turnoverRisk.ts`
- `benefit_approved` → `src/app/api/v1/benefit-claims/route.ts`
- `evaluation_deadline` → B3 평가 API
- `onboarding_task_overdue` → 온보딩 체크 로직

⬜ 미연결 이벤트 (연결 포인트):
- `requisition_approved` → `src/app/api/v1/recruitment/requisitions/[id]/approve/route.ts`
- `candidate_applied` → `src/app/api/v1/recruitment/applications/route.ts`
- `interview_scheduled` → `src/app/api/v1/recruitment/postings/[id]/interviews/route.ts`
- `offer_accepted` → `src/app/api/v1/recruitment/applications/[id]/offer/route.ts`
- `onboarding_task_due` → 온보딩 작업 생성/마감 체크
- `offboarding_started` → `src/app/api/v1/offboarding/route.ts`
- `crossboarding_triggered` → `src/lib/crossboarding.ts`
- `payroll_confirmed` → `src/app/api/v1/payroll/runs/[id]/approve/route.ts` (이미 payslip_issued 연결됨)
- `profile_change_approved` → 프로필 변경 승인 API
- `restructure_applied` → `src/app/api/v1/org/restructure-plans/[id]/apply/route.ts`
- `mandatory_training_due` → `src/app/api/v1/training/mandatory-config/enroll/route.ts`
- `training_expiry_30d` → 스케줄러 배치
- `budget_threshold_80` → 복리후생 예산 체크
- `burnout_risk_high` → `src/lib/analytics/predictive/burnout.ts`
- `team_health_at_risk` → `src/lib/analytics/predictive/teamHealth.ts`
- `evaluation_cycle_start` → 평가 사이클 시작 API
- `calibration_ready` → 캘리브레이션 시작 API
- `year_end_deadline` → 연말정산 마감 배치
- `shift_change_approved` → 교대 변경 승인 API
- `leave_expiry_30d` → 연차 소멸 예정 배치

### Phase B 전체 완료 🎉
B1~B11 전 모듈 구현 완료.
다음 단계: Phase C (UX 리팩토링 - 데이터 테이블 표준화, 대시보드 통일)
```

### Step 4: 최종 커밋

```bash
git add context/SHARED.md
git commit -m "docs(b11): context/SHARED.md B11 완료 내용 업데이트 (Phase B 전체 완료)"
```

---

## 검증 체크리스트

- [ ] `notification_system` 마이그레이션 성공
- [ ] `Notification.priority`, `metadata`, `channels[]` 필드 존재
- [ ] `NotificationPreference` 모델 생성
- [ ] `TeamsWebhookConfig` 모델 생성
- [ ] 디스패처: 5분 debounce 동작
- [ ] 디스패처: quiet hours 체크
- [ ] 디스패처: per-user 설정 반영
- [ ] `GET/PUT /api/v1/notifications/preferences` API 정상
- [ ] `GET/POST /api/v1/settings/teams-webhooks` API 정상
- [ ] Teams 테스트 전송 API 정상
- [ ] `/my/settings/notifications` 페이지 접근 가능
- [ ] Teams Webhook 설정 UI (다중 채널 + 이벤트 선택)
- [ ] `leave_approved` / `leave_rejected` 알림 연결
- [ ] `overtime_warning_48h` / `overtime_blocked_52h` 알림 연결
- [ ] `payslip_issued` 알림 연결
- [ ] `turnover_risk_critical` 알림 연결
- [ ] i18n `notification.types.*` 키 추가 (ko/en)
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` 성공
- [ ] `context/SHARED.md` B11 완료 내용 업데이트
