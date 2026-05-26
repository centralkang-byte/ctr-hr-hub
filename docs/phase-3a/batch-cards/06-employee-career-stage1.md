# Phase 3a · Batch 06 — 직원 경력 데이터 Stage 1 P0 Audit

> Stage 1 P0 audit (풀스택 데이터 트랙)
> **base SHA**: `2377b836`
> **작성일**: 2026-05-21 KST (Session 228)
> proto career tab 4 섹션 readonly inventory + schema design 사전

---

## §0. 1분 요약

- **4 섹션** (학력 / 자격증 / 교육 이수 / 사내 활동)
- proto career tab 인라인 데이터 inventory (강성민 default 예시)
- ✅ **codebase Prisma 모델 부재 재확인** (가디언 사전 가정 정합 — batch 04 N+18 finding 재검증)
- ✅ **TrainingEnrollment 재사용 가능** (교육 섹션 cross-ref)
- **15 findings** (HIGH 5 / MED 7 / LOW 3) — CR-001 ~ CR-015
- **Stage 2 의제**: Schema design + API 패턴 + UI surface + 입력 패턴 + N+18 폐기 시점 + i18n/a11y (Q1-Q6)
- **RECORD N+37~N+42** 6 surface 매핑

---

## §1. proto 데이터 inventory (4 섹션)

### 1.1 학력 (3 entries inline, `page-employee-detail.jsx:347-369`)

```jsx
[
  { school: "서울대학교 대학원", major: "산업공학 석사", period: "2018.03 — 2020.02", status: "졸업" },
  { school: "한양대학교",       major: "산업공학 학사", period: "2014.03 — 2018.02", status: "졸업" },
  { school: "서울고등학교",     major: "이공계열",     period: "2011.03 — 2014.02", status: "졸업" },
]
```

**필드 inventory**:
- `school` (string) — 학교명
- `major` (string) — 전공/계열
- `period` (string display) — "YYYY.MM — YYYY.MM" (실 DB는 startDate + endDate)
- `status` (enum) — 졸업 / 재학 중 / 중퇴 / 수료 추정

**입력 패턴 (proto 부재)**: 인라인 데이터만, 입력 UI 없음 → 본 batch 06에서 신설

### 1.2 자격증 / 인증 (5 entries inline, `:373-385`)

```jsx
PMP / PMI / 2023.06 / 유효
정보처리기사 / 한국산업인력공단 / 2019.05 / 유효
TOEIC 950 / ETS / 2022.11 / 갱신 임박  ← chip warning
AWS Solutions Architect / Amazon / 2024.03 / 유효
Six Sigma Green Belt / 사내 / 2024.09 / 유효
```

**필드 inventory**:
- `name` (string) — 자격증명
- `issuer` (string) — 발급기관 (사내 / 외부)
- `acquiredAt` (date YYYY.MM display) — 취득일
- `status` (enum) — **유효 / 갱신 임박 / 만료**
- (proto 부재이나 추정): `expiresAt` (date) — 만료일 (status 자동 계산)
- (proto 부재): `certificateUrl` (string) — S3 첨부

**display sub**: "5건" (자격증 카운트)

### 1.3 교육 이수 이력 (5 entries inline, `:388-414`)

```jsx
[
  { course: "리더십 부트캠프 Lv.2", hours: 24, type: "내부", date: "2025.11", status: "수료" },
  { course: "데이터 분석 입문",      hours: 16, type: "외부", date: "2025.09", status: "수료" },
  { course: "직장 내 괴롭힘 예방 (법정)", hours: 1, type: "법정", date: "2025.06", status: "수료" },
  { course: "정보보안 기초 (법정)",    hours: 2, type: "법정", date: "2025.03", status: "수료" },
  { course: "Workday 사용자 교육",   hours: 4, type: "내부", date: "2025.02", status: "수료" },
]
```

**필드 inventory**:
- `course` (string) — 과정명
- `hours` (number) — 이수 시간
- `type` (enum) — **내부 / 외부 / 법정**
- `date` (date YYYY.MM display) — 이수일
- `status` (enum) — **수료 / 진행 / 미수료**

**⭐ TrainingEnrollment cross-ref 가능성**:
- 코드베이스 `TrainingEnrollment` 모델 = `source` 필드 ("manual | gap_recommendation | mandatory_auto | onboarding")
- proto `type` ↔ codebase `source` 매핑:
  - 법정 ↔ `mandatory_auto`
  - 내부 ↔ `manual` 또는 `onboarding`
  - 외부 ↔ `manual` (외부 source)
- 필드 매핑: `course`/`hours`/`date`/`status` 모두 TrainingEnrollment + 관련 TrainingCourse 모델에 존재 추정

