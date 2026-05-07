import { describe, it, expect } from 'vitest'
import { canApproveRequisition } from '@/lib/approval/can-approve-requisition'

// ─── Test fixtures ──────────────────────────────────────────

const HR_ADMIN_STEP = { approverRole: 'hr_admin' }
const DEPT_HEAD_STEP = { approverRole: 'dept_head' }
const DIRECT_MANAGER_STEP = { approverRole: 'direct_manager' }
const CEO_STEP = { approverRole: 'ceo' }
const FINANCE_STEP = { approverRole: 'finance' }

// ─── Tests ──────────────────────────────────────────────────

describe('canApproveRequisition (UI button visibility SSOT)', () => {
  // ── Status / currentRecord short-circuits ────────────────

  it('returns false when status is not pending (approved)', () => {
    expect(
      canApproveRequisition({
        role: 'SUPER_ADMIN',
        status: 'approved',
        currentRecord: HR_ADMIN_STEP,
        passesServerApproverGate: true,
      }),
    ).toBe(false)
  })

  it('returns false when status is rejected', () => {
    expect(
      canApproveRequisition({
        role: 'HR_ADMIN',
        status: 'rejected',
        currentRecord: HR_ADMIN_STEP,
        passesServerApproverGate: true,
      }),
    ).toBe(false)
  })

  it('returns false when status is draft', () => {
    expect(
      canApproveRequisition({
        role: 'HR_ADMIN',
        status: 'draft',
        currentRecord: HR_ADMIN_STEP,
        passesServerApproverGate: true,
      }),
    ).toBe(false)
  })

  it('returns false when currentRecord is undefined (no pending step)', () => {
    expect(
      canApproveRequisition({
        role: 'SUPER_ADMIN',
        status: 'pending',
        currentRecord: undefined,
        passesServerApproverGate: true,
      }),
    ).toBe(false)
  })

  // ── SUPER_ADMIN: all steps allowed ───────────────────────

  it('SUPER_ADMIN can approve hr_admin step', () => {
    expect(
      canApproveRequisition({
        role: 'SUPER_ADMIN',
        status: 'pending',
        currentRecord: HR_ADMIN_STEP,
        passesServerApproverGate: false,
      }),
    ).toBe(true)
  })

  it('SUPER_ADMIN can approve dept_head step (regardless of gate)', () => {
    expect(
      canApproveRequisition({
        role: 'SUPER_ADMIN',
        status: 'pending',
        currentRecord: DEPT_HEAD_STEP,
        passesServerApproverGate: false,
      }),
    ).toBe(true)
  })

  it('SUPER_ADMIN can approve direct_manager step', () => {
    expect(
      canApproveRequisition({
        role: 'SUPER_ADMIN',
        status: 'pending',
        currentRecord: DIRECT_MANAGER_STEP,
        passesServerApproverGate: false,
      }),
    ).toBe(true)
  })

  it('SUPER_ADMIN can approve ceo / finance steps', () => {
    expect(
      canApproveRequisition({
        role: 'SUPER_ADMIN',
        status: 'pending',
        currentRecord: CEO_STEP,
        passesServerApproverGate: false,
      }),
    ).toBe(true)
    expect(
      canApproveRequisition({
        role: 'SUPER_ADMIN',
        status: 'pending',
        currentRecord: FINANCE_STEP,
        passesServerApproverGate: false,
      }),
    ).toBe(true)
  })

  // ── HR_ADMIN: hr_admin step only ─────────────────────────

  it('HR_ADMIN can approve hr_admin step (without server gate)', () => {
    expect(
      canApproveRequisition({
        role: 'HR_ADMIN',
        status: 'pending',
        currentRecord: HR_ADMIN_STEP,
        passesServerApproverGate: false,
      }),
    ).toBe(true)
  })

  it('HR_ADMIN cannot approve dept_head step (UX 회귀 차단 — server per-step check 정합)', () => {
    expect(
      canApproveRequisition({
        role: 'HR_ADMIN',
        status: 'pending',
        currentRecord: DEPT_HEAD_STEP,
        passesServerApproverGate: false,
      }),
    ).toBe(false)
  })

  it('HR_ADMIN cannot approve direct_manager step', () => {
    expect(
      canApproveRequisition({
        role: 'HR_ADMIN',
        status: 'pending',
        currentRecord: DIRECT_MANAGER_STEP,
        passesServerApproverGate: false,
      }),
    ).toBe(false)
  })

  it('HR_ADMIN cannot approve ceo / finance steps without server gate', () => {
    expect(
      canApproveRequisition({
        role: 'HR_ADMIN',
        status: 'pending',
        currentRecord: CEO_STEP,
        passesServerApproverGate: false,
      }),
    ).toBe(false)
    expect(
      canApproveRequisition({
        role: 'HR_ADMIN',
        status: 'pending',
        currentRecord: FINANCE_STEP,
        passesServerApproverGate: false,
      }),
    ).toBe(false)
  })

  // ── HR_ADMIN with server-verified gate (e.g., 'my' 탭에서 hr_admin 외 step
  //    노출 시) — 시나리오상 발생하지 않지만 helper 안전성 확인 ─────

  it('HR_ADMIN with server-verified gate falls through to gate (not hr_admin step)', () => {
    // 'my' 탭에서 HR_ADMIN이 dept_head step 항목을 받는 상황은 myApprovals 필터로 발생 불가하지만,
    // helper 안전성: passesServerApproverGate가 true면 노출 (server가 검증했음을 신뢰).
    expect(
      canApproveRequisition({
        role: 'HR_ADMIN',
        status: 'pending',
        currentRecord: DEPT_HEAD_STEP,
        passesServerApproverGate: true,
      }),
    ).toBe(true)
  })

  // ── EMPLOYEE / MANAGER / EXECUTIVE: server gate에 일임 ─────

  it('EMPLOYEE with passesServerApproverGate=true can approve (dept_head EMPLOYEE)', () => {
    expect(
      canApproveRequisition({
        role: 'EMPLOYEE',
        status: 'pending',
        currentRecord: DEPT_HEAD_STEP,
        passesServerApproverGate: true,
      }),
    ).toBe(true)
  })

  it('EMPLOYEE without server gate cannot approve', () => {
    expect(
      canApproveRequisition({
        role: 'EMPLOYEE',
        status: 'pending',
        currentRecord: DEPT_HEAD_STEP,
        passesServerApproverGate: false,
      }),
    ).toBe(false)
  })

  it('MANAGER with passesServerApproverGate=true can approve (direct_manager / dept_head MANAGER)', () => {
    expect(
      canApproveRequisition({
        role: 'MANAGER',
        status: 'pending',
        currentRecord: DIRECT_MANAGER_STEP,
        passesServerApproverGate: true,
      }),
    ).toBe(true)
    expect(
      canApproveRequisition({
        role: 'MANAGER',
        status: 'pending',
        currentRecord: DEPT_HEAD_STEP,
        passesServerApproverGate: true,
      }),
    ).toBe(true)
  })

  it('MANAGER without server gate cannot approve any step', () => {
    expect(
      canApproveRequisition({
        role: 'MANAGER',
        status: 'pending',
        currentRecord: DIRECT_MANAGER_STEP,
        passesServerApproverGate: false,
      }),
    ).toBe(false)
    expect(
      canApproveRequisition({
        role: 'MANAGER',
        status: 'pending',
        currentRecord: HR_ADMIN_STEP,
        passesServerApproverGate: false,
      }),
    ).toBe(false)
  })

  it('EXECUTIVE with passesServerApproverGate=true can approve (ceo step)', () => {
    expect(
      canApproveRequisition({
        role: 'EXECUTIVE',
        status: 'pending',
        currentRecord: CEO_STEP,
        passesServerApproverGate: true,
      }),
    ).toBe(true)
  })

  it('EXECUTIVE without server gate cannot approve', () => {
    expect(
      canApproveRequisition({
        role: 'EXECUTIVE',
        status: 'pending',
        currentRecord: CEO_STEP,
        passesServerApproverGate: false,
      }),
    ).toBe(false)
  })
})
