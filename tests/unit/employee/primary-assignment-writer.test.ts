import { describe, expect, it, vi } from 'vitest'

import { AppError } from '@/lib/errors'
import type { EmployeeAssignment } from '@/generated/prisma/client'
import {
  PRIMARY_ASSIGNMENT_RETRY_CODE,
  acquirePrimaryAssignmentDepartmentLocks,
  acquirePrimaryAssignmentEmployeeLocks,
  assertPrimaryAssignmentReplacement,
  assertPrimaryAssignmentSourceScopeLocked,
  casPrimaryAssignment,
  getOpenPrimaryAssignment,
  getPrimaryAssignmentAtDate,
  primaryAssignmentDepartmentScopeKey,
  sortPrimaryAssignmentDepartmentScopes,
  sortPrimaryAssignmentEmployeeIds,
  revalidatePrimaryAssignmentMasterData,
  revalidatePrimaryAssignmentMasterDataSet,
  validatePrimaryAssignmentTimeline,
  withPrimaryAssignmentRetry,
} from '@/lib/employee/primary-assignment-writer'
import type { PrimaryAssignmentMasterData } from '@/lib/employee/primary-assignment-writer'
import type { PrismaTx } from '@/lib/prisma-rls'

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function assignment(
  id: string,
  effectiveDate: string,
  endDate: string | null,
): EmployeeAssignment {
  const createdAt = date('2026-01-01')
  return {
    id,
    employeeId: 'employee-a',
    effectiveDate: date(effectiveDate),
    endDate: endDate ? date(endDate) : null,
    changeType: 'TRANSFER',
    companyId: 'company-a',
    departmentId: 'dept-a',
    jobGradeId: null,
    jobCategoryId: null,
    employmentType: 'FULL_TIME',
    contractType: null,
    status: 'ACTIVE',
    positionId: null,
    isPrimary: true,
    workLocationId: null,
    titleId: null,
    reason: null,
    orderNumber: null,
    approvedById: null,
    createdAt,
    updatedAt: createdAt,
  }
}

