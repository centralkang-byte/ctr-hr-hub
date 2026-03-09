# B7-1b: 연말정산

> **역할**: 당신은 CTR HR Hub의 CTO이자 시니어 풀스택 개발자입니다.
> **스택**: Next.js (App Router) + Supabase + PostgreSQL + **Prisma ORM** + Tailwind CSS
> **컨텍스트**: Phase A + B1 + B7-1a(국내 급여 계산 엔진) 완료.

### DB 접근 규칙 (전 세션 공통)

- 모든 테이블 생성/변경은 `prisma/schema.prisma` → `prisma migrate dev`
- 쿼리는 Prisma Client 사용
- Supabase는 Auth + Storage + Realtime 용도만

---

## 세션 목표

CTR-KR 직원의 **연말정산(Year-End Tax Settlement)** 프로세스를 구현합니다. 부양가족 확인 → 홈택스 간소화자료 PDF 업로드(파싱) → 추가공제 입력 → 자동계산 → HR 확정 → 원천징수영수증 발급까지 전 과정입니다.

**핵심**: 소득공제/세액공제 항목과 한도를 전부 **설정 테이블**로 관리합니다. 세법은 매년 바뀌므로 하드코딩 절대 금지.

**범위**: CTR-KR(한국법인)만. 다른 법인은 연말정산 해당 없음.

---

## ⚠️ 시작 전 필수 확인

### 컨텍스트 파일 규칙 (병렬 개발)

```bash
# 읽기: 3개 파일 모두 읽으세요
cat context/SHARED.md       # 공유 인프라 상태 확인
cat context/TRACK_A.md      # 이전 A 트랙 작업 확인 (이 세션은 [A] 트랙)
cat context/TRACK_B.md      # B 트랙 상태 참고

# 쓰기: TRACK_A.md에만 기록하세요
# 이 세션 결과는 context/TRACK_A.md에 기록하세요
# SHARED.md는 수정하지 마세요
```

### 선행 모듈 확인

```bash
# 1. B7-1a payroll_items 구조 확인
# - 연간 총급여 합산 가능 여부 (payrollRunId → year로 필터)
# - 기납부 소득세/지방소득세 합산 가능 여부

# 2. B7-1a insurance_rates, tax_brackets 테이블 확인
# - 연말정산 계산에 동일 테이블 사용

# 3. 직원 부양가족 데이터 존재 여부
# - 없으면 이번 세션에서 생성
```

### ⚠️ 연말정산의 복잡성 경고

한국 연말정산은 HR SaaS에서 **가장 복잡한 기능 중 하나**입니다. 이번 세션에서는 **핵심 로직의 프레임워크**를 만들고, 모든 세부 규칙을 완벽히 구현하려 하지 마세요.

**구현 범위**:
- ✅ 부양가족 관리 + 간소화자료 업로드 + 주요 공제 계산 + 결과 확인
- ✅ 공제 항목/한도를 설정 테이블로 관리하는 구조
- ❌ 모든 세법 엣지케이스 (외국인 특례, 중소기업 감면, 종교단체 기부 등은 추후)

---

## 핵심 설계 원칙

### 1. 연말정산 프로세스 플로우

```
Step 1: 직원 — 부양가족 확인/수정
  ↓
Step 2: 직원 — 홈택스 간소화자료 PDF 업로드
  ↓ (서버에서 파싱 → 공제 항목 자동 채움)
Step 3: 직원 — 추가공제 수동 입력 (간소화 미포함 항목)
  ↓
Step 4: 시스템 — 자동 계산 (소득공제 → 과세표준 → 산출세액 → 세액공제 → 결정세액 → 차감징수)
  ↓
Step 5: 직원 — 결과 확인 + 제출
  ↓
Step 6: HR — 검토 + 확정
  ↓
Step 7: 시스템 — 원천징수영수증 생성
  ↓
Step 8: 차감/추가 징수 → 다음 급여에 반영 (B7-1a 연동)
```

### 2. 공제 항목 = 모두 설정 테이블

