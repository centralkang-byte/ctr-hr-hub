# B9-2: 복리후생 관리

> **역할**: 당신은 CTR HR Hub의 CTO이자 시니어 풀스택 개발자입니다.
> **스택**: Next.js (App Router) + Supabase + PostgreSQL + **Prisma ORM** + Tailwind CSS
> **트랙**: Week 11 **[A]** 트랙
> **선행 완료**: B1(법인 엔진 + approval_flows) + B6-2(통합 승인함 패턴) + B9-1(복리후생 인프라)

---

## DB 접근 규칙 (전 세션 공통)

- 모든 테이블 생성/변경은 `prisma/schema.prisma` → `npx prisma migrate dev --name a_benefit_claims`
- 쿼리는 **Prisma Client만** 사용 (raw SQL 금지)
- Supabase는 Auth + Storage + Realtime 용도만
- **마이그레이션 네이밍**: `a_` 접두사 필수 (A 트랙)
- 동시에 [B] B10-1 애널리틱스가 진행 중 — **migrate는 B 트랙 완료 확인 후** 실행

---

## ⚠️ 시작 전 필수 확인

```bash
# 1. 컨텍스트 파일 3개 전부 읽기
cat context/SHARED.md
cat context/TRACK_A.md
cat context/TRACK_B.md

# 2. 디자인 시스템 + UI 패턴 확인
cat CLAUDE.md
cat CTR_UI_PATTERNS.md

# 3. B1 approval_flows(module='benefit') 시드 확인
# 4. B6-2 AttendanceApprovalRequest 승인 패턴 확인 (재사용)
# 5. B9-1 복리후생 인프라 구현 확인 (카테고리, 혜택 항목 CRUD, 법인별 분리)

# ⚡ 이 세션 결과는 context/TRACK_A.md에만 기록하세요
```

---

## 세션 목표

기존 i-people 시스템을 대체하는 **복리후생 신청·승인 모듈**을 구축합니다. B9-1에서 만든 복리후생 인프라(항목·카테고리) 위에 직원 신청→승인→실행 워크플로, 예산 관리, 사용 현황 추적을 구현합니다.

**핵심**: 복리후생 항목과 예산은 법인별로 완전히 다릅니다. CTR-KR은 경조금/학자금/건강검진/사내동호회, CTR-US는 401k/Health Insurance/Gym Membership 등.

