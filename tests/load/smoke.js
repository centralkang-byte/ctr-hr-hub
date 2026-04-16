import http from 'k6/http'
import { check, sleep } from 'k6'
import { login, setSession } from './helpers/auth.js'
import { BASE_URL, ACCOUNTS, PATHS, THRESHOLDS } from './helpers/config.js'

/**
 * Smoke test — 1 VU, 30s
 * Validates all critical paths return 200 with a single user.
 */
export const options = {
  vus: 1,
  duration: '30s',
  thresholds: THRESHOLDS,
}

export function setup() {
  const isSecure = BASE_URL.startsWith('https')
  const token = login(BASE_URL, ACCOUNTS.HR_ADMIN)
  if (!token) throw new Error('Setup login failed')
  return { baseUrl: BASE_URL, token, isSecure }
}

export default function (data) {
  const { baseUrl, token, isSecure } = data
  setSession(baseUrl, token, isSecure)

  // Health check (no auth required)
  const health = http.get(`${baseUrl}${PATHS.HEALTH}`)
  check(health, { 'health 200': (r) => r.status === 200 })

  // Dashboard
  const summary = http.get(`${baseUrl}${PATHS.HOME_SUMMARY}`)
  check(summary, { 'home/summary 200': (r) => r.status === 200 })
  sleep(1)

  const pending = http.get(`${baseUrl}${PATHS.PENDING_ACTIONS}`)
  check(pending, { 'pending-actions 200': (r) => r.status === 200 })
  sleep(1)

  // Employee list
  const employees = http.get(`${baseUrl}${PATHS.EMPLOYEES}`)
  check(employees, { 'employees 200': (r) => r.status === 200 })
  sleep(1)

  // Attendance admin
  const attendance = http.get(`${baseUrl}${PATHS.ATTENDANCE_ADMIN}`)
  check(attendance, { 'attendance/admin 200': (r) => r.status === 200 })
  sleep(1)

  // Analytics
  const analytics = http.get(`${baseUrl}${PATHS.ANALYTICS_ATTENDANCE}`)
  check(analytics, { 'analytics/attendance 200': (r) => r.status === 200 })
  sleep(1)

  // Org tree
  const orgTree = http.get(`${baseUrl}${PATHS.ORG_TREE}`)
  check(orgTree, { 'org/tree 200': (r) => r.status === 200 })
  sleep(1)
}
