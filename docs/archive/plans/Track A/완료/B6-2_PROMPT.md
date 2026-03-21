# B6-2: 휴가 고도화 (정책엔진 + 통합 승인함)

> **역할**: 당신은 CTR HR Hub의 CTO이자 시니어 풀스택 개발자입니다.
> **스택**: Next.js (App Router) + Supabase + PostgreSQL + **Prisma ORM** + Tailwind CSS
> **컨텍스트**: Phase A + B1(법인 엔진 + leave_settings + approval_flows) + B6-1(근태 고도화) 완료. STEP 3(기존 휴가 신청/승인) 존재.
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
npx prisma migrate dev --name a_b6_leave_policy
```

---

## 세션 목표

STEP 3의 기존 휴가(신청/승인)를 **법인별 휴가 정책 엔진(연차 부여/이월/소멸) + 근태 도메인 통합 승인함** 으로 고도화합니다.

**핵심**: 한국의 근로기준법 연차와 미국의 PTO 통합제, 중국의 춘절 특별휴가 등 법인별로 전혀 다른 휴가 체계를 **하나의 정책 엔진**으로 관리합니다.

---

## ⚠️ 시작 전 필수 확인

```bash
# 1. 컨텍스트 파일 3개 읽기
cat context/SHARED.md
cat context/TRACK_A.md
cat context/TRACK_B.md

# 2. STEP 3 휴가 현재 상태 확인
# - 휴가 유형 테이블 (leave_types?)
# - 휴가 신청 테이블 (leave_requests?)
# - 잔여 연차 관리 방식 (leave_balances?)
# - 승인 프로세스 구현 방식

# 3. B1 leave_settings 테이블 확인
# - 테이블만 존재, UI 없음
# - JSONB 구조 확인

# 4. B1 approval_flows(module='leave') 시드 확인
# - 휴가 승인 플로우 존재 여부

# 5. B6-1 근태 도메인 테이블 구조 확인
# ⚠️ B6-1은 [B] 트랙 — TRACK_B.md에서 결과 확인
# - 초과근무 신청이 근태 쪽에 있는지 확인
# - 교대 변경 요청(ShiftChangeRequest) 구조 확인

# 6. [B] 트랙 상태 확인 — TRACK_B.md에서 DB 변경사항 확인
# B 트랙이 migrate를 실행했다면 먼저 pull 후 시작
npx prisma db pull  # 필요 시
```

### ⚠️ STEP 3에서 잘못됐을 수 있는 부분

1. **한국 연차 규칙만 하드코딩** — 근속 1년 미만 월 1일, 1년 이상 15일 + 2년마다 1일 가산 등이 코드에 직접 박혀있을 수 있음. 법인별 정책으로 이관 필요.

2. **연차 부여/소멸 자동화 부재** — 매년 자동 부여 + 미사용 연차 소멸/이월 로직이 없고, HR이 수동으로 잔여일수를 관리하고 있을 수 있음.

3. **휴가 유형이 불충분** — 연차/반차 정도만 있고, 경조휴가/병가/출산휴가/특별휴가 등이 없을 수 있음.

4. **승인함이 휴가 전용** — 휴가 승인만 별도 페이지에 있고, 초과근무/근태수정/교대변경과 분리되어 있을 수 있음.

---

## 핵심 설계 원칙

### 1. 법인별 휴가 정책 = Accrual Rules + Leave Types

| 법인 | 연차 부여 방식 | 핵심 차이 |
|------|-------------|----------|
| **CTR-KR** | 근속 기반: 1년 미만 월1일, 1년+ 15일, 2년마다 +1일 (최대 25일) | 미사용 연차수당 의무, 이월 불가 (원칙) |
| **CTR-CN** | 근속 기반: 1~10년 5일, 10~20년 10일, 20년+ 15일 + 춘절 7일 | 춘절 특별휴가 별도 |
| **CTR-US** | PTO 통합제: 연차/병가 구분 없이 연 20일 | Sick Leave 별도 의무 (주별 상이) |
| **CTR-VN** | 기본 12일 + 근속 5년마다 +1일 | 음력설(Tết) 5일 별도 |
| **CTR-RU** | 기본 28일 (캘린더일) | 캘린더일 기준 (근무일 아님) |
| **CTR-MX** | 1년 12일, 매년 +2일 (5년까지), 이후 5년마다 +2일 | 크리스마스 보너스와 연동 |

### 2. Accrual Engine = 규칙 기반 자동 부여

```
연차 부여 주기 (accrual_type):
├── annual: 매년 1월 1일 (또는 입사일 기준) 일괄 부여
├── monthly: 매월 1일 비례 부여 (1년 미만 신입)
└── manual: HR 수동 부여 (특별휴가 등)

