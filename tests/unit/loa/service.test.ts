import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { EmployeeAssignment } from '@/generated/prisma/client'

const payrollAdjustmentMocks = vi.hoisted(() => ({
  buildLoaDesiredAmounts: vi.fn(async () => new Map<string, number>()),
  getUnconsumedDeferredLoaObligationsForLoa: vi.fn(async () => []),
  reconcileLockedLoaPayroll: vi.fn(async () => []),
}))

vi.mock('@/lib/loa/payroll-adjustment', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/loa/payroll-adjustment')>()
  return { ...actual, ...payrollAdjustmentMocks }
})

import {
  isLoaTransitionAllowed,
  loaTransitionSchema,
  transitionLeaveOfAbsence,
  type LoaTransitionInput,
} from '@/lib/loa/service'

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function assignment(
  overrides: Partial<EmployeeAssignment> = {},
): EmployeeAssignment {
  const createdAt = date('2026-01-01')
  return {
    id: 'assignment-1',
    employeeId: 'employee-1',
    effectiveDate: date('2026-01-01'),
    endDate: null,
    changeType: 'HIRE',
    companyId: 'company-1',
    departmentId: 'department-1',
    jobGradeId: null,
    jobCategoryId: null,
    employmentType: 'FULL_TIME',
    contractType: null,
    status: 'ACTIVE',
    positionId: 'position-1',
    isPrimary: true,
    workLocationId: null,
    titleId: null,
    reason: null,
    orderNumber: null,
    approvedById: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  }
}

