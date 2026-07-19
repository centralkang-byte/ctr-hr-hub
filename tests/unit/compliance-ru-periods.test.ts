import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const findMany = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({
  prisma: {
    employee: { findMany },
  },
}))

vi.mock('@/lib/employee/assignment-helpers', () => ({
  extractPrimaryAssignment: (assignments: unknown[]) => assignments[0],
}))

import { generate57TReport, generateP4Report } from '@/lib/compliance/ru'

const originalTimezone = process.env.TZ

beforeAll(() => {
  process.env.TZ = 'Asia/Seoul'
})

afterAll(() => {
  if (originalTimezone === undefined) {
    delete process.env.TZ
  } else {
    process.env.TZ = originalTimezone
  }
})

beforeEach(() => {
  findMany.mockReset()
})

function mockEmployeeWhenAssignmentOverlaps(rowEnd: Date) {
  findMany.mockImplementation(async (query) => {
    const periodStart = query.where.assignments.some.OR[1].endDate.gt as Date
    if (rowEnd.getTime() <= periodStart.getTime()) return []

    return [{
      id: 'employee-boundary',
      assignments: [{
        isPrimary: true,
        department: null,
        jobCategory: null,
        jobGrade: null,
      }],
    }]
  })
}

describe('Russian statutory report UTC periods', () => {
  it('excludes an assignment ending exactly at the UTC quarter start from P-4', async () => {
    const rowEnd = new Date('2025-04-01T00:00:00.000Z')
    mockEmployeeWhenAssignmentOverlaps(rowEnd)

    const report = await generateP4Report('company-ru', 2025, 2)
    const query = findMany.mock.calls[0][0]

    expect(new Date(2025, 3, 1).toISOString()).toBe('2025-03-31T15:00:00.000Z')
    expect(query.where.assignments.some.OR[1].endDate.gt.toISOString())
      .toBe('2025-04-01T00:00:00.000Z')
    expect(query.where.assignments.some.effectiveDate.lt.toISOString())
      .toBe('2025-07-01T00:00:00.000Z')
    expect(query.where.hireDate.lte.toISOString()).toBe('2025-06-30T23:59:59.999Z')
    expect(report.periodStart).toBe('2025-04-01T00:00:00.000Z')
    expect(report.periodEnd).toBe('2025-06-30T23:59:59.999Z')
    expect(report.totalHeadcount).toBe(0)
  })

  it('excludes an assignment ending exactly at the UTC year start from 57-T', async () => {
    const rowEnd = new Date('2025-01-01T00:00:00.000Z')
    mockEmployeeWhenAssignmentOverlaps(rowEnd)

    const report = await generate57TReport('company-ru', 2025)
    const query = findMany.mock.calls[0][0]

    expect(new Date(2025, 0, 1).toISOString()).toBe('2024-12-31T15:00:00.000Z')
    expect(query.where.assignments.some.OR[1].endDate.gt.toISOString())
      .toBe('2025-01-01T00:00:00.000Z')
    expect(query.where.assignments.some.effectiveDate.lt.toISOString())
      .toBe('2026-01-01T00:00:00.000Z')
    expect(query.where.hireDate.lte.toISOString()).toBe('2025-12-31T23:59:59.999Z')
    expect(report.totalHeadcount).toBe(0)
  })
})
