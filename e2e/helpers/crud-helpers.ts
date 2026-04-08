// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Thin CRUD / RBAC Test Generators
// Reusable across all API modules. Business semantics stay
// in module-specific spec files.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { parseApiResponse, assertError } from './api-client'
import { authFile } from './auth'
import type { RoleType } from './auth'

// ─── Types ──────────────────────────────────────────────────

interface ListEndpointConfig {
  /** API path (e.g. '/api/v1/employees') */
  path: string
  /** Role to authenticate as */
  role: RoleType
  /** Minimum expected results (default 1) */
  minResults?: number
  /** Description prefix (default: path) */
  label?: string
}

interface RbacBlockConfig {
  /** API path */
  path: string
  /** Roles that should be blocked */
  blockedRoles: RoleType[]
  /** HTTP method (default 'GET') */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  /** POST/PUT body if needed */
  body?: unknown
  /** Description prefix */
  label?: string
}

// ─── List Endpoint Tests ────────────────────────────────────

/**
 * Generates standard tests for a paginated list endpoint:
 * - Returns 200 with data array
 * - Returns pagination metadata
 * - Supports ?page=999 (empty result)
 */
export function testListEndpoint(config: ListEndpointConfig) {
  const { path, role, minResults = 1, label = path } = config

  test.describe(`List: ${label}`, () => {
    test.use({ storageState: authFile(role) })

    test('returns 200 with data array', async ({ request }) => {
      const res = await request.get(path)
      const result = await parseApiResponse(res)
      expect(result.ok).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
    })

    if (minResults > 0) {
      test(`returns at least ${minResults} result(s)`, async ({ request }) => {
        const res = await request.get(path)
        const result = await parseApiResponse(res)
        expect(result.ok).toBe(true)
        expect((result.data as unknown[]).length).toBeGreaterThanOrEqual(minResults)
      })
    }

    test('returns pagination metadata', async ({ request }) => {
      const res = await request.get(`${path}?page=1&limit=5`)
      const result = await parseApiResponse(res)
      expect(result.ok).toBe(true)
      if (result.pagination) {
        expect(result.pagination.page).toBe(1)
        expect(result.pagination.limit).toBe(5)
        expect(typeof result.pagination.total).toBe('number')
        expect(typeof result.pagination.totalPages).toBe('number')
      }
    })

    test('page=999 returns empty data', async ({ request }) => {
      const res = await request.get(`${path}?page=999&limit=10`)
      const result = await parseApiResponse(res)
      expect(result.ok).toBe(true)
      expect((result.data as unknown[]).length).toBe(0)
    })
  })
}

// ─── RBAC Block Tests ───────────────────────────────────────

/**
 * Generates RBAC tests that assert blocked roles get 401/403.
 * Creates one test per blocked role.
 */
export function testRbacBlock(config: RbacBlockConfig) {
  const { path, blockedRoles, method = 'GET', body, label = path } = config

  for (const role of blockedRoles) {
    test.describe(`RBAC: ${role} blocked from ${method} ${label}`, () => {
      test.use({ storageState: authFile(role) })

      test(`${method} → 401/403`, async ({ request }) => {
        let res
        switch (method) {
          case 'GET':
            res = await request.get(path)
            break
          case 'POST':
            res = await request.post(path, body ? { data: body } : undefined)
            break
          case 'PUT':
            res = await request.put(path, body ? { data: body } : undefined)
            break
          case 'DELETE':
            res = await request.delete(path)
            break
        }
        const result = await parseApiResponse(res)
        assertError(result, result.status, `${role} should be blocked from ${method} ${path}`)
        expect([401, 403]).toContain(result.status)
      })
    })
  }
}