이월 규칙 (carry_over):
├── none: 이월 불가 (소멸)
├── limited: 최대 N일까지 이월 (다음 분기/반기 내 사용)
└── unlimited: 전량 이월

소멸 규칙 (expiry):
├── 미사용분 소멸일: 부여일 + N개월
└── 소멸 전 알림: 30일/14일/7일 전
```

### 3. 통합 승인함 = 근태 도메인 원스톱

매니저/HR이 하나의 승인함에서 근태 관련 모든 요청을 처리:

| 요청 유형 | 출처 세션 | 승인 플로우 |
|----------|----------|-----------|
| 휴가 신청 | B6-2 (여기) | approval_flows(module='leave') |
| 초과근무 신청 | B6-1 or 기존 STEP 3 | approval_flows(module='leave') |
| 근태 수정 요청 | B6-1 or 기존 STEP 3 | 매니저 단일 승인 |
| 교대 변경 요청 | B6-1 ShiftChangeRequest | 매니저 단일 승인 |

---

## 작업 순서 (8 Tasks)

### Task 1: DB 마이그레이션 — Prisma 모델 추가

`prisma/schema.prisma`에 추가 후 `npx prisma migrate dev --name a_b6_leave_policy` 실행.

> **⚠️ migrate 전 확인**: `cat context/TRACK_B.md`에서 [B] 트랙이 미완료 migrate가 있는지 확인. 있으면 B 트랙 migrate 완료 후 진행.

```prisma
// ── 휴가 유형 정의 (법인별) ──