**display sub**: "12개월" (lookback window)

### 1.4 사내 활동 (5 chip array inline, `:418-426`)

```jsx
["사내 봉사단", "독서 동아리 회장", "OKR 워킹그룹", "사내 발표 (2025 H1)", "신입 멘토"]
```

**필드 inventory** (proto = 단순 chip):
- proto = 단순 string array (`title` 만)
- 본 batch 06에서 확장 필요:
  - `type` (enum) — 봉사 / 동아리 / 워킹그룹 / 발표 / 멘토 / 기타
  - `title` (string) — 활동명
  - `startDate` / `endDate` (date) — 활동 기간
  - `description` (string nullable) — 상세 설명

**입력 패턴**: chip add (proto 부재, 단순 form)

---

## §2. codebase 모델 부재 재확인 (batch 04 N+18 cross-ref)

### batch 04 N+18 pre-flight (`3ef54c7c` — `docs/phase-3a/stage4-preflight/n18-7tab-alignment.md`) finding 재검증

**CC grep 검증 결과** (HEAD `2377b836`):
```
$ grep -inE "EmployeeEducation|EmployeeCertification|EmployeeActivity|EducationHistory|CertificationRecord" prisma/schema.prisma
(empty)
```

→ ✅ **(a) 0건 정합** — 가디언 사전 가정 정합. batch 06 schema 신설 sound.

### TrainingEnrollment 기존 존재 ✅

```prisma
model TrainingEnrollment {
  id             String
  courseId       String           @map("course_id")
  employeeId     String           @map("employee_id")
  status         EnrollmentStatus
  source         String           @default("manual")  // manual | gap_recommendation | mandatory_auto | onboarding
  enrolledAt     DateTime
  startDate      DateTime?
  completedAt    DateTime?
  expiresAt      DateTime?        // 법정교육 유효기간 만료일
  score          Decimal?
  certificateKey String?          @map("certificate_key")
  notes          String?
}
```

→ **교육 섹션 (1.3) = TrainingEnrollment 재사용 가능** (필드 모두 정합, source enum 매핑 가능)

---

## §3. Schema design 사전 인벤토리

### 3.1 EmployeeEducation (신규)

```prisma
model EmployeeEducation {
  id              String   @id @default(uuid())
  employeeId      String   @map("employee_id")
  companyId       String   @map("company_id")        // RLS
  school          String   @db.VarChar(200)
  major           String?  @db.VarChar(150)
  degree          EducationDegree                    // 신규 enum
  startDate       DateTime @map("start_date") @db.Date
  endDate         DateTime? @map("end_date") @db.Date  // 재학 중 = null
  status          EducationStatus                    // 신규 enum
  certificateUrl  String?  @map("certificate_url")   // 졸업증명서 S3
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  employee Employee @relation(fields: [employeeId], references: [id])
  company  Company  @relation(fields: [companyId], references: [id])

  @@map("employee_educations")
}

enum EducationDegree {
  HIGH_SCHOOL    // 고등학교
  ASSOCIATE      // 전문대 (학사 이하)
  BACHELOR       // 학사
  MASTER         // 석사
  DOCTORATE      // 박사
  OTHER
}

enum EducationStatus {
  GRADUATED      // 졸업
  ATTENDING      // 재학 중
  WITHDRAWN      // 중퇴
  COMPLETED      // 수료
}
```

### 3.2 EmployeeCertification (신규)

```prisma
model EmployeeCertification {
  id              String   @id @default(uuid())
  employeeId      String   @map("employee_id")
  companyId       String   @map("company_id")
  name            String   @db.VarChar(200)
  issuer          String?  @db.VarChar(150)
  credentialNo    String?  @map("credential_no") @db.VarChar(100)
  acquiredAt      DateTime @map("acquired_at") @db.Date
  expiresAt       DateTime? @map("expires_at") @db.Date  // 만료 없음 = null
  certificateUrl  String?  @map("certificate_url")        // 자격증 사본 S3
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?

  employee Employee @relation(fields: [employeeId], references: [id])
  company  Company  @relation(fields: [companyId], references: [id])

  @@map("employee_certifications")
}
```

**status 계산**: `expiresAt` 기반 derived (DB 저장 X)
- `expiresAt === null` → "유효"
- `expiresAt > now + 90days` → "유효"
- `now <= expiresAt <= now + 90days` → "갱신 임박"
- `expiresAt < now` → "만료"

### 3.3 EmployeeActivity (신규)

