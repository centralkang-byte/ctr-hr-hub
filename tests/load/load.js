import http from 'k6/http'
import { check, sleep } from 'k6'
import { login, setSession } from './helpers/auth.js'
import { BASE_URL, ACCOUNTS, PATHS, THRESHOLDS } from './helpers/config.js'

/**
 * Load test — 10 VU, 3min ramp
 * Master plan target: 10 concurrent users, p95 < 2s.
 *
 * Logs in once per role in setup() to avoid auth rate limits (10 req/min).
 */
export const options = {
  stages: [
    { duration: '30s', target: 5 },   // ramp up
    { duration: '1m30s', target: 10 }, // hold at 10 VU
    { duration: '30s', target: 10 },   // sustain
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: THRESHOLDS,
}

export function setup() {
  const isSecure = BASE_URL.startsWith('https')
  const tokens = {
    HR_ADMIN: login(BASE_URL, ACCOUNTS.HR_ADMIN),
    MANAGER: login(BASE_URL, ACCOUNTS.MANAGER),
    EMPLOYEE: login(BASE_URL, ACCOUNTS.EMPLOYEE_A),
  }
  for (const [role, token] of Object.entries(tokens)) {
    if (!token) throw new Error(`Setup login failed for ${role}`)
  }
  return { baseUrl: BASE_URL, tokens, isSecure }
}

// Assign role per VU: 60% HR_ADMIN, 25% MANAGER, 15% EMPLOYEE
function getRole(vuId) {
  const mod = vuId % 20
  if (mod < 12) return 'HR_ADMIN'   // 60%
  if (mod < 17) return 'MANAGER'    // 25%
  return 'EMPLOYEE'                  // 15%
}

export default function (data) {
  const { baseUrl, tokens, isSecure } = data
  const role = getRole(__VU)
  setSession(baseUrl, tokens[role], isSecure)

  // All roles: dashboard
  const summary = http.get(`${baseUrl}${PATHS.HOME_SUMMARY}`)
  check(summary, { 'home/summary 200': (r) => r.status === 200 })
  sleep(Math.random() * 2 + 1) // 1-3s think time

  const pending = http.get(`${baseUrl}${PATHS.PENDING_ACTIONS}`)
  check(pending, { 'pending-actions 200': (r) => r.status === 200 })
  sleep(Math.random() * 2 + 1)

  // HR_ADMIN specific
  if (role === 'HR_ADMIN') {
    const employees = http.get(`${baseUrl}${PATHS.EMPLOYEES}`)
    check(employees, { 'employees 200': (r) => r.status === 200 })
    sleep(Math.random() * 2 + 1)

    const attendance = http.get(`${baseUrl}${PATHS.ATTENDANCE_ADMIN}`)
    check(attendance, { 'attendance/admin 200': (r) => r.status === 200 })
    sleep(Math.random() * 2 + 1)

    const analytics = http.get(`${baseUrl}${PATHS.ANALYTICS_ATTENDANCE}`)
    check(analytics, { 'analytics/attendance 200': (r) => r.status === 200 })
    sleep(Math.random() * 2 + 1)
  }

  // MANAGER + HR_ADMIN: org tree
  if (role === 'HR_ADMIN' || role === 'MANAGER') {
    const orgTree = http.get(`${baseUrl}${PATHS.ORG_TREE}`)
    check(orgTree, { 'org/tree 200': (r) => r.status === 200 })
    sleep(Math.random() * 2 + 1)
  }
}
