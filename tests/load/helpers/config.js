// Base URL: Vercel staging deployment or local dev
export const BASE_URL = __ENV.LOAD_TEST_BASE_URL || 'http://localhost:3002'

// Test accounts (from CLAUDE.md QA accounts)
export const ACCOUNTS = {
  SUPER_ADMIN: 'super@ctr.co.kr',
  HR_ADMIN: 'hr@ctr.co.kr',
  MANAGER: 'manager@ctr.co.kr',
  EMPLOYEE_A: 'employee-a@ctr.co.kr',
  EMPLOYEE_B: 'employee-b@ctr.co.kr',
}

// Critical API paths to test
export const PATHS = {
  HOME_SUMMARY: '/api/v1/home/summary',
  PENDING_ACTIONS: '/api/v1/home/pending-actions',
  EMPLOYEES: '/api/v1/employees?page=1&size=20',
  ATTENDANCE_ADMIN: '/api/v1/attendance/admin',
  ANALYTICS_ATTENDANCE: '/api/v1/analytics/attendance',
  ORG_TREE: '/api/v1/org/tree',
  HEALTH: '/api/v1/monitoring/health',
}

// Thresholds aligned with master plan targets
export const THRESHOLDS = {
  http_req_duration: ['p(95)<2000', 'p(99)<5000'],
  http_req_failed: ['rate<0.01'],
}
