# B7-2: 해외 급여 통합 + 글로벌 분석

> **역할**: 당신은 CTR HR Hub의 CTO이자 시니어 풀스택 개발자입니다.
> **스택**: Next.js (App Router) + Supabase + PostgreSQL + **Prisma ORM** + Tailwind CSS
> **컨텍스트**: Phase A + B1(법인 엔진 + exchange_rates + compensation_settings) + B7-1a(국내 급여) + B7-1b(연말정산) 완료.

### DB 접근 규칙 (전 세션 공통)

- 모든 테이블 생성/변경은 `prisma/schema.prisma` → `prisma migrate dev`
- 쿼리는 Prisma Client 사용
- Supabase는 Auth + Storage + Realtime 용도만

---

## 세션 목표

해외 5법인(CN/RU/US/VN/MX)은 현지 급여시스템을 사용하므로 **엑셀/CSV 업로드 + 항목 매핑**으로 데이터를 수집합니다. 수집된 데이터를 환율 변환하여 **글로벌 급여 대시보드**로 통합 분석하고, 급여 시뮬레이션 + 이상 탐지 기능을 제공합니다.

**핵심**: 해외법인의 급여를 직접 계산하는 것이 아니라, **결과 데이터를 수집→통합→분석**하는 것입니다.

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
# 1. B1 exchange_rates 테이블 확인
# - 테이블 존재 여부 + 시드 데이터 (KRW/USD/CNY/RUB/VND/MXN)

# 3. B1 compensation_settings 법인별 확인
# - CTR-US: Base + Bonus (USD)
# - CTR-CN: 기본급 + 보조금 (CNY)
# - 나머지: 기본 구조

# 4. B7-1a payroll_runs / payroll_items 구조 확인
# - 해외법인도 동일 구조로 데이터를 저장할 것인지 확인
```

---

## 핵심 설계 원칙

### 1. 해외 급여 = 업로드 + 매핑 (계산 아님)

```
[현지 급여시스템]  →  [엑셀/CSV 내보내기]  →  [CTR HR Hub 업로드]
                                              ↓
                                    [항목 매핑 설정]
                                    현지 컬럼명 → CTR 표준 필드
                                              ↓
                                    [payroll_items에 저장]
                                              ↓
                                    [환율 변환 → 글로벌 대시보드]
```

### 2. 항목 매핑 = 법인별 1회 설정, 이후 자동

각 법인의 엑셀 컬럼명이 다르므로, 한 번 매핑을 설정하면 이후 업로드 시 자동 적용.

```
CTR-US 매핑 예시:
  "Employee ID"    → employeeId (사번)
  "Base Salary"    → baseSalary
  "Bonus"          → allowances[0].amount (코드: bonus)
  "401k Deduction" → deductions[0].amount (코드: retirement)
  "Federal Tax"    → incomeTax
  "State Tax"      → localIncomeTax
  "Net Pay"        → netPay

CTR-CN 매핑 예시:
  "工号"           → employeeId
  "基本工资"       → baseSalary
  "住房补贴"       → allowances[0].amount (코드: housing)
  "交通补贴"       → allowances[1].amount (코드: transport)
  "个人所得税"     → incomeTax
  "实发工资"       → netPay
```

### 3. 환율 관리 = 월별 고정 + 실시간 API 선택

```
모드 1: 월별 고정 환율 (기본)
  → HR이 매월 초 환율 입력
  → 해당 월 전체에 동일 환율 적용
  → 경영관리/재무 보고용 (일관성 중요)

모드 2: 실시간 API (선택)
  → 외부 환율 API 호출 (Open Exchange Rates 등)
  → 대시보드 조회 시점의 환율 적용
  → 참고용 (공식 보고에는 부적합)
```

---

## 작업 순서 (8 Tasks)

### Task 1: DB 마이그레이션 — Prisma 모델 추가

`prisma/schema.prisma`에 추가 후 `npx prisma migrate dev --name a_b7_global_payroll` 실행.

```prisma
// ── 환율 (B1에서 테이블만 생성, 여기서 본격 사용) ──
// 이미 존재하면 확인만, 없으면 생성