```prisma
model EmployeeActivity {
  id           String   @id @default(uuid())
  employeeId   String   @map("employee_id")
  companyId    String   @map("company_id")
  type         ActivityType                           // 신규 enum
  title        String   @db.VarChar(200)
  description  String?  @db.Text
  startDate    DateTime @map("start_date") @db.Date
  endDate      DateTime? @map("end_date") @db.Date     // 진행 중 = null
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  deletedAt    DateTime?

  employee Employee @relation(fields: [employeeId], references: [id])
  company  Company  @relation(fields: [companyId], references: [id])

  @@map("employee_activities")
}

enum ActivityType {
  VOLUNTEER          // 봉사
  CLUB               // 동아리
  WORKING_GROUP      // 워킹그룹
  PRESENTATION       // 발표
  MENTOR             // 멘토
  COMMITTEE          // 위원회
  OTHER
}
```

### 3.4 TrainingEnrollment (기존 재사용)

- 교육 섹션 (1.3) = TrainingEnrollment + TrainingCourse 조인
- `source` enum 매핑:
  - `mandatory_auto` ↔ proto `법정`
  - `manual` ↔ proto `내부`/`외부` (TrainingCourse의 별도 field로 구분 가능)
  - `gap_recommendation` / `onboarding` ↔ proto `내부` 변형
- **schema 변경 0** (기존 모델 그대로 사용)
- 단 `source = manual` 케이스에서 "내부 vs 외부" 구분 필요 시 TrainingCourse 모델에 `externalProvider` 필드 추가 검토

---

## §4. API design 사전 인벤토리

### 4.1 RESTful per model (옵션 A)

**3 신규 모델 × 4 method = 12 endpoints**:
```
GET    /api/v1/employees/[id]/educations              (list)
POST   /api/v1/employees/[id]/educations              (create)
PATCH  /api/v1/employees/[id]/educations/[recordId]   (update)
DELETE /api/v1/employees/[id]/educations/[recordId]   (delete)

GET    /api/v1/employees/[id]/certifications
POST   /api/v1/employees/[id]/certifications
PATCH  /api/v1/employees/[id]/certifications/[recordId]
DELETE /api/v1/employees/[id]/certifications/[recordId]

GET    /api/v1/employees/[id]/activities
POST   /api/v1/employees/[id]/activities
PATCH  /api/v1/employees/[id]/activities/[recordId]
DELETE /api/v1/employees/[id]/activities/[recordId]
```

교육 = 기존 `/api/v1/training/*` 재사용 (별도 endpoint 0)

**장점**:
- 명확한 자원 분리
- 권한 가드 per resource 명확 (HR_ADMIN / 본인)
- 코드베이스 기존 `/api/v1/employees/[id]/{contracts,documents,...}` 패턴 정합

### 4.2 Nested 통합 (옵션 B)

```
GET    /api/v1/employees/[id]/career      (4 섹션 통합 read, training join)
POST   /api/v1/employees/[id]/career      (type 필드 + payload union — 자원 식별 어려움)
```

**단점**:
- create/update/delete 자원 식별 복잡 (type discriminator 필요)
- 4 섹션 권한 분리 어려움 (단일 endpoint)

→ **추천 = 옵션 A (RESTful per model)** + 교육 = TrainingEnrollment 재사용

### 4.3 권한 매트릭스

| Action | Resource | HR_ADMIN | SUPER_ADMIN | 본인 (EMPLOYEE self-service) | MANAGER |
|---|---|---|---|---|---|
| GET | educations/certifications/activities | ✅ | ✅ | ✅ (본인만) | ✅ (팀원만) |
| POST/PATCH | educations/certifications/activities | ✅ | ✅ | ✅ (본인만) | ❌ |
| DELETE | educations/certifications/activities | ✅ | ✅ | ✅ (본인만) | ❌ |

---

## §5. Findings (CR-001 ~ CR-015)

### CR-001 [HIGH] codebase Prisma 모델 부재 (3 신규 model 필요)
- **surface**: schema 전체
- **현상**: EmployeeEducation/Certification/Activity 0건 grep 재확인
- **권고**: schema migration N+37 + 3 model + 3 enum (EducationDegree/EducationStatus/ActivityType)

### CR-002 [HIGH] proto career tab 4 섹션 인라인 데이터
- **surface**: proto `page-employee-detail.jsx:347-426`
- **현상**: 4 섹션 모두 inline mock 데이터 (`[ { ... }, ... ]`)
- **권고**: data.js SSOT 이동 (batch 04 EM-004 동반)

### CR-003 [HIGH] 교육 섹션 = TrainingEnrollment 재사용
- **surface**: 교육 섹션 (1.3)
- **현상**: 기존 TrainingEnrollment 모델 필드 모두 정합. source enum 매핑 가능
- **권고**: 별도 신규 model 신설 X. TrainingEnrollment + TrainingCourse join 활용

