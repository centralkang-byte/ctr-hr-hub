---
paths: ["src/app/api/**"]
---

# API Conventions

표준 원본:
- `src/lib/permissions.ts` — `withPermission`, `withAuth`, `hasPermission`, `perm()`
- `src/lib/api.ts` — `apiSuccess`, `apiPaginated`, `apiError`, `buildPagination`, `apiClient`
- `src/lib/errors.ts` — `AppError` + 팩토리 함수
- `src/lib/cache.ts` — `withCache`, `CACHE_STRATEGY`, `invalidateCache`
- `src/lib/rate-limit.ts` — `withRateLimit`, `RATE_LIMITS`
- `src/lib/api/withRLS.ts`, `src/lib/api/companyFilter.ts`, `src/lib/api/cross-company-access.ts` (DO NOT TOUCH)

## 래퍼 조합 순서

시그니처상 `withPermission`만 3-arg 핸들러(`req, context, user`)를 받고 2-arg `RouteHandler`를 반환한다. `withCache`/`withRateLimit`은 2-arg `RouteHandler`만 입출력. 따라서:

```ts
export const GET = withCache(
  withRateLimit(
    withPermission(
      async (req, _context, user) => { /* handler — user는 SessionUser 보장 */ },
      perm(MODULE.EMPLOYEES, ACTION.VIEW),
    ),
    RATE_LIMITS.GENERAL,
  ),
  CACHE_STRATEGY.EMPLOYEE_LIST,
  'company',
)
```

- `withPermission` 가장 안쪽 — 3-arg 핸들러를 받아 2-arg로 변환
- `withRateLimit` 중간 — 인증 통과 여부와 무관하게 IP/user 키로 제한 (DDoS 방어용)
- `withCache` 가장 바깥 — HIT 시 권한 체크 스킵되므로 **scope에 role 포함 필수** (cross-role bleed 방지)

## 1. withPermission (권한 게이트)

```ts
import { withPermission } from '@/lib/permissions'
import { perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'

export const GET = withPermission(
  async (req, context, user) => {
    // user는 SessionUser로 보장됨
    return apiSuccess(data)
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
```

- `SUPER_ADMIN`은 모든 권한 bypass (permissions.ts 내부 로직)
- `MANAGER_UP` (MANAGER/EXECUTIVE/HR_ADMIN)은 `MODULE.ANALYTICS` 자동 허용
- 권한 없으면 `forbidden()` 자동 응답
- 세션 없으면 `unauthorized()` 자동 응답

## 2. withAuth (인증만, 권한 체크 X)

self-service 엔드포인트 (`/me`, `/internal-jobs` 등)에만 사용:

```ts
import { withAuth } from '@/lib/permissions'

export const GET = withAuth(async (req, context, user) => {
  // 본인 데이터만 조회하는 엔드포인트
  return apiSuccess(user)
})
```

## 3. withCache (캐시, GET only)

```ts
import { withCache, CACHE_STRATEGY } from '@/lib/cache'

withCache(handler, CACHE_STRATEGY.EMPLOYEE_LIST, 'company')
```

- Scope: `'user'` | `'company'` | `'global'` (상세: `performance.md`)
- GET 외 메서드는 자동 pass-through
- 2xx 응답만 캐시
- 응답 헤더에 `X-Cache: HIT|MISS` 부여
- Mutation 시 `invalidateCache(strategy, companyId)` 호출 필수

## 4. withRateLimit (레이트 리밋)

AI/export/파일 업로드/벌크 작업 등 비용 큰 작업에 필수:

```ts
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

export const POST = withRateLimit(
  withPermission(handler, perm(MODULE.AI, ACTION.EXECUTE)),
  RATE_LIMITS.AI,
)
```

RATE_LIMITS (SSOT: `src/lib/rate-limit.ts`) — 6개 상수:

| 상수 | 제한 | 용도 |
|------|------|------|
| `GENERAL` | 60 req/min | 일반 API (기본값) |
| `AUTH` | 10 req/min per IP | 로그인, 토큰 갱신 |
| `FILE_UPLOAD` | 5 req/min | S3 presigned URL, 파일 업로드 |
| `EXPORT` | 5 req/min per user | CSV/Excel/PDF 생성 |
| `AI` | 20 req/min per user | Anthropic/OpenAI 호출 |
| `BULK` | 3 req/min | 대량 마이그레이션, 벌크 import |

