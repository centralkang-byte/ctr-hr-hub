# 성능 최적화 플랜 v2

## Context

CTR HR Hub — 540 API, 153 페이지, 151 Client 컴포넌트.
현재 병목:
- dynamic import 0건 → 초기 번들에 모든 것 포함
- withCache 5/540 → 99% API가 매번 DB 직접 조회
- loading.tsx 0건 → 페이지 전환 시 빈 화면
- Redis KEYS 명령 → O(N) 블로킹

---

## Phase 1: Suspense 기반 부분 스켈레톤 (체감 속도 즉시 개선)

~~loading.tsx~~ → 페이지 전체 교체 대신 **데이터 의존 컴포넌트만 Suspense로 감싸기**.
사이드바/헤더는 유지, 데이터 테이블/차트/KPI 카드만 스켈레톤.

**방식:** 각 페이지의 page.tsx에서 데이터 패칭 영역만 Suspense 래핑
```tsx
// 예: employees/page.tsx
<div className="p-6 space-y-4">
  <PageHeader title="직원 관리" />  {/* 즉시 렌더 */}
  <Suspense fallback={<TableSkeleton rows={10} cols={6} />}>
    <EmployeeListServer />  {/* 데이터 의존 → 스켈레톤 */}
  </Suspense>
</div>
```

**파일:**
- 공용 스켈레톤 컴포넌트: `src/components/shared/PageSkeleton.tsx`
  - `KpiCardsSkeleton` (4칸 그리드)
  - `TableSkeleton` (rows/cols prop)
  - `ChartSkeleton` (고정 높이)
  - 스태거링 애니메이션 적용 (줄별 delay로 폭포수 효과)
- 적용 대상 (8개 주요 페이지): home, employees, payroll, attendance, leave, performance, analytics, recruitment

## Phase 2: Dynamic Import + CLS 방어

next/dynamic으로 무거운 컴포넌트 지연 로드 + **동일 크기 Skeleton fallback 필수**.

**대상 & CLS 방어:**
```tsx
// layout.tsx — 플로팅 UI라 CLS 없음
const HrChatbot = dynamic(
  () => import('@/components/hr-chatbot/HrChatbot').then(m => ({ default: m.HrChatbot })),
  { ssr: false }  // 플로팅 FAB — CLS 영향 없음
)
const CommandPalette = dynamic(
  () => import('@/components/command-palette/CommandPalette').then(m => ({ default: m.CommandPalette })),
  { ssr: false }  // 모달 — CLS 영향 없음
)

// 차트 — 반드시 같은 높이의 skeleton 지정
const AttritionChart = dynamic(
  () => import('@/components/analytics/AttritionTrendChart'),
  { loading: () => <ChartSkeleton className="h-80" /> }  // 차트와 같은 h-80
)
```

**수정 파일:**
- `src/app/(dashboard)/layout.tsx` — HrChatbot, CommandPalette
- analytics 차트 컴포넌트 사용 페이지들 — loading prop으로 CLS 방어
- OrgChart, 칸반 보드 — 해당 페이지에서만 dynamic import

## Phase 3: API 쿼리 최적화

### 3-A: home/summary EMPLOYEE 병렬화
`src/app/api/v1/home/summary/route.ts`
- totalEmployees + leaveBalance + attendanceCount → Promise.all 3병렬

### 3-B: employees 라우트 select 추가
`src/app/api/v1/employees/route.ts`
- Employee에 select 추가 (id, name, email, employeeNumber, hireDate, status, profileImageUrl)
- 민감 필드 DB 레벨에서 제외 → 응답 크기 50-70% 감소

## Phase 4: 캐시 — 무효화 동기화 + 사용자 격리

### 4-A: cacheDelPattern KEYS → SCAN 교체
`src/lib/redis.ts`
```ts
export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    const stream = redis.scanStream({ match: pattern, count: 100 })
    const pipeline = redis.pipeline()
    for await (const keys of stream) {
      if (keys.length) pipeline.del(...keys)
    }
    await pipeline.exec()
  } catch { /* graceful */ }
}
```

### 4-B: 캐시 키에 사용자 컨텍스트 포함
`src/lib/cache.ts` — withCache의 keyBuilder에 사용자 격리 강제

```ts
// 캐시 키 = prefix:companyId:role:employeeId:pathname:query
function buildUserScopedKey(
  strategy: CacheStrategy,
  user: SessionUser,
  pathname: string,
  query: string,
): string {
  return `${strategy.prefix}:${user.companyId}:${user.role}:${user.employeeId}:${pathname}${query ? `:${query}` : ''}`
}
```

withCache HOF 수정: handler에서 user를 추출하여 캐시 키에 포함.
→ A 직원과 B 매니저는 절대 같은 캐시를 공유하지 않음.

### 4-C: Mutation 시 캐시 즉시 무효화
상태 변경 API(POST/PUT/PATCH/DELETE)에서 관련 캐시 키 삭제.

**무효화 매핑 테이블:**

| Mutation API | 무효화 대상 캐시 |
|---|---|
| 휴가 승인/반려 (leave/[id]) | DASHBOARD_KPI, sidebar/counts |
| 직원 정보 수정 (employees/[id]) | EMPLOYEE_LIST |
| 급여 실행 상태 변경 (payroll/run) | DASHBOARD_KPI |
| 목표 승인 (goals/[id]) | sidebar/counts |
| 근태 기록 (attendance) | DASHBOARD_KPI |