```
소득공제 (Deductions from Income):
├── 인적공제: 본인 150만, 배우자 150만, 부양가족 1인당 150만
├── 국민연금 공제: 전액
├── 건강보험 공제: 전액
├── 주택임차차입금: 한도 설정
├── 신용카드 공제: 총급여 25% 초과분, 한도 300~500만
├── 의료비 공제: 총급여 3% 초과분, 한도 700만
├── 교육비 공제: 본인 전액, 자녀 1인당 300만
└── ...

세액공제 (Tax Credits):
├── 근로소득 세액공제: 산출세액 기준 차등
├── 자녀 세액공제: 1명 15만, 2명 35만, 3명+ 35만+30만×(N-2)
├── 월세 세액공제: 총급여 7000만 이하, 한도 750만 (12%/15%)
├── 기부금 세액공제: 한도별 차등
└── ...
```

### 3. 계산 순서 (변경 불가)

```
① 총급여 (B7-1a payroll_items 연간 합산)
② - 근로소득공제 (총급여 구간별 자동)
③ = 근로소득금액
④ - 소득공제 합계 (인적+연금+보험+주택+신용카드+의료비+교육비+...)
⑤ = 과세표준
⑥ × 세율 (과세표준 구간별)
⑦ = 산출세액
⑧ - 세액공제 합계 (근로소득+자녀+월세+기부금+...)
⑨ = 결정세액
⑩ - 기납부세액 (B7-1a 원천징수 합산)
⑪ = 차감징수세액 (양수: 추가납부, 음수: 환급)
```

---

## 작업 순서 (8 Tasks)

### Task 1: DB 마이그레이션 — Prisma 모델 추가

`prisma/schema.prisma`에 추가 후 `npx prisma migrate dev --name a_b7_year_end_settlement` 실행.

