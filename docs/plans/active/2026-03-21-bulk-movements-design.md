# B-5a: Bulk HR Movements — CSV Import (유형별 분리)

> **Date**: 2026-03-21
> **Status**: 설계 완료 → Gemini Review 대기
> **Estimated Sessions**: 5

---

## 1. 목표

HR Admin이 CSV 파일을 업로드하여 대량 인사이동을 일괄 처리. Workday EIB 패턴을 참고하여 **이동 유형별 별도 템플릿**으로 분리.

**범위:**
- 5개 이동 유형별 CSV 템플릿 다운로드/업로드
- 3단계 플로우: 유형 선택 → 업로드+검증+프리뷰 → 확인 후 실행
- All-or-Nothing 실행 (1건 에러 → 전체 롤백)
- 기존 `/api/v1/employees/bulk-upload` 흡수 후 deprecate

---

## 2. 설계 결정

| 항목 | 결정 | 근거 |
|------|------|------|
| 템플릿 방식 | 유형별 분리 (Workday EIB 패턴) | 컬럼 명확, 실수 적음, Zod 검증 단순 |
| 에러 처리 | All-or-Nothing | HR 인사발령은 정합성 중요; 프리뷰에서 미리 검증 |
| 승인 프로세스 | 없음 (3단계 프리뷰가 대체) | Workday도 bulk 자체는 즉시 실행, 권한으로 제어 |
| 권한 | HR_ADMIN, SUPER_ADMIN | RBAC으로 접근 제한 |
| 기존 bulk-upload | 새 시스템으로 흡수 후 redirect | 중복 제거, 단일 진입점 |
| 파일 형식 | CSV (UTF-8 BOM) | Excel 호환, 한글 깨짐 방지 |
| 직원 식별자 | employeeNo (사번) | 유일, 사람이 읽을 수 있음 |
| 참조 데이터 | code 기반 (부서코드, 직급코드 등) | UUID 대신 사람이 입력 가능한 코드 |

---

## 3. 이동 유형 및 템플릿 정의

### 3.1 TRANSFER (부서이동/직급변경)

기존 bulk-upload 기능을 계승.

| 컬럼 | 필수 | 설명 | 예시 |
|------|------|------|------|
| 사번 | ✅ | employeeNo | EMP001 |
| 부서코드 | ✅ | department.code | DEV-01 |
| 직급코드 |  | jobGrade.code | G3 |
| 직위코드 |  | position.code | POS-DEV-LEAD |
| 근무지코드 |  | workLocation.code | HQ-SEOUL |
| 발효일 | ✅ | YYYY-MM-DD | 2026-04-01 |
| 사유 |  | 자유 텍스트 | 조직개편 |

**비즈니스 로직:**
- `createAssignment(changeType: 'TRANSFER')` 호출
- 기존 primary assignment 자동 close
- 미제공 필드는 현재 assignment에서 carry forward

### 3.2 PROMOTION (승진)

| 컬럼 | 필수 | 설명 | 예시 |
|------|------|------|------|
| 사번 | ✅ | employeeNo | EMP001 |
| 새직급코드 | ✅ | 승진 후 jobGrade.code | G4 |
| 직위코드 |  | 변경 시 position.code | POS-MGR-01 |
| 발효일 | ✅ | YYYY-MM-DD | 2026-04-01 |
| 사유 |  | 자유 텍스트 | 2026년 정기승진 |

**비즈니스 로직:**
- `createAssignment(changeType: 'PROMOTION')` 호출
- 미제공 필드는 현재 assignment에서 carry forward
- 직급이 현재보다 높아야 함 (jobGrade.level 비교) — 경고만, 차단 안 함

### 3.3 ENTITY_TRANSFER (법인전환)

| 컬럼 | 필수 | 설명 | 예시 |
|------|------|------|------|
| 사번 | ✅ | employeeNo | EMP001 |
| 전환법인코드 | ✅ | 새 company.code | CTR-CN |
| 부서코드 | ✅ | 새 법인의 department.code | CN-DEV-01 |
| 직급코드 |  | 새 법인의 jobGrade.code | G3 |
| 직위코드 |  | position.code | POS-CN-DEV |
| 고용형태 |  | FULL_TIME, CONTRACT 등 | FULL_TIME |
| 발효일 | ✅ | YYYY-MM-DD | 2026-04-01 |
| 사유 |  | 자유 텍스트 | 중국법인 파견 |

