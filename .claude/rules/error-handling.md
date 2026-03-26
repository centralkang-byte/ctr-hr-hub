---
paths: ["src/**"]
---

# Error Handling 규칙

표준 원본: `src/lib/errors.ts` (AppError), `src/lib/api.ts` (apiError)

## 계층별 에러 처리

### API Route (Server)

```tsx
import { AppError, notFound, forbidden, badRequest, conflict, handlePrismaError } from '@/lib/errors'

// AppError 팩토리 사용 — Error 직접 throw 금지
throw notFound('직원을 찾을 수 없습니다.')
throw forbidden('접근 권한이 없습니다.')
throw badRequest('필수 항목이 누락되었습니다.', { field: 'name' })
throw conflict('이미 존재하는 데이터입니다.')

// Prisma 에러는 handlePrismaError()로 변환
catch (error) {
  throw handlePrismaError(error)
}

// 응답은 apiError()로 — withPermission 래퍼가 자동 처리
```

### Client Component

```tsx
import { toast } from '@/hooks/use-toast'

try {
  await apiClient.post('/api/v1/xxx', data)
  toast({ title: '저장되었습니다' })
} catch (err) {
  toast({
    title: '저장 실패',
    description: err instanceof Error ? err.message : '다시 시도해 주세요.',
    variant: 'destructive',
  })
}
```

## toast 패턴

| 상황 | title | variant |
|------|-------|---------|
| 성공 | 동작 완료 (2-4자): `저장되었습니다`, `삭제되었습니다` | 생략 (default) |
| 실패 | 동작 실패: `저장 실패`, `로드 실패` | `'destructive'` |
| description | 선택: 구체적 사유 또는 `err.message` | — |

## 금지

- `alert()` 사용
- `console.error()`로 에러 삼키기 (로깅만 하고 사용자에게 안 보여주기)
- 빈 catch 블록 `catch (e) {}`
- `Error` 직접 throw → `AppError` 팩토리 사용
- 에러 메시지 영어 → 한국어로 작성
