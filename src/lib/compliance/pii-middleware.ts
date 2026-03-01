// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PII Tracking Middleware
// Wraps API handlers to log PII access
// ═══════════════════════════════════════════════════════════

import { type NextRequest, NextResponse } from 'next/server'
import { logPiiAccess } from './gdpr'
import type { SessionUser } from '@/types'

type RouteContext = { params: Promise<Record<string, string>> }

type ApiHandler = (
  req: NextRequest,
  context: RouteContext,
  user: SessionUser,
) => Promise<NextResponse>

/**
 * Wraps an API handler to automatically log PII access.
 * Use on endpoints that return or modify personal data.
 */
export function withPiiTracking(
  handler: ApiHandler,
  accessType: string,
  fieldName: string,
): ApiHandler {
  return async (req, context, user) => {
    const response = await handler(req, context, user)

    // Extract target employee ID from URL params or response
    const params = await context.params
    const targetId = params.employeeId ?? params.id ?? user.employeeId

    if (targetId && user.employeeId !== targetId) {
      logPiiAccess(
        user.employeeId,
        targetId,
        user.companyId,
        accessType,
        fieldName,
        req.headers,
      )
    }

    return response
  }
}
