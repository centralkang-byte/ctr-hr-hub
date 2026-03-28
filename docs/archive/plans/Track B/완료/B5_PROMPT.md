# B5: 온보딩/오프보딩 고도화

> **역할**: 당신은 CTR HR Hub의 CTO이자 시니어 풀스택 개발자입니다.
> **스택**: Next.js (App Router) + Supabase + PostgreSQL + **Prisma ORM** + Tailwind CSS
> **컨텍스트**: Phase A + B1(법인 엔진 + onboarding_settings 테이블) 완료. STEP 4(기존 온보딩 Day 1/7/30/90 체크인 + 감정 펄스) 존재.
> **트랙**: **[B] 트랙** — context/TRACK_B.md에만 기록

### DB 접근 규칙 (전 세션 공통)

- 모든 테이블 생성/변경은 `prisma/schema.prisma` → `prisma migrate dev`
- 쿼리는 Prisma Client 사용
- Supabase는 Auth + Storage + Realtime 용도만

---

## 컨텍스트 파일 규칙 (병렬 개발)

```bash
# 읽기: 3개 파일 모두 읽으세요
cat context/SHARED.md       # 공유 인프라 상태 확인
cat context/TRACK_A.md      # A 트랙이 뭘 하고 있는지 참고
cat context/TRACK_B.md      # 이전 B 트랙 작업 확인

# 쓰기: TRACK_B.md에만 기록하세요
# ❌ SHARED.md 수정 금지
# ❌ TRACK_A.md 수정 금지

# migrate 이름 규칙: b_ 접두사 사용
npx prisma migrate dev --name b_b5_onboarding_offboarding
```

---

## 세션 목표

STEP 4의 기존 온보딩(Day 1/7/30/90 체크인 + 감정 펄스)을 **법인별 온보딩 템플릿 + 오프보딩 체계화 + Cross-boarding(법인 간 전출입)** 으로 고도화합니다.

**핵심**: 온보딩과 오프보딩은 동전의 양면이고, Cross-boarding은 둘을 동시에 트리거합니다.

---

## ⚠️ 시작 전 필수 확인

```bash
# 1. 컨텍스트 파일 3개 읽기
cat context/SHARED.md
cat context/TRACK_A.md
cat context/TRACK_B.md

# 2. STEP 4 온보딩 현재 상태 확인
# - 온보딩 플랜 테이블 구조 (onboarding_plans? onboarding_checklists?)
# - Day 1/7/30/90 체크인 구현 방식
# - 감정 펄스 저장 테이블
# - 온보딩 대시보드 라우트

# 3. B1 onboarding_settings 테이블 확인
# - 아직 UI 없이 테이블만 존재해야 함
# - JSONB 구조 확인

# 4. B4 Internal Mobility 연결 포인트 확인 (B4 완료 시)
# - hired 이벤트 발생 방식
# - 법인 간 이동 여부 판별 필드

# 5. B2 AssignmentTimeline 컴포넌트 경로 확인

# 6. [A] 트랙 상태 확인 — TRACK_A.md에서 DB 변경사항 확인
# A 트랙이 migrate를 실행했다면 먼저 pull 후 시작
npx prisma db pull  # 필요 시
```

### ⚠️ STEP 4에서 잘못됐을 수 있는 부분

1. **법인 구분 없는 단일 온보딩 템플릿** — STEP 4가 한국 기준으로만 만들어져 있을 가능성 높음. 4대보험 신고, 취업규칙 서약 같은 한국 전용 항목이 모든 법인에 적용되고 있을 수 있음.

2. **오프보딩 프로세스 부재** — STEP 4에서 온보딩만 구현하고 오프보딩(퇴직)은 아예 없을 수 있음. 이번 세션에서 전체 구축.

3. **플랜 상태 관리 미비** — 온보딩 플랜에 active/completed/suspended/archived 같은 상태 전이가 없을 수 있음.

---

## 핵심 설계 원칙

### 1. 온보딩 템플릿 = 법인별 체크리스트 마스터