model ExchangeRate {
  id            String   @id @default(uuid()) @db.Uuid
  year          Int
  month         Int
  fromCurrency  String   @db.VarChar(3)       // 'USD', 'CNY', 'RUB', 'VND', 'MXN'
  toCurrency    String   @default("KRW") @db.VarChar(3)
  rate          Float                          // 1 USD = 1,350 KRW
  source        String   @default("manual") @db.VarChar(20) // 'manual' | 'api'
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([year, month, fromCurrency, toCurrency])
  @@map("exchange_rates")
}

// ── 해외 급여 업로드 매핑 설정 (법인별) ──

model PayrollImportMapping {
  id            String   @id @default(uuid()) @db.Uuid
  companyId     String   @db.Uuid
  company       Company  @relation(fields: [companyId], references: [id])
  name          String   @db.VarChar(100)      // "CTR-US Monthly Payroll"
  fileType      String   @default("xlsx") @db.VarChar(10) // 'xlsx' | 'csv'
  headerRow     Int      @default(1)           // 헤더 행 번호
  mappings      Json                           // [{ sourceColumn, targetField, transform? }]
  currency      String   @db.VarChar(3)        // 'USD'
  isDefault     Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@map("payroll_import_mappings")
}

// mappings JSON 예시:
// [
//   { "sourceColumn": "Employee ID", "targetField": "employeeId" },
//   { "sourceColumn": "Base Salary", "targetField": "baseSalary" },
//   { "sourceColumn": "Bonus", "targetField": "allowance:bonus" },
//   { "sourceColumn": "Federal Tax", "targetField": "incomeTax" },
//   { "sourceColumn": "Net Pay", "targetField": "netPay" }
// ]

// ── 업로드 이력 ──

model PayrollImportLog {
  id            String   @id @default(uuid()) @db.Uuid
  companyId     String   @db.Uuid
  company       Company  @relation(fields: [companyId], references: [id])
  mappingId     String   @db.Uuid
  year          Int
  month         Int
  fileName      String   @db.VarChar(200)
  filePath      String   @db.VarChar(500)      // Supabase Storage
  employeeCount Int
  totalGross    Float
  totalNet      Float
  currency      String   @db.VarChar(3)
  status        String   @default("uploaded") @db.VarChar(20) // 'uploaded' | 'mapped' | 'confirmed' | 'error'
  errorDetails  Json?                          // 매핑 실패 행 정보
  uploadedBy    String   @db.Uuid
  confirmedAt   DateTime?
  createdAt     DateTime @default(now())

  @@map("payroll_import_logs")
}

// ── 급여 시뮬레이션 ──

