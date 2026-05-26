import { describe, it, expect } from 'vitest'
import {
  stepIndicatorState,
  nextButtonRole,
  isPrimaryDisabled,
  progressText,
} from '@/components/shared/WizardShell.helpers'

// ─── stepIndicatorState ─────────────────────────────────────

describe('stepIndicatorState', () => {
  it('returns "done" when stepIndex < currentStep', () => {
    expect(stepIndicatorState(0, 2)).toBe('done')
    expect(stepIndicatorState(1, 2)).toBe('done')
  })

  it('returns "current" when stepIndex === currentStep', () => {
    expect(stepIndicatorState(0, 0)).toBe('current')
    expect(stepIndicatorState(3, 3)).toBe('current')
  })

  it('returns "upcoming" when stepIndex > currentStep', () => {
    expect(stepIndicatorState(2, 1)).toBe('upcoming')
    expect(stepIndicatorState(5, 0)).toBe('upcoming')
  })

  it('handles first step boundary (idx=0, current=0)', () => {
    expect(stepIndicatorState(0, 0)).toBe('current')
  })

  it('handles last step boundary (idx=N-1, current=N-1)', () => {
    expect(stepIndicatorState(5, 5)).toBe('current')
  })

  it('handles negative stepIndex defensively (treated as < current)', () => {
    expect(stepIndicatorState(-1, 0)).toBe('done')
  })

  it('handles large stepIndex (treated as > current)', () => {
    expect(stepIndicatorState(100, 2)).toBe('upcoming')
  })

  it('handles currentStep beyond steps length (all become done)', () => {
    expect(stepIndicatorState(0, 10)).toBe('done')
    expect(stepIndicatorState(5, 10)).toBe('done')
  })
})

// ─── nextButtonRole ─────────────────────────────────────────

describe('nextButtonRole', () => {
  it('returns "next" when not on last step', () => {
    expect(nextButtonRole(0, 6)).toBe('next')
    expect(nextButtonRole(3, 6)).toBe('next')
    expect(nextButtonRole(4, 6)).toBe('next')
  })

  it('returns "submit" on last step (currentStep === totalSteps - 1)', () => {
    expect(nextButtonRole(5, 6)).toBe('submit')
    expect(nextButtonRole(0, 1)).toBe('submit')
  })

  it('returns "submit" when currentStep beyond totalSteps - 1', () => {
    expect(nextButtonRole(10, 6)).toBe('submit')
  })

  it('handles single-step wizard (currentStep=0, totalSteps=1)', () => {
    expect(nextButtonRole(0, 1)).toBe('submit')
  })

  it('handles 2-step wizard transitions', () => {
    expect(nextButtonRole(0, 2)).toBe('next')
    expect(nextButtonRole(1, 2)).toBe('submit')
  })

  it('handles 6-step wizard (proto ONBOARD_STEPS 정합)', () => {
    expect(nextButtonRole(0, 6)).toBe('next')
    expect(nextButtonRole(5, 6)).toBe('submit')
  })
})

// ─── isPrimaryDisabled ──────────────────────────────────────

describe('isPrimaryDisabled', () => {
  it('returns false when canProceed is undefined (default true)', () => {
    expect(isPrimaryDisabled(undefined)).toBe(false)
  })

  it('returns false when canProceed is true', () => {
    expect(isPrimaryDisabled(true)).toBe(false)
  })

  it('returns true when canProceed is false', () => {
    expect(isPrimaryDisabled(false)).toBe(true)
  })

  it('does not coerce truthy/falsy beyond strict false (defensive)', () => {
    // 0, '', null are not strictly === false
    expect(isPrimaryDisabled(undefined)).toBe(false)
  })
})

// ─── progressText ───────────────────────────────────────────

describe('progressText', () => {
  it('formats 0-indexed currentStep to 1-indexed display', () => {
    expect(progressText(0, 6)).toBe('1 / 6')
    expect(progressText(2, 6)).toBe('3 / 6')
  })

  it('formats last step correctly', () => {
    expect(progressText(5, 6)).toBe('6 / 6')
  })

  it('formats single-step wizard', () => {
    expect(progressText(0, 1)).toBe('1 / 1')
  })

  it('formats 2-step wizard', () => {
    expect(progressText(0, 2)).toBe('1 / 2')
    expect(progressText(1, 2)).toBe('2 / 2')
  })

  it('handles large step counts', () => {
    expect(progressText(99, 100)).toBe('100 / 100')
  })

  it('returns locale-free ratio (caller appends i18n step label)', () => {
    const result = progressText(0, 6)
    expect(result).toBe('1 / 6')
    expect(result).not.toContain('단계')
    expect(result).not.toContain('step')
  })
})