model LeaveType {
  id            String   @id @default(uuid()) @db.Uuid
  companyId     String?  @db.Uuid
  company       Company? @relation(fields: [companyId], references: [id])
  code          String   @db.VarChar(30)       // 'annual' | 'sick' | 'pto' | 'maternity' | 'paternity' | 'bereavement' | 'special' | 'unpaid'
  name          String   @db.VarChar(100)      // "연차휴가"
  nameEn        String?  @db.VarChar(100)      // "Annual Leave"
  isPaid        Boolean  @default(true)
  allowHalfDay  Boolean  @default(true)        // 반차 허용
  requiresProof Boolean  @default(false)       // 증빙 필요 (병가, 경조 등)
  maxConsecutiveDays Int?                      // 최대 연속 사용일 (null = 제한 없음)
  isActive      Boolean  @default(true)
  displayOrder  Int      @default(0)
  balances      LeaveBalance[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([companyId, code])
  @@map("leave_types")
}

// ── 연차 부여/이월 규칙 ──

model LeaveAccrualRule {
  id               String   @id @default(uuid()) @db.Uuid
  companyId        String?  @db.Uuid
  company          Company? @relation(fields: [companyId], references: [id])
  leaveTypeCode    String   @db.VarChar(30)    // leave_types.code 참조
  accrualType      String   @db.VarChar(20)    // 'annual' | 'monthly' | 'manual'
  accrualBasis     String   @db.VarChar(20)    // 'calendar_year' | 'hire_date_anniversary'
  rules            Json                        // 근속 구간별 부여일수 배열
  carryOverType    String   @default("none") @db.VarChar(20) // 'none' | 'limited' | 'unlimited'
  carryOverMaxDays Int?                        // limited일 때 최대 이월일수
  carryOverExpiryMonths Int?                   // 이월분 사용 기한 (월)
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@map("leave_accrual_rules")
}

// rules JSON 구조 예시 (CTR-KR 연차):
// [
//   { "minTenureMonths": 0, "maxTenureMonths": 11, "daysPerMonth": 1, "type": "monthly" },
//   { "minTenureMonths": 12, "maxTenureMonths": 35, "daysPerYear": 15, "type": "annual" },
//   { "minTenureMonths": 36, "maxTenureMonths": null, "daysPerYear": 15, "bonusPerTwoYears": 1, "maxDays": 25, "type": "annual" }
// ]

// ── 직원별 휴가 잔여 ──

model LeaveBalance {
  id            String    @id @default(uuid()) @db.Uuid
  employeeId    String    @db.Uuid
  leaveTypeId   String    @db.Uuid
  leaveType     LeaveType @relation(fields: [leaveTypeId], references: [id])
  year          Int                            // 2025
  entitled      Float                          // 부여일수
  used          Float     @default(0)          // 사용일수
  carriedOver   Float     @default(0)          // 전년 이월분
  adjusted      Float     @default(0)          // HR 수동 조정
  pending       Float     @default(0)          // 승인 대기 중 일수
  expiresAt     DateTime?                      // 이월분 만료일
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([employeeId, leaveTypeId, year])
  @@map("leave_balances")

  // 잔여 = entitled + carriedOver + adjusted - used - pending
}

// ── 근태 통합 승인 요청 ──

model AttendanceApprovalRequest {
  id              String   @id @default(uuid()) @db.Uuid
  companyId       String   @db.Uuid
  requesterId     String   @db.Uuid
  requestType     String   @db.VarChar(30)     // 'leave' | 'overtime' | 'attendance_correction' | 'shift_change'
  referenceId     String?  @db.Uuid            // 원본 요청 ID
  title           String   @db.VarChar(200)    // "연차 3/15~3/16 (2일)"
  details         Json?                        // 요청 유형별 상세 데이터
  status          String   @default("pending") @db.VarChar(20)
  approvalFlowId  String?  @db.Uuid
  currentStep     Int      @default(1)
  approvals       AttendanceApprovalStep[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([requesterId, status])
  @@index([companyId, status])
  @@map("attendance_approval_requests")
}

model AttendanceApprovalStep {
  id          String                    @id @default(uuid()) @db.Uuid
  requestId   String                    @db.Uuid
  request     AttendanceApprovalRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  stepOrder   Int
  approverId  String                    @db.Uuid
  status      String                    @default("pending") @db.VarChar(20)
  comment     String?                   @db.Text
  decidedAt   DateTime?
  createdAt   DateTime                  @default(now())

  @@map("attendance_approval_steps")
}
```

**기존 STEP 3 테이블과의 관계**:
- 기존 `leave_requests` 테이블이 있다면 유지하되, `AttendanceApprovalRequest`와 `referenceId`로 연결
- 기존 `leave_balances`가 있다면 위 모델로 마이그레이션 또는 확장
- 기존 leave_types가 있다면 위 모델과 병합 (법인별 분리 추가)

### Task 2: B1 leave_settings Admin UI 구현

**라우트**: `/settings/leave` (설정 섹션에 추가)

```
┌─────────────────────────────────────────────────┐
│ 휴가 설정                   [법인: CTR-KR ▼]      │
│                            [커스텀]               │
├─────────────────────────────────────────────────┤
│ [휴가 유형]  [부여 규칙]  [이월/소멸]              │
├─────────────────────────────────────────────────┤

── 휴가 유형 탭 ──
│ ┌──────────────────────────────────────────┐    │
│ │ 연차 (annual)  유급 ✅ 반차 ✅ 증빙 ❌     │    │
│ │ 병가 (sick)    유급 ✅ 반차 ❌ 증빙 ✅     │    │
│ │ 경조 (bereavement) 유급 ✅ 반차 ❌ 증빙 ✅ │    │
│ │ 출산 (maternity) 유급 ✅ 반차 ❌ 증빙 ✅   │    │
│ │ 무급 (unpaid)  무급 반차 ✅ 증빙 ❌       │    │
│ │ [+ 휴가 유형 추가]                        │    │
│ └──────────────────────────────────────────┘    │

── 부여 규칙 탭 ──
│ 연차 부여 규칙:                                   │
│ 부여 기준: [○역년 기준(1/1) ●입사일 기준]          │
│ 부여 방식: [○일괄 부여 ●월별 비례]                  │
│                                                 │
│ 근속별 부여일수:                                   │
│ ┌──────────────────────────────────────────┐    │
│ │ 입사~11개월:  월 [1]일씩 부여               │    │
│ │ 1년~2년:     연 [15]일 일괄                │    │
│ │ 3년 이상:    연 15일 + 2년마다 [1]일 가산    │    │
│ │ 최대:        [25]일                        │    │
│ │ [+ 구간 추가]                              │    │
│ └──────────────────────────────────────────┘    │

── 이월/소멸 탭 ──
│ 이월 정책: [●이월 불가 ○제한 이월 ○전량 이월]       │
│ (제한 이월 시) 최대 이월: [ ]일                     │
│ (제한 이월 시) 이월분 만료: [ ]개월 후               │
│                                                 │
│ 미사용 연차 수당:                                  │
│ [✅ 미사용 연차 수당 지급] (한국 노동법 의무)         │
│                                                 │
│ 소멸 알림:                                        │
│ [✅ 30일 전] [✅ 14일 전] [✅ 7일 전]               │
└─────────────────────────────────────────────────┘
```

### Task 3: 법인별 휴가 시드 데이터

**LeaveType 시드** (법인별):

CTR-KR:
```
annual(연차), sick(병가), bereavement(경조), maternity(출산), paternity(배우자출산), 
childcare(육아), unpaid(무급), special(특별-회사창립일 등)
```

CTR-US:
```
pto(PTO통합), sick(Sick Leave), bereavement(Bereavement), 
maternity(Maternity/FMLA), paternity(Paternity), unpaid(Unpaid)
```

CTR-CN:
```
annual(年假), sick(病假), marriage(婚假), maternity(产假), paternity(陪产假),
bereavement(丧假), spring_festival(春节特别假), unpaid(事假)
```

나머지 법인: 글로벌 기본(annual, sick, bereavement, maternity, paternity, unpaid)

**LeaveAccrualRule 시드**:
- CTR-KR: 근로기준법 기준 (위 부여 규칙 참조)
- CTR-US: 입사 시 PTO 20일 일괄 부여, 이월 5일 한도
- CTR-CN: 근속 1~10년 5일, 10~20년 10일, 20년+ 15일
- 나머지: 글로벌 기본 15일

### Task 4: Accrual Engine — 연차 자동 부여/소멸

```typescript
// lib/leave/accrualEngine.ts

async function calculateEntitlement(
  employeeId: string,
  year: number
): Promise<{ leaveTypeCode: string; entitled: number }[]> {
  const employee = await prisma.employeeProfile.findUnique({
    where: { id: employeeId },
    include: { company: true }
  });
  
  const rules = await prisma.leaveAccrualRule.findMany({
    where: {
      OR: [
        { companyId: employee.companyId },
        { companyId: null }
      ],
      isActive: true
    }
  });
  
  const effectiveRules = deduplicateByCompanyOverride(rules);
  
  const tenureMonths = differenceInMonths(
    new Date(year, 0, 1),
    employee.hireDate
  );
  
  return effectiveRules.map(rule => {
    const matchingTier = (rule.rules as AccrualTier[])
      .find(tier => 
        tenureMonths >= tier.minTenureMonths && 
        (tier.maxTenureMonths === null || tenureMonths <= tier.maxTenureMonths)
      );
    
    let entitled = 0;
    if (matchingTier) {
      if (matchingTier.type === 'monthly') {
        const monthsInYear = Math.min(12 - (tenureMonths % 12), 12);
        entitled = matchingTier.daysPerMonth * monthsInYear;
      } else {
        entitled = matchingTier.daysPerYear;
        if (matchingTier.bonusPerTwoYears) {
          const bonusYears = Math.floor(tenureMonths / 24) - 1;
          entitled += Math.max(0, bonusYears) * matchingTier.bonusPerTwoYears;
        }
        entitled = Math.min(entitled, matchingTier.maxDays || 99);
      }
    }
    
    return { leaveTypeCode: rule.leaveTypeCode, entitled };
  });
}

async function processAnnualAccrual(companyId: string, year: number) {
  const employees = await prisma.employeeProfile.findMany({
    where: { companyId, status: 'active' }
  });
  
  for (const emp of employees) {
    const entitlements = await calculateEntitlement(emp.id, year);
    
    for (const ent of entitlements) {
      const carryOver = await calculateCarryOver(emp.id, ent.leaveTypeCode, year - 1);
      
      await prisma.leaveBalance.upsert({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: emp.id,
            leaveTypeId: getLeaveTypeId(ent.leaveTypeCode, companyId),
            year
          }
        },
        create: {
          employeeId: emp.id,
          leaveTypeId: getLeaveTypeId(ent.leaveTypeCode, companyId),
          year,
          entitled: ent.entitled,
          carriedOver: carryOver.days,
          expiresAt: carryOver.expiryDate,
        },
        update: {
          entitled: ent.entitled,
          carriedOver: carryOver.days,
          expiresAt: carryOver.expiryDate,
        }
      });
    }
  }
}
```

### Task 5: 휴가 신청 플로우 고도화

기존 STEP 3 휴가 신청을 법인별 정책 + 통합 승인으로 강화.

**신청 폼**:
```
┌─────────────────────────────────────────────────┐
│ 휴가 신청                                        │
├─────────────────────────────────────────────────┤
│ 휴가 유형: [연차 ▼]     잔여: 12일 / 15일         │
│                                                 │
│ 기간: [2025-03-15] ~ [2025-03-16]   2일          │
│       [○종일 ●오전반차 ○오후반차]  ← allowHalfDay  │
│                                                 │
│ 사유: [개인 사유                              ]   │
│                                                 │
│ 증빙 첨부: [파일 선택]  ← requiresProof 일 때만    │
│                                                 │
│ 승인선: 팀장(김팀장) → HR(이담당)                  │
│         ← B1 approval_flows(module='leave')      │
│                                                 │
│ ⚠️ 해당 기간 팀 내 휴가자: 박대리(3/14~3/15)       │
│                                                 │
│ [취소]  [신청]                                    │
└─────────────────────────────────────────────────┘
```

**신청 시 자동 검증**:
1. 잔여일수 >= 신청일수 (부족 시 차단)
2. 최대 연속사용일 초과 여부
3. 같은 팀 동시 휴가자 수 경고 (차단은 아님)
4. 증빙 필수 유형인데 첨부 없으면 차단

**신청 → AttendanceApprovalRequest 생성**:
```typescript
const leaveRequest = await prisma.leaveRequest.create({ ... });

