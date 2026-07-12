// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GDPR enum 표시 라벨 (백엔드 zod enum 과 1:1)
// 백엔드 계약: src/lib/schemas/compliance.ts (retention category 9 · consent purpose 8)
// i18n 키 정리는 별도 P2 — 우선 humanized 영문 라벨 (Codex G1 합의)
// ═══════════════════════════════════════════════════════════

export const RETENTION_CATEGORIES = [
  'EMPLOYMENT_RECORDS', 'PAYROLL_DATA', 'PERFORMANCE_DATA', 'TRAINING_RECORDS',
  'RECRUITMENT_DATA', 'HEALTH_SAFETY', 'DISCIPLINARY_RECORDS', 'LEAVE_RECORDS', 'AUDIT_LOGS',
] as const

export const RETENTION_CATEGORY_LABELS: Record<string, string> = {
  EMPLOYMENT_RECORDS: 'Employment Records',
  PAYROLL_DATA: 'Payroll Data',
  PERFORMANCE_DATA: 'Performance Data',
  TRAINING_RECORDS: 'Training Records',
  RECRUITMENT_DATA: 'Recruitment Data',
  HEALTH_SAFETY: 'Health & Safety',
  DISCIPLINARY_RECORDS: 'Disciplinary Records',
  LEAVE_RECORDS: 'Leave Records',
  AUDIT_LOGS: 'Audit Logs',
}

export const CONSENT_PURPOSES = [
  'EMPLOYMENT_PROCESSING', 'PAYROLL_PROCESSING', 'BENEFITS_ADMINISTRATION',
  'PERFORMANCE_MANAGEMENT', 'TRAINING_RECORDS', 'HEALTH_SAFETY',
  'MARKETING_COMMUNICATION', 'THIRD_PARTY_TRANSFER',
] as const

export const CONSENT_PURPOSE_LABELS: Record<string, string> = {
  EMPLOYMENT_PROCESSING: 'Employment Processing',
  PAYROLL_PROCESSING: 'Payroll Processing',
  BENEFITS_ADMINISTRATION: 'Benefits Administration',
  PERFORMANCE_MANAGEMENT: 'Performance Management',
  TRAINING_RECORDS: 'Training Records',
  HEALTH_SAFETY: 'Health & Safety',
  MARKETING_COMMUNICATION: 'Marketing Communication',
  THIRD_PARTY_TRANSFER: 'Third-party Transfer',
}

/** API 에러 응답에서 사용자 표시용 메시지 추출 */
export async function readApiError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
  return body?.error?.message ?? fallback
}
