# Phase 3a · Batch 06 — 직원 경력 데이터 (격상 트랙)

> **격상 일자**: 2026-05-21 KST (Session 228)
> **격상 사유**: batch 04 N+18 pre-flight 결과 — Education/Certification/Activity 모델 부재. proto 디자인 완벽 적용 default 목표 정합
> **base SHA**: phase3a-audit `7c62b878`
> **사용자 결재**: 2026-05-21 KST (가디언 round 통과)

---

## §1. 격상 배경

batch 04 N+18 (7탭 정렬, EmployeeDetailClient career 탭 추가) pre-flight (`3ef54c7c` — `docs/phase-3a/stage4-preflight/n18-7tab-alignment.md`) finding:

- ⚠️ **DB 무관 주장 부분 정정** — Prisma 에 career 데이터 모델 0건
  - `EmployeeEducation` — 부재
  - `EmployeeCertification` — 부재
  - `EmployeeActivity` — 부재
  - `TrainingEnrollment` — 존재하나 직원 학력/경력 X (교육 프로그램 수강 기록)
- batch 04 N+18 진입 시 결정: **A 접근 = graceful empty + EmptyState 우회로** (단기 해결책, UX 회귀 미)
- **본 batch 06 = 풀스택 데이터 트랙** (schema + RLS + API + UI 통합 진입)

### 격상 의제 (Session 228 사용자 결재 통과)

가디언 default 결정: "proto 디자인 완벽 적용 default 목표 정합". batch 04 N+18 의 graceful empty 는 UX 미완 (career 탭 빈 화면 = 사용자 기대 mismatch). **본 batch 06 = N+18 머지 후 UX 회복 트랙**.

---

## §2. 예상 scope

### DB schema (3 신규 모델)

```prisma
model EmployeeEducation {
  id          String   @id @default(uuid())
  employeeId  String   @map("employee_id")
  companyId   String   @map("company_id")
  schoolName  String   @db.VarChar(200)
  degree      EducationDegree    // HS/AA/BA/MA/PHD 등 enum
  major       String?  @db.VarChar(100)
  gpa         Decimal? @db.Decimal(3, 2)
  startDate   DateTime @db.Date
  endDate     DateTime? @db.Date
  isCurrent   Boolean  @default(false)
  attachmentUrl String?  // S3 졸업증명서 link
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  employee Employee @relation(fields: [employeeId], references: [id])
  company  Company  @relation(fields: [companyId], references: [id])

  @@map("employee_educations")
}

model EmployeeCertification {
  id           String   @id @default(uuid())
  employeeId   String
  companyId    String
  name         String   @db.VarChar(200)
  issuer       String?  @db.VarChar(150)
  issueDate    DateTime @db.Date
  expiryDate   DateTime? @db.Date
  credentialNo String?  @db.VarChar(100)
  attachmentUrl String?
  createdAt    DateTime @default(now())
  // ... 동일 패턴
}

model EmployeeActivity {
  id          String   @id @default(uuid())
  employeeId  String
  companyId   String
  type        ActivityType   // INTERNAL_COMMITTEE / VOLUNTEER / CLUB / PRESENTATION 등
  title       String   @db.VarChar(200)
  description String?  @db.Text
  startDate   DateTime @db.Date
  endDate     DateTime? @db.Date
  // ... 동일 패턴
}
```

### API (12 endpoint)

- 3 model × 4 method (GET list / POST create / PATCH update / DELETE) = 12 routes
- 권한: HR_ADMIN / 본인 (`/api/v1/employees/[id]/{education,certifications,activities}/`)
- RLS: companyFilter 표준 + employee.companyId 정합 + 본인 self-service

### UI (4 섹션, CareerTab.tsx 확장)

batch 04 N+18 의 graceful empty CareerTab → 풀 CRUD UI:
- 학력 섹션 (EmployeeEducation list + add modal)
- 자격증 섹션 (EmployeeCertification list + add modal)
- 사내교육 섹션 (TrainingEnrollment lookup 재사용)
- 사내활동 섹션 (EmployeeActivity list + add modal)

### i18n

- 3 model × 평균 12 키 × 5 locale = ~180 entries
- + UI label/dialog/validation messages

### 작업 규모 추정

- **~1주 작업** (schema + migration + RLS + API + UI + i18n)
- 단독 PR 또는 N+18 implementation 합본

---

## §3. 의존성

### 선행 의존
- **batch 04 N+18 implementation 완료 후** 진입 권고 (UX 회귀 회피)
- 또는 **N+18 implementation 합본 PR** (동시 진행 — graceful empty 우회로 skip + 풀 CRUD 진입)

### Cross-batch 의존
- **batch 04 N+18 ↔ batch 06**: 두 트랙 동시 진행 가능
- **batch 07 N+33 ONBOARD_STEPS default seed**: TrainingEnrollment cross-ref (사내교육 섹션 데이터 source)
- **PR-5A 머지** 필요 (모든 codebase 트랙)

---

## §4. 다음 액션

1. **Stage 1 P0 audit** (별도 turn)
   - proto career tab 4 섹션 data inventory
   - 기존 Prisma 모델 (`TrainingEnrollment` 등) cross-ref
2. **Schema design**
   - 3 model + 2-3 enum + 관계 설계
   - migration script + idempotent seed
3. **API design**
   - 12 endpoint inventory
   - 권한 매트릭스 (HR_ADMIN / SUPER_ADMIN / 본인 self-service)
4. **Stage 2 카드 별도 작성** (batch 06 audit card)
5. **Stage 3 게이트 + Stage 4 pre-flight + implementation**

---

## §5. 가드

- ❌ **batch 04 N+18 implementation 전 단독 진입 금지** (graceful empty UX 회귀 위험)
- ❌ Prisma model field 신설 시 RLS 가드 누락 금지 (`companyId` 필수)
- ❌ 본인 self-service 권한 + HR 관리자 권한 분기 명시
- ✅ Stage 4 implementation PR 합본 또는 별도 PR (가디언 결정 게이트)
- ✅ batch 07 N+33 TrainingEnrollment cross-ref 정합 (사내교육 섹션)

---

## §6. RECORD 번호 reserve

본 batch는 풀스택 트랙 = RECORD 다수 발생 예상. **N+37~** reserve (batch 07 까지 N+36 사용 후).

예상 RECORD inventory (Stage 2 audit 후 확정):
- N+37: schema 신설 (3 model + enum) [HIGH]
- N+38: API 12 endpoint [HIGH]
- N+39: RLS 가드 [HIGH]
- N+40: CareerTab UI 4 섹션 풀 CRUD [HIGH]
- N+41: i18n 180+ entries [MEDIUM]
- N+42: 본인 self-service vs HR 관리자 권한 매트릭스 [MEDIUM]
- (Stage 2 audit 시 추가)

---

**상태**: 격상 결정 (Stage 2 카드 작성 대기)
**다음 갱신**: batch 06 Stage 2 audit card 작성 별도 turn
