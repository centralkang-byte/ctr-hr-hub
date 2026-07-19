import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EmployeeAssignment } from '@/generated/prisma/client'

const mocks = vi.hoisted(() => ({
  offboardingHint: vi.fn(),
  assignmentHint: vi.fn(),
  transaction: vi.fn(),
  calculateSeverance: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    employeeOffboarding: { findUnique: mocks.offboardingHint },
    employeeAssignment: { findFirst: mocks.assignmentHint },
    $transaction: mocks.transaction,
  },
}))

vi.mock('@/lib/payroll/severance', () => ({
  calculateSeverance: mocks.calculateSeverance,
}))

import { executeOffboardingCompletion } from '@/lib/offboarding/complete-offboarding'

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function assignment(endDate: Date | null): EmployeeAssignment {
  const createdAt = date('2026-01-01')
  return {
    id: 'assignment-1',
    employeeId: 'employee-1',
    effectiveDate: date('2025-01-01'),
    endDate,
    changeType: 'HIRE',
    companyId: 'company-1',
    departmentId: 'department-1',
    jobGradeId: null,
    jobCategoryId: null,
    employmentType: 'FULL_TIME',
    contractType: null,
    status: 'RESIGNED',
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

interface PersistedState {
  offboardingStatus: string
  assignmentEnd: Date | null
  assetStatus: string
}

function buildTransactionClient(state: PersistedState, includeAsset: boolean) {
  const employeeAssignmentUpdateMany = vi.fn(async (args: {
    data: { endDate?: Date | null }
  }) => {
    state.assignmentEnd = args.data.endDate ?? state.assignmentEnd
    return { count: 1 }
  })
  const assetReturnUpdate = vi.fn(async (args: {
    data: { status: string }
  }) => {
    state.assetStatus = args.data.status
    return { id: 'asset-1' }
  })
  const employeeOffboardingUpdateMany = vi.fn(async (args: {
    data: { status: string }
  }) => {
    state.offboardingStatus = args.data.status
    return { count: 1 }
  })

  return {
    $queryRaw: vi.fn(async () => [{ id: 'offboarding-1' }]),
    $executeRaw: vi.fn(async () => 0),
    employeeOffboarding: {
      findUnique: vi.fn(async () => ({
        id: 'offboarding-1',
        employeeId: 'employee-1',
        companyId: 'company-1',
        status: state.offboardingStatus,
        lastWorkingDate: date('2026-07-17'),
        isItAccountDeactivated: true,
        isExitInterviewCompleted: true,
        handoverToId: null,
        offboardingTasks: [],
        assetReturns: includeAsset
          ? [{
              id: 'asset-1',
              assetName: 'Laptop',
              status: state.assetStatus,
              residualValue: 0,
              consentDocExists: false,
            }]
          : [],
        employee: { id: 'employee-1', hireDate: date('2025-01-01') },
      })),
      updateMany: employeeOffboardingUpdateMany,
    },
    department: {
      findMany: vi.fn(async () => [{ id: 'department-1', companyId: 'company-1' }]),
    },
    employeeAssignment: {
      findMany: vi.fn(async () => [assignment(state.assignmentEnd)]),
      updateMany: employeeAssignmentUpdateMany,
    },
    company: {
      findUnique: vi.fn(async () => ({ countryCode: 'KR' })),
    },
    assetReturn: { update: assetReturnUpdate },
    leaveYearBalance: { findMany: vi.fn(async () => []) },
    compensationHistory: {
      findFirst: vi.fn(async () => ({ newBaseSalary: 120_000_000 })),
    },
    employeeOffboardingTask: { updateMany: vi.fn(async () => ({ count: 0 })) },
  }
}

type TransactionClient = ReturnType<typeof buildTransactionClient>

function createHarness(options: { includeAsset?: boolean } = {}) {
  const state: PersistedState = {
    offboardingStatus: 'IN_PROGRESS',
    assignmentEnd: null,
    assetStatus: 'PENDING',
  }
  let lastTransactionClient: TransactionClient | null = null

  mocks.offboardingHint.mockImplementation(async () => ({ employeeId: 'employee-1' }))
  mocks.assignmentHint.mockImplementation(async () => assignment(state.assignmentEnd))
  mocks.transaction.mockImplementation(async (
    operation: (tx: TransactionClient) => Promise<unknown>,
  ) => {
    const draft: PersistedState = {
      offboardingStatus: state.offboardingStatus,
      assignmentEnd: state.assignmentEnd ? new Date(state.assignmentEnd) : null,
      assetStatus: state.assetStatus,
    }
    const tx = buildTransactionClient(draft, options.includeAsset ?? false)
    lastTransactionClient = tx

    const result = await operation(tx)
    state.offboardingStatus = draft.offboardingStatus
    state.assignmentEnd = draft.assignmentEnd
    state.assetStatus = draft.assetStatus
    return result
  })

  return {
    state,
    transactionClient() {
      if (!lastTransactionClient) throw new Error('Transaction did not start')
      return lastTransactionClient
    },
  }
}

function severanceResult() {
  return {
    employeeId: 'employee-1',
    employeeName: 'Employee',
    hireDate: date('2025-01-01').toISOString(),
    terminationDate: date('2026-07-17').toISOString(),
    tenureDays: 562,
    tenureYears: 1.54,
    isEligible: true,
    avgWeeklyHours: 40,
    ineligibleReason: null,
    eligibilityWarning: null,
    recentThreeMonths: [],
    averageMonthlyPay: 10_000_000,
    severancePay: 15_400_000,
    incomeTax: 0,
    localIncomeTax: 0,
    netSeverancePay: 15_400_000,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('offboarding completion transaction', () => {
  it('closes the primary assignment at the exclusive LWD + 1 boundary', async () => {
    const harness = createHarness()
    mocks.calculateSeverance.mockResolvedValue(severanceResult())

    await expect(executeOffboardingCompletion('offboarding-1')).resolves.toMatchObject({
      status: 'COMPLETED',
    })

    expect(harness.state.offboardingStatus).toBe('COMPLETED')
    expect(harness.state.assignmentEnd).toEqual(date('2026-07-18'))
    expect(mocks.calculateSeverance).toHaveBeenCalledWith(
      'employee-1',
      date('2026-07-17'),
      'company-1',
      { db: harness.transactionClient() },
    )
    expect(harness.transactionClient().employeeAssignment.updateMany)
      .toHaveBeenCalledWith(expect.objectContaining({
        data: { endDate: date('2026-07-18') },
      }))
  })

  it('rolls back earlier transactional writes when severance calculation fails', async () => {
    const harness = createHarness({ includeAsset: true })
    mocks.calculateSeverance.mockRejectedValue(new Error('severance calculation failed'))

    await expect(executeOffboardingCompletion('offboarding-1'))
      .rejects.toThrow('severance calculation failed')

    const tx = harness.transactionClient()
    expect(mocks.calculateSeverance).toHaveBeenCalledWith(
      'employee-1',
      date('2026-07-17'),
      'company-1',
      { db: tx },
    )
    expect(tx.assetReturn.update).toHaveBeenCalledTimes(1)
    expect(tx.employeeOffboarding.updateMany).not.toHaveBeenCalled()
    expect(tx.employeeAssignment.updateMany).not.toHaveBeenCalled()
    expect(harness.state).toEqual({
      offboardingStatus: 'IN_PROGRESS',
      assignmentEnd: null,
      assetStatus: 'PENDING',
    })
  })
})
