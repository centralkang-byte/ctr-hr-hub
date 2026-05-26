// Pure helpers for WizardShell — vitest 검증 대상 (N+43 패턴 정합)
// React/JSX 회피로 `.ts` 분리 (vitest config: environment 'node' + .ts only)

export type StepIndicatorState = 'done' | 'current' | 'upcoming'

export function stepIndicatorState(
  stepIndex: number,
  currentStep: number,
): StepIndicatorState {
  if (stepIndex < currentStep) return 'done'
  if (stepIndex === currentStep) return 'current'
  return 'upcoming'
}

export function nextButtonRole(
  currentStep: number,
  totalSteps: number,
): 'next' | 'submit' {
  return currentStep >= totalSteps - 1 ? 'submit' : 'next'
}

export function isPrimaryDisabled(canProceed?: boolean): boolean {
  return canProceed === false
}

// Locale-free ratio. Caller (WizardShell.tsx) appends i18n step label.
export function progressText(currentStep: number, totalSteps: number): string {
  return `${currentStep + 1} / ${totalSteps}`
}
