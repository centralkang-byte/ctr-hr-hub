---
name: new-crud-module
description: 새 CRUD 모듈 생성 가이드. "새 모듈", "새 기능 추가", "XXX 페이지 만들어줘" 요청에 사용.
---

# 새 CRUD 모듈 생성

이 스킬은 새 기능 모듈을 일관된 구조로 생성한다.
반드시 아래 순서를 따르고, 각 단계에서 해당 규칙(`.claude/rules/`)을 준수한다.

## Step 1: 파일 구조 생성

```
src/app/(dashboard)/{module}/
  page.tsx                    ← rules/pages.md 준수
  {Module}Client.tsx          ← rules/components.md 준수

src/app/api/v1/{module}/
  route.ts                    ← GET (목록) + POST (생성)
  [id]/route.ts               ← GET (상세) + PUT (수정) + DELETE (삭제)
```

## Step 2: Server Page (`page.tsx`)

`rules/pages.md` 표준 템플릿 적용:
- `getServerSession` + `redirect('/login')`
- `<Suspense fallback={<ListPageSkeleton />}>` 래핑
- `<{Module}Client user={user} />` 전달

## Step 3: Client Component (`{Module}Client.tsx`)

`rules/components.md` 표준 구조:

```tsx
'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — {Module} Client
// {한 줄 설명}
// ═══════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────
// ─── Constants ──────────────────────────────────────────────
// ─── Component ──────────────────────────────────────────────

export function {Module}Client({ user }: { user: SessionUser }) {
  // rules/data-fetching.md 패턴: apiClient + useState + useCallback + useEffect
  // 3-상태 처리: loading / error / empty
}
```

## Step 4: API Route — 목록 + 생성 (`route.ts`)

```tsx
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { resolveCompanyId } from '@/lib/api/companyFilter'
import { prisma } from '@/lib/prisma'

// GET: 목록 조회
export const GET = withPermission(
  async (req, _context, user) => {
    const { searchParams } = new URL(req.url)
    const companyId = resolveCompanyId(user, searchParams)
    const pagination = buildPagination(searchParams)

    const [items, total] = await Promise.all([
      prisma.{model}.findMany({
        where: { companyId },
        ...pagination,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.{model}.count({ where: { companyId } }),
    ])

    return apiPaginated(items, total, pagination)
  },
  perm(MODULE.{MODULE_CODE}, ACTION.VIEW)
)

// POST: 생성
export const POST = withPermission(
  async (req, _context, user) => {
    const body = await req.json()
    // Zod validation
    const item = await prisma.{model}.create({ data: { ...body, companyId: user.companyId } })
    return apiSuccess(item, 201)
  },
  perm(MODULE.{MODULE_CODE}, ACTION.CREATE)
)
```

## Step 5: API Route — 상세 + 수정 + 삭제 (`[id]/route.ts`)

```tsx
// GET: 상세
export const GET = withPermission(
  async (req, context, user) => {
    const { id } = await context.params
    const item = await prisma.{model}.findUnique({ where: { id } })
    if (!item) throw notFound()
    return apiSuccess(item)
  },
  perm(MODULE.{MODULE_CODE}, ACTION.VIEW)
)

// PUT: 수정
export const PUT = withPermission(
  async (req, context, user) => {
    const { id } = await context.params
    const body = await req.json()
    // Zod validation
    const item = await prisma.{model}.update({ where: { id }, data: body })
    return apiSuccess(item)
  },
  perm(MODULE.{MODULE_CODE}, ACTION.UPDATE)
)

// DELETE: 삭제 (soft delete 권장)
export const DELETE = withPermission(
  async (req, context, user) => {
    const { id } = await context.params
    await prisma.{model}.update({ where: { id }, data: { deletedAt: new Date() } })
    return apiSuccess({ deleted: true })
  },
  perm(MODULE.{MODULE_CODE}, ACTION.DELETE)
)
```

## Step 6: 상수 등록

`src/lib/constants.ts`의 `MODULE`에 새 모듈 코드가 없으면 추가:

```tsx
export const MODULE = {
  // ... 기존 모듈들
  {NEW_MODULE}: '{new_module}',
} as const
```

## Step 7: 검증 체크리스트

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run lint` — no new warnings
- [ ] page.tsx: session 체크 + Suspense 래핑
- [ ] Client: 3-상태 처리 (loading/error/empty)
- [ ] API route: `withPermission` + `resolveCompanyId`
- [ ] 에러 메시지 한국어
