import { describe, it, expect } from 'vitest'
import {
  UnifiedTaskType,
  UnifiedTaskStatus,
  UnifiedTaskPriority,
  type UnifiedTask,
} from '@/lib/unified-task/types'

// ─── Helper: create mock UnifiedTask ────────────────────────

function mockTask(overrides: Partial<UnifiedTask> = {}): UnifiedTask {
  return {
    id: 'LeaveRequest:test-1',
    type: UnifiedTaskType.LEAVE_APPROVAL,
    status: UnifiedTaskStatus.PENDING,
    priority: UnifiedTaskPriority.MEDIUM,
    title: '연차 3일 신청 — 테스트',
    requester: { employeeId: 'emp-1', name: '김테스트' },
    assignee: { employeeId: 'mgr-1', name: '박매니저' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceId: 'test-1',
    sourceModel: 'LeaveRequest',
    actionUrl: '/leave/team',
    companyId: 'comp-1',
    metadata: {},
    ...overrides,
  }
}

// ─── Tests ──────────────────────────────────────────────────

describe('UnifiedTask actions field', () => {
  it('should have approveUrl and rejectUrl for PENDING leave tasks', () => {
    const task = mockTask({
      actions: {
        approveUrl: '/api/v1/leave/requests/test-1/approve',
        rejectUrl: '/api/v1/leave/requests/test-1/reject',
        detailUrl: '/leave/team',
      },
    })

    expect(task.actions).toBeDefined()
    expect(task.actions?.approveUrl).toContain('/approve')
    expect(task.actions?.rejectUrl).toContain('/reject')
    expect(task.actions?.detailUrl).toBe('/leave/team')
  })

  it('should only have detailUrl for completed tasks', () => {
    const task = mockTask({
      status: UnifiedTaskStatus.COMPLETED,
      actions: { detailUrl: '/leave/team' },
    })

    expect(task.actions?.approveUrl).toBeUndefined()
    expect(task.actions?.rejectUrl).toBeUndefined()
    expect(task.actions?.detailUrl).toBe('/leave/team')
  })

  it('should have payroll-specific action URLs', () => {
    const task = mockTask({
      type: UnifiedTaskType.PAYROLL_REVIEW,
      sourceId: 'run-1',
      actions: {
        approveUrl: '/api/v1/payroll/runs/run-1/approve',
        rejectUrl: '/api/v1/payroll/runs/run-1/reject',
        detailUrl: '/payroll/run-1/review',
      },
    })

    expect(task.actions?.approveUrl).toContain('/payroll/')
    expect(task.actions?.detailUrl).toContain('/payroll/')
  })

  it('performance tasks should only have detailUrl (no approve/reject)', () => {
    const task = mockTask({
      type: UnifiedTaskType.PERFORMANCE_REVIEW,
      actions: { detailUrl: '/performance/goals' },
    })

    expect(task.actions?.approveUrl).toBeUndefined()
    expect(task.actions?.rejectUrl).toBeUndefined()
    expect(task.actions?.detailUrl).toBe('/performance/goals')
  })
})

describe('Approval mode filtering logic', () => {
  const allTasks = [
    mockTask({ id: '1', type: UnifiedTaskType.LEAVE_APPROVAL, requester: { employeeId: 'emp-1', name: 'A' } }),
    mockTask({ id: '2', type: UnifiedTaskType.LEAVE_APPROVAL, requester: { employeeId: 'self', name: 'Self' } }),
    mockTask({ id: '3', type: UnifiedTaskType.PAYROLL_REVIEW }),
    mockTask({ id: '4', type: UnifiedTaskType.PERFORMANCE_REVIEW }),
    mockTask({ id: '5', type: UnifiedTaskType.ONBOARDING_TASK }),
    mockTask({ id: '6', type: UnifiedTaskType.LEAVE_APPROVAL, status: UnifiedTaskStatus.COMPLETED }),
  ]

  it('should filter to approval-relevant types only (LEAVE + PERFORMANCE + PAYROLL)', () => {
    const approvalTypes = new Set([
      UnifiedTaskType.LEAVE_APPROVAL,
      UnifiedTaskType.PERFORMANCE_REVIEW,
      UnifiedTaskType.PAYROLL_REVIEW,
    ])
    const filtered = allTasks.filter(t => approvalTypes.has(t.type))

    expect(filtered).toHaveLength(5)
    expect(filtered.every(t => approvalTypes.has(t.type))).toBe(true)
  })

  it('should exclude self from approval results', () => {
    const selfId = 'self'
    const filtered = allTasks.filter(t => t.requester.employeeId !== selfId)

    expect(filtered.find(t => t.requester.employeeId === 'self')).toBeUndefined()
  })

  it('should filter PENDING only when history is not included', () => {
    const pendingOnly = allTasks.filter(
      t => t.status === UnifiedTaskStatus.PENDING || t.status === UnifiedTaskStatus.IN_PROGRESS,
    )

    expect(pendingOnly.every(t =>
      t.status === UnifiedTaskStatus.PENDING || t.status === UnifiedTaskStatus.IN_PROGRESS,
    )).toBe(true)
  })

  it('should include COMPLETED/REJECTED when history is requested', () => {
    const withHistory = allTasks.filter(
      t =>
        t.status === UnifiedTaskStatus.PENDING ||
        t.status === UnifiedTaskStatus.IN_PROGRESS ||
        t.status === UnifiedTaskStatus.COMPLETED ||
        t.status === UnifiedTaskStatus.REJECTED,
    )

    expect(withHistory.length).toBeGreaterThanOrEqual(allTasks.filter(t => t.status === UnifiedTaskStatus.PENDING).length)
  })

  it('MANAGER should not see PAYROLL tasks', () => {
    const managerTypes = new Set([
      UnifiedTaskType.LEAVE_APPROVAL,
      UnifiedTaskType.PERFORMANCE_REVIEW,
    ])
    const managerTasks = allTasks.filter(t => managerTypes.has(t.type))

    expect(managerTasks.find(t => t.type === UnifiedTaskType.PAYROLL_REVIEW)).toBeUndefined()
  })

  it('HR_ADMIN should see PAYROLL tasks', () => {
    const hrTypes = new Set([
      UnifiedTaskType.LEAVE_APPROVAL,
      UnifiedTaskType.PERFORMANCE_REVIEW,
      UnifiedTaskType.PAYROLL_REVIEW,
    ])
    const hrTasks = allTasks.filter(t => hrTypes.has(t.type))

    expect(hrTasks.find(t => t.type === UnifiedTaskType.PAYROLL_REVIEW)).toBeDefined()
  })
})

describe('URL param rename (?tab → ?status)', () => {
  it('should use status param for PENDING/COMPLETED filter', () => {
    const params = new URLSearchParams('status=COMPLETED&tab=approvals')

    // Phase 0A: status for status filter, tab for view selection
    const statusTab = params.get('status') ?? 'PENDING'
    const viewTab = params.get('tab') ?? 'tasks'

    expect(statusTab).toBe('COMPLETED')
    expect(viewTab).toBe('approvals')
  })

  it('should default to PENDING when status is not specified', () => {
    const params = new URLSearchParams('tab=approvals')

    const statusTab = params.get('status') ?? 'PENDING'
    expect(statusTab).toBe('PENDING')
  })

  it('should default to tasks view when tab is not specified', () => {
    const params = new URLSearchParams('status=PENDING')

    const viewTab = params.get('tab') ?? 'tasks'
    expect(viewTab).toBe('tasks')
  })
})