```
[B1 onboarding_settings]         [STEP 4 기존 온보딩]
법인별 템플릿 (Admin 관리)    →    실제 플랜 인스턴스 (직원별 생성)
                                  
CTR-KR 템플릿:                    김사원 온보딩 플랜:
├── Day 1: 4대보험 신고            ├── Day 1: 4대보험 신고 ✅
├── Day 1: 취업규칙 서약           ├── Day 1: 취업규칙 서약 ✅
├── Day 1: 장비 수령              ├── Day 1: 장비 수령 ⏳
├── Day 7: 부서 소개              ├── Day 7: 부서 소개 ⬜
├── Day 30: 수습 중간점검          ├── ...
└── Day 90: 수습 최종평가          

CTR-US 템플릿:
├── Day 1: I-9 Form
├── Day 1: W-4 Form
├── Day 1: Equipment Setup
└── ...
```

### 2. Cross-boarding = 오프보딩(출발법인) + 온보딩(도착법인) 동시 트리거

```
김과장: CTR-KR → CTR-VN 전출 확정
        ↓
┌───────────────────┐  ┌───────────────────┐
│ CTR-KR 오프보딩     │  │ CTR-VN 온보딩      │
│ ├── 인수인계        │  │ ├── 비자 지원       │
│ ├── 장비 반납       │  │ ├── 현지 주택 안내   │
│ ├── 4대보험 상실신고 │  │ ├── 현지 은행 계좌   │
│ └── 퇴직금 정산     │  │ └── CTR-VN 취업규칙  │
└───────────────────┘  └───────────────────┘
      (동시 진행, 각각 별도 플랜)
```

### 3. 오프보딩 = 6단계 체계적 프로세스

```
퇴직 의사 접수
  ↓
Step 1: 퇴직면담 (exit interview) → 데이터는 B10 이직예측 학습용
  ↓
Step 2: 인수인계 계획 수립 + 실행
  ↓
Step 3: 장비/자산 회수
  ↓
Step 4: 퇴직금/잔여연차 정산 (외부 급여시스템 연동 데이터 준비)
  ↓
Step 5: 시스템 접근권한 해제
  ↓
Step 6: 경력증명서 발급 + 퇴직처리 완료
```

---

## 작업 순서 (8 Tasks)

### Task 1: DB 마이그레이션 — Prisma 모델 추가/확장

`prisma/schema.prisma`에 추가 후 `npx prisma migrate dev --name b_b5_onboarding_offboarding` 실행.

> **⚠️ migrate 전 확인**: `cat context/TRACK_A.md`에서 [A] 트랙이 미완료 migrate가 있는지 확인. 있으면 A 트랙 migrate 완료 후 진행.