- 키 구성: `{userId ?? ip}:{pathname}` — 인증 사용자는 user-scoped, 미인증은 IP-scoped
- Redis 장애 시 in-memory fallback (graceful degradation)
- 초과 시 429 + `Retry-After` 헤더 자동 부여

## 5. 응답 헬퍼

```ts
import { apiSuccess, apiPaginated, apiError, buildPagination } from '@/lib/api'

// 단건
return apiSuccess(employee)

// 목록 (페이지네이션)
return apiPaginated(items, buildPagination(page, limit, total))

// 에러 — withPermission 래퍼가 자동 호출하므로 직접 쓸 일은 드묾
return apiError(error)
```

- `apiError`는 `AppError`면 `statusCode`/`code`/`message`/`details` 그대로, 아니면 500 + Sentry 캡처

## 6. 에러 처리 (AppError 팩토리 only)

```ts
import {
  notFound, forbidden, badRequest, unauthorized,
  conflict, serviceUnavailable, moduleDisabled,
  handlePrismaError,
} from '@/lib/errors'

throw notFound('직원을 찾을 수 없습니다.')
throw forbidden('접근 권한이 없습니다.')
throw badRequest('필수 항목이 누락되었습니다.', { field: 'name' })
throw conflict('이미 존재하는 데이터입니다.')
throw unauthorized()
throw serviceUnavailable()
throw moduleDisabled('PAYROLL')

// Prisma 에러 변환
try { /* ... */ } catch (e) { throw handlePrismaError(e) }
```

- **Error 직접 throw 금지** — 팩토리만 사용
- 메시지는 한국어 (사용자 노출됨)
- `handlePrismaError`는 P2002(중복)/P2025(없음)/P2003(FK)/P2014(관계) 자동 매핑

## 7. 멀티테넌트 (companyId)

### resolveCompanyId (필수 SSOT)

```ts
import { resolveCompanyId } from '@/lib/api/companyFilter'

const { searchParams } = new URL(req.url)
const companyId = resolveCompanyId(user, searchParams.get('companyId'))
```

- `SUPER_ADMIN`: 쿼리 파라미터 `companyId` 허용 (타 법인 조회 가능)
- 그 외 role: 무조건 `user.companyId` 강제
- **companyId 수동 비교 금지** — 이 함수만 사용

### Cross-company 접근 (MANAGER+용)

```ts
import {
  verifyCrossCompanyAccess,      // 단건 (detail view)
  getCrossCompanyReadFilter,      // 목록 (list view, N+1 방지)
} from '@/lib/api/cross-company-access'

// Detail: 단일 targetEmployeeId 검증
const { allowed } = await verifyCrossCompanyAccess(ctx, targetEmployeeId)
if (!allowed) throw forbidden()

// List: WHERE 필터로 배치 처리
const crossFilter = await getCrossCompanyReadFilter(ctx)
const where = crossFilter ? { OR: [sameCompanyFilter, crossFilter] } : sameCompanyFilter
```

- 3-layer 체크 (role ≥ MANAGER, dotted/secondary 관계, 대상 일치)
- 읽기 전용 (`readOnly: true`) — 수정은 불가
- 경로: `org/tree`, `manager-hub/*`, `direct-reports`, 직원 detail 등

### withRLS (Row-Level Security 트랜잭션)

```ts
import { withRLS, buildRLSContext } from '@/lib/api/withRLS'

const result = await withRLS(buildRLSContext(user), async (tx) => {
  return tx.payrollRun.findUnique({ where: { id } })
})
```

- PostgreSQL SET LOCAL 세션 변수로 RLS 정책 활성화
- 기존 `WHERE companyId = ?`는 **redundant safety net으로 유지** (중복 방어)

## 8. Binary 응답 (파일 다운로드)

```ts
return new Response(buffer, {
  headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${filename}"`,
  },
})
```

- `NextResponse.json()` 사용 **금지** (binary에 부적절)
- `apiSuccess()` 사용 금지 (JSON 래핑됨)

## 금지

- raw `fetch()` 서버에서 사용 (DB/외부 API 직접 호출 대신 `prisma` + 전용 client)
- `withPermission` 없이 핸들러 노출 (self-service는 `withAuth`)
- `resolveCompanyId` 없이 companyId 수동 비교
- `Error` 직접 throw (AppError 팩토리만)
- 에러 메시지 영어 작성 (한국어 필수)
- `withCache` scope `'company'`인데 role 없이 키 구성 (cross-role bleed)
- DO NOT TOUCH: `src/lib/api/companyFilter.ts`, `src/lib/api/withRLS.ts`, `src/lib/prisma-rls.ts`