```prisma
// ── 연말정산 공제 항목 설정 (매년 업데이트) ──

model YearEndDeductionConfig {
  id              String   @id @default(uuid()) @db.Uuid
  year            Int
  category        String   @db.VarChar(30)     // 'income_deduction' | 'tax_credit'
  code            String   @db.VarChar(50)     // 'personal', 'pension', 'health_insurance', 'credit_card', 'medical', 'education', 'housing_rent', 'donation', 'child_credit' 등
  name            String   @db.VarChar(100)    // '인적공제', '신용카드 공제'
  rules           Json                         // 계산 규칙 (한도, 요율, 조건 등)
  displayOrder    Int      @default(0)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())

  @@unique([year, code])
  @@map("year_end_deduction_configs")
}

// rules JSON 예시 — 신용카드:
// {
//   "thresholdRate": 0.25,         // 총급여의 25% 초과분
//   "rates": {
//     "credit_card": 0.15,         // 신용카드 15%
//     "debit_card": 0.30,          // 체크카드 30%
//     "cash_receipt": 0.30,        // 현금영수증 30%
//     "traditional_market": 0.40   // 전통시장 40%
//   },
//   "limits": {
//     "salary_under_7000": 3000000,
//     "salary_7000_12000": 2500000,
//     "salary_over_12000": 2000000
//   }
// }

// ── 과세표준 세율 구간 ──

model IncomeTaxRate {
  id              String   @id @default(uuid()) @db.Uuid
  year            Int
  minAmount       BigInt                       // 하한 (원)
  maxAmount       BigInt?                      // 상한 (null = 초과)
  rate            Float                        // 세율 (%)
  progressiveDeduction BigInt                  // 누진공제액 (원)
  createdAt       DateTime @default(now())

  @@index([year, minAmount])
  @@map("income_tax_rates")
}

// ── 직원별 연말정산 ──

model YearEndSettlement {
  id              String   @id @default(uuid()) @db.Uuid
  employeeId      String   @db.Uuid
  year            Int
  status          String   @default("not_started") @db.VarChar(20) // 'not_started' | 'in_progress' | 'submitted' | 'hr_review' | 'confirmed'
  
  // ① 총급여 (B7-1a 자동 집계)
  totalSalary     BigInt   @default(0)          // 연간 총급여
  earnedIncomeDeduction BigInt @default(0)       // ② 근로소득공제
  earnedIncome    BigInt   @default(0)           // ③ 근로소득금액
  
  // ④ 소득공제
  incomeDeductions Json?                         // [{ code, name, amount, details }]
  totalIncomeDeduction BigInt @default(0)
  
  // ⑤~⑦
  taxableBase     BigInt   @default(0)           // ⑤ 과세표준
  taxRate         Float?                         // 적용 세율
  calculatedTax   BigInt   @default(0)           // ⑦ 산출세액
  
  // ⑧ 세액공제
  taxCredits      Json?                          // [{ code, name, amount, details }]
  totalTaxCredit  BigInt   @default(0)
  
  // ⑨~⑪
  determinedTax   BigInt   @default(0)           // ⑨ 결정세액
  prepaidTax      BigInt   @default(0)           // ⑩ 기납부세액
  finalSettlement BigInt   @default(0)           // ⑪ 차감징수 (양수=추가납부, 음수=환급)
  localTaxSettlement BigInt @default(0)          // 지방소득세 차감징수
  
  submittedAt     DateTime?
  confirmedAt     DateTime?
  confirmedBy     String?  @db.Uuid
  
  dependents      YearEndDependent[]
  deductions      YearEndDeduction[]
  documents       YearEndDocument[]
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([employeeId, year])
  @@map("year_end_settlements")
}

// ── 부양가족 ──

model YearEndDependent {
  id              String            @id @default(uuid()) @db.Uuid
  settlementId    String            @db.Uuid
  settlement      YearEndSettlement @relation(fields: [settlementId], references: [id], onDelete: Cascade)
  relationship    String            @db.VarChar(20)  // 'self' | 'spouse' | 'child' | 'parent' | 'grandparent' | 'sibling' | 'disabled'
  name            String            @db.VarChar(50)
  residentNumber  String?           @db.VarChar(20)  // 주민번호 (암호화 저장)
  birthDate       DateTime?         @db.Date
  isDisabled      Boolean           @default(false)
  isSenior        Boolean           @default(false)  // 70세 이상
  isSingleParent  Boolean           @default(false)
  deductionAmount Int               @default(1500000) // 기본 150만원
  additionalDeduction Int           @default(0)       // 추가공제 (경로우대/장애인 등)
  createdAt       DateTime          @default(now())

  @@map("year_end_dependents")
}

// ── 공제 항목 상세 (직원 입력) ──

model YearEndDeduction {
  id              String            @id @default(uuid()) @db.Uuid
  settlementId    String            @db.Uuid
  settlement      YearEndSettlement @relation(fields: [settlementId], references: [id], onDelete: Cascade)
  configCode      String            @db.VarChar(50)  // year_end_deduction_configs.code 참조
  category        String            @db.VarChar(30)  // 'income_deduction' | 'tax_credit'
  name            String            @db.VarChar(100)
  inputAmount     BigInt            @default(0)      // 직원 입력/간소화 금액
  deductibleAmount BigInt           @default(0)      // 공제 가능 금액 (한도 적용 후)
  details         Json?                              // 항목별 상세 (신용카드 유형별 금액 등)
  source          String            @default("manual") @db.VarChar(20) // 'manual' | 'hometax_pdf' | 'auto'
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@map("year_end_deductions")
}

// ── 제출 서류 ──

model YearEndDocument {
  id              String            @id @default(uuid()) @db.Uuid
  settlementId    String            @db.Uuid
  settlement      YearEndSettlement @relation(fields: [settlementId], references: [id], onDelete: Cascade)
  documentType    String            @db.VarChar(50)  // 'hometax_simplified' | 'medical_receipt' | 'education_receipt' | 'donation_receipt' | 'housing_contract'
  fileName        String            @db.VarChar(200)
  filePath        String            @db.VarChar(500) // Supabase Storage 경로
  parsedData      Json?                              // PDF 파싱 결과
  uploadedAt      DateTime          @default(now())

  @@map("year_end_documents")
}

// ── 원천징수영수증 ──

model WithholdingReceipt {
  id              String   @id @default(uuid()) @db.Uuid
  settlementId    String   @db.Uuid
  employeeId      String   @db.Uuid
  year            Int
  pdfPath         String?  @db.VarChar(500)
  issuedAt        DateTime @default(now())

  @@unique([settlementId])
  @@map("withholding_receipts")
}
```

### Task 2: 공제 항목 설정 시드 (2025년)

**소득공제 (income_deduction)** 주요 항목:

```typescript
const incomeDeductions2025 = [
  {
    code: 'personal', name: '인적공제',
    rules: { basePerPerson: 1500000, additionalSenior: 1000000, additionalDisabled: 2000000, additionalSingleParent: 1000000 }
  },
  {
    code: 'national_pension', name: '국민연금 공제',
    rules: { rate: 1.0 }  // 전액 공제
  },
  {
    code: 'health_insurance', name: '건강보험 공제',
    rules: { rate: 1.0 }  // 전액 공제
  },
  {
    code: 'credit_card', name: '신용카드 등 소득공제',
    rules: {
      thresholdRate: 0.25,
      rates: { credit_card: 0.15, debit_card: 0.30, cash_receipt: 0.30, traditional_market: 0.40, public_transport: 0.40, culture: 0.30 },
      limits: { salary_under_7000: 3000000, salary_7000_12000: 2500000, salary_over_12000: 2000000 },
      additionalLimits: { traditional_market: 1000000, public_transport: 1000000, culture: 1000000 }
    }
  },
  {
    code: 'housing_savings', name: '주택마련저축 공제',
    rules: { rate: 0.4, annualLimit: 2400000, salaryLimit: 70000000 }
  },
  {
    code: 'housing_loan_interest', name: '주택임차차입금 이자 공제',
    rules: { limits: { lease_deposit: 3000000, mortgage_fixed_15y: 15000000, mortgage_fixed_10y: 3000000 } }
  },
];

const taxCredits2025 = [
  {
    code: 'earned_income_credit', name: '근로소득 세액공제',
    rules: { brackets: [
      { maxTax: 1300000, rate: 0.55 },
      { minTax: 1300000, rate: 0.30, base: 715000 }
    ], limits: { salary_under_3300: 740000, salary_3300_7000: 660000, salary_over_7000: 500000 } }
  },
  {
    code: 'child_credit', name: '자녀 세액공제',
    rules: { first: 150000, second: 350000, thirdPlus: 300000 }  // 3명부터 추가 30만원씩
  },
  {
    code: 'medical_credit', name: '의료비 세액공제',
    rules: { thresholdRate: 0.03, rate: 0.15, seniorDisabledRate: 0.15, limit: 7000000, seniorDisabledNoLimit: true }
  },
  {
    code: 'education_credit', name: '교육비 세액공제',
    rules: { rate: 0.15, selfNoLimit: true, childLimit: 3000000, kindergartenLimit: 3000000 }
  },
  {
    code: 'donation_credit', name: '기부금 세액공제',
    rules: { politicalLimit: 100000, rate15: 0.15, rate30threshold: 10000000, rate30: 0.30 }
  },
  {
    code: 'rent_credit', name: '월세 세액공제',
    rules: { salaryLimit: 70000000, annualLimit: 7500000, rate_under_5500: 0.17, rate_5500_7000: 0.15 }
  },
];
```

**과세표준 세율 구간** (2025년):
```typescript
const taxRates2025 = [
  { minAmount: 0,          maxAmount: 14000000,   rate: 6,  progressiveDeduction: 0 },
  { minAmount: 14000000,   maxAmount: 50000000,   rate: 15, progressiveDeduction: 1260000 },
  { minAmount: 50000000,   maxAmount: 88000000,   rate: 24, progressiveDeduction: 5760000 },
  { minAmount: 88000000,   maxAmount: 150000000,  rate: 35, progressiveDeduction: 15440000 },
  { minAmount: 150000000,  maxAmount: 300000000,  rate: 38, progressiveDeduction: 19940000 },
  { minAmount: 300000000,  maxAmount: 500000000,  rate: 40, progressiveDeduction: 25940000 },
  { minAmount: 500000000,  maxAmount: 1000000000, rate: 42, progressiveDeduction: 35940000 },
  { minAmount: 1000000000, maxAmount: null,        rate: 45, progressiveDeduction: 65940000 },
];
```

### Task 3: 연말정산 계산 엔진