function createPayrollTransitionHarness(params: {
  status: string
  startDate: Date
  timeline: EmployeeAssignment[]
  expectedEndDate?: Date | null
  templateHint?: EmployeeAssignment | null
}) {
  const events: string[] = []
  const candidate = {
    id: 'loa-1',
    companyId: 'company-1',
    employeeId: 'employee-1',
    status: params.status,
    startDate: params.startDate,
    expectedEndDate: params.expectedEndDate ?? params.startDate,
  }
  const record = {
    ...candidate,
    typeId: 'loa-type-1',
    actualEndDate: null,
    payType: null,
    payRate: null,
    reason: null,
    proofFileUrl: null,
    requestedAt: date('2026-01-01'),
    approvedById: 'actor-1',
    approvedAt: date('2026-01-01'),
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    returnPositionId: null,
    returnNotes: null,
    loaAssignmentId: params.status === 'APPROVED' ? null : params.timeline[0]?.id ?? null,
    returnAssignmentId: null,
    splitSequence: 1,
    parentId: null,
    createdAt: date('2026-01-01'),
    updatedAt: date('2026-01-01'),
    deletedAt: null,
    type: {
      id: 'loa-type-1',
      name: '테스트 휴직',
      payType: 'UNPAID',
      payRate: null,
    },
  }
  const payrollRun = {
    id: 'payroll-run-1',
    companyId: 'company-1',
    yearMonth: params.startDate.toISOString().slice(0, 7),
    runType: 'MONTHLY',
    status: 'DRAFT',
    attendanceClosedAt: null,
  }
  const employeeAssignmentUpdateMany = vi.fn(async () => ({ count: 1 }))
  const employeeAssignmentCreate = vi.fn(async ({ data }) => ({
    ...data,
    id: `created-${data.status.toLowerCase()}`,
  }))
  const templateHint = Object.prototype.hasOwnProperty.call(params, 'templateHint')
    ? params.templateHint ?? null
    : params.timeline[0] ?? null
  const leaveOfAbsenceFindFirst = vi.fn()
    .mockResolvedValueOnce(candidate)
    .mockResolvedValue(record)
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    $queryRaw: vi.fn(async (parts: TemplateStringsArray) => {
      const statement = parts.join('?')
      if (statement.includes('leave_of_absences')) {
        events.push('loa-row')
        return [{ id: candidate.id }]
      }
      if (statement.includes('payroll_runs')) return [{ id: payrollRun.id }]
      if (statement.includes('companies')) {
        events.push('company-master')
        return [{ id: candidate.companyId }]
      }
      if (statement.includes('positions')) {
        events.push('position-master')
        return [{ id: templateHint?.positionId }]
      }
      throw new Error(`Unexpected row lock: ${statement}`)
    }),
    payrollAdjustment: { findMany: vi.fn(async () => []) },
    payrollRun: {
      findMany: vi.fn(async () => [payrollRun]),
      findFirst: vi.fn(async () => payrollRun),
    },
    leaveOfAbsence: {
      findFirst: leaveOfAbsenceFindFirst,
      findFirstOrThrow: vi.fn(async () => ({
        ...record,
        employee: { id: 'employee-1', name: '직원', employeeNo: 'E001' },
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      update: vi.fn(async () => record),
    },
    employee: {
      findFirst: vi.fn(async () => ({
        assignments: [{ companyId: 'company-1' }],
        employeeRoles: [{
          companyId: 'company-1',
          role: { code: 'HR_ADMIN' },
        }],
      })),
    },
    employeeAssignment: {
      findFirst: vi.fn(async () => templateHint),
      findMany: vi.fn(async () => params.timeline),
      updateMany: employeeAssignmentUpdateMany,
      create: employeeAssignmentCreate,
    },
    department: {
      findMany: vi.fn(async () => [{
        id: 'department-1',
        companyId: candidate.companyId,
      }]),
    },
    company: { findFirst: vi.fn(async () => ({ timezone: 'UTC' })) },
    position: { findFirst: vi.fn(async () => ({ id: 'position-1' })) },
    auditLog: { create: vi.fn(async () => ({})) },
  }
  const transaction = vi.fn(async (operation: (client: typeof tx) => unknown) =>
    operation(tx),
  )
  const db = {
    ...tx,
    $transaction: transaction,
  }

  async function run(input: LoaTransitionInput) {
    return transitionLeaveOfAbsence({
      id: candidate.id,
      companyId: candidate.companyId,
      actorId: 'actor-1',
      input,
      deps: {
        db: db as never,
        afterPeriodLock: async ({ key }) => {
          events.push(key.startsWith('payroll-run-registry:') ? 'registry' : 'period')
        },
        afterPayrollRunLock: async () => { events.push('payroll-run') },
        afterPrimaryAssignmentDepartmentLock: async () => {
          events.push('department')
        },
        afterPrimaryAssignmentEmployeeLock: async () => {
          events.push('employee-assignment')
        },
        afterPrimaryAssignmentTimelineRead: async () => {
          events.push('assignment-timeline')
        },
      },
    })
  }

  return {
    events,
    employeeAssignmentCreate,
    employeeAssignmentUpdateMany,
    transaction,
    run,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('LOA transition schema', () => {
  it.each([
    { action: 'approve' },
    { action: 'activate' },
    { action: 'cancel' },
    { action: 'reject', rejectionReason: 'Insufficient documentation' },
    { action: 'return', notes: 'Returning as discussed' },
    {
      action: 'complete',
      actualEndDate: '2026-07-17',
      returnPositionId: 'position-a',
      returnNotes: 'Return confirmed',
    },
  ])('accepts the exact payload for $action', (payload) => {
    expect(loaTransitionSchema.safeParse(payload).success).toBe(true)
  })

  it.each([
    { action: 'approve', notes: 'not allowed' },
    { action: 'activate', actualEndDate: '2026-07-17' },
    { action: 'cancel', reason: 'not allowed' },
    { action: 'return', rejectionReason: 'not allowed' },
  ])('rejects unknown fields for $action', (payload) => {
    expect(loaTransitionSchema.safeParse(payload).success).toBe(false)
  })

  it.each([
    { action: 'reject' },
    { action: 'reject', rejectionReason: '' },
    { action: 'reject', rejectionReason: '   ' },
  ])('requires a non-empty rejection reason', (payload) => {
    expect(loaTransitionSchema.safeParse(payload).success).toBe(false)
  })

  it.each([
    { action: 'complete' },
    { action: 'complete', actualEndDate: '2026-02-30' },
    { action: 'complete', actualEndDate: '2026-7-17' },
    { action: 'complete', actualEndDate: '2026-07-17T00:00:00.000Z' },
  ])('requires a real date-only actualEndDate', (payload) => {
    expect(loaTransitionSchema.safeParse(payload).success).toBe(false)
  })

  it('trims accepted text fields before use', () => {
    const parsed = loaTransitionSchema.parse({
      action: 'complete',
      actualEndDate: '2026-07-17',
      returnPositionId: '  position-a  ',
      returnNotes: '  Return confirmed  ',
    })

    expect(parsed).toEqual({
      action: 'complete',
      actualEndDate: '2026-07-17',
      returnPositionId: 'position-a',
      returnNotes: 'Return confirmed',
    })
  })
})

describe('LOA transition authorization', () => {
  const owner = { isOwner: true, isCompanyHr: false, isGlobalSuper: false }
  const manager = { isOwner: false, isCompanyHr: false, isGlobalSuper: false }
  const hr = { isOwner: false, isCompanyHr: true, isGlobalSuper: false }
  const globalSuper = { isOwner: false, isCompanyHr: false, isGlobalSuper: true }

  it.each(['approve', 'reject', 'activate', 'complete'] as const)(
    'allows only HR or global SUPER to %s',
    (action) => {
      expect(isLoaTransitionAllowed('REQUESTED', action, manager)).toBe(false)
      expect(isLoaTransitionAllowed('REQUESTED', action, owner)).toBe(false)
      expect(isLoaTransitionAllowed('REQUESTED', action, hr)).toBe(true)
      expect(isLoaTransitionAllowed('REQUESTED', action, globalSuper)).toBe(true)
    },
  )

  it('allows an owner or privileged actor to request return', () => {
    expect(isLoaTransitionAllowed('ACTIVE', 'return', owner)).toBe(true)
    expect(isLoaTransitionAllowed('ACTIVE', 'return', hr)).toBe(true)
    expect(isLoaTransitionAllowed('ACTIVE', 'return', manager)).toBe(false)
  })

  it('allows self cancellation only before assignment/payroll activation', () => {
    expect(isLoaTransitionAllowed('REQUESTED', 'cancel', owner)).toBe(true)
    expect(isLoaTransitionAllowed('APPROVED', 'cancel', owner)).toBe(true)
    expect(isLoaTransitionAllowed('ACTIVE', 'cancel', owner)).toBe(false)
    expect(isLoaTransitionAllowed('RETURN_REQUESTED', 'cancel', owner)).toBe(false)
    expect(isLoaTransitionAllowed('ACTIVE', 'cancel', hr)).toBe(true)
    expect(isLoaTransitionAllowed('ACTIVE', 'cancel', manager)).toBe(false)
  })
})

describe('LOA primary assignment transitions', () => {
  it('locks domain rows before the employee timeline and activates at a half-open boundary', async () => {
    const startDate = date('2026-07-10')
    const harness = createPayrollTransitionHarness({
      status: 'APPROVED',
      startDate,
      timeline: [assignment()],
    })

    await harness.run({ action: 'activate' })

    expect(harness.events).toEqual([
      'registry',
      'period',
      'loa-row',
      'payroll-run',
      'department',
      'company-master',
      'position-master',
      'employee-assignment',
      'assignment-timeline',
    ])
    expect(harness.employeeAssignmentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { endDate: startDate } }),
    )
    expect(harness.employeeAssignmentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        effectiveDate: startDate,
        status: 'ON_LEAVE',
        isPrimary: true,
      }),
    })
  })

  it('closes the LOA assignment and restores ACTIVE on E+1', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-18T12:00:00.000Z'))
    const loaAssignment = assignment({
      effectiveDate: date('2026-07-10'),
      changeType: 'STATUS_CHANGE',
      status: 'ON_LEAVE',
    })
    const harness = createPayrollTransitionHarness({
      status: 'RETURN_REQUESTED',
      startDate: loaAssignment.effectiveDate,
      expectedEndDate: date('2026-07-17'),
      timeline: [loaAssignment],
    })

    await harness.run({ action: 'complete', actualEndDate: '2026-07-17' })

    const returnDate = date('2026-07-18')
    expect(harness.employeeAssignmentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { endDate: returnDate } }),
    )
    expect(harness.employeeAssignmentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        effectiveDate: returnDate,
        status: 'ACTIVE',
        isPrimary: true,
      }),
    })
  })

  it('keeps a same-day cancelled LOA as D/D tombstone plus one ACTIVE row', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T12:00:00.000Z'))
    const sameDay = date('2026-07-10')
    const loaAssignment = assignment({
      effectiveDate: sameDay,
      changeType: 'STATUS_CHANGE',
      status: 'ON_LEAVE',
    })
    const harness = createPayrollTransitionHarness({
      status: 'ACTIVE',
      startDate: sameDay,
      timeline: [loaAssignment],
    })

    await harness.run({ action: 'cancel' })

    expect(harness.employeeAssignmentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { endDate: sameDay } }),
    )
    expect(harness.employeeAssignmentCreate).toHaveBeenCalledTimes(1)
    expect(harness.employeeAssignmentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        effectiveDate: sameDay,
        status: 'ACTIVE',
        isPrimary: true,
      }),
    })
  })

  it('retries instead of copying master data that changed before the employee lock', async () => {
    const startDate = date('2026-07-10')
    const templateHint = assignment({ positionId: 'position-before' })
    const freshAssignment = assignment({ positionId: 'position-after' })
    const harness = createPayrollTransitionHarness({
      status: 'APPROVED',
      startDate,
      templateHint,
      timeline: [freshAssignment],
    })

    await expect(harness.run({ action: 'activate' })).rejects.toMatchObject({
      code: 'PRIMARY_ASSIGNMENT_RETRY_REQUIRED',
    })
    expect(harness.transaction).toHaveBeenCalledTimes(3)
    expect(harness.employeeAssignmentCreate).not.toHaveBeenCalled()
  })
})