const approvalRequest = await prisma.attendanceApprovalRequest.create({
  data: {
    companyId: employee.companyId,
    requesterId: employee.id,
    requestType: 'leave',
    referenceId: leaveRequest.id,
    title: `연차 3/15~3/16 (2일)`,
    details: { leaveTypeCode: 'annual', startDate: '...', endDate: '...', days: 2 },
    approvalFlowId: flowId,
  }
});

await prisma.leaveBalance.update({
  where: { ... },
  data: { pending: { increment: 2 } }
});
```

### Task 6: 근태 도메인 통합 승인함

**라우트**: `/approvals/attendance` (또는 기존 승인 페이지 내 탭)

```
┌─────────────────────────────────────────────────┐
│ 근태 승인함                  승인대기: 8건         │
│ [전체] [휴가(5)] [초과근무(2)] [교대변경(1)]       │
├─────────────────────────────────────────────────┤
│ ☐ 🏖 김대리 · 연차 3/15~3/16 (2일)               │
│   잔여: 12일 | 팀 휴가자: 1명 | 3시간 전          │
│   [승인] [반려]                                  │
│                                                 │
│ ☐ 🏖 박사원 · 오전반차 3/20 (0.5일)               │
│   잔여: 8일 | 팀 휴가자: 0명 | 1일 전             │
│   [승인] [반려]                                  │
│                                                 │
│ ☐ ⏰ 이과장 · 초과근무 3/18 (3시간)               │
│   사유: 긴급 출하 | 주간 현재: 42h | 2시간 전      │
│   [승인] [반려]                                  │
│                                                 │
│ ☐ 🔄 최사원 · 교대변경 3/20 주간→오후조            │
│   교환 상대: 한사원 | 1일 전                      │
│   [승인] [반려]                                  │
│                                                 │
│ [☑ 선택 항목 일괄 승인]                            │
└─────────────────────────────────────────────────┘
```

**승인 처리 후 동작**:
- 휴가 승인: `LeaveBalance.pending -= days`, `LeaveBalance.used += days`
- 초과근무 승인: 근태 기록에 초과근무 확정 반영
- 교대변경 승인: `ShiftSchedule` 업데이트
- 반려: `pending` 원복, 요청자에게 반려 사유 알림

### Task 7: 직원용 휴가 현황 뷰

**라우트**: `/my/leave` (나의 공간)

```
┌─────────────────────────────────────────────────┐
│ 나의 휴가                           2025년        │
├─────────────────────────────────────────────────┤
│ 연차                                             │
│ ┌────────────────────────────────────────────┐  │
│ │ 부여: 15일 | 이월: 2일 | 사용: 5일 | 잔여: 12일 │  │
│ │ [████████████████░░░░░░░░░░░░]  사용률 29%   │  │
│ │ 승인대기: 2일                               │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
│ 병가: 잔여 3/3일                                 │
│ 경조: 필요 시 신청                                │
│                                                 │
│ [휴가 신청]                                      │
│                                                 │
│ 최근 사용 내역                                    │
│ ├── 03/10~03/11 연차 (2일) ✅ 승인완료            │
│ ├── 02/14 오전반차 (0.5일) ✅ 승인완료             │
│ └── 03/15~03/16 연차 (2일) ⏳ 승인대기            │
│                                                 │
│ 📅 팀 휴가 캘린더                                 │
│ [═══3월 캘린더═══]                               │
│ 3/10-11: 나 | 3/14-15: 박대리 | 3/20: 김과장     │
└─────────────────────────────────────────────────┘
```

### Task 8: 검증

```bash
# 1. 기존 STEP 3 휴가 미파괴 확인
#    - 기존 휴가 신청/승인 동작