```typescript
// lib/payroll/yearEndCalculation.ts

async function calculateYearEndSettlement(
  employeeId: string,
  year: number
): Promise<YearEndCalculationResult> {
  
  // ① 총급여 집계 (B7-1a payroll_items)
  const totalSalary = await sumAnnualGross(employeeId, year);
  
  // ② 근로소득공제 (총급여 구간별 자동 — 설정 테이블)
  const earnedIncomeDeduction = calcEarnedIncomeDeduction(totalSalary);
  
  // ③ 근로소득금액
  const earnedIncome = totalSalary - earnedIncomeDeduction;
  
  // ④ 소득공제 합산
  const deductions = await prisma.yearEndDeduction.findMany({
    where: { settlementId, category: 'income_deduction' }
  });
  const totalIncomeDeduction = deductions.reduce((sum, d) => sum + Number(d.deductibleAmount), 0);
  
  // ⑤ 과세표준
  const taxableBase = Math.max(0, earnedIncome - totalIncomeDeduction);
  
  // ⑥⑦ 산출세액 (누진세율 적용)
  const taxRates = await prisma.incomeTaxRate.findMany({ where: { year }, orderBy: { minAmount: 'asc' } });
  const { calculatedTax, appliedRate } = applyProgressiveTax(taxableBase, taxRates);
  
  // ⑧ 세액공제 합산
  const credits = await prisma.yearEndDeduction.findMany({
    where: { settlementId, category: 'tax_credit' }
  });
  const totalTaxCredit = credits.reduce((sum, c) => sum + Number(c.deductibleAmount), 0);
  
  // ⑨ 결정세액
  const determinedTax = Math.max(0, calculatedTax - totalTaxCredit);
  
  // ⑩ 기납부세액 (B7-1a 월별 원천징수 합산)
  const prepaidTax = await sumPrepaidTax(employeeId, year);
  
  // ⑪ 차감징수 (양수 = 추가납부, 음수 = 환급)
  const finalSettlement = determinedTax - prepaidTax;
  const localTaxSettlement = Math.round(finalSettlement * 0.1);
  
  return { totalSalary, earnedIncomeDeduction, earnedIncome, totalIncomeDeduction, taxableBase, appliedRate, calculatedTax, totalTaxCredit, determinedTax, prepaidTax, finalSettlement, localTaxSettlement };
}
```

### Task 4: 직원용 연말정산 UI

**라우트**: `/my/year-end-settlement` (나의 공간)

**위저드 형태 — 4단계**:

```
[Step 1: 부양가족] → [Step 2: 자료 업로드] → [Step 3: 추가 입력] → [Step 4: 결과 확인]
```

**Step 1 — 부양가족 확인**:
```
┌─────────────────────────────────────────────────┐
│ 부양가족 확인 — 2025년                            │
├─────────────────────────────────────────────────┤
│ ☑ 본인 (기본공제 150만원)                         │
│ ☑ 배우자 김OO (기본공제 150만원)                   │
│ ☑ 자녀 홍OO (2015.03, 기본공제 150만원)            │
│ ☑ 부친 홍OO (1955.08, 기본 150만 + 경로우대 100만) │
│                                                 │
│ [+ 부양가족 추가]                                 │
│ [다음 →]                                         │
└─────────────────────────────────────────────────┘
```

**Step 2 — 홈택스 간소화자료 업로드**:
```
┌─────────────────────────────────────────────────┐
│ 간소화자료 업로드                                  │
├─────────────────────────────────────────────────┤
│ 홈택스(www.hometax.go.kr)에서 다운로드한           │
│ PDF 파일을 업로드하세요.                           │
│                                                 │
│ [📁 PDF 파일 드래그 또는 클릭하여 업로드]           │
│                                                 │
│ ✅ 간소화자료.pdf (파싱 완료)                      │
│   ├── 신용카드: ₩ 24,500,000                    │
│   ├── 체크카드: ₩ 8,200,000                     │
│   ├── 의료비: ₩ 3,150,000                       │
│   ├── 교육비: ₩ 4,800,000                       │
│   ├── 보험료: ₩ 2,400,000                       │
│   └── 기부금: ₩ 500,000                         │
│                                                 │
│ [← 이전] [다음 →]                                │
└─────────────────────────────────────────────────┘
```

**PDF 파싱**: 홈택스 간소화 PDF의 구조화된 데이터를 추출. 완벽한 파싱이 어려우면 **금액만 수동 입력하는 폼**을 대안으로 제공.

**Step 3 — 추가공제 입력**:
간소화 자료에 포함되지 않는 항목 수동 입력:
- 월세 (임대차계약서 업로드)
- 주택마련저축 (통장사본 업로드)
- 추가 기부금