model PayrollSimulation {
  id            String   @id @default(uuid()) @db.Uuid
  createdBy     String   @db.Uuid
  type          String   @db.VarChar(20)       // 'transfer' | 'raise' | 'promotion'
  title         String   @db.VarChar(200)      // "김과장 CTR-KR→CTR-VN 전출 시뮬레이션"
  employeeId    String   @db.Uuid
  parameters    Json                           // 시뮬레이션 파라미터
  results       Json                           // 계산 결과
  createdAt     DateTime @default(now())

  @@map("payroll_simulations")
}
```

### Task 2: 환율 관리 UI + 시드

**라우트**: `/settings/exchange-rates` (설정 섹션)

```
┌─────────────────────────────────────────────────┐
│ 환율 관리                          2025년 3월      │
├─────────────────────────────────────────────────┤
│ 통화     환율 (→KRW)    소스      최종 수정        │
│ USD      1,350.00       수동      03/01           │
│ CNY        185.50       수동      03/01           │
│ RUB         14.80       수동      03/01           │
│ VND          0.055      수동      03/01           │
│ MXN         78.20       수동      03/01           │
│                                                 │
│ [이전 달 환율 복사]  [API에서 가져오기]  [저장]      │
└─────────────────────────────────────────────────┘
```

**시드**: 2025년 1~3월 환율 데이터 (5개 통화 × 3개월 = 15건)

### Task 3: 해외 급여 업로드 + 매핑 설정

**라우트**: `/hr/payroll/import` (급여 관리 내)

**Step 1 — 법인 + 매핑 선택**:
```
┌─────────────────────────────────────────────────┐
│ 해외 급여 업로드                                   │
├─────────────────────────────────────────────────┤
│ 법인: [CTR-US ▼]                                 │
│ 연월: [2025년 3월 ▼]                              │
│ 매핑: [CTR-US Monthly Payroll ▼]  [매핑 편집]      │
│                                                 │
│ [📁 엑셀/CSV 파일 업로드]                          │
└─────────────────────────────────────────────────┘
```

**Step 2 — 매핑 편집기** (최초 또는 변경 시):
```
┌─────────────────────────────────────────────────┐
│ 매핑 설정 — CTR-US                               │
├─────────────────────────────────────────────────┤
│ 파일 컬럼          →   CTR 필드                   │
│ "Employee ID"      →   [사번 (employeeId) ▼]      │
│ "Base Salary"      →   [기본급 (baseSalary) ▼]    │
│ "Bonus"            →   [수당: bonus ▼]            │
│ "401k Deduction"   →   [공제: retirement ▼]       │
│ "Federal Tax"      →   [소득세 (incomeTax) ▼]     │
│ "State Tax"        →   [지방세 (localIncomeTax) ▼] │
│ "Social Security"  →   [사회보험 ▼]               │
│ "Medicare"         →   [건강보험 ▼]               │
│ "Net Pay"          →   [실수령 (netPay) ▼]        │
│ "Hours Worked"     →   [무시 ▼]                   │
│                                                 │
│ 통화: [USD ▼]   헤더 행: [1]                      │
│ [기본 매핑으로 저장]  [적용]                        │
└─────────────────────────────────────────────────┘
```

**CTR 표준 필드 목록** (드롭다운):
- 사번, 기본급, 수당:{코드}, 공제:{코드}, 소득세, 지방세, 사회보험, 건강보험, 실수령, 무시

**Step 3 — 미리보기 + 확인**:
```
┌─────────────────────────────────────────────────┐
│ 업로드 미리보기 — CTR-US 2025년 3월               │
├─────────────────────────────────────────────────┤
│ 매칭 성공: 42명 / 45명                            │
│ ⚠️ 매칭 실패: 3명 (사번 불일치)                    │
│   └ EMP-101, EMP-203, EMP-305 [수동 매칭]         │
│                                                 │
│ 사번   이름        기본급     수당    세금    실수령 │
│ US001 John Smith  $8,500    $2,000  $2,100  $8,400│
│ US002 Jane Doe    $7,200    $1,500  $1,740  $6,960│
│ ...                                              │
│                                                 │
│ 합계: 총지급 $385,000 | 총실수령 $308,000          │
│                                                 │
│ [취소]  [확정 → payroll_items에 저장]              │
└─────────────────────────────────────────────────┘
```

**사번 매칭**: 업로드 파일의 사번 → `employee_profiles.employeeNumber`로 매칭. 실패 시 수동 매칭 UI.

**확정 시 동작**:
1. 해당 법인의 `PayrollRun` 생성 (status='confirmed')
2. 직원별 `PayrollItem` 생성 (매핑된 데이터)
3. `PayrollImportLog` 기록
4. B7-1a와 동일한 `PayrollItem` 구조 → 글로벌 대시보드에서 통합 조회 가능

### Task 4: 글로벌 급여 대시보드

**라우트**: `/hr/payroll/global` (급여 관리 내)

```
┌─────────────────────────────────────────────────────┐
│ 글로벌 급여 대시보드          2025년 3월  [KRW 기준]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 📊 법인별 평균 급여 (KRW 환산)                        │
│ ┌─────────────────────────────────────────────────┐ │
│ │ KR  ████████████████████  ₩4,200,000             │ │
│ │ US  ██████████████████████████  ₩5,670,000       │ │
│ │ CN  ████████████████  ₩3,420,000                 │ │
│ │ RU  ██████████████  ₩2,960,000                   │ │
│ │ VN  ████████  ₩1,850,000                         │ │
│ │ MX  ██████████████  ₩2,780,000                   │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ 📊 직급별 글로벌 비교                                │
│ ┌─────────────────────────────────────────────────┐ │
│ │ (직급별 법인 간 급여 비교 클러스터 바 차트)          │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ 📈 급여 트렌드 (최근 12개월)                          │
│ ┌─────────────────────────────────────────────────┐ │
│ │ (법인별 월별 총 인건비 라인 차트)                   │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ 📊 급여 밴드 분포                                    │
│ ┌─────────────────────────────────────────────────┐ │
│ │ (직급별 밴드 내 분포 Box Plot)                     │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ 📊 인건비 구성비                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ (기본급/수당/초과근무/보험/세금 파이 차트)           │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ [필터: 법인 ▼] [직급 ▼] [부서 ▼] [기간 ▼]            │
└─────────────────────────────────────────────────────┘
```

**차트 5~6개** (Recharts 사용):
1. 법인별 평균 급여 (수평 바 차트)
2. 직급별 법인 간 비교 (그룹 바 차트)
3. 급여 트렌드 12개월 (라인 차트)
4. 급여 밴드 분포 (B1 salary_bands 대비)
5. 인건비 구성비 (파이/도넛 차트)
6. (선택) 법인별 총 인건비 비중 (트리맵)

**환율 변환**:
```typescript
async function convertToKRW(amount: number, currency: string, year: number, month: number): Promise<number> {
  if (currency === 'KRW') return amount;
  const rate = await prisma.exchangeRate.findUnique({
    where: { year_month_fromCurrency_toCurrency: { year, month, fromCurrency: currency, toCurrency: 'KRW' } }
  });
  return Math.round(amount * rate.rate);
}
```

### Task 5: 급여 시뮬레이션

3가지 시나리오:

**1) 전출 시뮬레이션** — 법인 간 이동 시 급여 변화
```
┌────────────────────────────────────────────────┐
│ 전출 시뮬레이션                                   │
├────────────────────────────────────────────────┤
│ 대상: 김과장 (CTR-KR, 과장 S3)                    │
│ 이동: CTR-KR → CTR-VN                           │
│                                                │
│ 현재 (KRW)      →    전출 후 (VND→KRW 환산)      │
│ 기본급 ₩4,000,000    기본급 ₩3,200,000           │
│ 수당    ₩700,000     주거보조 ₩1,500,000         │
│ 총지급  ₩4,700,000   총지급  ₩4,700,000 (조정)  │
│ 공제   ₩940,000     공제   ₩470,000             │
│ 실수령  ₩3,760,000   실수령  ₩4,230,000          │
│                                                │
│ 💡 실수령 +₩470,000 (현지 세금/보험 차이)         │
│ ⚠️ 주거보조를 포함해야 동등 수준 유지               │
└────────────────────────────────────────────────┘
```

**2) 인상 시뮬레이션** — 연봉 인상 시 실수령 변화
```
김과장 (CTR-KR): 기본급 ₩4,000,000 → ₩4,400,000 (+10%)
  → 4대보험 변동: +₩44,500
  → 소득세 변동: +₩35,200
  → 실수령 변동: +₩320,300 (+8.5%)