**비즈니스 로직:**
- `createAssignment(changeType: 'TRANSFER_CROSS_COMPANY')` 호출
- companyId가 변경되므로 부서/직위도 새 법인 기준으로 필수 검증
- 겸직(secondary) assignment가 있으면 경고 표시

### 3.4 TERMINATION (퇴직)

| 컬럼 | 필수 | 설명 | 예시 |
|------|------|------|------|
| 사번 | ✅ | employeeNo | EMP001 |
| 퇴직구분 | ✅ | VOLUNTARY/INVOLUNTARY/RETIREMENT/CONTRACT_END | VOLUNTARY |
| 마지막근무일 | ✅ | YYYY-MM-DD | 2026-03-31 |
| 퇴직사유코드 |  | resignReasonCode | PERSONAL |
| 퇴직사유상세 |  | 자유 텍스트 | 개인 사유 |

**비즈니스 로직:**
- `createAssignment(changeType: 'RESIGN'/'TERMINATE', status: 'RESIGNED'/'TERMINATED')` 호출
- `EmployeeOffboarding` 레코드 자동 생성 (IN_PROGRESS)
- 퇴직 정산은 별도 프로세스 (자동 트리거하지 않음)
- VOLUNTARY/RETIREMENT → RESIGN, INVOLUNTARY/CONTRACT_END → TERMINATE

### 3.5 COMPENSATION (급여변경)

| 컬럼 | 필수 | 설명 | 예시 |
|------|------|------|------|
| 사번 | ✅ | employeeNo | EMP001 |
| 새기본급 | ✅ | 숫자 (원/위안 등) | 5000000 |
| 변경유형 | ✅ | ANNUAL_INCREASE/PROMOTION/MARKET_ADJUSTMENT/OTHER | ANNUAL_INCREASE |
| 통화 |  | 미입력 시 법인 기본 통화 | KRW |
| 발효일 | ✅ | YYYY-MM-DD | 2026-04-01 |
| 사유 |  | 자유 텍스트 | 2026년 연봉조정 |

**비즈니스 로직:**
- `CompensationHistory` 레코드 생성
- `previousBaseSalary` 자동 조회, `changePct` 자동 계산
- `SalaryBand` 범위 초과 시 경고 (차단 아님, `isException: true` 마킹)
- Assignment 변경 없음 (급여만 변경)

---

## 4. API 설계

### 4.1 엔드포인트

```
GET  /api/v1/bulk-movements/templates/[type]   → CSV 템플릿 다운로드
POST /api/v1/bulk-movements/validate           → 업로드 + 검증 + 프리뷰
POST /api/v1/bulk-movements/execute            → 검증된 데이터 실행
```

### 4.2 GET /templates/[type]

**Params:** `type` = `transfer | promotion | entity-transfer | termination | compensation`

**Response:** CSV 파일 (UTF-8 BOM, 헤더 + 예시 1행)

```csv
사번,부서코드,직급코드,직위코드,근무지코드,발효일,사유
EMP001,DEV-01,G3,POS-DEV-LEAD,HQ-SEOUL,2026-04-01,조직개편
```

### 4.3 POST /validate

**Request:** `multipart/form-data`
- `file`: CSV 파일
- `type`: 이동 유형 (`transfer | promotion | ...`)

**Response:**
```typescript
{
  valid: boolean
  totalRows: number
  validRows: number
  errors: Array<{
    row: number        // 1-based (헤더 제외)
    column: string     // 컬럼명
    message: string    // 한국어 에러 메시지
    severity: 'error' | 'warning'  // warning은 실행 가능
  }>
  preview: Array<{
    rowNum: number
    employeeNo: string
    employeeName: string   // 조회된 이름 (확인용)
    currentValue: string   // 현재 부서/직급 등 (비교용)
    newValue: string       // 변경될 값
    status: 'valid' | 'error' | 'warning'
  }>
  // 검증 통과 시 실행에 필요한 해시 토큰
  validationToken: string | null  // SHA256(file content + timestamp)
}
```