```prisma
// ── 온보딩 템플릿 (Admin 관리) ──

model OnboardingTemplate {
  id          String                   @id @default(uuid()) @db.Uuid
  companyId   String?                  @db.Uuid            // NULL = 글로벌 기본
  company     Company?                 @relation(fields: [companyId], references: [id])
  name        String                   @db.VarChar(200)     // "CTR-KR 신규입사 온보딩"
  type        String                   @db.VarChar(30)      // 'onboarding' | 'offboarding' | 'crossboarding_departure' | 'crossboarding_arrival'
  description String?                  @db.Text
  isActive    Boolean                  @default(true)
  items       OnboardingTemplateItem[]
  createdAt   DateTime                 @default(now())
  updatedAt   DateTime                 @updatedAt

  @@map("onboarding_templates")
}

model OnboardingTemplateItem {
  id           String             @id @default(uuid()) @db.Uuid
  templateId   String             @db.Uuid
  template     OnboardingTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  dayOffset    Int                                          // Day 1 = 1, Day 7 = 7, Day 30 = 30 등
  category     String             @db.VarChar(50)           // 'document' | 'equipment' | 'training' | 'introduction' | 'compliance' | 'assessment'
  title        String             @db.VarChar(200)
  titleEn      String?            @db.VarChar(200)
  description  String?            @db.Text
  assigneeRole String             @db.VarChar(30)           // 'employee' | 'hr' | 'manager' | 'it' | 'finance'
  isRequired   Boolean            @default(true)
  displayOrder Int                @default(0)
  createdAt    DateTime           @default(now())

  @@map("onboarding_template_items")
}

// ── 온보딩/오프보딩 플랜 인스턴스 (직원별) ──

model OnboardingPlan {
  id           String               @id @default(uuid()) @db.Uuid
  employeeId   String               @db.Uuid
  templateId   String?              @db.Uuid              // 어떤 템플릿에서 생성했는지
  companyId    String               @db.Uuid
  company      Company              @relation(fields: [companyId], references: [id])
  type         String               @db.VarChar(30)        // 'onboarding' | 'offboarding' | 'crossboarding_departure' | 'crossboarding_arrival'
  status       String               @default("active") @db.VarChar(20)  // 'active' | 'completed' | 'suspended' | 'archived'
  startDate    DateTime             @db.Date
  targetEndDate DateTime?           @db.Date               // 예상 완료일
  completedAt  DateTime?
  linkedPlanId String?              @db.Uuid               // Cross-boarding: 반대쪽 플랜 연결
  items        OnboardingPlanItem[]
  createdAt    DateTime             @default(now())
  updatedAt    DateTime             @updatedAt

  @@map("onboarding_plans")
}

model OnboardingPlanItem {
  id            String         @id @default(uuid()) @db.Uuid
  planId        String         @db.Uuid
  plan          OnboardingPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  templateItemId String?       @db.Uuid              // 템플릿 원본 참조
  dayOffset     Int
  category      String         @db.VarChar(50)
  title         String         @db.VarChar(200)
  description   String?        @db.Text
  assigneeRole  String         @db.VarChar(30)
  assigneeId    String?        @db.Uuid              // 실제 배정된 담당자
  isRequired    Boolean        @default(true)
  status        String         @default("pending") @db.VarChar(20) // 'pending' | 'in_progress' | 'completed' | 'skipped'
  dueDate       DateTime?      @db.Date
  completedAt   DateTime?
  completedBy   String?        @db.Uuid
  notes         String?        @db.Text
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@map("onboarding_plan_items")
}

// ── 퇴직면담 (오프보딩 전용) ──

model ExitInterview {
  id               String   @id @default(uuid()) @db.Uuid
  employeeId       String   @db.Uuid
  planId           String?  @db.Uuid              // 오프보딩 플랜 연결
  interviewerId    String   @db.Uuid              // 면담 진행자 (HR)
  interviewDate    DateTime @db.Date
  resignationReason String  @db.VarChar(50)        // 'better_opportunity' | 'compensation' | 'work_life_balance' | 'management' | 'career_growth' | 'relocation' | 'personal' | 'other'
  detailedReason   String?  @db.Text               // 상세 사유
  satisfaction     Json?                           // { overall: 3, compensation: 2, culture: 4, management: 3, growth: 2 } (1~5)
  wouldRecommend   Boolean?                        // 회사 추천 의향
  suggestions      String?  @db.Text               // 개선 제안
  isConfidential   Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@map("exit_interviews")
}
```

**기존 STEP 4 테이블과의 관계**:
- STEP 4의 기존 온보딩 테이블이 있다면 → 위 모델로 마이그레이션하거나, 기존 테이블을 확장
- 기존 Day 1/7/30/90 체크인 데이터가 있다면 → OnboardingPlanItem으로 이관
- 기존 감정 펄스 테이블은 유지 (B10에서 참조)
- **기존 테이블 구조를 먼저 확인하고 전략 결정** — 무조건 새로 만들지 마세요

### Task 2: B1 onboarding_settings UI 구현

B1에서 테이블만 만들어둔 `OnboardingSetting`의 Admin UI를 구현합니다.

**라우트**: `/settings/onboarding` (설정 섹션에 추가)