**Step 4 — 결과 확인**:
```
┌─────────────────────────────────────────────────┐
│ 2025년 연말정산 결과                               │
├─────────────────────────────────────────────────┤
│ ① 총급여:              ₩ 54,000,000             │
│ ② 근로소득공제:         ₩ 12,750,000             │
│ ③ 근로소득금액:         ₩ 41,250,000             │
│ ④ 소득공제 합계:        ₩ 11,230,000             │
│   ├ 인적공제:           ₩  6,000,000             │
│   ├ 국민연금:           ₩  2,430,000             │
│   ├ 건강보험:           ₩  1,912,000             │
│   └ 신용카드 등:        ₩    888,000             │
│ ⑤ 과세표준:            ₩ 30,020,000             │
│ ⑥ 세율:               15%                       │
│ ⑦ 산출세액:            ₩  3,243,000             │
│ ⑧ 세액공제 합계:        ₩  1,628,000             │
│   ├ 근로소득:           ₩    660,000             │
│   ├ 자녀:              ₩    150,000             │
│   ├ 의료비:            ₩    232,500             │
│   └ 교육비:            ₩    585,500             │
│ ⑨ 결정세액:            ₩  1,615,000             │
│ ⑩ 기납부세액:           ₩  1,780,000             │
│                                                 │
│ ⑪ 환급 예정:           ₩    165,000  🎉         │
│   (지방소득세 환급:     ₩     16,500)             │
│                                                 │
│ [← 수정하기]  [제출]                              │
└─────────────────────────────────────────────────┘
```

### Task 5: 공제 금액 자동 계산 (한도 적용)

각 공제 항목의 `inputAmount` → `deductibleAmount` 변환 시 한도를 적용합니다.

```typescript
// lib/payroll/deductionCalculator.ts

async function calculateDeductibleAmount(
  code: string,
  inputAmount: number,
  totalSalary: number,
  year: number
): Promise<number> {
  const config = await prisma.yearEndDeductionConfig.findUnique({
    where: { year_code: { year, code } }
  });
  
  const rules = config.rules as DeductionRules;
  
  switch (code) {
    case 'credit_card': {
      // 총급여 25% 초과분에 대해 유형별 공제율 적용
      const threshold = totalSalary * rules.thresholdRate;
      const excess = Math.max(0, inputAmount - threshold);
      // ... 유형별 공제율 적용 + 한도 적용
      return Math.min(calculated, limit);
    }
    case 'medical': {
      // 총급여 3% 초과분의 15%
      const threshold = totalSalary * rules.thresholdRate;
      const excess = Math.max(0, inputAmount - threshold);
      return Math.min(excess * rules.rate, rules.limit);
    }
    // ... 항목별 계산 로직
  }
}
```

**핵심**: 계산 로직은 `rules` JSON에서 한도/요율을 읽어서 처리. 코드에 숫자를 하드코딩하지 않습니다.

### Task 6: HR 관리 — 진행현황 + 검토 + 확정

**라우트**: `/hr/year-end-settlement` (인사운영)

```
┌─────────────────────────────────────────────────┐
│ 2025년 연말정산 관리               CTR-KR          │
├─────────────────────────────────────────────────┤
│ 진행 현황:                                       │
│ 미시작 23명 | 진행중 45명 | 제출완료 80명 | 확정 5명 │
│ [==============████████░░░]  완료율 55%           │
│                                                 │
│ ⚠️ 마감까지 7일 남음                              │
│                                                 │
│ 제출 완료 직원 (HR 검토 필요):                     │
│ ├── 김과장: 환급 ₩165,000 [검토] [확정]            │
│ ├── 이대리: 추가납부 ₩42,000 [검토] [확정]          │
│ └── ...                                          │
│                                                 │
│ [일괄 확정] [미제출 독촉 알림]                      │
└─────────────────────────────────────────────────┘
```

### Task 7: 원천징수영수증 생성

확정 후 직원별 원천징수영수증 PDF 자동 생성.

- B7-1a Payslip과 유사한 PDF 생성 패턴
- Supabase Storage 저장
- 직원 "나의 공간"에서 다운로드 가능

### Task 8: 검증

