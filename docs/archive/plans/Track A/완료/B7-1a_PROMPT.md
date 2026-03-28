# B7-1a: 국내 월급여 계산 엔진

> **역할**: 당신은 CTR HR Hub의 CTO이자 시니어 풀스택 개발자입니다.
> **스택**: Next.js (App Router) + Supabase + PostgreSQL + **Prisma ORM** + Tailwind CSS
> **컨텍스트**: Phase A + B1(법인 엔진 + compensation_settings) + B6(근태/휴가) 완료.
> **트랙**: **[A] 트랙** — context/TRACK_A.md에만 기록

### DB 접근 규칙 (전 세션 공통)

- 모든 테이블 생성/변경은 `prisma/schema.prisma` → `prisma migrate dev`
- 쿼리는 Prisma Client 사용
- Supabase는 Auth + Storage + Realtime 용도만

---

## 컨텍스트 파일 규칙 (병렬 개발)

```bash
# 읽기: 3개 파일 모두 읽으세요
cat context/SHARED.md       # 공유 인프라 상태 확인
cat context/TRACK_A.md      # 이전 A 트랙 작업 확인
cat context/TRACK_B.md      # B 트랙이 뭘 하고 있는지 참고

# 쓰기: TRACK_A.md에만 기록하세요
# ❌ SHARED.md 수정 금지
# ❌ TRACK_B.md 수정 금지

# migrate 이름 규칙: a_ 접두사 사용
npx prisma migrate dev --name a_b7_payroll_kr
```

---

## 세션 목표

CTR-KR(한국법인)의 **4대보험 + 소득세 + 급여항목 계산**을 직접 구현합니다. 급여 계산 플로우(기본급→수당→근태반영→4대보험→세금→검토→확정→명세서)를 완전 자동화하되, HR 검토/수정 단계를 반드시 포함합니다.

**핵심**: 실제 급여를 지급하는 것이 아니라 **계산+명세서 생성**까지입니다. 실제 지급은 외부 급여시스템으로 데이터를 내보냅니다.

**범위**: 이 세션은 **한국법인만** 다룹니다. 해외 5법인은 B7-2에서 다룹니다.

---

## ⚠️ 시작 전 필수 확인

```bash
# 1. 컨텍스트 파일 3개 읽기
cat context/SHARED.md
cat context/TRACK_A.md
cat context/TRACK_B.md

# 2. B1 compensation_settings(CTR-KR) 확인
# - pay_components: 기본급, 직책수당, 식대(비과세), 차량유지비(비과세)
# - salary_bands: 직급별 min/mid/max

# 3. B6-1 근태 데이터 확인
# ⚠️ B6-1은 [B] 트랙 — TRACK_B.md에서 결과 확인
# - 월별 근무시간 합산 가능 여부
# - 초과근무(연장/야간/휴일) 구분 필드
# - 교대근무 야간수당 필드 (ShiftDefinition.isNightShift)

# 4. B6-2 휴가 데이터 확인
# ⚠️ B6-2는 [A] 트랙 — TRACK_A.md에서 결과 확인
# - LeaveBalance.used → 미사용 연차수당 계산용
# - 월별 휴가 사용일수 조회 가능 여부

# 5. employee_compensations 테이블 확인
# - 직원별 기본급 + 수당 데이터 존재 여부

# 6. [B] 트랙 상태 확인 — TRACK_B.md에서 DB 변경사항 확인
# B 트랙이 migrate를 실행했다면 먼저 pull 후 시작
npx prisma db pull  # 필요 시
```

### ⚠️ 이 세션의 특수성

급여 계산은 **숫자가 틀리면 법적 문제**가 됩니다. 다음을 반드시 지키세요:

1. **요율/한도는 전부 설정 테이블** — 4대보험 요율, 세율, 비과세 한도 등 하드코딩 절대 금지. 매년 변경됩니다.
2. **원 단위 반올림 규칙** — 4대보험은 원 미만 절사, 소득세는 10원 미만 절사 등 항목별로 다릅니다.
3. **HR 검토 단계 필수** — 자동 계산 후 반드시 HR이 확인/수정할 수 있어야 합니다.
4. **확정 후 불변** — 한번 확정된 급여 데이터는 수정 불가. 수정이 필요하면 소급 정산으로 처리.

---

## 핵심 설계 원칙

### 1. 급여 계산 파이프라인

```
Step 1: 기본 급여 수집
  employee_compensations → 기본급 + 수당 목록

Step 2: 근태 반영
  B6-1 근태 → 결근일수, 지각, 초과근무(연장/야간/휴일) 시간
  → 결근 공제, 초과근무 수당 계산

Step 3: 비과세 분리
  식대(월 20만원 한도), 차량유지비(월 20만원 한도) 등
  → 과세 대상 급여 산출

Step 4: 4대보험 공제
  국민연금, 건강보험(+장기요양), 고용보험, 산재보험(회사부담만)
  → 근로자 부담분 공제

Step 5: 소득세 + 지방소득세
  간이세액표 기반 원천징수

Step 6: HR 검토/수정
  → 자동 계산 결과를 HR이 확인
  → 이상 항목 수동 수정 가능

Step 7: 확정
  → payroll_run status = 'confirmed'
  → 수정 불가 상태로 전환

Step 8: 급여명세서 PDF 생성 + 전달
  → 인앱 + 이메일 + PDF 다운로드
```

### 2. 요율 테이블 = 매년 바뀌는 외부 변수

```
2025년 기준 (예시, 실제 요율은 시드 데이터로 관리):

국민연금:     9.0% (근로자 4.5% + 사업주 4.5%), 상한 590만원
건강보험:     7.09% (근로자 3.545% + 사업주 3.545%)
장기요양보험:  건강보험의 12.81%
고용보험:     근로자 0.9%, 사업주 1.05%~1.65% (규모별)
산재보험:     사업주 전액 (업종별 상이)

비과세 한도:
식대:         월 200,000원
차량유지비:   월 200,000원 (자기차량 운전보조금)
```

### 3. 중도입사/퇴사 = 일할계산

```
중도입사: 입사일 ~ 월말까지 일할 계산
퇴사:     월초 ~ 퇴사일까지 일할 계산
일할급여 = 월급여 × (근무일수 / 해당월 총 근무일수)
4대보험: 가입일수 기준 일할 계산
```

---

## 작업 순서 (9 Tasks)

### Task 1: DB 마이그레이션 — Prisma 모델 추가

`prisma/schema.prisma`에 추가 후 `npx prisma migrate dev --name a_b7_payroll_kr` 실행.

> **⚠️ migrate 전 확인**: `cat context/TRACK_B.md`에서 [B] 트랙이 미완료 migrate가 있는지 확인. 있으면 B 트랙 migrate 완료 후 진행.

