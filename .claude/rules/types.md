---
paths: ["src/types/**", "src/**/*.ts", "src/**/*.tsx"]
---

# Type 규칙

표준 원본: `src/types/index.ts`

## 타입 위치 결정

| 위치 | 용도 | 예시 |
|------|------|------|
| `@/types/index.ts` | 공통 타입, Prisma re-export | `SessionUser`, `ApiResponse`, `Company` |
| `@/types/{domain}.ts` | 도메인별 공유 타입 (2+ 파일에서 사용) | `@/types/assignment.ts` |
| 컴포넌트 파일 내 | 해당 컴포넌트 전용 | API 응답 타입, 로컬 state 타입 |

## 규칙

- Prisma 모델은 `@/types`에서 re-export된 것을 import (`@/generated/prisma` 직접 import 금지)
- enum은 `@/generated/prisma/enums`에서 import (이것만 예외)
- API 응답용 타입은 Prisma 타입을 extends 하지 않고 별도 interface로 정의
- interface Props는 컴포넌트 바로 위 `─── Types ───` 섹션에 정의
- 컴포넌트 전용 타입도 `─── Types ───` 섹션에 배치

## 컴포넌트 내 타입 패턴

```tsx
// ─── Types ──────────────────────────────────────────────────

interface AttendanceRecord {
  id: string
  workDate: string
  status: string
  // ...
}

interface Props {
  user: SessionUser
}
```

## 금지

- `any` 타입 사용 (부득이한 경우 `unknown` + type guard)
- Prisma 타입을 API 응답으로 직접 반환 (필요한 필드만 pick하거나 별도 interface)
- 같은 타입을 여러 파일에 중복 정의 → `@/types`로 추출
