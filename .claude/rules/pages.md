---
paths: ["src/app/**/page.tsx"]
---

# Server Page 규칙

표준 원본: `src/app/(dashboard)/employees/page.tsx`

## 필수 구조

모든 `(dashboard)` 하위 page.tsx는 아래 템플릿을 따른다:

```tsx
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /{route} (Server Page)
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { XxxClient } from './XxxClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function XxxPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <XxxClient user={user} />
    </Suspense>
  )
}
```

## Suspense fallback 선택

| 페이지 유형 | Skeleton |
|-------------|----------|
| 목록/테이블 | `ListPageSkeleton` |
| 대시보드/KPI | `HomeSkeleton` |
| 차트/분석 | `ChartSkeleton` |
| 모두 `@/components/shared/PageSkeleton`에서 import |

## 금지

- Suspense 없이 Client 직접 렌더링
- session 체크 없는 pass-through (`return <XxxClient />`)
- page.tsx 안에서 inline JSX 레이아웃 (탭, 카드 등 직접 배치)
- Client에서 자체적으로 session fetch

## 예외

- `(auth)` 하위 (login, register): session 체크 불필요
- settings 하위 탭 라우트: 부모 layout에서 session 처리 시 생략 가능