```prisma
// ── 4대보험 요율 테이블 (매년 업데이트) ──

model InsuranceRate {
  id              String   @id @default(uuid()) @db.Uuid
  year            Int                               // 2025
  type            String   @db.VarChar(30)           // 'national_pension' | 'health_insurance' | 'long_term_care' | 'employment_insurance' | 'industrial_accident'
  employeeRate    Float                              // 근로자 부담률 (%)
  employerRate    Float                              // 사업주 부담률 (%)
  upperLimit      Float?                             // 보수월액 상한 (원)
  lowerLimit      Float?                             // 보수월액 하한 (원)
  notes           String?  @db.Text
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())

  @@unique([year, type])
  @@map("insurance_rates")
}

// ── 소득세 간이세액표 ──

model TaxBracket {
  id              String   @id @default(uuid()) @db.Uuid
  year            Int
  minIncome       Int                               // 과세 대상 월급여 하한 (원)
  maxIncome       Int?                              // 상한 (null = 이상)
  dependents      Int      @default(1)              // 부양가족 수
  taxAmount       Int                               // 원천징수 세액 (원)
  createdAt       DateTime @default(now())

  @@index([year, minIncome, dependents])
  @@map("tax_brackets")
}

// ── 비과세 한도 ──

model NontaxableLimit {
  id              String   @id @default(uuid()) @db.Uuid
  year            Int
  code            String   @db.VarChar(30)           // 'meal_allowance' | 'vehicle_allowance' | 'childcare' 등
  name            String   @db.VarChar(100)          // '식대'
  monthlyLimit    Int                                // 월 한도 (원)
  annualLimit     Int?                               // 연 한도 (원, null이면 월한도×12)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())

  @@unique([year, code])
  @@map("nontaxable_limits")
}

// ── 급여 실행 (월별) ──

model PayrollRun {
  id              String        @id @default(uuid()) @db.Uuid
  companyId       String        @db.Uuid
  company         Company       @relation(fields: [companyId], references: [id])
  year            Int
  month           Int                                // 1~12
  status          String        @default("draft") @db.VarChar(20) // 'draft' | 'calculated' | 'reviewed' | 'confirmed' | 'distributed'
  totalGross      Float         @default(0)
  totalDeductions Float         @default(0)
  totalNet        Float         @default(0)
  employeeCount   Int           @default(0)
  calculatedAt    DateTime?
  calculatedBy    String?       @db.Uuid
  confirmedAt     DateTime?
  confirmedBy     String?       @db.Uuid
  notes           String?       @db.Text
  items           PayrollItem[]
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@unique([companyId, year, month])
  @@map("payroll_runs")
}

// ── 급여 항목 (직원별) ──

model PayrollItem {
  id              String     @id @default(uuid()) @db.Uuid
  payrollRunId    String     @db.Uuid
  payrollRun      PayrollRun @relation(fields: [payrollRunId], references: [id], onDelete: Cascade)
  employeeId      String     @db.Uuid
  baseSalary      Int                                // 기본급 (월)
  allowances      Json                               // [{ code, name, amount, isTaxable }]
  overtimePay     Int        @default(0)             // 초과근무수당
  deductions      Json                               // [{ code, name, amount }]
  grossPay        Int                                // 총 지급액
  taxableIncome   Int                                // 과세 대상 소득
  nontaxableTotal Int        @default(0)             // 비과세 합계
  nationalPension Int        @default(0)
  healthInsurance Int        @default(0)
  longTermCare    Int        @default(0)
  employmentInsurance Int    @default(0)
  incomeTax       Int        @default(0)
  localIncomeTax  Int        @default(0)
  totalDeductions Int        @default(0)
  netPay          Int                                // 실수령액
  workDays        Int?
  overtimeHours   Float?
  isProrated      Boolean    @default(false)
  prorateRatio    Float?
  adjustments     Json?                              // HR 수동 조정 [{ reason, amount }]
  status          String     @default("calculated") @db.VarChar(20)
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  @@unique([payrollRunId, employeeId])
  @@index([employeeId])
  @@map("payroll_items")
}

// ── 급여명세서 ──

model Payslip {
  id              String   @id @default(uuid()) @db.Uuid
  payrollItemId   String   @db.Uuid
  employeeId      String   @db.Uuid
  year            Int
  month           Int
  pdfPath         String?  @db.VarChar(500)
  isViewed        Boolean  @default(false)
  viewedAt        DateTime?
  sentViaEmail    Boolean  @default(false)
  sentAt          DateTime?
  createdAt       DateTime @default(now())

  @@unique([payrollItemId])
  @@map("payslips")
}
```

### Task 2: 요율 시드 데이터

**2025년 기준 4대보험**:

```typescript
const insuranceRates2025 = [
  { year: 2025, type: 'national_pension', employeeRate: 4.5, employerRate: 4.5, upperLimit: 5900000, lowerLimit: 370000 },
  { year: 2025, type: 'health_insurance', employeeRate: 3.545, employerRate: 3.545, upperLimit: null, lowerLimit: null },
  { year: 2025, type: 'long_term_care', employeeRate: 12.81, employerRate: 12.81, upperLimit: null, lowerLimit: null },  // 건강보험의 %
  { year: 2025, type: 'employment_insurance', employeeRate: 0.9, employerRate: 1.15, upperLimit: null, lowerLimit: null },
  { year: 2025, type: 'industrial_accident', employeeRate: 0, employerRate: 1.47, upperLimit: null, lowerLimit: null },  // 제조업 기준
];
```

**비과세 한도**:
```typescript
const nontaxableLimits2025 = [
  { year: 2025, code: 'meal_allowance', name: '식대', monthlyLimit: 200000 },
  { year: 2025, code: 'vehicle_allowance', name: '자기차량 운전보조금', monthlyLimit: 200000 },
  { year: 2025, code: 'childcare', name: '육아수당', monthlyLimit: 200000 },
];
```

**간이세액표**: 주요 급여 구간 20~30개 시드. 나머지는 보간(interpolation) 처리.

### Task 3: 급여 계산 엔진

```typescript
// lib/payroll/calculatePayroll.ts

async function calculateEmployeePayroll(
  employeeId: string,
  year: number,
  month: number
): Promise<PayrollCalculation> {
  
  // Step 1: 기본 급여 수집
  const compensation = await getCurrentCompensation(employeeId, year, month);
  const baseSalary = compensation.baseSalaryMonthly;
  const allowances = compensation.allowances;
  
  // Step 2: 근태 반영
  const attendance = await getMonthlyAttendance(employeeId, year, month);
  const overtimePay = calculateOvertimePay(baseSalary, attendance);
  const absenceDeduction = calculateAbsenceDeduction(baseSalary, attendance);
  
  // Step 3: 총 지급액 + 비과세 분리
  const grossPay = baseSalary 
    + sumAllowances(allowances) 
    + overtimePay 
    - absenceDeduction;
  
  const nontaxableLimits = await getNontaxableLimits(year);
  const { taxableIncome, nontaxableTotal } = separateTaxable(
    baseSalary, allowances, overtimePay, nontaxableLimits
  );
  
  // Step 4: 4대보험
  const rates = await getInsuranceRates(year);
  const nationalPension = calcNationalPension(taxableIncome, rates);
  const healthInsurance = calcHealthInsurance(taxableIncome, rates);
  const longTermCare = calcLongTermCare(healthInsurance, rates);
  const employmentInsurance = calcEmploymentInsurance(taxableIncome, rates);
  
  // Step 5: 소득세
  const dependents = await getDependentCount(employeeId);
  const taxableAfterInsurance = taxableIncome - nationalPension - healthInsurance - longTermCare - employmentInsurance;
  const incomeTax = lookupTaxBracket(taxableAfterInsurance, dependents, year);
  const localIncomeTax = Math.floor(incomeTax * 0.1 / 10) * 10;  // 10원 미만 절사
  
  // 합계
  const totalDeductions = nationalPension + healthInsurance + longTermCare 
    + employmentInsurance + incomeTax + localIncomeTax;
  const netPay = grossPay - totalDeductions;
  
  return { baseSalary, allowances, overtimePay, deductions: [{ code: 'absence', name: '결근공제', amount: absenceDeduction }], grossPay, taxableIncome, nontaxableTotal, nationalPension, healthInsurance, longTermCare, employmentInsurance, incomeTax, localIncomeTax, totalDeductions, netPay };
}
```

**초과근무수당 계산**:
```typescript
function calculateOvertimePay(monthlyBase: number, attendance: MonthlyAttendance): number {
  const hourlyRate = monthlyBase / 209;  // 한국 월 소정근로시간 209시간 기준
  
  const extendedPay = attendance.extendedHours * hourlyRate * 1.5;   // 연장 150%
  const nightPay = attendance.nightHours * hourlyRate * 0.5;         // 야간 가산 50%
  const holidayPay = attendance.holidayHours * hourlyRate * 1.5;     // 휴일 150%
  
  return Math.round(extendedPay + nightPay + holidayPay);
}
```

