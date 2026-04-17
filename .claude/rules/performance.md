---
paths: ["src/app/api/**", "src/app/**/page.tsx", "src/app/**/layout.tsx", "src/lib/cache.ts", "src/lib/redis.ts", "src/lib/company/**", "src/lib/settings/**"]
---

# Performance Rules

표준 원본:
- `src/lib/cache.ts` — `CACHE_STRATEGY`, `withCache`, `invalidateCache`, `buildCacheKey`, `getCacheStats`
- `src/lib/redis.ts` — `redis`, `cacheGet`, `cacheSet`, `cacheDel`, `cacheDelPattern`
- `src/lib/company/getCompanies.ts` — React cache() + Redis 이중 캐싱 예시
- `src/lib/settings/get-setting.ts` — React cache() per-request 디덥 예시

## 2-Tier 캐싱 전략

| Tier | 도구 | 범위 | 용도 |
|------|------|------|------|
| 1 | React `cache()` | per-request | N+1 방지 (동일 쿼리 1회만) |
| 2 | Redis | cross-request | 30s~1800s TTL, 공유 캐시 |

두 레이어를 조합한 패턴: `getCompanies.ts`, `get-setting.ts` 참조.

```ts
import { cache } from 'react'
import { cacheGet, cacheSet } from '@/lib/redis'

export const getCompaniesForUser = cache(async (role, companyId) => {
  const cacheKey = `companies:${role}:${companyId}`
  const cached = await cacheGet<CompanyOption[]>(cacheKey)
  if (cached) return cached

  const data = await /* ... Prisma query ... */
  await cacheSet(cacheKey, data, 300)
  return data
})
```

## CACHE_STRATEGY 상수

| Strategy | TTL | 용도 |
|----------|-----|------|
| `ORG_TREE` | 600s | 조직도 |
| `DASHBOARD_KPI` | 60s | 대시보드 KPI |
| `CODE_TABLES` | 1800s | 마스터 코드 (roles, permissions, countries) |
| `EMPLOYEE_LIST` | 300s | 직원 목록 |
| `ANALYTICS` | 300s | 분석/리포트 |
| `SIDEBAR` | 30s | 사이드바 메뉴 |
| `RECRUITMENT` | 120s | 채용 |

TTL 추가/수정은 `src/lib/cache.ts`에서. 새 모듈은 기존 전략 재사용 → 불가피할 때만 추가.

## Scope 선택

```ts
withCache(handler, CACHE_STRATEGY.X, scope)
```

| Scope | 키 구성 | 언제 |
|-------|---------|------|
| `'user'` | `{prefix}:{companyId}:{role}:{employeeId}:{pathname}{query}` | 개인별 대시보드, 사이드바 (내 업무 queue 등) |
| `'company'` | `{prefix}:{companyId}:{role}:{pathname}{query}` | 법인별 공유 (analytics, org tree). **role 포함 필수** — cross-role cache bleed 방지 |
| `'global'` | `{prefix}:{pathname}{query}` | 전역 마스터 코드 (country/timezone 등) |

**중요**: `'company'` scope도 role을 키에 포함한다. HR_ADMIN에게 캐시된 200이 EMPLOYEE에게 반환되면 권한 유출됨.

## 캐시 무효화 (Mutation 후 필수)

```ts
import { invalidateCache, invalidateMultiple } from '@/lib/cache'

// 단일 전략
await invalidateCache(CACHE_STRATEGY.EMPLOYEE_LIST, companyId)

// 다중 전략 (관련 캐시 일괄)
await invalidateMultiple(
  [CACHE_STRATEGY.EMPLOYEE_LIST, CACHE_STRATEGY.ORG_TREE, CACHE_STRATEGY.SIDEBAR],
  companyId,
)
```

- 직원 생성/수정/삭제 → `EMPLOYEE_LIST` + `ORG_TREE` + `SIDEBAR` 무효화
- 조직 구조 변경 → `ORG_TREE` + `SIDEBAR` + `DASHBOARD_KPI` 무효화
- `cacheDelPattern`은 SCAN 기반 — **KEYS 명령 금지** (O(N) 블로킹)

## Server Component 패턴

### force-dynamic (세션 기반 페이지)

```ts
// src/app/(dashboard)/layout.tsx
export const dynamic = 'force-dynamic'
```

- `(dashboard)` 하위 전부 동적 렌더링 (세션 의존)
- 정적 페이지(marketing, login 등)에는 사용 금지

### React cache() (per-request 디덥)

Server Component/Layout에서 동일 쿼리가 여러 번 호출될 때 `cache()`로 래핑:

```ts
import { cache } from 'react'
export const getCompanyById = cache(async (id: string) => { /* ... */ })
```

- 요청 수명 동안만 유효 (요청 종료 시 clear)
- Prisma 쿼리 디덥 효과적

### Dynamic import + loading: () => null (CLS 방지)

떠다니는 UI(CommandPalette, Chatbot, Toast, SessionTimeoutWarning)는 지연 로드:

```ts
const HrChatbot = dynamic(() => import('./HrChatbot'), {
  loading: () => null,  // 로딩 중 자리 차지 안 함 → CLS 제로
})
```

- 초기 LCP 개선
- `ssr: false`는 필요할 때만 (서버에서 렌더링 불필요한 경우)

## Redis Graceful Degradation

`src/lib/redis.ts`의 모든 헬퍼는 try-catch로 감싸고 **throw 안 함**:

- `cacheGet` 실패 → `null` 반환 (cache miss처럼)
- `cacheSet`/`cacheDel`/`cacheDelPattern` 실패 → silent
- 목적: Redis 장애 시 앱이 죽지 않음 (DB 조회로 fallback)

**이 패턴 깨지 말 것** — Redis throw는 전체 앱 장애로 이어짐.

## 모니터링

```ts
import { getCacheStats } from '@/lib/cache'

const stats = await getCacheStats()
// { overall: {hits, misses, hitRate}, byStrategy: {...} }
```

- `/api/v1/admin/cache-stats` (관리자용)로 노출 가능
- Hit rate 낮은 전략(<50%) → TTL 조정 또는 scope 재검토

## 금지

- `redis.keys()` 사용 (SCAN 기반 `cacheDelPattern`만 사용)
- `withCache` 없이 빈번 읽기 GET 라우트 (예외: 실시간성 중요한 알림 등)
- Mutation 후 `invalidateCache` 누락 (stale data 위험)
- Redis 실패를 throw로 전파 (graceful degradation 원칙 유지)
- `force-dynamic`을 정적 페이지에 사용
- `company` scope에 role 없이 키 구성 (cross-role bleed)
