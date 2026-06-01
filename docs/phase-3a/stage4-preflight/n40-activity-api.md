# N+40 Pre-flight — EmployeeActivity API (RESTful CRUD)

> **base SHA**: `6f4ffe84` · **트랙**: codebase · **우선**: MEDIUM
> **결정 (Stage 3 Q2=A)**: RESTful per model (N+38 패턴 정합)
> **본 pre-flight 결과 (요약)**: ✅ N+38 동일 패턴 정합. 별도 S3 / derived 로직 0.

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### N+38 패턴 cross-ref

`docs/phase-3a/stage4-preflight/n38-education-api.md` 모든 spec 정합. 차이점:
- model = `EmployeeActivity` (학력/자격증과 동일 1:N 패턴)
- 추가 field: `type` (ActivityType enum) + `description` (text)
- derived status 0 (단순 CRUD)
- S3 0 (file 첨부 없음)

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) 신규 endpoint 4건

```
src/app/api/v1/employees/[id]/activities/
├── route.ts             (GET list / POST create, ~80 lines)
└── [recordId]/
    └── route.ts         (GET / PATCH / DELETE, ~80 lines)
```

### (b) Zod schema spec

```ts
export const activityCreateSchema = z.object({
  type: z.enum(['VOLUNTEER', 'CLUB', 'WORKING_GROUP', 'PRESENTATION', 'MENTOR', 'COMMITTEE', 'OTHER']),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable(),
})
```

### (c) 정렬 default

- GET list = `endDate DESC NULLS FIRST, startDate DESC`
- 진행 중 (endDate = null) 최상위, 최근 종료 순

### (d) 예상 총 line delta

- endpoint 4건: +160 lines
- Zod schema (Activity): +30 lines (N+38 파일에 추가)
- **순 총합**: **+190 lines**

---

## §3. i18n / DB / API 영향 평가

- **i18n**: 0 (N+42 PR에서 처리)
- **DB**: 0 (N+37 schema 완료)
- **API**: 4 endpoint 신규
- **S3**: 0 (file 첨부 없음)

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (LOW)**: ActivityType enum 7 values — UI 분류 chip variant 매핑 (N+41 작업)
- **R2 (LOW)**: 단순 CRUD, 회귀 위험 낮음

### 의존성
- **N+37 선행 필수**
- **PR-5A 머지** 후

### 가드
- ❌ N+38 패턴 외 시그니처 신설 금지
- ✅ withRLS wrapper + companyFilter 표준
- ✅ 권한 매트릭스 = N+38 정합

---

## §5. Implementation 단계 (N+37 머지 후)

1. **branch**: `feat/employee-activity-api`
2. **commit 1**: Zod schema (N+38 파일에 Activity 추가)
3. **commit 2**: `/api/v1/employees/[id]/activities/` 4 endpoint
4. **vitest API**: 4 method × 권한 매트릭스
5. **codex Gate 1+2**: 표준
6. **PR open**: `feat/employee-activity-api` → main

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error
- ✅ **lint**: clean
- ✅ **vitest**: 4 method × 권한 = 12+ case
- ✅ **playwright e2e**: activity CRUD 1 시나리오
- ✅ **회귀 0**: 다른 endpoint 무변동

---

**상태**: pre-flight 완료, N+37 선행 의존
**Stage 4 예상 PR 크기**: 2 commits, +190 lines, 2-3 file diff