**반올림 규칙**:
- 국민연금: 원 미만 절사
- 건강보험: 원 미만 절사
- 장기요양: 원 미만 절사
- 고용보험: 원 미만 절사
- 소득세: 10원 미만 절사
- 지방소득세: 10원 미만 절사

### Task 4: 중도입사/퇴사 일할계산

```typescript
function calculateProratedPay(
  monthlyPay: number,
  year: number,
  month: number,
  hireDate?: Date,
  resignDate?: Date
): { proratedPay: number; ratio: number; workDays: number; totalDays: number } {
  
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = endOfMonth(monthStart);
  const totalWorkDays = getBusinessDays(monthStart, monthEnd);
  
  const effectiveStart = hireDate && hireDate > monthStart ? hireDate : monthStart;
  const effectiveEnd = resignDate && resignDate < monthEnd ? resignDate : monthEnd;
  const actualWorkDays = getBusinessDays(effectiveStart, effectiveEnd);
  
  const ratio = actualWorkDays / totalWorkDays;
  const proratedPay = Math.round(monthlyPay * ratio);
  
  return { proratedPay, ratio, workDays: actualWorkDays, totalDays: totalWorkDays };
}
```

### Task 5: 급여 실행 플로우 UI

**라우트**: `/hr/payroll` (인사운영 섹션)

```
┌─────────────────────────────────────────────────────┐
│ 급여 관리 — CTR-KR                    2025년 3월분   │
├─────────────────────────────────────────────────────┤
│ 상태: [🟡 계산 완료 — HR 검토 대기]                   │
│                                                     │
│ [1.급여계산] → [2.HR검토] → [3.확정] → [4.명세서배포] │
│     ✅          ⏳ 현재       ⬜          ⬜          │
├─────────────────────────────────────────────────────┤
│ 요약                                                │
│ ├── 대상 인원: 153명 (정규 148 | 계약 5)              │
│ ├── 총 지급액: ₩ 823,450,000                        │
│ ├── 총 공제액: ₩ 164,690,000                        │
│ ├── 총 실수령: ₩ 658,760,000                        │
│ └── ⚠️ 이상 항목: 3건 [확인 필요]                    │
│                                                     │
│ [직원별 상세]                                        │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 사번  이름   기본급     수당    초과   총지급    공제   실수령   상태   │
│ │ 001  김과장  4,000,000  500,000  150,000  4,650,000  930,000  3,720,000  ✅ │
│ │ 002  이대리  3,200,000  400,000  0       3,600,000  720,000  2,880,000  ✅ │
│ │ 003  박사원  2,800,000  350,000  200,000  3,350,000  ⚠️      2,700,000  ⚠️ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ [재계산]  [확정]                                      │
└─────────────────────────────────────────────────────┘
```

**이상 항목 감지**:
- 전월 대비 급여 변동 > 20% → ⚠️ 경고
- 중도입사/퇴사 일할계산 적용 직원 → ℹ️ 정보
- 초과근무 수당이 기본급의 50% 초과 → ⚠️ 경고
- 4대보험 상한/하한 적용 직원 → ℹ️ 정보

### Task 6: HR 검토/수정 UI

직원별 급여 상세 → 클릭 시 수정 가능한 사이드패널.

