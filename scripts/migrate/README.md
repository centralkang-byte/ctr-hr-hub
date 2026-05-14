# Legacy ERP Migration Scripts (IS_PE01 + IS_SY02)

CTR 그룹 레거시 ERP의 `IS_PE01` (인사정보, 224 컬럼) + `IS_SY02` (공통코드) 를 CTR HR Hub 로 옮기는 일회성 import 파이프라인.

## Pre-requisites

1. **Schema migrations 적용 완료** (Stage A~D commit: `643dd848`, `65d2cec8`, `9e7053b6`, `a43ebc0f`)
2. **`.env.local` 환경변수**:
   - `DATABASE_URL` — 타겟 DB (먼저 **staging** 에서 검증, 그 다음 production)
   - `PII_ENCRYPTION_KEY` — base64 32 bytes (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)
3. **입력 xlsx 파일** — ERP 운영팀에서 추출
   - `IS_SY02.xlsx` (공통코드)
   - `IS_PE01.xlsx` (인사정보)

## Execution Order

각 stage 는 **DRY_RUN=true** 로 먼저 검증 후 실제 실행. 누락된 매핑은 `MigrationLog` 또는 stderr 에 기록됨.

```bash
# Stage 1: 공통코드 마스터 import (IS_SY02 → CodeGroup + CodeItem)
DRY_RUN=true npx tsx scripts/migrate/01-import-codes.ts /path/to/IS_SY02.xlsx
npx tsx scripts/migrate/01-import-codes.ts /path/to/IS_SY02.xlsx

# Stage 2: 조직 매핑 — IS_PE01 의 코드를 기존 Company/Department/JobGrade 등에 매핑
#  (별도 commit 에서 작성 예정)
# DRY_RUN=true npx tsx scripts/migrate/02-map-org.ts /path/to/IS_PE01.xlsx

# Stage 3: Employee + EmployeeRrn + EmployeeAssignment(HIRE/TERMINATE)
#  (별도 commit 에서 작성 예정)
# DRY_RUN=true npx tsx scripts/migrate/03-import-employees.ts /path/to/IS_PE01.xlsx

# Stage 4: 부속 데이터 (Address, BankAccount, KoreaSocialInsurance, StatutoryStatus, Military)
#  (별도 commit 에서 작성 예정)
# DRY_RUN=true npx tsx scripts/migrate/04-import-supporting.ts /path/to/IS_PE01.xlsx

# Stage 5: 검증
#  (별도 commit 에서 작성 예정)
# npx tsx scripts/migrate/05-verify.ts
```

## Idempotency

모든 스크립트는 **upsert + deterministic UUID** (`uuidv5(legacyId, NAMESPACE)`) 사용. 재실행 안전.

| Namespace | 용도 |
|---|---|
| `8c9d2c3e-1f4b-4a5e-9e7c-0b1f2c3d4e5f` | CodeMaster (group/item) — seed 와 동일 |
| (TBD) | Employee, Assignment 등 |

## CodeMaster 매핑 키 규칙 (Stage 2)

회사별로 의미가 다른 legacy 코드 (DEPTCD/JIKGUBCD/JIKWICD/JIKCKCD/WORK_AREA 등) 는
CodeMaster 에 **컴포지트 키** `<COMPYCD>:<LEGACY>` 형식으로 등록해야 함.

예: 회사 코드 `620` 의 부서 `02` 가 우리 시스템의 `R&D` 부서라면:
```
CodeGroup code = "DEPTCD"
CodeItem  code = "620:02", reference1 = "R&D"
```

회사 단위 unique 가 아닌 코드 (COMPYCD/JIKMUCD) 는 단순 `<LEGACY>` 형식:
```
CodeGroup code = "COMPYCD"
CodeItem  code = "620", reference1 = "CTR"
```

Stage 2 (`02-map-org.ts`) 가 이 규칙으로 lookup. 누락/오매핑은 exit 1.

## Rollback

각 stage 는 독립 transaction. 실패 시:

```sql
-- Stage 1 롤백 (코드 마스터)
TRUNCATE code_items, code_groups CASCADE;

-- Stage 3 롤백 (Employee — 주의: 다른 stage 데이터 cascading 삭제됨)
TRUNCATE employees CASCADE;
```

최악의 경우 staging DB 에서 `prisma migrate reset` 후 재시작.

## Sample Data Verification

샘플 3건 (IS_PE01 R3~R5: 최지혜/강상우/채종은) 으로 dry-run 검증 후 전체 데이터.

## Phase 2 (실데이터 입수 후 보강)

- COMPYCD → Company 매핑 테이블 (운영팀 협의)
- DEPTCD → Department 매핑 테이블
- JIKGUBCD → JobGrade 매핑 테이블
- JIKWICD → EmployeeTitle 매핑 테이블
- IS_PE01 의 JUMINNO 가 평문인지 legacy 암호화인지 확인 → encrypt 전 처리 분기
