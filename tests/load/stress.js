import http from 'k6/http'
import { check, sleep } from 'k6'
import { login, setSession } from './helpers/auth.js'
import { BASE_URL, ACCOUNTS, PATHS } from './helpers/config.js'

/**
 * Stress test — 30 VU, 5min ramp
 * Pushes beyond target to find breaking point. Thresholds relaxed.
 *
 * Logs in once per role in setup() to avoid auth rate limits.
 */
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // warm up
    { duration: '1m', target: 20 },   // push
    { duration: '1m', target: 30 },   // stress
    { duration: '1m', target: 30 },   // sustain peak
    { duration: '1m30s', target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000', 'p(99)<10000'], // relaxed
    http_req_failed: ['rate<0.05'],                    // 5% error budget
  },
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

function getRole(vuId) {
  const mod = vuId % 20
  if (mod < 12) return 'HR_ADMIN'
  if (mod < 17) return 'MANAGER'
  return 'EMPLOYEE'
}

export default function (data) {
  const { baseUrl, tokens, isSecure } = data
  const role = getRole(__VU)
  setSession(baseUrl, tokens[role], isSecure)

  // Dashboard (all roles)
  const summary = http.get(`${baseUrl}${PATHS.HOME_SUMMARY}`)
  check(summary, { 'home/summary 200': (r) => r.status === 200 })
  sleep(Math.random() * 2 + 1)

  const pending = http.get(`${baseUrl}${PATHS.PENDING_ACTIONS}`)
  check(pending, { 'pending-actions 200': (r) => r.status === 200 })
  sleep(Math.random() + 0.5)

  // HR_ADMIN heavy path
  if (role === 'HR_ADMIN') {
    const employees = http.get(`${baseUrl}${PATHS.EMPLOYEES}`)
    check(employees, { 'employees 200': (r) => r.status === 200 })
    sleep(Math.random() + 0.5)

    const attendance = http.get(`${baseUrl}${PATHS.ATTENDANCE_ADMIN}`)
    check(attendance, { 'attendance/admin 200': (r) => r.status === 200 })
    sleep(Math.random() + 0.5)

    const analytics = http.get(`${baseUrl}${PATHS.ANALYTICS_ATTENDANCE}`)
    check(analytics, { 'analytics/attendance 200': (r) => r.status === 200 })
    sleep(Math.random() + 0.5)
  }

  // Org tree
  if (role !== 'EMPLOYEE') {
    const orgTree = http.get(`${baseUrl}${PATHS.ORG_TREE}`)
    check(orgTree, { 'org/tree 200': (r) => r.status === 200 })
    sleep(Math.random() + 0.5)
  }
}
