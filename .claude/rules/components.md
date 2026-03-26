---
paths: ["src/app/**/*Client.tsx", "src/components/**/*.tsx"]
---

# Component 규칙

표준 원본: `src/app/(dashboard)/attendance/AttendanceClient.tsx`

## Client Component 필수 구조

```tsx
'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — {Feature} Client
// {한 줄 설명}
// ═══════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────
// ─── Constants ──────────────────────────────────────────────
// ─── Helpers ────────────────────────────────────────────────
// ─── Component ──────────────────────────────────────────────
```

## 섹션 구분자

위 `─── Section ───` 주석으로 코드 영역을 구분한다. Types → Constants → Helpers → Component 순서.

## Props

- `user: SessionUser`을 page.tsx에서 전달받는다
- interface Props는 컴포넌트 바로 위에 정의

## 3-상태 처리 (필수)

모든 데이터를 fetch하는 Client는 아래 3가지 상태를 처리한다:

| 상태 | 처리 |
|------|------|
| loading | `<TableSkeleton />` 또는 `<Skeleton />` |
| error | `toast({ title: '로드 실패', variant: 'destructive' })` |
| empty | `<EmptyState />` 컴포넌트 |

## Import 순서

1. `'use client'` (첫 줄, 빈 줄 없이)
2. React hooks (`useState`, `useEffect`, `useCallback` 등)
3. `next-intl` (`useTranslations`)
4. `lucide-react` 아이콘
5. UI 컴포넌트 (`@/components/ui/*`)
6. 공유 컴포넌트 (`@/components/shared/*`)
7. lib/utils (`@/lib/api`, `@/lib/styles/*`, `@/hooks/*`)
8. types (`@/types`)
9. 로컬 컴포넌트 (같은 디렉토리)

## 네이밍

- 페이지 Client: `{Feature}Client.tsx` (예: `AttendanceClient.tsx`)
- 공유 컴포넌트: `PascalCase.tsx`
- feature-specific 하위 컴포넌트: 같은 디렉토리에 배치

## status/variant 매핑

- `@/lib/styles/status`의 `STATUS_VARIANT`를 import해서 사용
- 컴포넌트 내 inline 색상 매핑 금지 (Constants 섹션에서 STATUS_VARIANT 참조)

## 금지

- Client에서 직접 session fetch
- inline 스타일 객체 대신 `cn()` + Tailwind 사용
- `@/components/shared/` 컴포넌트를 feature 폴더에 복제