# 2. 법인별 휴가 정책
#    - CTR-KR: 근속 기반 연차 자동 계산 (1년 미만 월1일, 1년+ 15일)
#    - CTR-US: PTO 20일 일괄 부여
#    - 법인 전환 시 휴가 유형/잔여 변경 확인

# 3. Accrual Engine
#    - 연초 일괄 부여 실행 → LeaveBalance 생성
#    - 이월 처리: 전년 미사용분 이월/소멸
#    - 중도입사: 월별 비례 부여

# 4. 휴가 신청 → 통합 승인함
#    - 잔여 부족 시 신청 차단
#    - 증빙 필수 유형에서 미첨부 시 차단
#    - 통합 승인함에 표시 확인

# 5. 통합 승인함
#    - 휴가 + 초과근무 + 교대변경 통합 표시
#    - 일괄 승인 동작
#    - 승인 후 LeaveBalance 업데이트

# 6. 직원용 휴가 현황
#    - 잔여일수, 사용률 바, 사용 내역
#    - 팀 휴가 캘린더

# 7. [B] 트랙과의 충돌 확인
#    - TRACK_B.md 확인하여 겹치는 테이블/라우트 없는지 검증
#    - B6-1(B트랙) ShiftChangeRequest와 통합 승인함 연결 확인