### CR-004 [HIGH] 입력 UI 부재 (proto)
- **surface**: 4 섹션
- **현상**: proto inline mock 만, 입력 form / drawer / wizard 부재
- **권고**: 입력 패턴 결정 게이트 (Q4)

### CR-005 [HIGH] 자격증 status = derived (DB 미저장)
- **surface**: 자격증 섹션
- **현상**: 유효 / 갱신 임박 / 만료 = `expiresAt` 기반 계산 (proto `chip warning` = 만료 임박)
- **권고**: derived field (DB 저장 X), service layer 또는 client 계산

### CR-006 [MEDIUM] 학력 status enum (4가지)
- **surface**: 학력 섹션
- **현상**: 졸업 / 재학 중 / 중퇴 / 수료 (proto 명시 = 졸업만)
- **권고**: `EducationStatus` 신규 enum (4 values + nullable check)

### CR-007 [MEDIUM] 자격증 첨부 (S3 upload)
- **surface**: 자격증 섹션
- **현상**: proto certificateUrl 미명시
- **권고**: `certificateUrl` 필드 + S3 presigned URL upload (기존 패턴 `/api/v1/employees/[id]/documents` cross-ref)

### CR-008 [MEDIUM] 사내 활동 = 단순 chip → 확장 model
- **surface**: 사내 활동 섹션
- **현상**: proto = 단순 string chip array. 본 batch = title + type + period + description
- **권고**: ActivityType enum + 4 필드 신설

### CR-009 [MEDIUM] period display "YYYY.MM — YYYY.MM" 패턴
- **surface**: 학력 + 자격증 + 교육
- **현상**: proto display 패턴 일관 (string concat). 실 DB는 startDate + endDate
- **권고**: util 함수 신설 (`formatPeriod(start, end)`) — 또는 기존 `src/lib/timezone.ts` 확장

### CR-010 [MEDIUM] 4 섹션 권한 매트릭스
- **surface**: API 전체
- **현상**: HR_ADMIN / 본인 / MANAGER 권한 분기 필요
- **권고**: 본인 self-service + HR_ADMIN 전체 + MANAGER read-only (팀원)

### CR-011 [MEDIUM] sub display ("5건" / "12개월")
- **surface**: 자격증 + 교육 섹션 card head sub
- **현상**: 자격증 = 총 개수, 교육 = lookback window
- **권고**: 자격증 = count, 교육 = `enrolledAt >= now - 12 months` query filter

### CR-012 [MEDIUM] 자격증 chip warning (갱신 임박)
- **surface**: 자격증 섹션
- **현상**: 만료 90일 전 = warning 표시 (proto: TOEIC 갱신 임박)
- **권고**: derived field 계산 spec 명시 (90일 default, config 가능)

### CR-013 [LOW] 학력 정렬 (최신 → 과거)
- **surface**: 학력 섹션
- **현상**: proto 정렬 = 최근 졸업 순 (endDate DESC)
- **권고**: API GET default sort = `endDate DESC NULLS FIRST` (재학 중 = 최상위)

### CR-014 [LOW] i18n 5 locale 라벨
- **surface**: 4 섹션 UI label + enum value
- **현상**: 한국어 literal proto + 5 locale 미신설
- **권고**: 키 신설 ~150 entries (4 섹션 + 3 enum × 평균 12 values + chip status × 5 locale)

### CR-015 [LOW] N+18 graceful empty 우회로 폐기 시점
- **surface**: batch 04 N+18 implementation 후
- **현상**: batch 04 N+18 = graceful empty (EmptyState 표시) → 본 batch 06 implementation 시 폐기
- **권고**: Q5 결정 (즉시 / 점진 / 병행)

---

## §6. Stage 2 카드 진입 의제 (Q-게이트 사전 정리)

### Q1 — Schema design 채택
- **A** (3 신규 모델 별도, TrainingEnrollment 재사용) — proto 4 섹션 정합
- **B** (단일 EmployeeCareerRecord 통합 + type discriminator enum) — 단순화, 권한/쿼리 복잡
- **C** (proto 4 섹션 매핑 정확, type 분리)
- **CC 추천**: **A** (RESTful per model + TrainingEnrollment 재사용)

### Q2 — API 패턴
- **A** (RESTful per model — 12 endpoints) — 권한 가드 명확
- **B** (Nested `/career` 통합) — type discriminator 복잡
- **C** (GraphQL-like aggregate)
- **CC 추천**: **A** (코드베이스 기존 패턴 정합)

