import { beforeEach, describe, expect, it, vi } from 'vitest'

const cacheMocks = vi.hoisted(() => ({
  hitHandler: vi.fn(),
}))
const queryMocks = vi.hoisted(() => ({
  employeeFindMany: vi.fn(),
  compensationHistoryFindMany: vi.fn(),
  salaryBandFindMany: vi.fn(),
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/cache', () => ({
  CACHE_STRATEGY: {
    ANALYTICS: { ttl: 300, prefix: 'cache:analytics' },
  },
  withCache: vi.fn(() => cacheMocks.hitHandler),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    employee: { findMany: queryMocks.employeeFindMany },
    compensationHistory: { findMany: queryMocks.compensationHistoryFindMany },
    salaryBand: { findMany: queryMocks.salaryBandFindMany },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { EXPORT: {} },
  withRateLimit: vi.fn((handler) => handler),
}))

vi.mock('@/lib/employee/assignment-helpers', () => ({
  extractPrimaryAssignment: vi.fn(),
}))

import { GET } from '@/app/api/v1/analytics/gender-pay-gap/route'
import { GET as exportGET } from '@/app/api/v1/analytics/gender-pay-gap/export/route'
import { ROLE } from '@/lib/constants'
import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import type { SessionUser } from '@/types'

const mockedSession = vi.mocked(getServerSession)

function makeUser(role: string): SessionUser {
  return {
    id: `user-${role.toLowerCase()}`,
    employeeId: `employee-${role.toLowerCase()}`,
    companyId: 'company-ctr',
    name: 'Test User',
    email: `${role.toLowerCase()}@ctr.co.kr`,
    role,
    permissions: [{ module: 'analytics', action: 'read' }],
  }
}

function makeRequest(): NextRequest {
  return new NextRequest(
    'http://localhost:3002/api/v1/analytics/gender-pay-gap?groupBy=department',
  )
}

function makeContext() {
  return { params: Promise.resolve({}) }
}

describe('GET /analytics/gender-pay-gap cache authorization order', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cacheMocks.hitHandler.mockResolvedValue(
      NextResponse.json(
        { data: { source: 'cached-sensitive-data' } },
        { status: 200, headers: { 'X-Cache': 'HIT' } },
      ),
    )
  })

  it.each([ROLE.MANAGER, ROLE.EXECUTIVE])(
    'rejects %s before entering the cached handler, even when it would return a HIT',
    async (role) => {
      mockedSession.mockResolvedValue({ user: makeUser(role) } as never)

      const response = await GET(makeRequest(), makeContext())
      const body = (await response.json()) as {
        error: { code: string }
      }

      expect(response.status).toBe(403)
      expect(response.headers.get('X-Cache')).toBeNull()
      expect(body.error.code).toBe('FORBIDDEN')
      expect(cacheMocks.hitHandler).not.toHaveBeenCalled()
    },
  )

  it('allows HR_ADMIN to continue into the cached handler', async () => {
    mockedSession.mockResolvedValue({
      user: makeUser(ROLE.HR_ADMIN),
    } as never)

    const request = makeRequest()
    const context = makeContext()
    const response = await GET(request, context)
    const body = (await response.json()) as {
      data: { source: string }
    }

    expect(cacheMocks.hitHandler).toHaveBeenCalledTimes(1)
    expect(cacheMocks.hitHandler).toHaveBeenCalledWith(request, context)
    expect(response.status).toBe(200)
    expect(response.headers.get('X-Cache')).toBe('HIT')
    expect(body.data.source).toBe('cached-sensitive-data')
  })
})

describe('GET /analytics/gender-pay-gap/export direct authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([ROLE.MANAGER, ROLE.EXECUTIVE])(
    'rejects direct %s handler access before querying compensation data',
    async (role) => {
      mockedSession.mockResolvedValue({ user: makeUser(role) } as never)

      const response = await exportGET(
        new NextRequest('http://localhost:3002/api/v1/analytics/gender-pay-gap/export'),
        makeContext(),
      )

      expect(response.status).toBe(403)
      expect(queryMocks.employeeFindMany).not.toHaveBeenCalled()
      expect(queryMocks.compensationHistoryFindMany).not.toHaveBeenCalled()
    },
  )
})
