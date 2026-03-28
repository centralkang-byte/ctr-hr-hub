# Prisma Schema Naming Conventions

> CTR HR Hub 스키마 네이밍 가이드라인
> 작성일: 2026-03-28
> 적용 대상: 신규 모델/필드 전체, 기존 모델은 점진적 마이그레이션

---

## 1. 모델명

### 규칙

| 규칙 | 예시 | 비고 |
|------|------|------|
| 단수형 PascalCase | `Employee`, `LeaveRequest` | ~~Employees~~, ~~leave_requests~~ |
| 도메인 접두사 | `Employee*` = 직원 종속 엔티티 | `EmployeeRole`, `EmployeePayItem` |
| Template/Instance 쌍 | `OnboardingTemplate` + `EmployeeOnboarding` | 템플릿은 `*Template`, 인스턴스는 `Employee*` |
| 국가별 모델 | `KedoDocument` (러시아), `MilitaryRegistration` (한국) | 코멘트로 국가/규정 명시 필수 |
| 약어 금지 | `AttendanceApprovalRequest` | ~~AttApprReq~~ |

### Employee* 접두사 기준

`Employee` 접두사는 **직원 1명에 종속된 엔티티**에만 사용:

```
✅ EmployeeRole        — 직원별 역할 할당
✅ EmployeePayItem     — 직원별 급여 항목
✅ EmployeeOnboarding  — 직원별 온보딩 인스턴스
✅ EmployeeDocument    — 직원별 문서

❌ OnboardingTemplate  — 회사 공통 템플릿 (직원 종속 아님)
❌ LeavePolicy         — 회사/법인 정책 (직원 종속 아님)
❌ PayrollRun          — 법인/기간별 급여 실행
```

### Template/Instance 패턴

```
[Template 계층]          [Instance 계층]
OnboardingTemplate       EmployeeOnboarding
  └─ OnboardingTask      └─ EmployeeOnboardingTask

OffboardingChecklist     EmployeeOffboarding
  └─ OffboardingTask     └─ EmployeeOffboardingTask
```

---

## 2. 필드명

### 날짜 필드

| 유형 | 접미사 | 예시 | Prisma 타입 |
|------|--------|------|-------------|
| Date only (시간 없음) | `*Date` | `hireDate`, `birthDate`, `effectiveDate` | `DateTime` (date-only semantics) |
| Timestamp (시간 포함) | `*At` | `createdAt`, `approvedAt`, `completedAt` | `DateTime` |
| 기간 시작/종료 | `startDate` / `endDate` | `contractStartDate`, `contractEndDate` | `DateTime` |
| 유효 기간 | `effectiveFrom` / `effectiveTo` | `effectiveFrom`, `effectiveTo` | `DateTime` |

```
✅ hireDate        — 입사일 (date only)
✅ createdAt       — 생성 시각 (timestamp)
✅ approvedAt      — 승인 시각 (timestamp)
✅ effectiveDate   — 발효일 (date only)

❌ startedAt       — 혼용 (startDate 또는 startedAt 중 하나로 통일)
❌ lastWorkingDate — OK이지만 lastWorkingDay도 허용
```

### Boolean 필드

**항상 `is*` 접두사**:

```
✅ isActive, isRequired, isPrimary, isLocked
✅ isMfaEnabled, isHeadcount, isPublic, isInternal

❌ mfaEnabled          → isMfaEnabled
❌ severanceCalculated → isSeveranceCalculated
❌ active              → isActive
```

예외: `has*` 접두사는 소유/존재 확인에 허용:
```
✅ hasAttachment, hasDependents
```

### Status/Enum 필드

```
✅ status    LeaveRequestStatus    — 모델명 + Status
✅ status    OffboardingStatus     — 모델명 + Status
✅ type      LeaveOfAbsenceType    — 분류 enum은 *Type

❌ state (사용 금지 — status로 통일)
```

### FK (Foreign Key) 필드

**항상 `*Id` 접미사**:

```
✅ employeeId, companyId, departmentId
✅ approvedById   — 승인자 FK (스칼라)
✅ createdById    — 생성자 FK (스칼라)

❌ approvedBy     — 릴레이션 필드와 충돌 위험
❌ createdBy      — 릴레이션 필드와 충돌 위험
```

**릴레이션 필드 네이밍**:

```prisma
// 스칼라 FK + 릴레이션 쌍
approvedById  String
approver      Employee  @relation("approver", fields: [approvedById], ...)

createdById   String
creator       Employee  @relation("creator", fields: [createdById], ...)
```