npx tsc --noEmit
npm run build
# context/TRACK_A.md 업데이트 (SHARED.md, TRACK_B.md 수정 금지)
```

---

## 산출물 체크리스트

- [ ] Prisma 모델 6개 (LeaveType, LeaveAccrualRule, LeaveBalance, AttendanceApprovalRequest, AttendanceApprovalStep, 기존 테이블 확장)
- [ ] B1 leave_settings Admin UI (/settings/leave) — 휴가유형/부여규칙/이월소멸 3탭
- [ ] 법인별 시드 (KR 근로기준법 + US PTO + CN 춘절 + 글로벌 기본)
- [ ] Accrual Engine — 연차 자동 부여/이월/소멸 로직
- [ ] 휴가 신청 폼 고도화 (잔여 체크, 증빙, 팀 동시 휴가 경고)
- [ ] 근태 도메인 통합 승인함 (휴가+초과근무+근태수정+교대변경)
- [ ] 직원용 휴가 현황 뷰 (/my/leave)
- [ ] 기존 STEP 3 미파괴 확인
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 성공
- [ ] **context/TRACK_A.md 업데이트** (아래 내용 기록)

---

## context/TRACK_A.md 업데이트 내용 (세션 종료 시)

```markdown
## B6-2 완료 (날짜)

