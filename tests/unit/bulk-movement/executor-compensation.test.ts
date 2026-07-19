import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EmployeeAssignment } from '@/generated/prisma/client'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  assignmentHints: vi.fn(),
  acquireDepartmentLocks: vi.fn(),
  revalidateDepartments: vi.fn(),
  revalidateMasterDataSet: vi.fn(),
  acquireEmployeeLocks: vi.fn(),
  readTimeline: vi.fn(),
  openAssignment: vi.fn(),
  assignmentAtDate: vi.fn(),
  assignmentCreate: vi.fn(),
  casAssignment: vi.fn(),
  retry: vi.fn(),
  salaryBandFindMany: vi.fn(),
  compensationFindFirst: vi.fn(),
  compensationCreate: vi.fn(),
  employeeFindUnique: vi.fn(),
  auditLogCreate: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    employeeAssignment: { findMany: mocks.assignmentHints },
    $transaction: mocks.transaction,
  },
}))

vi.mock('@/lib/notifications', () => ({ sendNotification: vi.fn() }))

vi.mock('@/lib/employee/primary-assignment-writer', () => ({
  PRIMARY_ASSIGNMENT_RETRY_CODE: 'PRIMARY_ASSIGNMENT_RETRY_REQUIRED',
  acquirePrimaryAssignmentDepartmentLocks: mocks.acquireDepartmentLocks,
  acquirePrimaryAssignmentEmployeeLocks: mocks.acquireEmployeeLocks,
  assertPrimaryAssignmentReplacement: vi.fn(),
  assertPrimaryAssignmentSourceScopeLocked: vi.fn(),
  casPrimaryAssignment: mocks.casAssignment,
  getOpenPrimaryAssignment: mocks.openAssignment,
  getPrimaryAssignmentAtDate: mocks.assignmentAtDate,
  readPrimaryAssignmentTimeline: mocks.readTimeline,
  revalidatePrimaryAssignmentDepartments: mocks.revalidateDepartments,
  revalidatePrimaryAssignmentMasterDataSet: mocks.revalidateMasterDataSet,
  withPrimaryAssignmentRetry: mocks.retry,
}))

import { executeMovements } from '@/lib/bulk-movement/executor'

const effectiveDate = new Date('2026-07-01T00:00:00.000Z')
const assignment = {
  id: 'assignment-1',
  employeeId: 'employee-1',
  effectiveDate: new Date('2026-01-01T00:00:00.000Z'),
  endDate: null,
  changeType: 'HIRE',
  companyId: 'company-1',
  departmentId: 'department-1',
  jobGradeId: 'grade-1',
  jobCategoryId: 'engineering',
  employmentType: 'FULL_TIME',
  contractType: null,
  status: 'ACTIVE',
  positionId: 'position-1',
  isPrimary: true,
  workLocationId: 'location-1',
  titleId: null,
  reason: null,
  orderNumber: null,
  approvedById: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
} as EmployeeAssignment

beforeEach(() => {
  vi.clearAllMocks()
  mocks.assignmentHints.mockResolvedValue([assignment])
  mocks.acquireDepartmentLocks.mockResolvedValue([
    'company-1:department-1',
    'company-1:department-2',
  ])
  mocks.readTimeline.mockResolvedValue([assignment])
  mocks.openAssignment.mockReturnValue(assignment)
  mocks.assignmentAtDate.mockReturnValue(assignment)
  mocks.employeeFindUnique.mockResolvedValue({ id: 'employee-1', deletedAt: null })
  mocks.compensationFindFirst.mockResolvedValue({ newBaseSalary: 100 })
  mocks.salaryBandFindMany.mockResolvedValue([
    {
      id: 'generic-newer',
      jobGradeId: 'grade-1',
      jobCategoryId: null,
      effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
      minSalary: 50,
      maxSalary: 120,
    },
    {
      id: 'engineering-exact',
      jobGradeId: 'grade-1',
      jobCategoryId: 'engineering',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      minSalary: 140,
      maxSalary: 160,
    },
  ])
  mocks.compensationCreate.mockResolvedValue({ id: 'compensation-1' })
  mocks.assignmentCreate.mockResolvedValue({ id: 'assignment-2' })
  mocks.auditLogCreate.mockResolvedValue({ id: 'audit-1' })
  mocks.retry.mockImplementation(async (operation: () => Promise<unknown>) => operation())
  mocks.transaction.mockImplementation(async (operation: (tx: unknown) => Promise<unknown>) =>
    operation({
      employee: { findUnique: mocks.employeeFindUnique },
      employeeAssignment: { create: mocks.assignmentCreate },
      compensationHistory: {
        findFirst: mocks.compensationFindFirst,
        create: mocks.compensationCreate,
      },
      salaryBand: { findMany: mocks.salaryBandFindMany },
      auditLog: { create: mocks.auditLogCreate },
    }),
  )
})

