---
name: add-rbac
description: 기존 기능에 RBAC 권한 체크 추가. "권한 추가", "RBAC 적용", "접근 제한" 요청에 사용.
---

# RBAC 권한 추가 가이드

기존 기능에 역할 기반 접근 제어를 추가하는 체크리스트.

## Step 1: MODULE 상수 확인

`src/lib/constants.ts`에 해당 모듈이 있는지 확인:

```tsx
export const MODULE = {
  EMPLOYEES: 'employees',
  ATTENDANCE: 'attendance',
  // ... 없으면 추가
} as const
```

## Step 2: API Route에 withPermission 적용

기존 route를 `withPermission` 래퍼로 감싼다:

```tsx
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'

// Before (보호 없음)
export async function GET(req: NextRequest) { ... }

// After (RBAC 적용)
export const GET = withPermission(
  async (req, _context, user) => {
    // user.companyId, user.role 등 사용 가능
    // ...
    return apiSuccess(data)
  },
  perm(MODULE.{XXX}, ACTION.VIEW)
)
```

### ACTION 매핑

| HTTP Method | ACTION | 설명 |
|-------------|--------|------|
| GET | `ACTION.VIEW` | 조회 |
| POST | `ACTION.CREATE` | 생성 |
| PUT/PATCH | `ACTION.UPDATE` | 수정 |
| DELETE | `ACTION.DELETE` | 삭제 |
| 승인/반려 | `ACTION.APPROVE` | 관리 작업 |

## Step 3: Company 스코핑

`resolveCompanyId`로 회사 범위를 제한한다:

```tsx
import { resolveCompanyId } from '@/lib/api/companyFilter'

// SUPER_ADMIN: queryCompanyId 파라미터 허용
// 나머지: user.companyId로 자동 스코핑
const companyId = resolveCompanyId(user, searchParams)
```

## Step 4: Client-side 조건부 렌더링 (선택)

역할에 따라 UI를 분기할 때:

```tsx
import { hasPermission } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'

// 버튼 표시/숨김
{hasPermission(user, perm(MODULE.XXX, ACTION.CREATE)) && (
  <Button>추가</Button>
)}

// 역할별 분기
if (user.role === ROLE.SUPER_ADMIN || user.role === ROLE.HR_ADMIN) {
  // 관리자 뷰
} else if (user.role === ROLE.MANAGER) {
  // 매니저 뷰 (팀원만 조회)
} else {
  // 직원 뷰 (본인만)
}
```

## Step 5: 역할별 데이터 필터링

| 역할 | 데이터 범위 |
|------|-------------|
| SUPER_ADMIN | 전체 법인 (queryCompanyId로 전환) |
| HR_ADMIN | 소속 법인 전체 |
| EXECUTIVE | 소속 법인 전체 (읽기 중심) |
| MANAGER | 직속 팀원 (`Position.reportsToPositionId` 기반) |
| EMPLOYEE | 본인만 (`user.employeeId`) |

## 주의사항

- `prisma/schema.prisma`는 DO NOT TOUCH — 새 Permission row는 seed에서 추가
- Manager 관계는 `managerId`가 아닌 `Position.reportsToPositionId` 사용
- `resolveCompanyId`는 `@/lib/api/companyFilter.ts` — DO NOT TOUCH (보안 SSOT)

## 검증 체크리스트

- [ ] API route에 `withPermission` 래퍼 적용
- [ ] `resolveCompanyId`로 company 스코핑
- [ ] 권한 없는 사용자가 403 응답 받는지 확인
- [ ] Client에서 역할별 UI 분기 (해당 시)
- [ ] `npx tsc --noEmit` 통과
