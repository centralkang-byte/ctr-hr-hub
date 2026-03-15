import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { AppError, isAppError } from '@/lib/errors'
import type {
  ApiResponse,
  PaginatedResponse,
  PaginationInfo,
  ApiErrorDetail,
} from '@/types'

// ─── Server-side response helpers ─────────────────────────

export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data }, { status })
}

export function apiPaginated<T>(
  data: T[],
  pagination: PaginationInfo,
): NextResponse<PaginatedResponse<T>> {
  return NextResponse.json({ data, pagination })
}

export function apiError(error: unknown): NextResponse<{ error: ApiErrorDetail }> {
  if (isAppError(error)) {
    // Capture 5xx AppErrors to Sentry
    if (error.statusCode >= 500) {
      Sentry.captureException(error, {
        tags: { errorCode: error.code },
        extra: { status: error.statusCode },
      })
    }
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      { status: error.statusCode },
    )
  }

  // Unknown errors → always 500 → always capture to Sentry
  const message =
    error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'

  Sentry.captureException(error instanceof Error ? error : new Error(message), {
    tags: { errorCode: 'INTERNAL_ERROR' },
    extra: { status: 500 },
  })

  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message } },
    { status: 500 },
  )
}

// ─── Pagination helper ────────────────────────────────────

export function buildPagination(
  page: number,
  limit: number,
  total: number,
): PaginationInfo {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  }
}

// ─── Client-side API client ───────────────────────────────

class ApiClient {
  private baseUrl: string

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    url: string,
    options: RequestInit = {},
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    const json = await res.json() as T | { error: ApiErrorDetail }

    if (!res.ok) {
      const errorBody = json as { error: ApiErrorDetail }
      throw new AppError(
        res.status,
        errorBody.error?.code ?? 'UNKNOWN',
        errorBody.error?.message ?? '요청 처리 중 오류가 발생했습니다.',
        errorBody.error?.details,
      )
    }

    return json as T
  }

  async get<T>(url: string, params?: Record<string, string | number | undefined>): Promise<ApiResponse<T>> {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value))
        }
      })
    }
    const queryString = searchParams.toString()
    const fullUrl = queryString ? `${url}?${queryString}` : url
    return this.request<ApiResponse<T>>(fullUrl)
  }

  async getList<T>(
    url: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<PaginatedResponse<T>> {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value))
        }
      })
    }
    const queryString = searchParams.toString()
    const fullUrl = queryString ? `${url}?${queryString}` : url
    return this.request<PaginatedResponse<T>>(fullUrl)
  }

  /** Recursively convert Date instances to ISO 8601 strings before sending */
  private serializeDates(value: unknown): unknown {
    if (value instanceof Date) {
      return value.toISOString()
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.serializeDates(item))
    }
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, this.serializeDates(v)]),
      )
    }
    return value
  }

  async post<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>(url, {
      method: 'POST',
      body: body ? JSON.stringify(this.serializeDates(body)) : undefined,
    })
  }

  async put<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>(url, {
      method: 'PUT',
      body: body ? JSON.stringify(this.serializeDates(body)) : undefined,
    })
  }

  async patch<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>(url, {
      method: 'PATCH',
      body: body ? JSON.stringify(this.serializeDates(body)) : undefined,
    })
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>(url, { method: 'DELETE' })
  }
}

export const apiClient = new ApiClient()