```
┌────────────────────────────────────────┐
│ 박사원 (003) — 2025년 3월 급여          │
│ ⚠️ 초과근무 수당 비율 높음              │
├────────────────────────────────────────┤
│ 지급 항목                              │
│ ├── 기본급:       ₩ 2,800,000         │
│ ├── 직책수당:     ₩   200,000         │
│ ├── 식대(비과세):  ₩   200,000         │
│ ├── 초과근무수당:  ₩   350,000         │
│ │   └ 연장 20h(₩262,500) + 야간 8h(₩87,500)│
│ ├── 결근공제:     -₩  200,000         │
│ └── 총 지급액:    ₩ 3,350,000         │
│                                        │
│ 공제 항목                              │
│ ├── 국민연금:     ₩   139,050         │
│ ├── 건강보험:     ₩   109,390         │
│ ├── 장기요양:     ₩    14,010         │
│ ├── 고용보험:     ₩    27,810         │
│ ├── 소득세:       ₩    85,200         │
│ ├── 지방소득세:   ₩     8,520         │
│ └── 총 공제액:    ₩   383,980         │
│                                        │
│ 실수령액:         ₩ 2,966,020         │
│                                        │
│ HR 조정:                               │
│ [+ 조정 추가]                           │
│ 사유: [특별수당 - 프로젝트 완료 보상    ] │
│ 금액: [+ ₩ 500,000]                    │
│                                        │
│ [저장] [원래대로]                        │
└────────────────────────────────────────┘
```

### Task 7: 급여명세서 PDF 생성

확정 후 직원별 PDF 급여명세서 자동 생성.

**PDF 내용**:
```
┌──────────────────────────────────────┐
│        CTR Korea Co., Ltd.           │
│         급 여 명 세 서               │
│        2025년 03월분                 │
├──────────────────────────────────────┤
│ 사 번: 003      성 명: 박사원        │
│ 부 서: 개발팀    직 급: 사원(S1)     │
├──────────────────────────────────────┤
│ [지급 내역]           [공제 내역]     │
│ 기본급    2,800,000  국민연금  139,050│
│ 직책수당    200,000  건강보험  109,390│
│ 식대       200,000  장기요양   14,010│
│ 초과근무    350,000  고용보험   27,810│
│ 결근공제   -200,000  소득세    85,200│
│ 특별수당    500,000  지방세     8,520│
│                                      │
│ 지급합계  3,850,000  공제합계  383,980│
│                                      │
│         실수령액: ₩ 3,466,020        │
├──────────────────────────────────────┤
│ 근태: 근무 20일 | 연장 20h | 야간 8h │
│ 연차: 잔여 12/15일                   │
└──────────────────────────────────────┘
```

**생성/배포**:
- PDF → Supabase Storage 저장 (`payslips/{year}/{month}/{employeeId}.pdf`)
- 직원에게 인앱 알림: "3월 급여명세서가 발급되었습니다"
- 이메일 발송 (선택적)
- 직원은 "나의 공간 > 급여" 에서 확인 + PDF 다운로드

### Task 8: 휴직자/예외 처리

**제외 대상**: 무급휴직자, 퇴직 처리 완료자 → PayrollRun 대상에서 자동 제외

**예외 케이스 목록**:
| 케이스 | 처리 |
|--------|------|
| 중도입사 | 일할계산 (Task 4) |
| 중도퇴사 | 일할계산 + 미사용 연차수당 (B6-2 LeaveBalance 참조) |
| 무급휴직 | 제외 (급여 0원, 4대보험만 처리) |
| 육아휴직 | 급여 미지급, 4대보험 특례 (감면) |
| 연봉 인상 반영 | 인상 effective_date 기준 해당월부터 반영 |
| 비과세 한도 초과 | 한도 초과분은 과세 대상으로 전환 |

### Task 9: 검증

```bash
# 1. 급여 계산 정확성
#    - 기본급 4,000,000 직원의 4대보험/세금 수동 계산 대조
#    - 중도입사(3/15) 직원 일할계산 검증
#    - 초과근무 20시간 야간 8시간 수당 검증

# 2. 급여 실행 플로우
#    - 계산 → 검토 → 확정 → 명세서 상태 전이
#    - 확정 후 수정 불가 확인

# 3. HR 조정
#    - 수동 조정 추가 → 총액 재계산
#    - 조정 사유 기록

# 4. 이상 항목 감지
#    - 전월 대비 변동 > 20% 경고
#    - 중도입사 알림

# 5. 급여명세서 PDF
#    - PDF 생성 → Storage 저장
#    - 직원 조회 가능 확인

# 6. 비과세 한도
#    - 식대 200,000 초과분 과세 전환 확인

# 7. [B] 트랙과의 충돌 확인
#    - TRACK_B.md 확인하여 겹치는 테이블/라우트 없는지 검증

npx tsc --noEmit
npm run build
# context/TRACK_A.md 업데이트 (SHARED.md, TRACK_B.md 수정 금지)
```