**구현 패턴:**
```ts
// 예: 휴가 승인 API
export async function PATCH(req, ctx) {
  // ... 승인 로직 ...

  // 캐시 무효화 — 승인한 사용자 + 신청자의 캐시 모두 삭제
  await Promise.all([
    invalidateCache(CACHE_STRATEGY.DASHBOARD_KPI, companyId),
    cacheDelPattern(`cache:dashboard:kpi:${companyId}*`),
  ])

  return apiSuccess(result)
}
```

### 4-D: 고빈도 API에 withCache 적용
현재 5 → 15개 라우트 캐시 확대

| Route | TTL | 캐시 키 스코프 |
|---|---|---|
| sidebar/counts | 30s | companyId:role:employeeId |
| analytics/workforce | 300s | companyId |
| analytics/performance | 300s | companyId |
| analytics/compensation | 300s | companyId |
| analytics/team-health | 300s | companyId |
| analytics/attendance | 300s | companyId |
| analytics/turnover | 300s | companyId |
| recruitment/dashboard | 120s | companyId |
| home/pending-actions | 60s | companyId:role:employeeId |
| employees (list) | 60s | companyId:query |

## Phase 5: next.config 최적화

```js
experimental: {
  optimizePackageImports: [
    'lucide-react',
    'recharts',
    'framer-motion',
    '@radix-ui/react-icons',
  ],
},
```

## Phase 6: Perceived Performance UX 업그레이드

### 6-A: 낙관적 UI (Optimistic Update)
SWR의 `mutate`로 결재 승인/휴가 신청 시 서버 응답 전 UI 즉시 반영.

```ts
// 예: 휴가 승인 버튼
async function handleApprove(id: string) {
  // 1. UI 즉시 업데이트 (낙관적)
  mutate('/api/v1/home/pending-actions',
    (prev) => ({ ...prev, pendingLeaves: prev.pendingLeaves - 1 }),
    false
  )

  // 2. 서버 요청
  try {
    await apiClient.patch(`/api/v1/leave/${id}`, { status: 'APPROVED' })
    mutate('/api/v1/home/pending-actions')  // 서버 데이터로 재검증
  } catch {
    mutate('/api/v1/home/pending-actions')  // 롤백
    toast.error('승인 실패')
  }
}
```

적용 대상: 휴가 승인/반려, 목표 승인, 결재 처리 (3곳)

### 6-B: 호버 프리패칭
사이드바 링크에 onMouseEnter 시 SWR prefetch.

```tsx
// Sidebar 링크 — DO NOT TOUCH 파일이므로 외부 래퍼로 구현
// src/components/shared/PrefetchLink.tsx
'use client'
import Link from 'next/link'
import { preload } from 'swr'

const PREFETCH_MAP: Record<string, string> = {
  '/hr/employees': '/api/v1/employees',
  '/hr/payroll': '/api/v1/payroll/runs',
  '/hr/leave': '/api/v1/leave/requests',
  '/analytics': '/api/v1/analytics/overview',
}

export function PrefetchLink({ href, children, ...props }) {
  const handleMouseEnter = () => {
    const api = PREFETCH_MAP[href]
    if (api) preload(api, fetcher)
  }
  return <Link href={href} onMouseEnter={handleMouseEnter} {...props}>{children}</Link>
}
```
→ Sidebar.tsx는 DO NOT TOUCH이므로, PrefetchLink를 별도 생성하고 Sidebar에서 사용하는 Link를 교체하지 않음.
대신 DashboardShell에서 래핑하거나, navigation config에 prefetch URL 매핑만 추가.

### 6-C: 스태거링 스켈레톤
Phase 1의 PageSkeleton에 포함. 줄별 animation-delay로 폭포수 효과.

```tsx
{Array.from({ length: rows }).map((_, i) => (
  <Skeleton
    key={i}
    className="h-10 w-full"
    style={{ animationDelay: `${i * 75}ms` }}
  />
))}
```

---

## 작업 순서 & 예상 효과

| Phase | 작업 | 예상 효과 | 파일 수 |
|---|---|---|---|
| 1 | Suspense 부분 스켈레톤 | 깜빡임 없는 점진적 로딩 | +1 신규, ~8 수정 |
| 2 | Dynamic import + CLS 방어 | 초기 번들 20-30% 감소 | ~5 수정 |
| 3 | 쿼리 병렬화 + select | API 응답 30-50% 단축 | ~2 수정 |
| 4 | 캐시 (격리+무효화+확대) | 반복 조회 90%+ 제거 + 데이터 정합성 보장 | ~15 수정 |
| 5 | next.config 최적화 | 번들 추가 감소 | 1 수정 |
| 6 | UX (낙관적UI+프리패치+스태거링) | 체감 지연 0에 가까움 | +1 신규, ~5 수정 |

## 검증

각 Phase 완료 후:
1. `npx tsc --noEmit` — 0 errors
2. `npm run lint` — no warnings
3. dev 서버 → 주요 페이지 로딩 확인
4. Mutation 후 UI 즉시 반영 + 캐시 무효화 확인
5. Network 탭 X-Cache: HIT + 사용자별 캐시 격리 확인
6. 다른 계정 로그인 → 캐시 오염 없음 확인
