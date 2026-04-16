// ═══════════════════════════════════════════════════════════
// Unit Tests — Task Status State Machine
// src/lib/shared/task-state-machine.ts (PROTECTED — tests only)
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  validateTaskTransition,
  canSkip,
  requiresBlockedReason,
  isNudgeEligible,
  isTerminalStatus,
} from '@/lib/shared/task-state-machine'

// ─── validateTaskTransition ─────────────────────────────────

describe('validateTaskTransition', () => {
  // Valid transitions
  it('should allow PENDING → IN_PROGRESS', () => {
    const result = validateTaskTransition({
      currentStatus: 'PENDING', targetStatus: 'IN_PROGRESS', isRequired: true,
    })
    expect(result).toEqual({ allowed: true })
  })

  it('should allow PENDING → BLOCKED with reason', () => {
    const result = validateTaskTransition({
      currentStatus: 'PENDING', targetStatus: 'BLOCKED', isRequired: true,
      blockedReason: 'Waiting on IT',
    })
    expect(result).toEqual({ allowed: true })
  })

  it('should allow PENDING → SKIPPED for non-required task', () => {
    const result = validateTaskTransition({
      currentStatus: 'PENDING', targetStatus: 'SKIPPED', isRequired: false,
    })
    expect(result).toEqual({ allowed: true })
  })

  it('should allow IN_PROGRESS → DONE', () => {
    const result = validateTaskTransition({
      currentStatus: 'IN_PROGRESS', targetStatus: 'DONE', isRequired: true,
    })
    expect(result).toEqual({ allowed: true })
  })

  it('should allow IN_PROGRESS → BLOCKED with reason', () => {
    const result = validateTaskTransition({
      currentStatus: 'IN_PROGRESS', targetStatus: 'BLOCKED', isRequired: true,
      blockedReason: 'Dependency not met',
    })
    expect(result).toEqual({ allowed: true })
  })

  it('should allow BLOCKED → PENDING (unblock)', () => {
    const result = validateTaskTransition({
      currentStatus: 'BLOCKED', targetStatus: 'PENDING', isRequired: true,
    })
    expect(result).toEqual({ allowed: true })
  })

  it('should allow BLOCKED → IN_PROGRESS (unblock + resume)', () => {
    const result = validateTaskTransition({
      currentStatus: 'BLOCKED', targetStatus: 'IN_PROGRESS', isRequired: true,
    })
    expect(result).toEqual({ allowed: true })
  })

  // Rejection: BLOCKED reason required
  it('should reject PENDING → BLOCKED without reason', () => {
    const result = validateTaskTransition({
      currentStatus: 'PENDING', targetStatus: 'BLOCKED', isRequired: true,
    })
    expect(result.allowed).toBe(false)
    expect(result.error).toContain('blockedReason')
  })

  it('should reject BLOCKED with whitespace-only reason', () => {
    const result = validateTaskTransition({
      currentStatus: 'PENDING', targetStatus: 'BLOCKED', isRequired: true,
      blockedReason: '   ',
    })
    expect(result.allowed).toBe(false)
  })

  // Rejection: SKIPPED + required
  it('should reject PENDING → SKIPPED for required task', () => {
    const result = validateTaskTransition({
      currentStatus: 'PENDING', targetStatus: 'SKIPPED', isRequired: true,
    })
    expect(result.allowed).toBe(false)
    expect(result.error).toContain('Required')
  })

  // Rejection: invalid transitions
  it('should reject PENDING → DONE (not in transition map)', () => {
    const result = validateTaskTransition({
      currentStatus: 'PENDING', targetStatus: 'DONE', isRequired: true,
    })
    expect(result.allowed).toBe(false)
  })

  it('should reject IN_PROGRESS → PENDING (not allowed)', () => {
    const result = validateTaskTransition({
      currentStatus: 'IN_PROGRESS', targetStatus: 'PENDING', isRequired: true,
    })
    expect(result.allowed).toBe(false)
  })

  // Terminal states
  it('should reject any transition from DONE', () => {
    const result = validateTaskTransition({
      currentStatus: 'DONE', targetStatus: 'PENDING', isRequired: true,
    })
    expect(result.allowed).toBe(false)
    expect(result.error).toContain('DONE')
    expect(result.error).toContain('terminal')
  })

  it('should reject any transition from SKIPPED', () => {
    const result = validateTaskTransition({
      currentStatus: 'SKIPPED', targetStatus: 'PENDING', isRequired: false,
    })
    expect(result.allowed).toBe(false)
    expect(result.error).toContain('SKIPPED')
  })

  // Self-transition (Codex recommendation)
  it('should reject self-transition PENDING → PENDING', () => {
    const result = validateTaskTransition({
      currentStatus: 'PENDING', targetStatus: 'PENDING', isRequired: true,
    })
    expect(result.allowed).toBe(false)
  })

  // Codex: illegal jump BLOCKED → DONE
  it('should reject BLOCKED → DONE (not in transition map)', () => {
    const result = validateTaskTransition({
      currentStatus: 'BLOCKED', targetStatus: 'DONE', isRequired: true,
    })
    expect(result.allowed).toBe(false)
  })
})

// ─── canSkip ────────────────────────────────────────────────

describe('canSkip', () => {
  it('should return false for required tasks', () => {
    expect(canSkip(true)).toBe(false)
  })

  it('should return true for non-required tasks', () => {
    expect(canSkip(false)).toBe(true)
  })
})

// ─── requiresBlockedReason ──────────────────────────────────

describe('requiresBlockedReason', () => {
  it('should return true for BLOCKED status', () => {
    expect(requiresBlockedReason('BLOCKED')).toBe(true)
  })

  it('should return false for non-BLOCKED statuses', () => {
    expect(requiresBlockedReason('PENDING')).toBe(false)
    expect(requiresBlockedReason('IN_PROGRESS')).toBe(false)
    expect(requiresBlockedReason('DONE')).toBe(false)
    expect(requiresBlockedReason('SKIPPED')).toBe(false)
  })
})

// ─── isNudgeEligible ────────────────────────────────────────

describe('isNudgeEligible', () => {
  it('should return true for PENDING', () => {
    expect(isNudgeEligible('PENDING')).toBe(true)
  })

  it('should return true for IN_PROGRESS', () => {
    expect(isNudgeEligible('IN_PROGRESS')).toBe(true)
  })

  it('should return false for BLOCKED, DONE, SKIPPED', () => {
    expect(isNudgeEligible('BLOCKED')).toBe(false)
    expect(isNudgeEligible('DONE')).toBe(false)
    expect(isNudgeEligible('SKIPPED')).toBe(false)
  })
})

// ─── isTerminalStatus ───────────────────────────────────────

describe('isTerminalStatus', () => {
  it('should return true for DONE and SKIPPED', () => {
    expect(isTerminalStatus('DONE')).toBe(true)
    expect(isTerminalStatus('SKIPPED')).toBe(true)
  })

  it('should return false for PENDING, IN_PROGRESS, BLOCKED', () => {
    expect(isTerminalStatus('PENDING')).toBe(false)
    expect(isTerminalStatus('IN_PROGRESS')).toBe(false)
    expect(isTerminalStatus('BLOCKED')).toBe(false)
  })
})