```

**3) 승진 시뮬레이션** — 직급 변경 시 밴드 내 위치 + 급여 변화

### Task 6: 이상 탐지

자동 감지 + HR 대시보드 경고.

**감지 규칙 4가지**:

| 규칙 | 기준 | 표시 |
|------|------|------|
| 밴드 이탈 | 급여가 해당 직급 salary_band min/max 밖 | 🔴 "밴드 이탈" |
| 동일 직급 편차 | 같은 법인+직급 내 편차 > 30% | 🟠 "내부 형평성 주의" |
| 법인 간 격차 | 동일 직급의 법인 간 환산 급여 격차 > 50% | 🟡 "글로벌 격차" |
| 전월 대비 급변 | 전월 대비 개인 급여 변동 > 20% (인상/발령 없이) | 🟠 "비정상 변동" |

```
┌─────────────────────────────────────────────────┐
│ ⚠️ 이상 탐지 알림 (5건)                           │
├─────────────────────────────────────────────────┤
│ 🔴 US003 Jane (Software Eng, S3) — 밴드 상한 초과 │
│    현재: $12,500 | 밴드 max: $11,000              │
│                                                 │
│ 🟠 KR부서 개발팀 S2 — 내부 편차 35%               │
│    최소 ₩3,000,000 ~ 최대 ₩4,050,000             │
│                                                 │
│ 🟡 S3 직급 KR↔US 격차 62%                        │
│    KR 평균 ₩4,200,000 | US 평균 ₩6,800,000       │
│    (환율 감안 후에도 격차 지속)                     │
│                                                 │
│ [상세 분석] [무시]                                │
└─────────────────────────────────────────────────┘
```

### Task 7: 해외법인 급여 데이터 시드

5개 법인 × 직원 5~10명씩 샘플 PayrollItem 시드:

- CTR-US: 10명, USD, Base+Bonus 구조
- CTR-CN: 10명, CNY, 기본급+보조금 구조
- CTR-RU: 5명, RUB
- CTR-VN: 8명, VND
- CTR-MX: 5명, MXN

이 시드가 있어야 글로벌 대시보드에서 차트가 의미있게 표시됩니다.

### Task 8: 검증

```bash
# 1. 환율 관리
#    - 월별 환율 CRUD
#    - "이전 달 복사" 동작