| 역할 | 스칼라 FK | 릴레이션 필드 |
|------|-----------|---------------|
| 승인자 | `approvedById` | `approver` |
| 생성자 | `createdById` | `creator` |
| 발급자 | `issuedById` | `issuer` |
| 수여자 | `awardedById` | `awarder` |
| 업로더 | `uploadedById` | `uploader` |
| 완료자 | `completedById` | `completer` |
| 위임자 | `delegatedById` | `delegator` |
| 취소자 | `cancelledById` | `canceller` |

### Audit 필드

**모든 모델에 필수**:

```prisma
createdAt   DateTime   @default(now())
updatedAt   DateTime   @updatedAt
```

선택적:
```prisma
deletedAt   DateTime?  // soft delete (아래 참조)
```

---

## 3. Soft Delete

### 단일 패턴: `deletedAt`

```prisma
// ✅ 올바른 패턴
deletedAt  DateTime?

// 쿼리
where: { deletedAt: null }  // 활성 레코드
where: { deletedAt: { not: null } }  // 삭제된 레코드
```

### isActive 마이그레이션 가이드

> **현황**: 일부 모델에 `isActive`와 `deletedAt`이 동시에 존재함 (이중 패턴)
> **방향**: `deletedAt` 단일 패턴으로 통일 (2026 Q3 목표)
> **신규 코드**: 반드시 `deletedAt` 사용, `isActive` 사용 금지

**이중 패턴 보유 모델** (9개 — isActive에 @deprecated 마킹 완료):
- Company, Department, OnboardingTemplate, BenefitPolicy
- LeavePolicy, LeaveOfAbsenceType, HrDocument
- TrainingCourse, WorkflowRule

**isActive만 있는 모델** (32개 — deletedAt 추가 필요, 별도 migration 예정):
- AnalyticsConfig, ApprovalFlow, AttendanceTerminal, BenefitPlan
- Competency, CompetencyCategory, CompetencyIndicator, CompetencyLibrary
- DataRetentionPolicy, EmailTemplate, EmsBlockConfig, HrChatSession
- InsuranceRate, JobCategory, LeaveAccrualRule, LeaveTypeDef
- MandatoryTraining, MandatoryTrainingConfig, NontaxableLimit, NotificationTrigger
- OffboardingChecklist, PayAllowanceType, PayDeductionType, Position
- ShiftGroup, ShiftPattern, SocialInsuranceConfig, TaxBracket
- TeamsWebhookConfig, TenantEnumOption, WorkLocation, YearEndDeductionConfig

---

## 4. Enum

### 네이밍 규칙

```
{Model}{Field}  또는  {Domain}{Concept}

✅ LeaveRequestStatus    — 모델명 + 필드
✅ OffboardingType       — 도메인 + 개념
✅ EmployeeStatus        — 모델명 + Status
✅ AttendanceStatus      — 모델명 + Status

❌ Status (너무 일반적)
❌ Type (너무 일반적)
```

### Enum 값 네이밍

```
UPPER_SNAKE_CASE

✅ APPROVED, PENDING, REJECTED
✅ NEW_HIRE, INTERNAL_TRANSFER
✅ FULL_TIME, PART_TIME

❌ approved, Pending, rejected
```

---

## 5. 코멘트 규칙

### 모델 코멘트

용도가 이름만으로 명확하지 않은 모델에는 `///` 코멘트 필수:

```prisma
/// 러시아 전자문서 관리 (KEDO = Кадровый электронный документооборот)
model KedoDocument { ... }

/// HR 용어 커스터마이징 — 회사별 라벨 오버라이드 ("Manager" → "팀장")
model TermOverride { ... }

/// 성과 평가 블록 매트릭스 설정 (EMS = Employee Management System)
model EmsBlockConfig { ... }
```

### deprecated 필드

```prisma
/// @deprecated — deletedAt 사용. 2026 Q3 제거 예정
isActive  Boolean  @default(true)
```

---

## 6. 체크리스트 (새 모델/필드 추가 시)

- [ ] 모델명: 단수형 PascalCase, Employee* 접두사 기준 준수
- [ ] 날짜 필드: `*Date` (date-only) vs `*At` (timestamp) 구분
- [ ] Boolean: `is*` 접두사 사용
- [ ] FK: `*Id` 접미사, 릴레이션과 이름 충돌 없음
- [ ] Audit: `createdAt` + `updatedAt` 포함
- [ ] Soft delete: `deletedAt` 사용 (isActive 금지)
- [ ] Enum: `{Model}{Field}` 패턴, `UPPER_SNAKE_CASE` 값
- [ ] 코멘트: 약어/국가별/비직관적 모델에 `///` 설명 추가