```bash
# 1. 연말정산 계산 정확성
#    - 총급여 5400만원, 부양가족 4인, 신용카드 2450만원 기준 수동 계산 대조
#    - 결정세액 vs 기납부세액 차액 = 환급/추가납부 확인

# 2. 위저드 플로우
#    - Step 1~4 전환 동작
#    - PDF 업로드 → 파싱 결과 표시 (또는 수동 입력)
#    - 결과 확인 → 제출

# 3. 공제 한도 적용
#    - 신용카드: 총급여 25% 초과분만 공제
#    - 의료비: 총급여 3% 초과분만 공제
#    - 한도 초과 시 한도액으로 제한

# 4. HR 관리
#    - 진행현황 대시보드
#    - 직원별 검토 → 확정
#    - 일괄 확정

# 5. 원천징수영수증 PDF 생성

npx tsc --noEmit
npm run build
# context/TRACK_A.md 업데이트
```

---

## 산출물 체크리스트

- [ ] Prisma 모델 7개 (YearEndDeductionConfig, IncomeTaxRate, YearEndSettlement, YearEndDependent, YearEndDeduction, YearEndDocument, WithholdingReceipt)
- [ ] 2025년 시드 (소득공제 6+, 세액공제 6+, 과세표준 세율 8구간)
- [ ] 연말정산 계산 엔진 (11단계 순차 계산)
- [ ] 공제 한도 자동 적용 로직
- [ ] 직원용 위저드 UI (4단계)
- [ ] 홈택스 PDF 업로드 + 파싱 (또는 수동 입력 대안)
- [ ] HR 관리 대시보드 + 검토 + 확정
- [ ] 원천징수영수증 PDF 생성
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 성공
- [ ] context/TRACK_A.md 업데이트

---

## context/TRACK_A.md 업데이트 내용 (세션 종료 시)

```markdown
## B7-1b 완료 (날짜) — [A] 트랙

### DB 테이블
- year_end_deduction_configs, income_tax_rates
- year_end_settlements, year_end_dependents, year_end_deductions, year_end_documents
- withholding_receipts

### 핵심 함수
- calculateYearEndSettlement() — 11단계 연말정산 계산
- calculateDeductibleAmount() — 항목별 한도 적용
- sumAnnualGross() / sumPrepaidTax() — B7-1a 데이터 집계

### 다음 세션 주의사항
- B7-2: 해외법인은 연말정산 해당 없음 (한국만)
- B7-2: payroll_runs 구조는 공유하되 계산 엔진은 다름
- B10-2: HR KPI에 연말정산 완료율 위젯 추가 가능
```

---

## 주의사항

1. **홈택스 PDF 파싱의 현실** — 국세청 간소화 PDF는 구조가 매년 바뀔 수 있고, 완벽한 파싱은 매우 어렵습니다. **PDF 파싱은 best-effort로 구현하고, 파싱 실패 시 수동 입력 폼으로 fallback**하세요. 파싱 결과는 반드시 직원이 확인/수정할 수 있어야 합니다.

2. **주민번호 암호화** — `YearEndDependent.residentNumber`는 개인정보 중 가장 민감합니다. DB 레벨 암호화(pgcrypto) 또는 애플리케이션 레벨 암호화를 적용하세요. 화면 표시 시 뒷자리 마스킹 (예: 800101-1\*\*\*\*\*\*).

3. **BigInt 사용 이유** — 연간 총급여와 과세표준은 수억 원이 될 수 있고, 누진공제액도 큰 숫자입니다. JavaScript의 Number 정밀도 한계(2^53)를 고려해 Prisma `BigInt` 사용. 프론트에서는 `BigInt` → `string`으로 변환하여 표시.

4. **세법 변경 대응** — 2026년에 세율이나 공제 한도가 바뀌면, `year_end_deduction_configs`와 `income_tax_rates`에 2026년 시드를 추가하면 됩니다. 코드 변경 없이 연도별 규칙을 관리하는 것이 이 설계의 핵심입니다.

5. **차감징수 → 급여 반영은 이번 세션에서 안 함** — 환급/추가납부 금액을 다음 달 급여에 반영하는 것은 B7-1a의 `PayrollItem.adjustments`로 처리하면 됩니다. 이번 세션에서는 `finalSettlement` 계산까지만 하고, 급여 반영 로직은 다음 급여 실행 시 HR이 수동으로 조정 항목에 추가하세요.