**검증 단계:**
1. 파일 형식 검증 (CSV, UTF-8, 헤더 매칭)
2. 행별 필수 필드 검증 (Zod schema)
3. 참조 데이터 검증 (사번→Employee, 부서코드→Department 등)
4. 비즈니스 룰 검증 (상태 전이, 직급 비교 등)
5. 중복 검증 (같은 사번이 파일 내 중복)

### 4.4 POST /execute

**Request:**
```typescript
{
  type: string              // 이동 유형
  validationToken: string   // validate에서 받은 토큰
  file: File                // 동일 파일 재전송 (토큰으로 무결성 검증)
}
```

**Response:**
```typescript
{
  success: boolean
  applied: number           // 처리된 건수
  executionId: string       // 실행 ID (감사 로그)
}
```

**실행 로직:**
1. validationToken 검증 (파일 해시 일치 확인)
2. `prisma.$transaction()` 내에서 전체 row 실행
3. 1건이라도 실패 → 전체 롤백
4. `BulkMovementExecution` 감사 레코드 생성

---

## 5. 데이터 모델

### 5.1 BulkMovementExecution (감사 로그)

```prisma
model BulkMovementExecution {
  id            String   @id @default(uuid())
  companyId     String   @map("company_id")
  movementType  String   @map("movement_type")  // TRANSFER, PROMOTION, etc.
  fileName      String   @map("file_name")
  totalRows     Int      @map("total_rows")
  appliedRows   Int      @map("applied_rows")
  status        String   // COMPLETED, FAILED, ROLLED_BACK
  executedBy    String   @map("executed_by")
  executedAt    DateTime @default(now()) @map("executed_at")
  errorDetails  Json?    @map("error_details")

  company  Company  @relation(...)
  executor Employee @relation(...)

  @@map("bulk_movement_executions")
}
```

---

## 6. 파일 구조

```
src/
  lib/
    bulk-movement/
      types.ts                    # MovementType enum, 공통 타입
      parser.ts                   # CSV 파싱 (UTF-8 BOM 처리)
      validator.ts                # 공통 검증 로직 (사번 조회, 중복 체크 등)
      executor.ts                 # 공통 실행 로직 (트랜잭션 래퍼)
      templates/
        index.ts                  # 템플릿 레지스트리
        transfer.ts               # 컬럼 정의 + Zod schema + 실행 함수
        promotion.ts
        entity-transfer.ts
        termination.ts
        compensation.ts

  app/
    api/v1/bulk-movements/
      templates/[type]/route.ts   # GET: 템플릿 다운로드
      validate/route.ts           # POST: 업로드 + 검증
      execute/route.ts            # POST: 실행

    [locale]/(dashboard)/
      hr/bulk-movements/
        page.tsx                  # Server page
        BulkMovementsClient.tsx   # 3-step wizard UI
        components/
          TypeSelector.tsx        # Step 1: 유형 선택 카드
          FileUploader.tsx        # Step 2: 파일 업로드 + 드래그앤드롭
          ValidationPreview.tsx   # Step 2: 프리뷰 테이블 + 에러 표시
          ExecutionConfirm.tsx    # Step 3: 확인 + 실행 버튼
```

---

## 7. UI 설계

### 7.1 Step 1 — 유형 선택