describe('executeMovements compensation salary band', () => {
  it('uses the assignment category band instead of a newer generic band', async () => {
    await executeMovements(
      'compensation',
      [{
        rowNum: 2,
        employeeId: 'employee-1',
        employeeNo: 'E001',
        employeeName: 'Employee',
        data: {
          effectiveDate: '2026-07-01',
          newBaseSalary: '150',
          changeType: 'ANNUAL_INCREASE',
        },
      }],
      'compensation.csv',
      { actorEmployeeId: 'actor-1', companyId: 'company-1' },
    )

    expect(mocks.salaryBandFindMany).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        jobGradeId: 'grade-1',
        effectiveFrom: { lte: effectiveDate },
        AND: [
          { OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveDate } }] },
          { OR: [{ jobCategoryId: 'engineering' }, { jobCategoryId: null }] },
        ],
        deletedAt: null,
      },
    })
    expect(mocks.compensationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ isException: false, exceptionReason: null }),
    })
  })

  it('queries only generic bands when the assignment has no category', async () => {
    mocks.assignmentAtDate.mockReturnValue({ ...assignment, jobCategoryId: null })

    await executeMovements(
      'compensation',
      [{
        rowNum: 2,
        employeeId: 'employee-1',
        employeeNo: 'E001',
        employeeName: 'Employee',
        data: {
          effectiveDate: '2026-07-01',
          newBaseSalary: '150',
          changeType: 'ANNUAL_INCREASE',
        },
      }],
      'compensation.csv',
      { actorEmployeeId: 'actor-1', companyId: 'company-1' },
    )

    expect(mocks.salaryBandFindMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        AND: [
          { OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveDate } }] },
          { jobCategoryId: null },
        ],
      }),
    })
  })
})

describe('executeMovements assignment master data fence', () => {
  it('revalidates final inherited and replacement IDs before employee locking', async () => {
    await executeMovements(
      'transfer',
      [{
        rowNum: 2,
        employeeId: 'employee-1',
        employeeNo: 'E001',
        employeeName: 'Employee',
        data: {
          effectiveDate: '2026-07-01',
          departmentId: 'department-2',
          jobGradeId: 'grade-2',
        },
      }],
      'transfer.csv',
      { actorEmployeeId: 'actor-1', companyId: 'company-1' },
    )

    expect(mocks.revalidateMasterDataSet).toHaveBeenCalledWith(
      expect.anything(),
      [{
        companyId: 'company-1',
        jobGradeId: 'grade-2',
        jobCategoryId: 'engineering',
        positionId: 'position-1',
        workLocationId: 'location-1',
      }],
    )
    expect(mocks.revalidateDepartments.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.revalidateMasterDataSet.mock.invocationCallOrder[0])
    expect(mocks.revalidateMasterDataSet.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.acquireEmployeeLocks.mock.invocationCallOrder[0])
  })

  it('marks a stale assignment hint as retryable', async () => {
    mocks.openAssignment.mockReturnValue({
      ...assignment,
      updatedAt: new Date('2026-07-19T01:00:00.000Z'),
    })

    await expect(executeMovements(
      'transfer',
      [{
        rowNum: 2,
        employeeId: 'employee-1',
        employeeNo: 'E001',
        employeeName: 'Employee',
        data: {
          effectiveDate: '2026-07-01',
          departmentId: 'department-2',
        },
      }],
      'transfer.csv',
      { actorEmployeeId: 'actor-1', companyId: 'company-1' },
    )).rejects.toMatchObject({
      statusCode: 409,
      code: 'PRIMARY_ASSIGNMENT_RETRY_REQUIRED',
      details: { employeeId: 'employee-1' },
    })
  })
})
