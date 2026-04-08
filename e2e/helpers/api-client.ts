// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Shared API Test Client
// Centralized response parsing, assertion helpers, and
// convenience wrapper for Playwright APIRequestContext.
// ═══════════════════════════════════════════════════════════

import type { APIRequestContext, APIResponse } from '@playwright/test'
import { expect } from '@playwright/test'

// ─── Types ──────────────────────────────────────────────────

export interface ApiResult<T = unknown> {
  status: number
  ok: boolean
  data: T | undefined
  error: string | undefined
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  body: Record<string, unknown>
}

export interface RawResult {
  status: number
  ok: boolean
  headers: Record<string, string>
  buffer: Buffer
}

// ─── Response Parsers ───────────────────────────────────────

/**
 * Parse a JSON API response into a standardized shape.
 * Extracted from eval-fixtures.ts — single source of truth.
 */
export async function parseApiResponse<T = unknown>(
  response: APIResponse,
): Promise<ApiResult<T>> {
  const status = response.status()
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>

  const errorObj = body.error as { message?: string; code?: string } | string | undefined
  const errorMessage =
    typeof errorObj === 'string' ? errorObj : (errorObj?.message ?? undefined)

  const pagination = body.pagination as ApiResult['pagination'] | undefined

  return {
    status,
    ok: response.ok(),
    data: body.data as T | undefined,
    error: errorMessage,
    pagination,
    body,
  }
}

/**
 * Parse a raw/binary response (for file exports like XLSX).
 * Returns status, headers, and raw buffer — no JSON parsing.
 */
export async function parseRawResponse(response: APIResponse): Promise<RawResult> {
  const headers: Record<string, string> = {}
  const allHeaders = response.headers()
  for (const [key, value] of Object.entries(allHeaders)) {
    headers[key] = value
  }

  return {
    status: response.status(),
    ok: response.ok(),
    headers,
    buffer: Buffer.from(await response.body()),
  }
}

// ─── Assertion Helpers ──────────────────────────────────────

/**
 * Assert the API call succeeded (2xx) and data exists.
 * Throws a descriptive error on failure.
 */
export function assertOk<T>(
  result: ApiResult<T>,
  msg?: string,
): asserts result is ApiResult<T> & { ok: true; data: T } {
  const label = msg ?? 'API call'
  expect(result.ok, `${label} failed (${result.status}): ${result.error ?? 'unknown'}`).toBe(
    true,
  )
  expect(result.data, `${label}: response data is missing`).toBeDefined()
}

/**
 * Assert the API call returned a specific error status.
 */
export function assertError(result: ApiResult, expectedStatus: number, msg?: string): void {
  const label = msg ?? 'API call'
  expect(result.status, `${label}: expected ${expectedStatus}, got ${result.status}`).toBe(
    expectedStatus,
  )
  expect(result.ok, `${label}: expected failure but got ok`).toBe(false)
}

// ─── ApiClient Wrapper ──────────────────────────────────────

/**
 * Convenience wrapper around Playwright APIRequestContext.
 * Adds typed response parsing and optional query param handling.
 * Usage is optional — plain request.get()/post() still works.
 */
export class ApiClient {
  constructor(private request: APIRequestContext) {}

  async get<T = unknown>(
    path: string,
    params?: Record<string, string>,
  ): Promise<ApiResult<T>> {
    const url = params ? `${path}?${new URLSearchParams(params).toString()}` : path
    const res = await this.request.get(url)
    return parseApiResponse<T>(res)
  }

  async post<T = unknown>(path: string, data?: unknown): Promise<ApiResult<T>> {
    const res = await this.request.post(path, data !== undefined ? { data } : undefined)
    return parseApiResponse<T>(res)
  }

  async put<T = unknown>(path: string, data?: unknown): Promise<ApiResult<T>> {
    const res = await this.request.put(path, data !== undefined ? { data } : undefined)
    return parseApiResponse<T>(res)
  }

  async del<T = unknown>(path: string): Promise<ApiResult<T>> {
    const res = await this.request.delete(path)
    return parseApiResponse<T>(res)
  }

  async getRaw(path: string, params?: Record<string, string>): Promise<RawResult> {
    const url = params ? `${path}?${new URLSearchParams(params).toString()}` : path
    const res = await this.request.get(url)
    return parseRawResponse(res)
  }
}
