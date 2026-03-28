# 하네스 리팩토링 Phase 2: Suspense 래핑

## Context

Session 36에서 Phase 1(silent catch → toast) 완료. Phase 2는 `getServerSession` 호출이 있지만 `Suspense` 래핑이 없는 page.tsx ~106개에 Suspense boundary를 추가하는 작업.

**목적**: 하네스 `pages.md` 규칙 준수 — 모든 dashboard page.tsx는 Client 컴포넌트를 `<Suspense fallback={<Skeleton />}>` 으로 감싸야 함. Suspense 없으면 서버 컴포넌트에서 데이터 로딩 시 전체 페이지 블로킹 발생.

## 수정 대상: 106개 파일

### 유형 A: 단순 래핑 (session O, user prop O, Suspense X) — ~95개
현재:
```tsx
return <XxxClient user={user} />
```
수정:
```tsx
return (
  <Suspense fallback={<ListPageSkeleton />}>
    <XxxClient user={user} />
  </Suspense>
)
```
변경점: `Suspense` import + skeleton import + JSX 래핑 (3줄 변경)

### 유형 B: params 있는 동적 라우트 ([id] 등) — ~10개
현재:
```tsx
return <XxxClient user={user} id={id} />
```
수정: 유형 A와 동일 패턴 (params는 이미 await됨, 래핑만 추가)

### 유형 C: settings/page.tsx 등 inline JSX가 있는 페이지 — ~7개
현재: page.tsx 안에 inline JSX (탭, 카드 등)
**Phase 2 스코프**: Suspense 래핑만 추가. inline JSX 제거는 Phase 3 또는 별도 작업.
- settings 하위 탭은 부모 layout에서 session 처리 가능 → 하네스 예외 해당 여부 확인 필요

## Skeleton 매핑 기준

| 영역 | Skeleton | 대상 |
|------|----------|------|
| 목록/테이블/폼/상세 | `ListPageSkeleton` | employees/*, payroll/*, recruitment/*, discipline/*, leave/*, onboarding/*, offboarding/*, settings/*, approvals/*, benefits/*, my/*, notifications/*, delegation/*, team/* |
| 대시보드/KPI | `HomeSkeleton` | dashboard/*, manager-hub/* |
| 차트/분석 | `ChartSkeleton` or `AnalyticsSkeleton` | analytics/* |
| 조직도 | `ChartSkeleton` | org-studio/* |

## 실행 전략

106개 파일이지만 변경은 기계적(동일 패턴 반복). 병렬 subagent로 영역별 분할 처리.

### Step 1: 영역별 배치 수정 (5 batch)
- **Batch 1**: payroll/* (13개) + attendance/* (4개) + leave/* (3개) = 20개
- **Batch 2**: performance/* (17개) + recruitment/* (13개) = 30개
- **Batch 3**: employees/* (7개) + discipline/* (6개) + onboarding/* (5개) + offboarding/* (3개) = 21개
- **Batch 4**: my/* (12개) + settings/* (7개) + approvals/* (2개) = 21개
- **Batch 5**: analytics/* (5개) + dashboard/* (2개) + directory/* (1개) + manager-hub/* (1개) + org-studio/* (1개) + benefits/* (1개) + delegation/* (1개) + notifications/* (1개) + team/* (1개) + (auth)/pre-hire (1개) = 15개

### Step 2: 검증
- `npx tsc --noEmit` — 0 errors
- `grep -r "Suspense" src/app/(dashboard) --include="page.tsx" -L` — Suspense 누락 0개
- `npm run lint` — no new warnings

### Step 3: 커밋
- 메시지: `refactor: page.tsx ~106개 Suspense boundary 추가 (하네스 Phase 2)`

## 제외 항목
- `(auth)/login/page.tsx` — auth 라우트, 하네스 예외
- 이미 Suspense 적용된 8개 page.tsx
- `analytics/page.tsx`, `hr/bulk-movements/page.tsx` — Suspense import만 있고 사용 안 함 (별도 확인 필요)

## 주의사항
- settings/page.tsx는 inline JSX가 있어 단순 래핑이 안 됨 → Suspense를 SettingsHubClient 부분만 감싸기
- `export const dynamic = 'force-dynamic'` 있는 페이지 → 유지 (제거 금지)
- DO NOT TOUCH 파일 없음 (page.tsx는 제외 대상 아님)