**UI 기준**: CLAUDE.md 디자인 토큰(green #00C853 primary, Pretendard) + CTR_UI_PATTERNS.md 인터랙션 패턴 준수. B6-2 통합 승인함 패턴을 복리후생 승인에 재활용.

---

## 작업 순서 (7 Tasks)

### Task 1: DB 마이그레이션

> B9-1에서 이미 생성된 테이블이 있다면 확인 후 누락분만 추가합니다.
> 마이그레이션명: `a_benefit_claims`

```prisma
model BenefitPlan {
  id              String   @id @default(uuid()) @db.Uuid
  companyId       String?  @db.Uuid
  company         Company? @relation(fields: [companyId], references: [id])
  code            String   @db.VarChar(30)
  name            String   @db.VarChar(100)
  nameEn          String?  @db.VarChar(100)
  category        String   @db.VarChar(30)         // 'financial' | 'health' | 'lifestyle' | 'family' | 'education'
  description     String?  @db.Text
  benefitType     String   @db.VarChar(20)         // 'fixed_amount' | 'reimbursement' | 'subscription' | 'one_time'
  amount          Int?                             // 고정금액 (원/USD 등)
  maxAmount       Int?                             // 최대 한도
  currency        String   @default("KRW") @db.VarChar(3)
  frequency       String   @default("once") @db.VarChar(20) // 'once' | 'annual' | 'monthly' | 'per_event'
  eligibility     Json?                            // { minTenureMonths: 6, jobLevels: ["S2","S3"], employmentTypes: ["permanent"] }
  requiresApproval Boolean @default(true)
  requiresProof   Boolean  @default(false)
  isActive        Boolean  @default(true)
  displayOrder    Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  claims          BenefitClaim[]

  @@unique([companyId, code])
  @@map("benefit_plans")
}

model BenefitClaim {
  id              String      @id @default(uuid()) @db.Uuid
  benefitPlanId   String      @db.Uuid
  benefitPlan     BenefitPlan @relation(fields: [benefitPlanId], references: [id])
  employeeId      String      @db.Uuid
  claimAmount     Int                              // 신청 금액
  approvedAmount  Int?                             // 승인 금액
  eventDate       DateTime?   @db.Date             // 해당 이벤트 날짜 (경조 등)
  eventDetail     String?     @db.Text             // "결혼", "본인 자녀 초등학교 입학"
  proofPaths      String[]    @default([])         // 증빙 파일 경로들
  status          String      @default("pending") @db.VarChar(20) // 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled'
  approvedBy      String?     @db.Uuid
  approvedAt      DateTime?
  rejectedReason  String?     @db.Text
  paidAt          DateTime?
  notes           String?     @db.Text
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([employeeId, status])
  @@map("benefit_claims")
}

model BenefitBudget {
  id              String   @id @default(uuid()) @db.Uuid
  companyId       String   @db.Uuid
  company         Company  @relation(fields: [companyId], references: [id])
  year            Int
  category        String   @db.VarChar(30)         // benefit_plans.category와 동일
  totalBudget     Int                              // 연간 예산
  usedAmount      Int      @default(0)             // 사용 금액
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([companyId, year, category])
  @@map("benefit_budgets")
}
```

**체크**: B9-1에서 이미 BenefitPlan 등이 생성되었다면 diff만 적용. 중복 migrate 방지.

---

### Task 2: 법인별 복리후생 시드

**CTR-KR** (10개):

| 카테고리 | 항목 | 타입 | 금액/한도 | 빈도 | 증빙 |
|---------|------|------|----------|------|------|
| family | 결혼축하금(본인) | fixed_amount | 500,000 | per_event | ✅ |
| family | 결혼축하금(자녀) | fixed_amount | 300,000 | per_event | ✅ |
| family | 조의금(부모/배우자부모) | fixed_amount | 500,000 | per_event | ✅ |
| family | 조의금(조부모) | fixed_amount | 300,000 | per_event | ✅ |
| family | 출산축하금 | fixed_amount | 300,000 | per_event | ✅ |
| education | 대학학자금 | reimbursement | max 2,000,000 | annual | ✅ |
| education | 자기개발비 | reimbursement | max 1,000,000 | annual | ✅ |
| health | 종합건강검진 | reimbursement | max 500,000 | annual | ✅ |
| health | 안경/렌즈 지원 | reimbursement | max 200,000 | annual | ✅ |
| lifestyle | 사내동호회 | subscription | 50,000 | monthly | ❌ |

**CTR-US** (5개):

| 카테고리 | 항목 | 타입 | 금액/한도 | 빈도 | 통화 |
|---------|------|------|----------|------|------|
| financial | 401k Matching | subscription | max 6% of salary | monthly | USD |
| financial | Stock Purchase Plan | subscription | — | monthly | USD |
| health | Health Insurance Subsidy | subscription | 500 | monthly | USD |
| health | Gym Membership | reimbursement | max 50 | monthly | USD |
| lifestyle | Employee Assistance Program | subscription | — | monthly | USD |

**나머지 법인 (CN/RU/VN/MX)**: 글로벌 기본 2개 (건강검진 + 경조금)

**2025년 예산 시드**:
- CTR-KR: family ₩20M, education ₩15M, health ₩10M, lifestyle ₩5M
- CTR-US: financial $50K, health $30K, lifestyle $10K

---

### Task 3: 직원용 복리후생 신청 UI

> **경로**: `/my/benefits`
> **디자인**: CLAUDE.md 토큰 + CTR_UI_PATTERNS.md 카드/리스트 패턴

```
┌─────────────────────────────────────────────────┐
│ 나의 복리후생                                     │
├─────────────────────────────────────────────────┤
│ 📊 올해 사용 현황                                 │
│ ├── 학자금: ₩800,000 / ₩2,000,000 (40%)         │
│ ├── 건강검진: 미사용 / ₩500,000                   │
│ └── 자기개발: ₩350,000 / ₩1,000,000 (35%)       │
│                                                 │
│ [+ 복리후생 신청]                                  │
│                                                 │
│ 최근 신청 내역                                    │
│ ├── 03/01 자기개발비 ₩150,000 ✅ 승인             │
│ ├── 02/15 대학학자금 ₩400,000 ✅ 승인             │
│ └── 01/20 안경/렌즈 ₩180,000 ⏳ 승인대기          │
└─────────────────────────────────────────────────┘
```

**신청 폼** (모달 또는 슬라이드오버):
```
┌─────────────────────────────────────────────────┐
│ 복리후생 신청                                     │
├─────────────────────────────────────────────────┤
│ 항목: [경조금 - 결혼축하금 ▼]                      │
│ 금액: ₩ [500,000]  (기준: 본인 결혼 50만원)       │
│ 이벤트 날짜: [2025-04-15]                         │
│ 상세: [본인 결혼                              ]   │
│ 증빙: [📁 청첩장.pdf]  ← Supabase Storage        │
│                                                 │
│ [취소]                              [신청]        │
└─────────────────────────────────────────────────┘
```

**핵심 로직**:
- 항목 선택 시 benefitType에 따라 금액 필드 동적 변경 (fixed → 자동입력, reimbursement → 직접입력)
- **자격 검증은 서버사이드** — API에서 eligibility JSON 체크 후 결과 반환
- 연간 한도 초과 시 신청 차단 + 안내 메시지
- 증빙 필수 항목은 파일 없이 신청 불가

---

### Task 4: HR 관리 + 승인 플로우

> **경로**: `/hr/benefits`
> **패턴**: B6-2 통합 승인함 패턴 재활용 — 승인/반려 UI·API 구조 동일

```
┌─────────────────────────────────────────────────┐
│ 복리후생 관리                    [법인: CTR-KR ▼]  │
├─────────────────────────────────────────────────┤
│ 탭: [승인대기] [전체내역] [설정] [예산]             │
│                                                 │
│ ── 승인 대기 (5건) ──                             │
│ ┌─────────────────────────────────────────────┐ │
│ │ 김과장 · 결혼축하금 · ₩500,000               │ │
│ │ 이벤트: 2025-04-15 본인 결혼                  │ │
│ │ 증빙: 📎 청첩장.pdf                           │ │
│ │                         [반려]  [승인 ✓]      │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 📊 예산 현황                                      │
│ ├── 경조금: ₩12.5M / ₩20M (63%) ████████░░░    │
│ ├── 학자금: ₩8.2M / ₩15M (55%)  ███████░░░░    │
│ ├── 건강: ₩3.8M / ₩10M (38%)    █████░░░░░░    │
│ └── 생활: ₩2.1M / ₩5M (42%)     ██████░░░░░    │
└─────────────────────────────────────────────────┘
```

**승인 처리**:
- 승인 시 `BenefitClaim.status → 'approved'` + `BenefitBudget.usedAmount` 자동 증가
- 반려 시 `rejectedReason` 필수 입력
- B6-2 승인함 패턴 재사용: 동일한 승인/반려 API 구조, 배치 승인 지원

---

### Task 5: 예산 관리 + 소진률 알림

- HR Admin이 법인/카테고리별 연간 예산 설정 (`/hr/benefits` 예산 탭)
- 소진률 **80%** 도달 시 HR 알림 (UI 배너 + 대시보드 표시)
- 예산 초과 신청 시 **경고만** (차단 아님 — HR 판단에 위임)
- 예산 프로그레스 바: CTR_UI_PATTERNS.md 프로그레스 컴포넌트 활용

---

### Task 6: 시드 + 빌드 검증

```bash
# 1. 시드 실행
npx prisma db seed

# 2. 기능 검증
# - 복리후생 항목 법인별 필터링
# - 신청 → 자격 검증 (eligibility) → 승인/반려
# - 잔여 한도 체크 (annual 항목)
# - 예산 현황 차트 / 소진률 표시
# - 증빙 파일 업로드 (Supabase Storage)

# 3. 빌드 검증
npx tsc --noEmit      # TypeScript 0 errors
npm run build         # Next.js 빌드 성공

# 4. 컨텍스트 업데이트
# → context/TRACK_A.md에만 기록 (SHARED.md, TRACK_B.md 수정 금지)
```

---

### Task 7: 검증 체크리스트

- [ ] Prisma 모델 3개 (BenefitPlan, BenefitClaim, BenefitBudget) — B9-1 기존분 확인 후 diff 적용
- [ ] 마이그레이션명 `a_` 접두사 (`a_benefit_claims`)
- [ ] 법인별 시드 (KR 10개 + US 5개 + 나머지 법인 기본 2개씩)
- [ ] 2025년 예산 시드 (KR 4카테고리 + US 3카테고리)
- [ ] 직원용 `/my/benefits` — 사용현황 프로그레스 + 신청 폼 + 이력 리스트
- [ ] 신청 폼: 항목 타입별 금액 동적 처리 + 자격 검증(서버사이드) + 증빙 업로드
- [ ] HR 관리 `/hr/benefits` — 승인대기 리스트 + 배치 승인 + 전체 내역
- [ ] 승인 시 BenefitBudget.usedAmount 자동 증가
- [ ] 예산 프로그레스 바 + 80% 소진 경고
- [ ] CLAUDE.md 디자인 토큰 준수 (green primary, Pretendard, minimal shadow)
- [ ] CTR_UI_PATTERNS.md 인터랙션 패턴 준수
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` 성공
- [ ] `context/TRACK_A.md` 업데이트 완료

---

## context/TRACK_A.md 업데이트 내용 (세션 종료 시)

```markdown
## B9-2 완료 (날짜)

### DB 테이블
- benefit_plans (B9-1에서 생성 or 신규)
- benefit_claims (신규)
- benefit_budgets (신규)
- 마이그레이션: a_benefit_claims

### 구현 범위
- 직원용: /my/benefits (사용현황 + 신청 + 이력)
- HR용: /hr/benefits (승인 + 예산 관리 + 설정)
- 승인 패턴: B6-2 통합 승인함 재활용

### 다음 세션 연동 포인트
- B7-1a 급여: 경조금 등 과세 대상 복리후생 → 연말정산 참고 데이터 (직접 급여 포함 X)
- B10-1 애널리틱스 ([B] 트랙): 복리후생 활용률 데이터 참조 가능
- B10-2: HR KPI에 복리후생 활용률 위젯 추가
- B11: 알림 — 승인/반려 알림, 예산 80% 소진 알림, 연간 미사용 안내
```

---

## 주의사항

1. **복리후생 지급은 급여와 분리** — 경조금 등은 별도 지급이므로 B7-1a 급여 계산에 포함하지 않습니다. 과세 대상 복리후생(학자금 등)은 연말정산 시 참고할 수 있으므로 데이터 연동 포인트만 기록.

2. **i-people 대체** — 이 모듈이 기존 i-people 시스템의 복리후생 기능을 대체합니다. 마이그레이션 데이터(기존 신청 이력)는 추후 별도 처리.

3. **eligibility 검증은 서버사이드** — 클라이언트에서 자격 여부를 판단하지 마세요. API에서 eligibility JSON 체크 후 결과 반환.

4. **B9-1 인프라 확인 필수** — B9-1에서 이미 만든 테이블/컴포넌트가 있을 수 있습니다. 중복 생성하지 말고 diff만 적용.

5. **[B] 트랙 충돌 방지** — 이 세션에서 SHARED.md, TRACK_B.md를 수정하지 마세요. migrate 실행 전 [B] 트랙 migrate 완료 여부 확인.