# 2. 해외 급여 업로드
#    - 매핑 설정 → 엑셀 업로드 → 미리보기 → 확정
#    - 사번 불일치 수동 매칭
#    - PayrollRun + PayrollItem 생성 확인

# 3. 글로벌 대시보드
#    - 6개 법인 데이터 통합 표시
#    - KRW 환산 정확성
#    - 필터(법인/직급/기간) 동작
#    - 차트 5~6개 렌더링

# 4. 시뮬레이션
#    - 전출: KR→VN 시 급여 비교
#    - 인상: 10% 인상 시 실수령 변동
#    - 승진: 직급 변경 시 밴드 위치

# 5. 이상 탐지
#    - 밴드 이탈 감지
#    - 동일 직급 편차 감지
#    - 법인 간 격차 감지

npx tsc --noEmit
npm run build
# context/TRACK_A.md 업데이트
```

---

## 산출물 체크리스트

- [ ] Prisma 모델 4개 (ExchangeRate 확인/생성, PayrollImportMapping, PayrollImportLog, PayrollSimulation)
- [ ] 환율 관리 UI + 시드 (5통화 × 3개월)
- [ ] 해외 급여 업로드: 매핑 편집기 + 파일 업로드 + 미리보기 + 확정
- [ ] 글로벌 급여 대시보드: 차트 5~6개 (Recharts)
- [ ] 급여 시뮬레이션: 전출/인상/승진 3가지
- [ ] 이상 탐지: 4가지 규칙 + 경고 UI
- [ ] 해외법인 시드 데이터 (5법인 × 5~10명)
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 성공
- [ ] context/TRACK_A.md 업데이트

---

## context/TRACK_A.md 업데이트 내용 (세션 종료 시)

```markdown
## B7-2 완료 (날짜) — [A] 트랙

### DB 테이블
- exchange_rates (B1에서 생성, 여기서 본격 사용)
- payroll_import_mappings, payroll_import_logs
- payroll_simulations

### 핵심 함수
- convertToKRW() — 환율 변환
- 이상 탐지 4가지 규칙 함수

### 다음 세션 주의사항
- B10-1: 글로벌 급여 데이터 → HR KPI (법인별 인건비)
- B10-2: HR KPI 대시보드에 급여 관련 위젯 연동
- B11: i18n — 통화 포맷 (KRW ₩ / USD $ / CNY ¥ 등)
```

---

## 주의사항

1. **해외 급여 데이터의 정확성은 업로드 파일에 달려 있음** — HR Hub는 업로드된 데이터를 그대로 저장합니다. 계산 검증은 하지 않으므로, 업로드 전 현지 급여시스템에서 검증이 완료된 데이터를 사용하세요.

2. **환율 변환은 참고용** — 법인 간 급여를 KRW로 비교하는 것은 분석 목적이지, 실제 급여가 KRW로 지급되는 것이 아닙니다. 대시보드에 "환율 변환은 참고용입니다" 면책 문구를 표시하세요.

3. **PayrollItem 구조 통일** — B7-1a에서 만든 `PayrollItem` 스키마를 해외법인도 동일하게 사용합니다. 한국은 계산 엔진이 채우고, 해외는 업로드 매핑이 채우지만, 저장 구조는 같으므로 글로벌 대시보드에서 통합 쿼리가 가능합니다.

4. **매핑 설정 변경 이력** — 법인에서 급여 시스템을 바꾸면 엑셀 컬럼명이 달라집니다. `PayrollImportMapping`은 여러 개 저장 가능하고, `isDefault`로 기본 매핑을 지정합니다.

5. **시뮬레이션 = 저장만, 급여 반영 안 함** — 시뮬레이션 결과는 참고용으로 저장만 합니다. 실제 급여 변경은 발령(assignment) + 보상 변경(compensation)을 통해 처리합니다.