```
┌─────────────────────────────────────────────────┐
│ 온보딩 설정                 [법인: CTR-KR ▼]      │
│                            [글로벌 기본값 사용 중]  │
├─────────────────────────────────────────────────┤
│ [온보딩 템플릿]  [오프보딩 템플릿]  [일반 설정]     │
├─────────────────────────────────────────────────┤
│ CTR-KR 온보딩 템플릿                              │
│                                                 │
│ Day 1                                           │
│ ├── 📋 4대보험 신고         담당: HR    필수 ✅    │
│ ├── 📋 취업규칙 서약         담당: HR    필수 ✅    │
│ ├── 💻 장비 수령/세팅        담당: IT    필수 ✅    │
│ ├── 🤝 팀 소개              담당: 매니저  필수 ✅   │
│ └── [+ 항목 추가]                                │
│                                                 │
│ Day 7                                           │
│ ├── 🏢 부서 업무 소개         담당: 매니저  필수 ✅  │
│ ├── 📚 필수 교육 수료         담당: 직원   필수 ✅   │
│ └── [+ 항목 추가]                                │
│                                                 │
│ Day 30                                          │
│ ├── 📊 수습 중간점검          담당: 매니저  필수 ✅  │
│ └── [+ 항목 추가]                                │
│                                                 │
│ Day 90                                          │
│ ├── 📊 수습 최종평가          담당: HR    필수 ✅   │
│ └── [+ 항목 추가]                                │
│                                                 │
│ [+ Day 추가]   [저장]                             │
└─────────────────────────────────────────────────┘
```

**B1 패턴 재사용**:
- CompanySelector + GlobalOverrideBadge 사용
- 법인 오버라이드 없으면 글로벌 템플릿 표시
- "커스터마이징 시작" → 글로벌 복사하여 법인 템플릿 생성

### Task 3: 법인별 온보딩 시드 데이터

**CTR-KR 온보딩 템플릿** (상세):
```
Day 1:  4대보험 신고(HR) | 취업규칙 서약(HR) | 장비 세팅(IT) | 팀 소개(매니저) | 회사 소개 투어(HR)
Day 7:  부서 업무 소개(매니저) | 필수 안전교육(직원) | 사내 시스템 교육(IT) | 멘토 배정(매니저)
Day 30: 수습 중간점검(매니저) | 목표 설정 미팅(매니저) | HR 체크인(HR)
Day 90: 수습 최종평가(HR+매니저) | 정규직 전환 결정(HR) | 교육 이수 확인(HR)
```

**CTR-US 온보딩 템플릿**:
```
Day 1: I-9 Verification(HR) | W-4 Tax Form(HR) | Equipment Setup(IT) | Team Introduction(Manager)
Day 7: Department Orientation(Manager) | Benefits Enrollment(HR) | Safety Training(Employee)
Day 30: 30-Day Check-in(Manager) | Goal Setting(Manager)
Day 90: 90-Day Review(Manager+HR)
```

**나머지 4개 법인**: 글로벌 기본 템플릿 사용 (법인 오버라이드 없음)
```
글로벌 기본:
Day 1: Equipment Setup(IT) | Team Introduction(Manager) | Company Orientation(HR)
Day 7: Department Briefing(Manager) | Required Training(Employee)
Day 30: Mid-check Review(Manager)
Day 90: Final Review(HR+Manager)
```

**오프보딩 템플릿** (글로벌 공통):
```
Day 0:  퇴직면담 진행(HR)
Day 1-7: 인수인계 계획 수립(매니저+직원) | 인수인계 실행(직원)
Day 7-14: 장비/자산 회수(IT) | 접근권한 해제(IT)
최종일:  퇴직금 정산 데이터 준비(Finance) | 경력증명서 발급(HR) | 퇴직처리 완료(HR)
```

**Cross-boarding 출발법인 템플릿**:
```
인수인계 | 장비 반납 | 현지 사회보험 상실신고 | 현지 은행계좌 처리 | 송별 미팅
```