### Q3 — UI surface 분기
- **A** (proto career tab 단일 surface 4 섹션) — batch 04 N+18 합본
- **B** (각 섹션 별도 sub-page `/employees/[id]/career/{education,certifications,...}`) — over-engineering
- **C** (single page + collapsible) — 모바일 reflow 우위
- **CC 추천**: **A** (proto 정합)

### Q4 — 입력 패턴
- **A** (drawer 입력 — 4 섹션 공통 `<EmployeeCareerDrawer type="education|...">`)
- **B** (위저드 — 과설계)
- **C** (inline edit — 데이터 정합성 위험)
- **CC 추천**: **A** (drawer SSOT, batch 04 N+21 DemoLimitBanner 비대상)

### Q5 — N+18 graceful empty 우회로 폐기 시점
- **A** (batch 06 implementation 즉시 폐기 — 합본 PR)
- **B** (점진 — 4 섹션 implementation 시 각각 폐기)
- **C** (병행 운영, deprecated tag)
- **CC 추천**: **A** (합본 PR, EmptyState 단기 우회로 종결)

### Q6 — i18n / a11y
- i18n: 5 locale × ~150 entries (4 섹션 + enum values + status labels)
- a11y: drawer form 패턴 (batch 08 N+44 SSOT 정합 — Radix Dialog focus trap)
- **CC 추천**: 5 locale 일괄 + drawer form a11y SSOT 적용

---

## §7. RECORD 후보 매핑 (N+37~N+42)

batch 06 inventory reserve 한 6 RECORD 의 surface/scope 매핑:

| RECORD | 묶음 finding | 우선 | 예상 scope |
|---|---|---|---|
| **N+37** | CR-001 + CR-005 + CR-006 + CR-008 (schema 신설 + 3 enum) | HIGH | Prisma 3 model + 3 enum + RLS + migration |
| **N+38** | API 4 endpoint (학력) — CR-001 sub | HIGH | RESTful CRUD + 권한 가드 |
| **N+39** | API 4 endpoint (자격증) + CR-005 derived status + CR-007 S3 | MEDIUM | RESTful CRUD + derived field |
| **N+40** | API 4 endpoint (사내활동) — CR-008 sub | MEDIUM | RESTful CRUD |
| **N+41** | UI 4 섹션 implementation + drawer form (Q3/Q4) + N+18 graceful empty 폐기 (Q5=A) | HIGH | React + form state + batch 04 N+18 합본 |
| **N+42** | i18n 5 locale (~150 entries) + a11y (batch 08 N+44 SSOT) + 교육 섹션 TrainingEnrollment 매핑 (CR-003) | LOW | 키 + 검증 |

**교육 섹션 별도 RECORD 처리**: CR-003 (TrainingEnrollment 재사용) → 본 batch 06 implementation 시 별도 endpoint 신설 0, query layer (`/api/v1/employees/[id]/educations/training`) 또는 기존 `/api/v1/training/enrollments?employeeId=...` 재사용 검토

---

## §8. 다음 액션

1. **Stage 2 카드 본문 작성** (별도 turn)
   - Q1-Q6 정합성 검증 + 결정
   - 15 finding × 6 RECORD plan body 사양화
2. **Stage 3 게이트** (사용자 결재 — schema design 결정은 사용자 의제, 가디언 default 부적합)
3. **Stage 4 pre-flight** (schema migration plan + RLS 패턴 + S3 upload)
4. **Stage 4 implementation** = batch 04 N+18 implementation 합본 또는 분리 PR (Q5=A 추천)

---

## §9. 의존성

### Cross-batch 의존
- **batch 04 N+18 implementation 합본 또는 분리 PR 후**: N+18 graceful empty (EmptyState) → 본 batch 06 풀스택 폐기 (Q5=A)
- **batch 08 N+44 drawer form a11y SSOT 정합**: Q4=A drawer 입력 패턴
- **batch 04 N+21 DemoLimitBanner 비대상**: 본 batch는 wizard 아닌 drawer = banner slot 비대상

### 무관
- batch 05 / 07 / 08 N+45/N+46 / 09 무관 (서로 다른 surface)

### 선행 의존
- **PR-5A 머지** 후 진입 (모든 codebase 트랙)
- **사용자 결재 필수** (schema design = 사용자 의제, 가디언 default 부적합)

---

**상태**: Stage 1 P0 audit 완료
**사전 가정 정정**: ✅ 없음 (가디언 사전 가정 정합 — 모델 0건 + TrainingEnrollment cross-ref)
**다음 갱신**: Stage 2 카드 작성 별도 turn (Q1-Q6 사용자 결재 + RECORD plan body 사양화)
