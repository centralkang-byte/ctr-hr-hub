// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST/DELETE /api/v1/push/subscribe
// Push 구독 등록/해제
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withAuth } from '@/lib/permissions'

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
})

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
})

// ─── POST: 구독 등록 ──────────────────────────────────────

export const POST = withAuth(async (req: NextRequest, _context, user) => {
  const body: unknown = await req.json()
  const parsed = subscribeSchema.safeParse(body)
  if (!parsed.success) {
    throw badRequest('잘못된 구독 데이터입니다.', { issues: parsed.error.issues })
  }

  try {
    const subscription = await prisma.pushSubscription.upsert({
      where: {
        employeeId_endpoint: {
          employeeId: user.employeeId,
          endpoint: parsed.data.endpoint,
        },
      },
      create: {
        employeeId: user.employeeId,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.p256dh,
        auth: parsed.data.auth,
      },
      update: {
        p256dh: parsed.data.p256dh,
        auth: parsed.data.auth,
      },
    })

    return apiSuccess(subscription, 201)
  } catch (error) {
    throw handlePrismaError(error)
  }
})

// ─── DELETE: 구독 해제 ─────────────────────────────────────

export const DELETE = withAuth(async (req: NextRequest, _context, user) => {
  const body: unknown = await req.json()
  const parsed = unsubscribeSchema.safeParse(body)
  if (!parsed.success) {
    throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
  }

  try {
    await prisma.pushSubscription.deleteMany({
      where: {
        employeeId: user.employeeId,
        endpoint: parsed.data.endpoint,
      },
    })

    return apiSuccess({ unsubscribed: true })
  } catch (error) {
    throw handlePrismaError(error)
  }
})