**Cross-boarding 도착법인 템플릿**:
```
비자/워크퍼밋 지원 | 현지 주거 안내 | 현지 사회보험 가입 | 현지 은행계좌 개설 | 현지 시스템 접근권한 | 현지 팀 소개
```

### Task 4: 온보딩 플랜 인스턴스 생성 + 관리 UI

**플랜 생성 트리거**:
1. **신규입사**: HR이 직원 등록 시 → 해당 법인 온보딩 템플릿으로 플랜 자동 생성
2. **채용확정**: B4 ATS에서 hired 상태 → 온보딩 플랜 자동 생성
3. **수동생성**: HR이 직접 플랜 생성 (중도입사 등 예외)

**온보딩 대시보드** (HR 뷰):
```
┌─────────────────────────────────────────────────────┐
│ 온보딩 현황                          [법인: 전체 ▼]  │
├─────────────────────────────────────────────────────┤
│ 진행 중 (5명)    완료 (12명)    보류 (1명)           │
├─────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────┐   │
│ │ 김사원 · 개발팀 · CTR-KR · Day 14/90           │   │
│ │ ████████░░░░░░░░░░░░  진행률 35% (7/20)       │   │
│ │ ⚠️ 지연: "필수 안전교육" (Day 7 미완료)          │   │
│ │ 😊 최근 펄스: 긍정적 (02/28)                   │   │
│ └───────────────────────────────────────────────┘   │
│ ┌───────────────────────────────────────────────┐   │
│ │ Jane · QA팀 · CTR-US · Day 45/90              │   │
│ │ ████████████████░░░░  진행률 70% (14/20)       │   │
│ │ 😐 최근 펄스: 보통 (02/25)                     │   │
│ └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**플랜 상세 뷰** (직원별):
- 체크리스트 항목별 상태 (pending/in_progress/completed/skipped)
- 담당자별 필터 (나한테 배정된 것만)
- 지연 항목 하이라이트
- 기존 STEP 4 감정 펄스 연동 표시

**플랜 상태 전이**:
```
active ──→ completed (전체 필수항목 완료 시)
  │
  └──→ suspended (휴직 등) ──→ active (복귀 시)
  │
  └──→ archived (퇴직 등 강제 종료)
