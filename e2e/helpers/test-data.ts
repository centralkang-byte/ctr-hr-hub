// ═══════════════════════════════════════════════════════════
// CTR HR Hub — E2E Test Data Helpers
// Unique prefixes + test account mapping for data isolation
// ═══════════════════════════════════════════════════════════

/**
 * Generate a unique prefix for test data to avoid collisions.
 */
export function uniquePrefix(specName: string) {
  return `e2e-${specName}-${Date.now()}`
}

/**
 * QA test accounts from seed data.
 * Must match prisma/seed.ts and CLAUDE.md QA accounts.
 */
export const TEST_ACCOUNTS = {
  SUPER_ADMIN: {
    email: 'super@ctr.co.kr',
    name: '최상우',
    company: 'CTR-HOLD',
  },
  HR_ADMIN: {
    email: 'hr@ctr.co.kr',
    name: '한지영',
    company: 'CTR',
  },
  HR_ADMIN_CN: {
    email: 'hr@ctr-cn.com',
    name: '陈美玲',
    company: 'CTR-CN',
  },
  MANAGER: {
    email: 'manager@ctr.co.kr',
    name: '박준혁',
    company: 'CTR',
  },
  MANAGER2: {
    email: 'manager2@ctr.co.kr',
    name: '김서연',
    company: 'CTR',
  },
  EMPLOYEE_A: {
    email: 'employee-a@ctr.co.kr',
    name: '이민준',
    company: 'CTR',
  },
  EMPLOYEE_B: {
    email: 'employee-b@ctr.co.kr',
    name: '정다은',
    company: 'CTR',
  },
  EMPLOYEE_C: {
    email: 'employee-c@ctr.co.kr',
    name: '송현우',
    company: 'CTR',
  },
} as const