### DB 테이블
- leave_types, leave_accrual_rules, leave_balances
- attendance_approval_requests, attendance_approval_steps
- (기존 STEP 3 leave_requests와의 관계 기록)
- migrate 이름: a_b6_leave_policy

### 핵심 함수
- calculateEntitlement() — 직원별 연차 부여일수 계산
- processAnnualAccrual() — 연초 일괄 부여 + 이월 처리
- 통합 승인함 컴포넌트 경로

### [B] 트랙 참고사항
- 통합 승인함이 B6-1(B트랙) ShiftChangeRequest를 읽기 전용으로 표시
- B6-1의 shift_change_requests 테이블 구조에 의존 — 변경 시 동기화 필요

### 다음 세션 주의사항 (A 트랙)
- B7-1a: LeaveBalance.used → 미사용 연차수당 계산 입력
- B7-1a: 월 근무일수 = 총일수 - 휴가일수 (급여 계산)
- B9-2: AttendanceApprovalRequest 패턴을 복리후생 승인에서 참조 가능
- B10-1: 연차 미사용률 → 번아웃 지표 입력
- B11: 알림 이벤트 — 휴가 승인/반려, 연차 소멸 임박, 이월 알림
```

---

## 주의사항

1. **한국 연차 계산의 복잡성** — 입사일 기준 vs 역년 기준, 회계연도 전환 시 비례 부여 등 엣지 케이스가 많습니다. 완벽하게 구현하려 하지 말고, 기본 로직을 구현한 후 HR이 `adjusted` 필드로 수동 보정할 수 있게 하세요.

2. **LeaveBalance.pending 동기화** — 승인/반려/취소 시 pending 값이 정확히 원복되어야 합니다. 트랜잭션으로 묶으세요. 레이스 컨디션도 고려.

3. **통합 승인함에서 B6-1 ShiftChangeRequest 연결** — B6-1에서 만든 교대 변경 요청이 별도 승인 체계를 갖고 있을 수 있습니다. 통합 승인함에 표시할 때 기존 ShiftChangeRequest의 승인 로직을 `AttendanceApprovalRequest`로 전환할지, 읽기 전용으로 표시만 할지 결정하세요. **권장**: 읽기 전용 표시 + 기존 ShiftChangeRequest 승인 로직 유지.

4. **반차 = 0.5일 처리** — `LeaveBalance`의 `used`와 `pending` 필드가 Float인 이유입니다. 0.5 단위 연산이 정확한지 확인하세요.

5. **미사용 연차 수당은 급여 모듈(B7)의 영역** — B6-2에서는 LeaveBalance 데이터만 정확히 관리하고, 수당 계산은 B7-1a에서 처리합니다. "미사용 연차 수당 지급" 설정은 leave_settings에 두되, 금액 계산은 B7에 위임.

6. **migrate 이름에 `a_` 접두사 필수** — [B] 트랙과의 migrate lock 충돌을 방지합니다. 두 트랙이 동시에 migrate를 돌리면 안 됩니다.