```

### Task 5: 오프보딩 체계화

**라우트**: `/hr/offboarding` (인사운영 섹션)

**퇴직 프로세스 시작 방식**:
1. 직원이 "퇴직 의사 접수" → HR에게 알림
2. HR이 직접 "오프보딩 시작" → 해당 법인 오프보딩 템플릿으로 플랜 생성

**오프보딩 대시보드**:
```
┌─────────────────────────────────────────────────┐
│ 오프보딩 진행 중 (3명)                             │
├─────────────────────────────────────────────────┤
│ 박과장 · 영업팀 · CTR-KR · 퇴사일: 03/31          │
│ [✅ 퇴직면담] [✅ 인수인계] [⏳ 장비회수] [⬜ 정산]  │
│                                                 │
│ Wang Li · 생산팀 · CTR-CN · 퇴사일: 04/15         │
│ [✅ 퇴직면담] [⏳ 인수인계] [⬜ 장비회수] [⬜ 정산]  │
└─────────────────────────────────────────────────┘
```

### Task 6: 퇴직면담 (Exit Interview)

오프보딩 Step 1. HR이 진행하는 구조화된 면담 폼.

```
┌─────────────────────────────────────────────────┐
│ 퇴직면담 — 박과장 (영업팀 · CTR-KR)               │
├─────────────────────────────────────────────────┤
│ 면담일: [2025-03-15]   면담자: [HR 이담당]         │
│                                                 │
│ 주요 퇴직 사유:                                    │
│ [○ 더 나은 기회  ●보상/급여  ○워라밸               │
│  ○경영진/관리  ○커리어성장  ○이사/개인사유  ○기타]  │
│                                                 │
│ 상세 사유:                                        │
│ [동종 업계 대비 보상 수준이 낮다고 느꼈습니다.       │
│  특히 성과급 체계에 대한 불만족이 컸습니다.       ]  │
│                                                 │
│ 만족도 (1~5):                                     │
│ 전반적:    ★★★☆☆                                │
│ 보상:      ★★☆☆☆                                │
│ 조직문화:  ★★★★☆                                │
│ 관리/리더: ★★★☆☆                                │
│ 성장기회:  ★★☆☆☆                                │
│                                                 │
│ 회사 추천 의향: [○예 ○아니오]                      │
│                                                 │
│ 개선 제안:                                        │
│ [성과급 기준을 더 투명하게 공개해주면 좋겠습니다.  ] │
│                                                 │
│ [저장]                                           │
└─────────────────────────────────────────────────┘
```

**데이터 활용**: `exit_interviews` 데이터는 B10-1 이직 예측 모델의 학습 데이터로 사용됩니다. TRACK_B.md에 테이블 구조를 정확히 기록하세요.

### Task 7: Cross-boarding (법인 간 전출입)

**트리거**: 
1. B4 Internal Mobility에서 다른 법인 채용 확정
2. HR이 수동으로 법인 간 전출 처리

**자동 생성 플로우**:
```typescript
async function triggerCrossboarding(
  employeeId: string,
  fromCompanyId: string,
  toCompanyId: string,
  transferDate: Date
) {
  // 1. 출발법인 오프보딩 플랜 생성 (crossboarding_departure 템플릿)
  const departurePlan = await createPlan({
    employeeId,
    companyId: fromCompanyId,
    type: 'crossboarding_departure',
    startDate: transferDate,
  });
  
  // 2. 도착법인 온보딩 플랜 생성 (crossboarding_arrival 템플릿)
  const arrivalPlan = await createPlan({
    employeeId,
    companyId: toCompanyId,
    type: 'crossboarding_arrival',
    startDate: transferDate,
  });
  
  // 3. 양쪽 플랜 상호 연결
  await prisma.onboardingPlan.update({
    where: { id: departurePlan.id },
    data: { linkedPlanId: arrivalPlan.id }
  });
  await prisma.onboardingPlan.update({
    where: { id: arrivalPlan.id },
    data: { linkedPlanId: departurePlan.id }
  });
  
  // 4. A2 employee_assignments에 전출 발령 생성
  // 5. 양쪽 HR + 매니저에게 알림
}
```

### Task 8: 검증

```bash
# 1. 기존 STEP 4 온보딩 미파괴 확인
#    - Day 1/7/30/90 체크인 동작
#    - 감정 펄스 동작

# 2. 법인별 온보딩 템플릿
#    - CTR-KR 선택 → 한국 전용 항목(4대보험 등) 표시
#    - CTR-US 선택 → 미국 전용 항목(I-9, W-4 등) 표시
#    - CTR-VN 선택 → 글로벌 기본 템플릿 (오버라이드 없음)

# 3. 온보딩 플랜 생성 + 진행
#    - 직원 등록 → 자동 플랜 생성
#    - 체크리스트 항목 완료 처리
#    - 진행률 표시 + 지연 항목 하이라이트

# 4. 오프보딩 프로세스
#    - 오프보딩 시작 → 플랜 생성
#    - 퇴직면담 폼 작성 + 저장
#    - 단계별 완료 처리

# 5. Cross-boarding
#    - CTR-KR→CTR-VN 전출 트리거
#    - 출발 오프보딩 + 도착 온보딩 동시 생성
#    - linkedPlanId로 양쪽 연결 확인

# 6. 플랜 상태 전이
#    - active → suspended → active (복귀)
#    - active → completed (전체 필수항목 완료)

# 7. [A] 트랙과의 충돌 확인
#    - TRACK_A.md 확인하여 겹치는 테이블/라우트 없는지 검증

