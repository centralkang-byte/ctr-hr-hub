import { beforeEach, describe, expect, it, vi } from 'vitest'

const findMany = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({
  prisma: {
    employeeAssignment: { findMany },
  },
}))

import {
  getYearEndOwnershipWindow,
  readYearEndOwners,
  resolveYearEndOwner,
} from '@/lib/payroll/year-end-settlement-owner'

beforeEach(() => {
  findMany.mockReset()
})

describe('resolveYearEndOwner', () => {
  it('fails closed when no overlapping primary assignment exists', () => {
    expect(resolveYearEndOwner([])).toEqual({
      resolved: false,
      reason: 'NO_ASSIGNMENT',
    })
  })

  it('resolves multiple assignments in one company to the latest assignment', () => {
    const older = {
      id: 'assignment-a',
      companyId: 'company-a',
      effectiveDate: new Date('2025-01-01T00:00:00.000Z'),
      endDate: new Date('2025-07-01T00:00:00.000Z'),
    }
    const latest = {
      id: 'assignment-b',
      companyId: 'company-a',
      effectiveDate: new Date('2025-07-01T00:00:00.000Z'),
      endDate: null,
    }

    expect(resolveYearEndOwner([older, latest])).toEqual({
      resolved: true,
      companyId: 'company-a',
      assignment: latest,
    })
  })

  it('fails closed when assignments overlap the year in multiple companies', () => {
    const assignments = [
      {
        id: 'assignment-a',
        companyId: 'company-a',
        effectiveDate: new Date('2025-01-01T00:00:00.000Z'),
        endDate: new Date('2025-07-01T00:00:00.000Z'),
      },
      {
        id: 'assignment-b',
        companyId: 'company-b',
        effectiveDate: new Date('2025-07-01T00:00:00.000Z'),
        endDate: null,
      },
    ]

    expect(resolveYearEndOwner(assignments)).toEqual({
      resolved: false,
      reason: 'MULTIPLE_COMPANIES',
    })
  })

  it('ignores zero-length assignment tombstones', () => {
    const boundary = new Date('2025-07-01T00:00:00.000Z')

    expect(
      resolveYearEndOwner([
        {
          id: 'assignment-tombstone',
          companyId: 'company-a',
          effectiveDate: boundary,
          endDate: boundary,
        },
      ]),
    ).toEqual({ resolved: false, reason: 'NO_ASSIGNMENT' })
  })
})

describe('readYearEndOwners', () => {
  it('queries the half-open settlement-year overlap and preserves missing employees', async () => {
    findMany.mockResolvedValue([])

    const owners = await readYearEndOwners(['employee-a', 'employee-b'], 2025)

    const { start, endExclusive } = getYearEndOwnershipWindow(2025)
    expect(start.toISOString()).toBe('2025-01-01T00:00:00.000Z')
    expect(endExclusive.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          employeeId: { in: ['employee-a', 'employee-b'] },
          isPrimary: true,
          effectiveDate: { lt: endExclusive },
          OR: [{ endDate: null }, { endDate: { gt: start } }],
        },
      }),
    )
    expect(owners.get('employee-a')).toEqual({
      resolved: false,
      reason: 'NO_ASSIGNMENT',
    })
    expect(owners.get('employee-b')).toEqual({
      resolved: false,
      reason: 'NO_ASSIGNMENT',
    })
  })
})