describe('primary assignment writer protocol', () => {
  it('sorts and deduplicates the complete company/department key', () => {
    const scopes = sortPrimaryAssignmentDepartmentScopes([
      { companyId: 'company-b', departmentId: null },
      { companyId: 'company-a', departmentId: 'dept-z' },
      { companyId: 'company-b', departmentId: 'dept-a' },
      { companyId: 'company-a', departmentId: 'dept-z' },
      { companyId: 'company-a', departmentId: null },
    ])

    expect(scopes.map(primaryAssignmentDepartmentScopeKey)).toEqual([
      'company-a:<null>',
      'company-a:dept-z',
      'company-b:<null>',
      'company-b:dept-a',
    ])
    expect(sortPrimaryAssignmentEmployeeIds(['employee-b', 'employee-a', 'employee-b']))
      .toEqual(['employee-a', 'employee-b'])
  })

  it('accepts half-open D/D transitions and a zero-length audit tombstone', () => {
    expect(() => validatePrimaryAssignmentTimeline([
      { id: 'old', effectiveDate: date('2026-01-01'), endDate: date('2026-02-01') },
      { id: 'loa-tombstone', effectiveDate: date('2026-02-01'), endDate: date('2026-02-01') },
      { id: 'active', effectiveDate: date('2026-02-01'), endDate: date('2026-03-01') },
      { id: 'later', effectiveDate: date('2026-03-01'), endDate: null },
    ])).not.toThrow()
  })

  it('does not select a zero-length tombstone at its boundary', () => {
    const timeline = [
      assignment('tombstone', '2026-02-01', '2026-02-01'),
      assignment('active', '2026-02-01', null),
    ]
    expect(getPrimaryAssignmentAtDate(timeline, date('2026-02-01'))?.id).toBe('active')
  })

  it('distinguishes an effective row from a scheduled future open successor', () => {
    const timeline = [
      assignment('effective-today', '2026-01-01', '2026-03-01'),
      assignment('future-open', '2026-03-01', null),
    ]

    expect(getPrimaryAssignmentAtDate(timeline, date('2026-02-01'))?.id)
      .toBe('effective-today')
    expect(getOpenPrimaryAssignment(timeline)?.id).toBe('future-open')
  })

  it('rejects overlaps, inverted ranges, and two effective rows at the same start', () => {
    expect(() => validatePrimaryAssignmentTimeline([
      { id: 'a', effectiveDate: date('2026-01-01'), endDate: date('2026-02-02') },
      { id: 'b', effectiveDate: date('2026-02-01'), endDate: null },
    ])).toThrow(AppError)
    expect(() => validatePrimaryAssignmentTimeline([
      { id: 'a', effectiveDate: date('2026-02-02'), endDate: date('2026-02-01') },
    ])).toThrow(AppError)
    expect(() => validatePrimaryAssignmentTimeline([
      { id: 'a', effectiveDate: date('2026-02-01'), endDate: date('2026-03-01') },
      { id: 'b', effectiveDate: date('2026-02-01'), endDate: null },
    ])).toThrow(AppError)
  })

  it('validates a replacement against future rows at the exact boundary', () => {
    expect(() => assertPrimaryAssignmentReplacement({
      timeline: [
        { id: 'current', effectiveDate: date('2026-01-01'), endDate: null },
      ],
      replacedAssignmentId: 'current',
      closeDate: date('2026-02-01'),
      nextEffectiveDate: date('2026-02-01'),
      nextEndDate: null,
    })).not.toThrow()

    expect(() => assertPrimaryAssignmentReplacement({
      timeline: [
        { id: 'current', effectiveDate: date('2026-01-01'), endDate: date('2026-03-01') },
        { id: 'future', effectiveDate: date('2026-03-01'), endDate: null },
      ],
      replacedAssignmentId: 'current',
      closeDate: date('2026-02-01'),
      nextEffectiveDate: date('2026-02-01'),
      nextEndDate: null,
    })).toThrow(AppError)
  })

  it('raises a retryable conflict when the fresh source was not prelocked', () => {
    expect(() => assertPrimaryAssignmentSourceScopeLocked(
      ['company-a:dept-a'],
      { companyId: 'company-a', departmentId: 'dept-b' },
    )).toThrowError(expect.objectContaining({ code: PRIMARY_ASSIGNMENT_RETRY_CODE }))
  })

  it('retries only bounded retryable conflicts', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new AppError(409, PRIMARY_ASSIGNMENT_RETRY_CODE, 'retry'))
      .mockResolvedValue('ok')

    await expect(withPrimaryAssignmentRetry(operation)).resolves.toBe('ok')
    expect(operation).toHaveBeenCalledTimes(2)

    const exhausted = vi.fn(async () => {
      throw { code: 'P2034' }
    })
    await expect(withPrimaryAssignmentRetry(exhausted, { maxAttempts: 2 }))
      .rejects.toMatchObject({ code: 'CONFLICT', statusCode: 409 })
    expect(exhausted).toHaveBeenCalledTimes(2)
  })

  it('acquires every canonical department key before sorted employee keys', async () => {
    const advisoryKeys: string[] = []
    const tx = {
      $executeRaw: vi.fn(async (_strings: TemplateStringsArray, key: string) => {
        advisoryKeys.push(key)
        return 0
      }),
    } as unknown as PrismaTx

    await acquirePrimaryAssignmentDepartmentLocks(tx, [
      { companyId: 'company-b', departmentId: 'dept-b' },
      { companyId: 'company-a', departmentId: null },
      { companyId: 'company-a', departmentId: 'dept-a' },
    ])
    await acquirePrimaryAssignmentEmployeeLocks(tx, ['employee-b', 'employee-a'])

    expect(advisoryKeys).toEqual([
      'primary-assignment:department:company-a:<null>',
      'primary-assignment:department:company-a:dept-a',
      'primary-assignment:department:company-b:dept-b',
      'primary-assignment:employee:employee-a',
      'primary-assignment:employee:employee-b',
    ])
  })

  it('locks every active company-scoped assignment master reference with FOR SHARE', async () => {
    const rowLocks: Array<{ statement: string; values: unknown[] }> = []
    const tx = {
      $queryRaw: vi.fn(async (
        parts: TemplateStringsArray,
        ...values: unknown[]
      ) => {
        rowLocks.push({
          statement: parts.join('?').replace(/\s+/g, ' ').trim(),
          values,
        })
        return [{ id: values[0] }]
      }),
    } as unknown as PrismaTx

    await revalidatePrimaryAssignmentMasterData(tx, {
      companyId: 'company-a',
      jobGradeId: 'grade-a',
      titleId: 'title-a',
      jobCategoryId: 'category-a',
      positionId: 'position-a',
      workLocationId: 'location-a',
    })

    expect(rowLocks).toEqual([
      {
        statement: 'SELECT id FROM companies WHERE id = ? AND deleted_at IS NULL FOR SHARE',
        values: ['company-a'],
      },
      {
        statement: 'SELECT id FROM job_categories WHERE id = ? AND company_id = ? AND deleted_at IS NULL FOR SHARE',
        values: ['category-a', 'company-a'],
      },
      {
        statement: 'SELECT id FROM job_grades WHERE id = ? AND company_id = ? AND deleted_at IS NULL FOR SHARE',
        values: ['grade-a', 'company-a'],
      },
      {
        statement: 'SELECT id FROM positions WHERE id = ? AND company_id = ? AND deleted_at IS NULL FOR SHARE',
        values: ['position-a', 'company-a'],
      },
      {
        statement: 'SELECT id FROM employee_titles WHERE id = ? AND company_id = ? AND deleted_at IS NULL FOR SHARE',
        values: ['title-a', 'company-a'],
      },
      {
        statement: 'SELECT id FROM work_locations WHERE id = ? AND company_id = ? AND deleted_at IS NULL FOR SHARE',
        values: ['location-a', 'company-a'],
      },
    ])
  })

  it('deduplicates and locks a batch in the same canonical order regardless of input order', async () => {
    const captureOrder = async (
      dataSet: readonly PrimaryAssignmentMasterData[],
    ): Promise<string[]> => {
      const order: string[] = []
      const tx = {
        $queryRaw: vi.fn(async (
          parts: TemplateStringsArray,
          ...values: unknown[]
        ) => {
          const statement = parts.join('?').replace(/\s+/g, ' ').trim()
          const table = statement.match(/FROM ([a-z_]+)/)?.[1]
          order.push(`${table}:${String(values[0])}`)
          return [{ id: values[0] }]
        }),
      } as unknown as PrismaTx

      await revalidatePrimaryAssignmentMasterDataSet(tx, dataSet)
      return order
    }

    const first: PrimaryAssignmentMasterData[] = [
      { companyId: 'company-b', jobGradeId: 'grade-z', titleId: 'title-z' },
      { companyId: 'company-a', jobCategoryId: 'category-a', jobGradeId: 'grade-a' },
      {
        companyId: 'company-a',
        jobGradeId: 'grade-a',
        positionId: 'position-a',
        workLocationId: 'location-a',
      },
    ]
    const second = [...first].reverse()

    const firstOrder = await captureOrder(first)
    const secondOrder = await captureOrder(second)

    expect(firstOrder).toEqual(secondOrder)
    expect(firstOrder).toEqual([
      'companies:company-a',
      'companies:company-b',
      'job_categories:category-a',
      'job_grades:grade-a',
      'job_grades:grade-z',
      'positions:position-a',
      'employee_titles:title-z',
      'work_locations:location-a',
    ])
  })

  it('rejects a missing or deleted company before locking child master rows', async () => {
    const queryRaw = vi.fn(async (_parts: TemplateStringsArray) => [])
    const tx = { $queryRaw: queryRaw } as unknown as PrismaTx

    await expect(revalidatePrimaryAssignmentMasterData(tx, {
      companyId: 'company-missing',
      jobGradeId: 'grade-a',
    })).rejects.toMatchObject({ code: 'BAD_REQUEST', statusCode: 400 })

    expect(queryRaw).toHaveBeenCalledTimes(1)
    expect(queryRaw.mock.calls[0]?.[0].join(' ').replace(/\s+/g, ' '))
      .toContain('FROM companies')
  })

  it.each([
    ['jobGradeId', 'job_grades', 'grade-missing'],
    ['titleId', 'employee_titles', 'title-missing'],
    ['jobCategoryId', 'job_categories', 'category-missing'],
    ['positionId', 'positions', 'position-missing'],
    ['workLocationId', 'work_locations', 'location-missing'],
  ] as const)(
    'rejects missing or deleted %s after the company row is locked',
    async (field, table, id) => {
      const statements: string[] = []
      const tx = {
        $queryRaw: vi.fn(async (
          parts: TemplateStringsArray,
          ...values: unknown[]
        ) => {
          const statement = parts.join('?').replace(/\s+/g, ' ').trim()
          statements.push(statement)
          return statement.includes(`FROM ${table}`) ? [] : [{ id: values[0] }]
        }),
      } as unknown as PrismaTx
      const data: PrimaryAssignmentMasterData = { companyId: 'company-a' }
      data[field] = id

      await expect(revalidatePrimaryAssignmentMasterData(tx, data))
        .rejects.toMatchObject({ code: 'BAD_REQUEST', statusCode: 400 })

      expect(statements[0]).toContain('FROM companies')
      expect(statements.at(-1)).toContain(`FROM ${table}`)
      expect(statements.at(-1)).toContain('company_id = ?')
      expect(statements.at(-1)).toContain('deleted_at IS NULL')
      expect(statements.at(-1)).toContain('FOR SHARE')
    },
  )

  it('rejects a root Prisma client and a zero-row exact CAS', async () => {
    const root = {
      $connect: vi.fn(),
      $executeRaw: vi.fn(),
      $queryRaw: vi.fn(),
    } as unknown as PrismaTx
    await expect(acquirePrimaryAssignmentEmployeeLocks(root, ['employee-a']))
      .rejects.toMatchObject({ code: 'PRIMARY_ASSIGNMENT_TRANSACTION_REQUIRED' })
    await expect(revalidatePrimaryAssignmentMasterData(root, {
      companyId: 'company-a',
      jobGradeId: 'grade-a',
    })).rejects.toMatchObject({ code: 'PRIMARY_ASSIGNMENT_TRANSACTION_REQUIRED' })
    expect(root.$queryRaw).not.toHaveBeenCalled()

    const tx = {
      employeeAssignment: {
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
    } as unknown as PrismaTx
    await expect(casPrimaryAssignment(
      tx,
      assignment('current', '2026-01-01', null),
      { endDate: date('2026-02-01') },
    )).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})
