import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  today: new Date('2026-07-19T00:00:00.000Z'),
  getTodayForTimezone: vi.fn(),
}))

vi.mock('@/lib/assignments', () => ({
  getTodayForTimezone: mocks.getTodayForTimezone,
}))

import {
  countCurrentOrFutureAssignmentMasterReferences,
  lockActivePositionReferences,
  softDeletePositionMaster,
} from '@/lib/employee/assignment-master-lifecycle'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getTodayForTimezone.mockReturnValue(mocks.today)
})

describe('assignment master lifecycle fence', () => {
  it('locks tenant-scoped position references in canonical mixed-mode order', async () => {
    const queryRaw = vi.fn()
      .mockResolvedValueOnce([{ id: 'position-a' }])
      .mockResolvedValueOnce([{ id: 'position-b' }])
    const tx = { $queryRaw: queryRaw }

    await expect(lockActivePositionReferences(tx as never, {
      companyId: 'company-1',
      positionIds: ['position-b', 'position-a', 'position-a'],
      forUpdatePositionIds: ['position-b'],
    })).resolves.toEqual(['position-a', 'position-b'])

    expect(queryRaw.mock.calls.map((call) => call.slice(1))).toEqual([
      ['position-a', 'company-1'],
      ['position-b', 'company-1'],
    ])
    expect(queryRaw.mock.calls[0][0].join(' ')).toContain('FOR SHARE')
    expect(queryRaw.mock.calls[1][0].join(' ')).toContain('FOR UPDATE')
  })

  it('rejects a missing, deleted, or cross-company position reference', async () => {
    const tx = { $queryRaw: vi.fn(async () => []) }

    await expect(lockActivePositionReferences(tx as never, {
      companyId: 'company-1',
      positionIds: ['position-1'],
    })).rejects.toMatchObject({ code: 'CONFLICT', statusCode: 409 })
  })

  it('counts open and future-ended references using the company-local date', async () => {
    const count = vi.fn(async () => 2)
    const tx = {
      company: {
        findFirst: vi.fn(async () => ({ timezone: 'America/Chicago' })),
      },
      employeeAssignment: { count },
    }

    await expect(
      countCurrentOrFutureAssignmentMasterReferences(
        tx as never,
        'company-1',
        [{ positionId: 'position-1' }],
      ),
    ).resolves.toBe(2)

    expect(mocks.getTodayForTimezone).toHaveBeenCalledWith('America/Chicago')
    expect(count).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        AND: [
          { OR: [{ positionId: 'position-1' }] },
          { OR: [{ endDate: null }, { endDate: { gt: mocks.today } }] },
        ],
      },
    })
  })

  it('soft-deletes a position only after all live references are clear', async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }))
    const tx = {
      $queryRaw: vi.fn(async () => [{
        id: 'position-1',
        companyId: 'company-1',
        deletedAt: null,
      }]),
      company: {
        findFirst: vi.fn(async () => ({ timezone: 'Asia/Seoul' })),
      },
      employeeAssignment: { count: vi.fn(async () => 0) },
      position: { count: vi.fn(async () => 0), updateMany },
      jobPosting: { count: vi.fn(async () => 0) },
      requisition: { count: vi.fn(async () => 0) },
    }
    const db = {
      $transaction: vi.fn(async (operation: (client: typeof tx) => unknown) =>
        operation(tx),
      ),
    }

    const result = await softDeletePositionMaster({
      positionId: 'position-1',
      companyId: 'company-1',
      deps: { db: db as never },
    })

    expect(result).toEqual({
      id: 'position-1',
      companyId: 'company-1',
      deletedAt: expect.any(Date),
    })
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'position-1',
        companyId: 'company-1',
        deletedAt: null,
      },
      data: { deletedAt: expect.any(Date) },
    })
    expect(tx.position.count).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        deletedAt: null,
        OR: [
          { reportsToPositionId: 'position-1' },
          { dottedLinePositionId: 'position-1' },
        ],
      },
    })
  })

  it('blocks a position that still owns an active hierarchy or recruitment reference', async () => {
    const updateMany = vi.fn()
    const tx = {
      $queryRaw: vi.fn(async () => [{
        id: 'position-1',
        companyId: 'company-1',
        deletedAt: null,
      }]),
      company: {
        findFirst: vi.fn(async () => ({ timezone: 'Asia/Seoul' })),
      },
      employeeAssignment: { count: vi.fn(async () => 0) },
      position: { count: vi.fn(async () => 1), updateMany },
      jobPosting: { count: vi.fn(async () => 0) },
      requisition: { count: vi.fn(async () => 0) },
    }
    const db = {
      $transaction: vi.fn(async (operation: (client: typeof tx) => unknown) =>
        operation(tx),
      ),
    }

    await expect(softDeletePositionMaster({
      positionId: 'position-1',
      companyId: 'company-1',
      deps: { db: db as never },
    })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(updateMany).not.toHaveBeenCalled()
  })
})
