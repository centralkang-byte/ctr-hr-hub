# N+37 Pre-flight — Schema 신설 (3 model + 3 enum + RLS + migration) ⭐ 선행

> **base SHA**: `6f4ffe84` · **트랙**: Prisma migration · **우선**: HIGH (선행)
> **결정 (Stage 3 Q1=A 가디언 default)**: 3 신규 model + TrainingEnrollment 재사용 (교육 섹션)
> **본 pre-flight 결과 (요약)**: ✅ schema 패턴 정합. 기존 LeaveRequest / EmployeeAssignment 1:N 정합. RLS companyFilter SSOT.

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### 기존 1:N 관계 패턴 (cross-ref)

```prisma
// prisma/schema.prisma:1622 EmployeeAssignment (1:N from Employee)
// prisma/schema.prisma:2245 LeaveRequest (1:N from Employee)
```

→ **EmployeeEducation / EmployeeCertification / EmployeeActivity = 동일 1:N 패턴 정합**

### RLS SSOT 패턴

- `src/lib/api/companyFilter.ts` (resolveCompanyId — security SSOT, DO NOT TOUCH)
- `src/lib/api/withRLS.ts` (withRLS transaction wrapper)
- 기존 모델 `companyId` 필드 + RLS policy 적용 surface 다수

### enum naming convention

- 기존 enum: `LeaveStatus / OnboardingProgressStatus / TaskProgressStatus 등`
- naming: PascalCase, semantic prefix (e.g., `Education*`)

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) Prisma schema 변경

| 파일 | 변경 | line delta |
|---|---|---|
| `prisma/schema.prisma` | 3 model + 3 enum + Employee relation 추가 | +120 |
| `prisma/migrations/{timestamp}_add_employee_career_models/migration.sql` | **신규** migration | +80 (자동 생성) |

### (b) Schema spec

```prisma
model EmployeeEducation {
  id              String          @id @default(uuid())
  employeeId      String          @map("employee_id")
  companyId       String          @map("company_id")
  school          String          @db.VarChar(200)
  major           String?         @db.VarChar(150)
  degree          EducationDegree
  startDate       DateTime        @map("start_date") @db.Date
  endDate         DateTime?       @map("end_date") @db.Date
  status          EducationStatus
  certificateUrl  String?         @map("certificate_url")
  createdAt       DateTime        @default(now()) @map("created_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")
  deletedAt       DateTime?       @map("deleted_at")

  employee Employee @relation("EmployeeEducations", fields: [employeeId], references: [id])
  company  Company  @relation("EmployeeEducationsCompany", fields: [companyId], references: [id])

  @@index([employeeId, deletedAt])
  @@index([companyId])
  @@map("employee_educations")
}

model EmployeeCertification {
  // 동일 패턴
  // 필드: name / issuer / credentialNo / acquiredAt / expiresAt / certificateUrl
}

model EmployeeActivity {
  // 동일 패턴
  // 필드: type (ActivityType) / title / description / startDate / endDate
}

enum EducationDegree { HIGH_SCHOOL ASSOCIATE BACHELOR MASTER DOCTORATE OTHER }
enum EducationStatus { GRADUATED ATTENDING WITHDRAWN COMPLETED }
enum ActivityType { VOLUNTEER CLUB WORKING_GROUP PRESENTATION MENTOR COMMITTEE OTHER }
```

### (c) Employee model relation 추가

```prisma
// Employee model에 3 relation 추가
educations     EmployeeEducation[]      @relation("EmployeeEducations")
certifications EmployeeCertification[]  @relation("EmployeeCertifications")
activities     EmployeeActivity[]       @relation("EmployeeActivities")
```

### (d) Company model relation 추가 (RLS)

```prisma
// Company model에 3 relation 추가 (RLS scope)
employeeEducations     EmployeeEducation[]      @relation("EmployeeEducationsCompany")
employeeCertifications EmployeeCertification[]  @relation("EmployeeCertificationsCompany")
employeeActivities     EmployeeActivity[]       @relation("EmployeeActivitiesCompany")
```

### (e) 예상 총 line delta

- schema.prisma: +120
- migration SQL: +80 (자동 생성, manual edit 0)
- **순 총합**: ~200 lines (schema + migration)

---

## §3. RLS / Migration / 검증

### RLS policy

- 기존 패턴 (`src/lib/api/withRLS.ts` + `companyFilter`) 재사용
- API 라우트에서 `withRLS(async (tx) => {...})` wrapper 적용
- schema 자체에 RLS policy 신설 0 (DB level RLS는 supabase config 별도)

### Migration spec

```bash
npx prisma migrate dev --name add_employee_career_models
```

- migration 파일: `prisma/migrations/{timestamp}_add_employee_career_models/migration.sql`
- 자동 생성 SQL = `CREATE TABLE employee_educations / employee_certifications / employee_activities` + 3 enum 신설 + foreign key + 인덱스

### Rollback 시나리오

- `npx prisma migrate reset` (개발용)
- production: 별도 down migration 신설 (DROP TABLE × 3 + DROP TYPE × 3)
- migration 진입 전 staging 검증 필수

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (LOW)**: 신규 model = 빈 테이블, 회귀 위험 0
- **R2 (LOW)**: Employee model에 relation 추가 시 다른 컴파일 의존성 변동 검증 필요 (Prisma Client regenerate)
- **R3 (MEDIUM)**: production migration 적용 시점 (PR-5A 머지 + ~~staging 검증~~)

### 의존성
- **PR-5A 머지** 후 진입
- 다른 RECORD 의존성 0 (선행 RECORD)

### 가드
- ❌ Employee model에 추가 외 다른 model 변경 금지 (회귀 위험)
- ❌ DO NOT TOUCH `prisma/schema.prisma` 가드 — migration plan 사전 합의 필수 (CLAUDE.md)
- ❌ RLS policy schema 자체 변경 금지 (기존 SSOT 재사용)
- ✅ Prisma migrate dev 후 `prisma generate` 자동 실행
- ✅ vitest schema 검증 + migration rollback 시나리오

---

## §5. Implementation 단계 (PR-5A 머지 후, 선행 RECORD)

1. **사전 합의 게이트**: schema spec finalize (필드 + 인덱스 + 관계)
2. **branch**: `feat/employee-career-schema`
3. **commit 1**: `prisma/schema.prisma` 3 model + 3 enum + Employee/Company relation 추가
4. **commit 2**: `npx prisma migrate dev --name add_employee_career_models` 자동 생성 SQL commit
5. **vitest 단위**: 3 model CRUD 기본 검증
6. **staging 검증**: production migration 적용 전 staging DB에서 validate
7. **codex Gate 1+2**: 표준
8. **PR open**: `feat/employee-career-schema` → main

---

## §6. Verification (verify 계획)

- ✅ **tsc**: `npx tsc --noEmit` 0 error
- ✅ **lint**: clean
- ✅ **prisma generate**: 자동 실행 PASS
- ✅ **prisma migrate status**: up to date
- ✅ **vitest**: 3 model CRUD 단위
- ✅ **회귀 0**: 다른 model schema 무변동

---

**상태**: pre-flight 완료, 선행 RECORD (N+38/N+39/N+40 의존)
**Stage 4 예상 PR 크기**: 2 commits, +200 lines (schema + migration), 2-3 file diff
