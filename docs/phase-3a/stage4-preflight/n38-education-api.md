# N+38 Pre-flight — EmployeeEducation API (RESTful CRUD)

> **base SHA**: `6f4ffe84` · **트랙**: codebase · **우선**: HIGH
> **결정 (Stage 3 Q2=A)**: RESTful per model (4 endpoints)
> **본 pre-flight 결과 (요약)**: ✅ 기존 `/api/v1/employees/[id]/*` nested route 패턴 정합 (12+ surface 존재).

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### 기존 nested route 패턴 cross-ref

```
src/app/api/v1/employees/[id]/
├── assignments/           (1:N CRUD 패턴 cross-ref)
├── certificate-requests/  (1:N + approval workflow)
├── compensation/
├── contract/ / contracts/
├── documents/
├── histories/ / history/
├── insights/
├── offboarding/
├── probation/
├── schedules/
├── snapshot/
├── transfer/
└── work-permits/          (1:N CRUD 패턴 cross-ref)
```

→ **`/api/v1/employees/[id]/education/` = 동일 패턴 정합** (12+ surface 정합)

### Zod validation SSOT

- 기존 패턴: `src/lib/schemas/` 또는 endpoint inline Zod
- naming: `employeeEducationSchema` / `educationCreateSchema` 추정

### RLS scope

- `withRLS` wrapper + `companyFilter.ts` 표준 패턴
- 기존 endpoint 모두 동일 wrapper 사용

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) 신규 endpoint 4건

```
src/app/api/v1/employees/[id]/education/
├── route.ts             (GET list / POST create, ~80 lines)
└── [recordId]/
    └── route.ts         (GET / PATCH / DELETE, ~80 lines)
```

| 파일 | 변경 | line delta |
|---|---|---|
| `route.ts` (list + create) | 신규 | +80 |
| `[recordId]/route.ts` (read + update + delete) | 신규 | +80 |
| `src/lib/schemas/employee-career.ts` (Zod) | 신규 | +50 |
| **순 총합** | — | **+210 lines** |

### (b) Zod schema spec

```ts
import { z } from 'zod'

export const educationCreateSchema = z.object({
  school: z.string().min(1).max(200),
  major: z.string().max(150).optional(),
  degree: z.enum(['HIGH_SCHOOL', 'ASSOCIATE', 'BACHELOR', 'MASTER', 'DOCTORATE', 'OTHER']),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable(),
  status: z.enum(['GRADUATED', 'ATTENDING', 'WITHDRAWN', 'COMPLETED']),
  certificateUrl: z.string().url().optional(),
})

export const educationUpdateSchema = educationCreateSchema.partial()
```

### (c) 권한 매트릭스

| Action | HR_ADMIN / SUPER_ADMIN | EMPLOYEE (self-service) | MANAGER (팀원) |
|---|---|---|---|
| GET (list) | ✅ 전체 | ✅ 본인만 | ✅ read-only |
| POST (create) | ✅ | ✅ 본인만 | ❌ |
| PATCH (update) | ✅ | ✅ 본인만 | ❌ |
| DELETE (soft delete) | ✅ | ✅ 본인만 | ❌ |

### (d) 정렬 default

- GET list = `endDate DESC NULLS FIRST, startDate DESC`
- 재학 중 (endDate = null) 최상위, 최근 졸업 순

---

## §3. i18n / DB / API 영향 평가

- **i18n**: 0 (server-side validation messages는 별도, N+42 에서 처리)
- **DB**: 0 (N+37 schema 완료 후 진입)
- **API**: 4 endpoint 신규 (path 명확)

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (LOW)**: 기존 `/api/v1/employees/[id]/*` 패턴 12+ surface 정합 → 회귀 위험 낮음
- **R2 (LOW)**: Zod schema enum mismatch (Prisma enum vs Zod literal) → CI에서 catch

### 의존성
- **N+37 선행 필수** (schema migration 머지 후 진입)
- **PR-5A 머지** 후

### 가드
- ❌ 다른 nested route 시그니처 변경 금지
- ❌ Zod schema enum literal 직접 작성 금지 (Prisma enum 정합)
- ✅ withRLS wrapper + companyFilter 표준 패턴
- ✅ 권한 매트릭스 가드 (HR_ADMIN / 본인 / MANAGER 분리)

---

## §5. Implementation 단계 (N+37 머지 후)

1. **사전 합의 게이트**: Zod schema spec finalize
2. **branch**: `feat/employee-education-api`
3. **commit 1**: Zod schema 신설 (`src/lib/schemas/employee-career.ts`)
4. **commit 2**: `/api/v1/employees/[id]/education/route.ts` (list + create)
5. **commit 3**: `/api/v1/employees/[id]/education/[recordId]/route.ts` (read + update + delete)
6. **vitest API**: 4 method × 권한 매트릭스 (HR_ADMIN / 본인 / MANAGER × 12 case)
7. **codex Gate 1+2**: 표준
8. **PR open**: `feat/employee-education-api` → main

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error
- ✅ **lint**: clean
- ✅ **vitest**: 4 method × 권한 = 12+ case
- ✅ **playwright e2e**: education CRUD 1 시나리오
- ✅ **회귀 0**: 다른 `/api/v1/employees/[id]/*` endpoint 무변동

---

**상태**: pre-flight 완료, N+37 선행 의존
**Stage 4 예상 PR 크기**: 3 commits, +210 lines, 3 file diff
