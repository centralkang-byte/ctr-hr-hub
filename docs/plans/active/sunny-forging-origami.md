# 성능 최적화 플랜

## Context

CTR HR Hub는 540개 API 라우트, 153개 페이지, 151개 Client 컴포넌트를 가진 대규모 HR SaaS.
현재 성능 병목:
- **dynamic import 0건** → 무거운 차트/에디터가 초기 번들에 포함
- **withCache 5/540 라우트** → 99%의 API가 매번 DB 직접 조회
- **loading.tsx 0건** → 페이지 전환 시 빈 화면
- **sidebar/counts 매 페이지 로드** → 캐시 없음
- **MANAGER/EMPLOYEE 홈 쿼리 직렬** → Promise.all 미사용
- **Redis KEYS 명령** → O(N) 블로킹 위험

## Phase 1: loading.tsx 추가 (체감 속도 즉시 개선)

주요 라우트에 loading.tsx 스켈레톤 추가. 페이지 전환 시 즉각 피드백.

**파일 생성 (8개):**
- `src/app/(dashboard)/home/loading.tsx`
- `src/app/(dashboard)/hr/employees/loading.tsx`
- `src/app/(dashboard)/hr/payroll/loading.tsx`
- `src/app/(dashboard)/hr/attendance/loading.tsx`
- `src/app/(dashboard)/hr/leave/loading.tsx`
- `src/app/(dashboard)/performance/loading.tsx`
- `src/app/(dashboard)/analytics/loading.tsx`
- `src/app/(dashboard)/recruitment/loading.tsx`

패턴: shadcn/ui Skeleton 컴포넌트로 KPI 카드 + 테이블 스켈레톤

## Phase 2: Dynamic Import (번들 사이즈 감소)

무거운 컴포넌트를 next/dynamic으로 지연 로드.

**대상:**
1. `HrChatbot` — layout.tsx에서 모든 페이지에 로드됨 → dynamic (ssr: false)
2. `CommandPalette` — 같은 이유 → dynamic (ssr: false)
3. Recharts 차트 컴포넌트 — analytics에서만 필요 → dynamic
4. `@xyflow/react` (OrgChart) — /organization 에서만 필요 → dynamic
5. `@dnd-kit` (칸반) — recruitment 에서만 필요 → dynamic

**수정 파일:**
- `src/app/(dashboard)/layout.tsx` — HrChatbot, CommandPalette
- 차트 사용 페이지들 — 차트 컴포넌트 dynamic import

## Phase 3: API 쿼리 최적화

### 3-A: sidebar/counts에 withCache 추가
`src/app/api/v1/sidebar/counts/route.ts`
- withCache(handler, CACHE_STRATEGY.DASHBOARD_KPI) 래핑 (TTL 30초)
- 매 페이지 이동마다 DB 안 침

### 3-B: home/summary EMPLOYEE 브랜치 병렬화
`src/app/api/v1/home/summary/route.ts`
- leaveBalance + attendanceCount → Promise.all 병렬화
- MANAGER 브랜치는 이미 구조적으로 OK

### 3-C: employees 라우트 select 추가
`src/app/api/v1/employees/route.ts`
- Employee에 select 추가 — 필요 필드만 조회
- 응답 크기 50-70% 감소

## Phase 4: Redis 캐시 확대

### 4-A: cacheDelPattern KEYS → SCAN 교체
`src/lib/redis.ts` — KEYS 명령은 O(N) 블로킹 → scanStream 사용

### 4-B: 고빈도 API에 withCache 적용
현재 5/540 → 핵심 15개 라우트 캐시 추가

| Route | TTL | 이유 |
|---|---|---|
| sidebar/counts | 30s | 매 페이지 로드 |
| analytics/workforce | 300s | MV 쿼리 |
| analytics/performance | 300s | 집계 |
| analytics/compensation | 300s | 집계 |
| analytics/team-health | 300s | 집계 |
| analytics/attendance | 300s | 집계 |
| analytics/turnover | 300s | 집계 |
| recruitment/dashboard | 120s | 퍼널 |
| home/pending-actions | 60s | count |
| employees (list) | 60s | 목록 |

## Phase 5: next.config 최적화

`next.config.mjs`에 optimizePackageImports 추가:
- lucide-react, recharts, framer-motion, @radix-ui 등
- 트리쉐이킹 개선 → 미사용 아이콘/컴포넌트 번들 제외

## 작업 순서 및 예상 효과

| Phase | 작업 | 예상 효과 | 파일 수 |
|---|---|---|---|
| 1 | loading.tsx 추가 | 빈 화면 → 스켈레톤 (체감 즉시) | +8 신규 |
| 2 | Dynamic import | 초기 번들 20-30% 감소 | ~5 수정 |
| 3 | 쿼리 병렬화 + select | API 응답 30-50% 단축 | ~3 수정 |
| 4 | Redis 캐시 확대 | 반복 조회 90%+ 제거 | ~12 수정 |
| 5 | next.config 최적화 | 번들 사이즈 추가 감소 | 1 수정 |

## 검증

각 Phase 완료 후:
1. `npx tsc --noEmit` — 0 errors
2. `npm run lint` — no warnings
3. dev 서버 → 주요 페이지 로딩 확인
4. Network 탭 X-Cache: HIT 확인 (Phase 4)
