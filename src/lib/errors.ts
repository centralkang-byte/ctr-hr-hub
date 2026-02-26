// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Centralized Error Handling
// ═══════════════════════════════════════════════════════════

export class AppError extends Error {
  readonly statusCode: number
  readonly code: string
  readonly details?: Record<string, unknown>

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

// ─── Factory Functions ────────────────────────────────────

export function notFound(message = '리소스를 찾을 수 없습니다.'): AppError {
  return new AppError(404, 'NOT_FOUND', message)
}

export function forbidden(message = '접근 권한이 없습니다.'): AppError {
  return new AppError(403, 'FORBIDDEN', message)
}

export function badRequest(
  message = '잘못된 요청입니다.',
  details?: Record<string, unknown>,
): AppError {
  return new AppError(400, 'BAD_REQUEST', message, details)
}

export function unauthorized(message = '인증이 필요합니다.'): AppError {
  return new AppError(401, 'UNAUTHORIZED', message)
}

export function conflict(message = '이미 존재하는 데이터입니다.'): AppError {
  return new AppError(409, 'CONFLICT', message)
}

export function serviceUnavailable(message = '서비스를 일시적으로 사용할 수 없습니다.'): AppError {
  return new AppError(503, 'SERVICE_UNAVAILABLE', message)
}

export function moduleDisabled(module: string): AppError {
  return new AppError(403, 'MODULE_DISABLED', `${module} 모듈이 비활성화되어 있습니다.`)
}

// ─── Prisma Error Handler ─────────────────────────────────

interface PrismaError {
  code?: string
  meta?: { target?: string[] }
  message?: string
}

export function handlePrismaError(error: unknown): AppError {
  const prismaError = error as PrismaError

  switch (prismaError.code) {
    case 'P2002': {
      const target = prismaError.meta?.target?.join(', ') ?? '알 수 없음'
      return conflict(`중복된 값이 존재합니다: ${target}`)
    }
    case 'P2025':
      return notFound('요청한 레코드를 찾을 수 없습니다.')
    case 'P2003':
      return badRequest('참조하는 레코드가 존재하지 않습니다.')
    case 'P2014':
      return badRequest('관계 제약 조건을 위반했습니다.')
    default:
      return new AppError(500, 'INTERNAL_ERROR', '데이터베이스 오류가 발생했습니다.')
  }
}

// ─── Type Guard ───────────────────────────────────────────

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