```
┌─────────────────────────────────────────────────────────────┐
│ 대량 인사이동                                                 │
│                                                               │
│ 이동 유형을 선택하세요                                          │
│                                                               │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│ │ 🔄       │ │ ⬆️       │ │ 🏢       │                       │
│ │ 부서이동  │ │ 승진      │ │ 법인전환  │                       │
│ │ 부서/직급 │ │ 직급 상향  │ │ 타법인   │                       │
│ │ 변경      │ │ 발령      │ │ 전환     │                       │
│ └──────────┘ └──────────┘ └──────────┘                       │
│ ┌──────────┐ ┌──────────┐                                    │
│ │ 🚪       │ │ 💰       │                                    │
│ │ 퇴직      │ │ 급여변경  │                                    │
│ │ 퇴직/퇴사 │ │ 기본급    │                                    │
│ │ 처리      │ │ 변경      │                                    │
│ └──────────┘ └──────────┘                                    │
│                                                               │
│ 선택한 유형: [부서이동]    [📥 템플릿 다운로드]                    │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Step 2 — 업로드 + 프리뷰

```
┌─────────────────────────────────────────────────────────────┐
│ 부서이동 — 파일 업로드                                        │
│                                                               │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   │
│   📁 CSV 파일을 여기에 드래그하거나 클릭하여 선택하세요        │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   │
│                                                               │
│ ✅ 검증 완료: 45건 중 45건 정상                                │
│                                                               │
│ ┌─────┬────────┬──────────┬──────────┬────────┬───────┐     │
│ │ #   │ 사번    │ 이름     │ 현재      │ 변경    │ 상태  │     │
│ ├─────┼────────┼──────────┼──────────┼────────┼───────┤     │
│ │ 1   │ EMP001 │ 이민준    │ 개발1팀   │ 개발2팀 │ ✅    │     │
│ │ 2   │ EMP002 │ 정다은    │ 개발1팀   │ QA팀   │ ✅    │     │
│ │ 3   │ EMP003 │ 송현우    │ 개발2팀   │ ???    │ ❌    │     │
│ │     │        │          │           │ 에러: 부서코드 'XXX' 없음 │
│ └─────┴────────┴──────────┴──────────┴────────┴───────┘     │
│                                                               │
│                              [← 유형 선택]  [실행 →] (비활성)   │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Step 3 — 실행 확인

```
┌─────────────────────────────────────────────────────────────┐
│ 실행 확인                                                     │
│                                                               │
│ ⚠️ 다음 인사이동을 실행하시겠습니까?                             │
│                                                               │
│   유형: 부서이동                                               │
│   대상: 45명                                                  │
│   발효일: 2026-04-01                                          │
│   경고: 2건 (직급 비교 불가)                                    │
│                                                               │
│ 이 작업은 되돌릴 수 없습니다.                                    │
│ 모든 대상 직원의 발령이력에 새 레코드가 추가됩니다.                │
│                                                               │
│                              [← 수정]  [✅ 실행]               │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Carry Forward 규칙

유형별로 미입력 필드 처리:

| 유형 | 미입력 시 현재값 유지 필드 |
|------|--------------------------|
| TRANSFER | jobGradeId, jobCategoryId, positionId, employmentType, workLocationId |
| PROMOTION | departmentId, jobCategoryId, employmentType, workLocationId |
| ENTITY_TRANSFER | jobCategoryId (나머지는 새 법인 기준 필수) |
| TERMINATION | 없음 (assignment close만) |
| COMPENSATION | 없음 (assignment 변경 없음) |

---

## 9. 기존 bulk-upload 마이그레이션

```
Phase 1: 새 /bulk-movements API 구현
Phase 2: 기존 bulk-upload UI에서 새 API로 리다이렉트
Phase 3: 기존 /api/v1/employees/bulk-upload deprecated 표시
         (하위 호환을 위해 즉시 삭제하지 않음)
```

---

## 10. 보안

- RBAC: `HR_ADMIN` + `SUPER_ADMIN` only (module: `EMPLOYEE`, action: `BULK_UPDATE`)
- Company scope: HR_ADMIN은 자기 법인 직원만 처리 가능
- SUPER_ADMIN은 전체 법인 처리 가능
- 감사 로그: BulkMovementExecution에 실행자, 파일명, 결과 기록
- validationToken: 검증 → 실행 사이 파일 변조 방지 (SHA256 해시)

---

## 11. 제외 범위 (Phase 3.5에서 안 함)

- 실행 취소 (Undo) 기능
- 스케줄링 (미래 날짜 자동 실행)
- 알림 (실행 완료 후 메일 등)
- 급여 자동 연동 (승진 시 자동 급여 인상)
- Excel (.xlsx) 지원 (CSV만)