npx tsc --noEmit
npm run build
# context/TRACK_B.md 업데이트 (SHARED.md, TRACK_A.md 수정 금지)
```

---

## 산출물 체크리스트

- [ ] Prisma 모델 5개 (OnboardingTemplate, OnboardingTemplateItem, OnboardingPlan, OnboardingPlanItem, ExitInterview)
- [ ] B1 onboarding_settings Admin UI (/settings/onboarding)
- [ ] 법인별 온보딩 시드 (KR 상세 + US + 글로벌 기본 + 오프보딩 + Cross-boarding)
- [ ] 온보딩 플랜 인스턴스 생성 + 대시보드 + 상세 뷰
- [ ] 오프보딩 대시보드 + 6단계 프로세스
- [ ] 퇴직면담 폼 + 저장
- [ ] Cross-boarding 자동 트리거 (출발 오프보딩 + 도착 온보딩)
- [ ] 기존 STEP 4 온보딩 미파괴 확인
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 성공
- [ ] **context/TRACK_B.md 업데이트** (아래 내용 기록)

---

## context/TRACK_B.md 업데이트 내용 (세션 종료 시)

```markdown
## B5 완료 (날짜)

### DB 테이블
- onboarding_templates, onboarding_template_items
- onboarding_plans, onboarding_plan_items
- exit_interviews
- (기존 STEP 4 테이블과의 관계 기록)
- migrate 이름: b_b5_onboarding_offboarding

### 주요 라우트
- /settings/onboarding — 온보딩/오프보딩 템플릿 Admin
- /hr/offboarding — 오프보딩 대시보드
- 기존 온보딩 대시보드 라우트 (STEP 4)

### 핵심 함수
- triggerCrossboarding() — 법인 간 전출 시 양쪽 플랜 자동 생성
- createPlanFromTemplate() — 템플릿 → 플랜 인스턴스 생성

### [A] 트랙 참고사항
- 이 세션의 테이블은 [A] 트랙과 독립적 (충돌 없음)
- exit_interviews는 B10-1(이직 예측)에서 참조 예정

### 다음 세션 주의사항 (B 트랙)
- B6-1: 온보딩 중 직원의 근태 처리 (수습 기간 특수 처리 여부)
- B10-1: exit_interviews 데이터 → 이직 예측 학습 데이터
  - resignationReason, satisfaction, wouldRecommend 필드 활용
- B11: 알림 이벤트 — 온보딩 항목 마감, 오프보딩 시작, Cross-boarding 트리거
```

---

## 주의사항

1. **기존 STEP 4 온보딩 테이블과 신규 모델의 관계를 먼저 결정** — STEP 4 테이블을 그대로 확장할지, 새 모델로 마이그레이션할지는 기존 구조를 확인한 후 결정하세요. 기존 데이터(감정 펄스, Day 체크인 기록)가 유실되면 안 됩니다.

2. **오프보딩에서 급여/퇴직금 "정산"은 데이터 준비만** — 실제 급여 계산은 B7, 급여 지급은 외부 시스템. 오프보딩에서는 "퇴직금 정산에 필요한 데이터(근속기간, 잔여연차, 미지급 수당 등)를 정리"하는 체크리스트 항목으로 관리하세요.

3. **퇴직면담은 기밀** — `isConfidential=true`가 기본. HR Admin만 조회 가능하고, 해당 직원의 매니저도 열람 불가. B10-1에서 집계 데이터(퇴직 사유 분포)로만 활용하고 개별 면담 내용은 비식별화.

4. **Cross-boarding 시 A2 Effective Dating** — 전출 시점에 기존 법인의 assignment에 `end_date`를 설정하고, 새 법인에 새 assignment를 생성해야 합니다. 이 로직을 `triggerCrossboarding()`에 포함하세요.

5. **템플릿의 dayOffset은 유연하게** — Day 1/7/30/90이 고정이 아닙니다. Admin이 Day 3, Day 14, Day 60 등 자유롭게 추가할 수 있어야 합니다. "Day 추가" 버튼으로 임의 일수를 입력받으세요.

6. **migrate 이름에 `b_` 접두사 필수** — [A] 트랙과의 migrate lock 충돌을 방지합니다. 두 트랙이 동시에 migrate를 돌리면 안 됩니다.