---

## 산출물 체크리스트

- [ ] Prisma 모델 6개 (InsuranceRate, TaxBracket, NontaxableLimit, PayrollRun, PayrollItem, Payslip)
- [ ] 2025년 요율 시드 (4대보험 + 비과세 한도 + 간이세액표 주요 구간)
- [ ] 급여 계산 엔진 (기본급→수당→근태→비과세→4대보험→세금)
- [ ] 초과근무수당 계산 (연장150%/야간50%/휴일150%)
- [ ] 중도입사/퇴사 일할계산
- [ ] 급여 실행 플로우 UI (계산→검토→확정→배포)
- [ ] HR 검토/수정 사이드패널
- [ ] 이상 항목 감지 + 경고
- [ ] 급여명세서 PDF 생성 + 배포
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 성공
- [ ] **context/TRACK_A.md 업데이트** (아래 내용 기록)

---

## context/TRACK_A.md 업데이트 내용 (세션 종료 시)

```markdown
## B7-1a 완료 (날짜)

### DB 테이블
- insurance_rates, tax_brackets, nontaxable_limits
- payroll_runs, payroll_items, payslips
- migrate 이름: a_b7_payroll_kr

### 핵심 함수
- calculateEmployeePayroll() — 직원별 급여 계산
- calculateOvertimePay() — 초과근무수당
- calculateProratedPay() — 일할계산
- lookupTaxBracket() — 간이세액표 조회

### [B] 트랙 참고사항
- B6-1(B트랙) 근태 데이터(초과근무 시간, 야간근무) 참조
- B6-1 shift_definitions.isNightShift → 야간수당 계산에 사용

### 다음 세션 주의사항 (A 트랙)
- B7-1b: payroll_items 데이터를 연말정산에서 참조 (연간 총급여, 기납부세액)
- B7-1b: insurance_rates/tax_brackets 테이블을 연말정산에서도 사용
- B7-2: payroll_runs 구조를 해외 법인도 동일하게 사용 (계산 엔진만 다름)
- B10-1: 초과근무 시간 데이터 → 번아웃 지표
```

---

## 주의사항

1. **요율은 반드시 시드 데이터/설정 테이블에서** — `4.5`를 코드에 쓰지 마세요. `insuranceRates` 테이블에서 조회. 2026년에 요율이 바뀌면 새 시드만 추가하면 됩니다.

2. **간이세액표 전체 시드는 비현실적** — 실제 간이세액표는 수백 행입니다. 주요 급여 구간(200만~1000만원, 100만원 단위)과 부양가족 1~4명 조합만 시드하고, 구간 사이는 보간 처리하세요.

3. **확정 후 불변 = 데이터 무결성의 핵심** — `PayrollRun.status = 'confirmed'` 이후에는 `PayrollItem`을 UPDATE하면 안 됩니다. API에서 확정 상태 체크 미들웨어를 반드시 추가하세요.

4. **급여명세서 PDF 보안** — 급여 데이터는 극도로 민감합니다. Supabase Storage에 저장 시 해당 직원만 접근 가능한 RLS/경로 구조.

5. **월 소정근로시간 209시간** — 한국 통상임금 계산의 기준입니다. 이 숫자도 하드코딩하지 말고 `attendance_settings` 또는 `compensation_settings`에서 관리하세요.

6. **migrate 이름에 `a_` 접두사 필수** — [B] 트랙과의 migrate lock 충돌을 방지합니다.
