# B6-1: 근태 고도화 (교대+유연+52시간)

> **역할**: 당신은 CTR HR Hub의 CTO이자 시니어 풀스택 개발자입니다.
> **스택**: Next.js (App Router) + Supabase + PostgreSQL + **Prisma ORM** + Tailwind CSS
> **컨텍스트**: Phase A + B1(법인 엔진 + attendance_settings 테이블) 완료. STEP 3(기존 근태/출퇴근 + 52시간 모니터링) 존재.
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
npx prisma migrate dev --name b_b6_attendance
```

---

## 세션 목표

STEP 3의 기존 근태(출퇴근 기록 + 52시간 모니터링)를 **근무유형 엔진(고정/유연/교대/재택) + 교대근무 스케줄링 + 52시간 단계별 경고** 로 고도화합니다.

**범위**: 이 세션은 "근태"만 다루고, "휴가"는 B6-2에서 다룹니다.

---

## ⚠️ 시작 전 필수 확인

```bash
# 1. 컨텍스트 파일 3개 읽기
cat context/SHARED.md
cat context/TRACK_A.md
cat context/TRACK_B.md

# 2. STEP 3 근태 현재 상태 확인
# - 출퇴근 기록 테이블 (attendance_records? time_entries?)
# - 52시간 모니터링 구현 방식 (주간 합산? 실시간?)
# - 근태 대시보드 라우트
# - 초과근무 신청/승인 구현 여부

# 3. B1 attendance_settings 테이블 확인
# - 테이블만 존재, UI 없음
# - JSONB 구조 확인

# 4. B1 CompanySelector, SettingsPageLayout 컴포넌트 경로 확인

# 5. [A] 트랙 상태 확인 — TRACK_A.md에서 DB 변경사항 확인
# A 트랙이 migrate를 실행했다면 먼저 pull 후 시작
npx prisma db pull  # 필요 시
```

### ⚠️ STEP 3에서 잘못됐을 수 있는 부분

1. **단일 근무유형(고정근무)만 지원** — STEP 3가 9-to-6 고정근무만 전제할 수 있음. 유연근무(코어타임), 교대근무, 재택근무 구분이 없을 수 있음.

2. **52시간 경고가 단순 알림만** — 44h→주의, 48h→경고, 52h→차단의 단계별 대응이 아니라, 52h 초과 시 단순 경고만 있을 수 있음.

3. **교대근무 데이터 모델 부재** — 자동차부품 제조사인 CTR의 생산직은 교대근무가 필수인데, STEP 3에서 사무직 기준으로만 구현했을 수 있음.

---

## 핵심 설계 원칙

### 1. 근무유형 엔진 — 4가지 유형

| 유형 | 설명 | 핵심 로직 |
|------|------|----------|
| **고정 (Fixed)** | 9:00~18:00 등 정해진 시간 | 출퇴근 시간 대비 지각/조퇴 판정 |
| **유연 (Flexible)** | 코어타임(10~16시) + 자율 배분 | 일 8시간 채우기, 코어타임 이탈 감지 |
| **교대 (Shift)** | 2교대/3교대/4조3교대 등 | 월간 스케줄 관리, 교대 변경 요청 |
| **재택 (Remote)** | 재택근무일 지정 | 출근/퇴근 대신 업무시작/종료 기록 |

### 2. 52시간 3단계 경고 (한국 노동법)

```
주간 근무시간 = 기본근무(40h) + 연장근무(최대 12h)

44h 도달 → 🟡 주의 (직원+매니저에게 알림)
           "이번 주 잔여 8시간. 추가 근무 시 52시간 초과 위험"

48h 도달 → 🟠 경고 (직원+매니저+HR에게 알림)
           "이번 주 잔여 4시간. 추가 출근 시 HR 승인 필요"
           
52h 도달 → 🔴 차단 (추가 출근 불가, HR 강제 승인만 가능)
           "52시간 상한 도달. 추가 근무는 노동법 위반입니다"
```

**비한국 법인**: 법인별 주간 상한이 다를 수 있음 → B1 `attendance_settings`에서 설정

### 3. 교대근무 = Admin이 자유 정의

교대 패턴을 하드코딩하지 않습니다. Admin이 Shift Definition을 만들고 조합합니다.

```
예시 — 3교대:
주간조(Day):    06:00 ~ 14:00 (8h)
오후조(Swing):  14:00 ~ 22:00 (8h)  
야간조(Night):  22:00 ~ 06:00 (8h) — 야간수당 적용

예시 — 4조3교대:
A조: 주간→주간→오후→오후→야간→야간→휴무→휴무 (8일 사이클)
B조: 오후→오후→야간→야간→휴무→휴무→주간→주간
...
```

---

## 작업 순서 (8 Tasks)

### Task 1: DB 마이그레이션 — Prisma 모델 추가

`prisma/schema.prisma`에 추가 후 `npx prisma migrate dev --name b_b6_attendance` 실행.

> **⚠️ migrate 전 확인**: `cat context/TRACK_A.md`에서 [A] 트랙이 미완료 migrate가 있는지 확인. 있으면 A 트랙 migrate 완료 후 진행.

```prisma
// ── 교대근무 정의 ──

model ShiftDefinition {
  id          String   @id @default(uuid()) @db.Uuid
  companyId   String?  @db.Uuid
  company     Company? @relation(fields: [companyId], references: [id])
  name        String   @db.VarChar(100)    // "주간조", "Day Shift"
  nameEn      String?  @db.VarChar(100)
  code        String   @db.VarChar(20)     // "DAY", "SWING", "NIGHT"
  startTime   String   @db.VarChar(5)      // "06:00"
  endTime     String   @db.VarChar(5)      // "14:00"
  breakMinutes Int     @default(60)        // 휴게시간
  isNightShift Boolean @default(false)     // 야간수당 적용 여부
  color        String?  @db.VarChar(7)     // "#3B82F6" (달력 표시용)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  schedules   ShiftSchedule[]

  @@unique([companyId, code])
  @@map("shift_definitions")
}

// ── 교대근무 스케줄 (직원별 일별 배정) ──

model ShiftSchedule {
  id              String          @id @default(uuid()) @db.Uuid
  employeeId      String          @db.Uuid
  shiftDefinitionId String        @db.Uuid
  shiftDefinition ShiftDefinition @relation(fields: [shiftDefinitionId], references: [id])
  date            DateTime        @db.Date
  status          String          @default("scheduled") @db.VarChar(20) // 'scheduled' | 'completed' | 'absent' | 'swapped'
  actualStartTime DateTime?       // 실제 출근 시각
  actualEndTime   DateTime?       // 실제 퇴근 시각
  notes           String?         @db.Text
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@unique([employeeId, date])
  @@index([employeeId, date])
  @@map("shift_schedules")
}

// ── 교대 변경 요청 ──

model ShiftChangeRequest {
  id              String   @id @default(uuid()) @db.Uuid
  requesterId     String   @db.Uuid           // 요청자
  targetEmployeeId String? @db.Uuid           // 교환 상대 (맞교대 시)
  originalDate    DateTime @db.Date
  originalShiftId String   @db.Uuid
  requestedDate   DateTime? @db.Date          // 날짜 변경 시
  requestedShiftId String? @db.Uuid           // 교대조 변경 시
  reason          String?  @db.Text
  type            String   @db.VarChar(20)    // 'swap' | 'change' | 'cancel'
  status          String   @default("pending") @db.VarChar(20) // 'pending' | 'approved' | 'rejected'
  approvedBy      String?  @db.Uuid
  approvedAt      DateTime?
  createdAt       DateTime @default(now())

  @@map("shift_change_requests")
}

// ── 52시간 경고 로그 ──

model WorkHourAlert {
  id          String   @id @default(uuid()) @db.Uuid
  employeeId  String   @db.Uuid
  weekStart   DateTime @db.Date             // 해당 주 월요일
  totalHours  Float                         // 현재 주간 총 근무시간
  alertLevel  String   @db.VarChar(20)      // 'caution' (44h) | 'warning' (48h) | 'blocked' (52h)
  threshold   Float                         // 발동 기준 시간
  isResolved  Boolean  @default(false)       // HR 확인/해제 여부
  resolvedBy  String?  @db.Uuid
  resolvedAt  DateTime?
  createdAt   DateTime @default(now())

  @@unique([employeeId, weekStart, alertLevel])
  @@map("work_hour_alerts")
}
```

**기존 STEP 3 테이블 수정 필요 여부 확인**:
- 출퇴근 기록 테이블에 `workType` 필드 추가: `'fixed' | 'flexible' | 'shift' | 'remote'`
- 직원 프로필/assignments에 `workType` 기본 근무유형 필드 존재 여부 확인

### Task 2: B1 attendance_settings Admin UI 구현

B1에서 테이블만 만들어둔 `AttendanceSetting`의 Admin UI를 구현합니다.

**라우트**: `/settings/attendance` (설정 섹션에 추가)

```
┌─────────────────────────────────────────────────┐
│ 근태 설정                   [법인: CTR-KR ▼]      │
│                            [커스텀]               │
├─────────────────────────────────────────────────┤
│ [근무유형]  [52시간 관리]  [교대근무]               │
├─────────────────────────────────────────────────┤

── 근무유형 탭 ──
│ 지원 근무유형:                                    │
│ ☑ 고정근무 (Fixed)                               │
│   기본 시간: [09:00] ~ [18:00]  휴게: [60]분      │
│                                                 │
│ ☑ 유연근무 (Flexible)                            │
│   코어타임: [10:00] ~ [16:00]                    │
│   일 최소근무: [8]시간                            │
│                                                 │
│ ☑ 교대근무 (Shift)  → "교대근무" 탭에서 상세 설정    │
│                                                 │
│ ☑ 재택근무 (Remote)                              │
│   주간 최대: [3]일                               │

── 52시간 관리 탭 ──
│ 주간 상한: [52]시간                               │
│ 기본 근무: [40]시간                               │
│ 연장 상한: [12]시간                               │
│                                                 │
│ 경고 단계:                                        │
│ 🟡 주의: [44]시간 도달 시 → 직원+매니저 알림        │
│ 🟠 경고: [48]시간 도달 시 → 직원+매니저+HR 알림     │
│ 🔴 차단: [52]시간 도달 시 → 추가 출근 차단          │
│                                                 │
│ ☑ 차단 시 HR 강제 승인으로 해제 가능               │

── 교대근무 탭 ──
│ 교대조 정의:                                      │
│ ┌──────────────────────────────────────────┐     │
│ │ DAY  주간조  06:00~14:00  휴게60분  🟦    │     │
│ │ SWING 오후조 14:00~22:00  휴게60분  🟩    │     │
│ │ NIGHT 야간조 22:00~06:00  휴게60분  🟥 🌙 │     │
│ │ [+ 교대조 추가]                          │     │
│ └──────────────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
```

**법인별 차이 예시**:
- CTR-KR: 52시간 준수 필수, 야간수당 50% 가산
- CTR-US: FLSA 기준 주 40시간, 연장 1.5배
- CTR-CN: 월 36시간 연장 상한 (주간이 아닌 월간)
- CTR-MX: 주 48시간 기본

### Task 3: 근무유형 엔진 — 직원별 근무유형 판정

```typescript
// lib/attendance/workTypeEngine.ts

interface WorkTypeConfig {
  type: 'fixed' | 'flexible' | 'shift' | 'remote';
  fixedStart?: string;    // "09:00"
  fixedEnd?: string;      // "18:00"
  coreStart?: string;     // "10:00" (유연)
  coreEnd?: string;       // "16:00" (유연)
  minDailyHours?: number; // 8 (유연)
  shiftDefinitionId?: string; // (교대)
}

// 출퇴근 기록 처리
async function processAttendance(
  employeeId: string,
  clockIn: Date,
  clockOut: Date
) {
  const config = await getEmployeeWorkType(employeeId);
  
  switch (config.type) {
    case 'fixed':
      return processFixed(clockIn, clockOut, config);
      // → 지각/조퇴/정상 판정, 초과근무 자동 계산
      
    case 'flexible':
      return processFlexible(clockIn, clockOut, config);
      // → 코어타임 이탈 체크, 일 근무시간 합산, 부족 시 경고
      
    case 'shift':
      return processShift(employeeId, clockIn, clockOut);
      // → 배정된 교대조 대비 실제 근무 비교
      
    case 'remote':
      return processRemote(clockIn, clockOut, config);
      // → 업무시작/종료 기록, 고정근무와 동일 시간 판정
  }
}
```

**유연근무 일 8시간 체우기 로직**:
```
10:00 출근 → OK (코어타임 전 도착)
09:30 출근 → OK (더 일찍도 가능)
10:30 출근 → ⚠️ 코어타임 지각 (10:00 이후)

퇴근: 출근 + 9시간(8시간 근무 + 1시간 휴게) 이후 가능
10:00 출근 → 19:00 이후 퇴근 가능
09:00 출근 → 18:00 이후 퇴근 가능
```

### Task 4: 교대근무 스케줄 관리 UI

**월간 달력 뷰** (HR/매니저):

```
┌─────────────────────────────────────────────────┐
│ 교대근무 스케줄 — 생산1팀         2025년 3월       │
│                                                 │
│      월     화     수     목     금     토  일   │
│      3/3    3/4    3/5    3/6    3/7   3/8  3/9 │
│ 김A  🟦DAY  🟦DAY  🟩SWING 🟩SWING 🟥NIGHT ⬜OFF ⬜OFF │
│ 이B  🟩SWING 🟩SWING 🟥NIGHT 🟥NIGHT ⬜OFF ⬜OFF 🟦DAY │
│ 박C  🟥NIGHT 🟥NIGHT ⬜OFF  ⬜OFF  🟦DAY 🟦DAY 🟩SWING │
│ 최D  ⬜OFF  ⬜OFF  🟦DAY  🟦DAY  🟩SWING 🟩SWING 🟥NIGHT │
│                                                 │
│ [일괄 배정] [패턴 반복 적용] [엑셀 업로드]          │
└─────────────────────────────────────────────────┘
```

**패턴 반복 적용**: 위 4조3교대 8일 사이클 패턴을 정의하면 → 월 전체에 자동 반복 적용

**주간 달력 뷰** (직원 본인):
```
┌─────────────────────────────────────────────────┐
│ 나의 교대 스케줄 — 이번 주                        │
│                                                 │
│ 월 3/3: 🟦 주간조 06:00~14:00                    │
│ 화 3/4: 🟦 주간조 06:00~14:00                    │
│ 수 3/5: 🟩 오후조 14:00~22:00                    │
│ 목 3/6: 🟩 오후조 14:00~22:00                    │
│ 금 3/7: 🟥 야간조 22:00~06:00 🌙                 │
│ 토 3/8: ⬜ 휴무                                  │
│ 일 3/9: ⬜ 휴무                                  │
│                                                 │
│ [교대 변경 요청]                                  │
└─────────────────────────────────────────────────┘
```

**교대 변경 요청**: 
- 맞교대(swap): 다른 직원과 날짜/교대조 교환
- 교대 변경(change): 특정 날짜의 교대조 변경 요청
- 매니저 승인 필요

### Task 5: 52시간 모니터링 고도화

기존 STEP 3의 52시간 모니터링을 3단계 경고 + 차단으로 강화.

**실시간 주간 근무시간 계산**:
```typescript
async function getWeeklyHours(employeeId: string, weekStart: Date): Promise<number> {
  // 해당 주 월~일 출퇴근 기록 합산
  const records = await prisma.attendanceRecord.findMany({
    where: {
      employeeId,
      date: {
        gte: weekStart,
        lt: addDays(weekStart, 7)
      }
    }
  });
  
  return records.reduce((sum, r) => {
    const hours = differenceInHours(r.clockOut, r.clockIn) - (r.breakMinutes / 60);
    return sum + hours;
  }, 0);
}
```

**경고 트리거**: 출퇴근 기록 저장 후 자동 실행
```typescript
async function checkWorkHourAlert(employeeId: string, date: Date) {
  const settings = await getCompanySettings<AttendanceSetting>(
    'attendanceSetting', 
    employee.companyId
  );
  
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const totalHours = await getWeeklyHours(employeeId, weekStart);
  
  const thresholds = settings.alertThresholds; // { caution: 44, warning: 48, blocked: 52 }
  
  if (totalHours >= thresholds.blocked) {
    await createAlert(employeeId, weekStart, 'blocked', totalHours, thresholds.blocked);
    // → 직원+매니저+HR 알림, 추가 출근 차단
  } else if (totalHours >= thresholds.warning) {
    await createAlert(employeeId, weekStart, 'warning', totalHours, thresholds.warning);
    // → 직원+매니저+HR 알림
  } else if (totalHours >= thresholds.caution) {
    await createAlert(employeeId, weekStart, 'caution', totalHours, thresholds.caution);
    // → 직원+매니저 알림
  }
}
```

**차단 해제**: HR Admin이 `WorkHourAlert`의 `isResolved=true`로 설정하면 해당 주 추가 출근 가능. 단, 해제 사유 기록 필수.

### Task 6: 근태 대시보드 강화

기존 STEP 3 대시보드에 교대근무 + 52시간 모니터링 강화 뷰를 추가.

**HR 대시보드 — 52시간 모니터링 위젯**:
```
┌─────────────────────────────────────────────────┐
│ 📊 이번 주 52시간 현황           [법인: CTR-KR ▼] │
├─────────────────────────────────────────────────┤
│ 🔴 차단 (52h+): 0명                              │
│ 🟠 경고 (48h+): 3명  [상세보기]                    │
│   └ 김과장(49.5h) · 이대리(48.2h) · 박사원(48.0h)  │
│ 🟡 주의 (44h+): 8명  [상세보기]                    │
│ 🟢 안전 (44h-): 142명                            │
├─────────────────────────────────────────────────┤
│ 📈 주간 초과근무 추이 (최근 8주)                    │
│ [====차트====]                                   │
└─────────────────────────────────────────────────┘
```

**근무유형별 현황**:
```
오늘 근무 현황
├── 고정근무: 120명 (출근 115 | 지각 3 | 결근 2)
├── 유연근무: 30명 (근무중 28 | 코어타임 이탈 2)
├── 교대근무: 45명 (주간 15 | 오후 15 | 야간 15)
└── 재택근무: 20명 (업무중 18 | 미접속 2)
```

### Task 7: 기존 STEP 3 연결

STEP 3 기존 코드와의 통합 포인트:

1. **출퇴근 기록 저장 → 근무유형 엔진 경유**: 기존 clock-in/out API에 `processAttendance()` 연결
2. **52시간 모니터링 → 3단계 경고 교체**: 기존 단순 경고를 `checkWorkHourAlert()`로 교체
3. **근태 대시보드 → 교대 + 52시간 위젯 추가**: 기존 대시보드에 위젯 추가 (기존 위젯 유지)
4. **직원별 근태 현황 → B2 프로필 근태 탭 연결**: 기존 근태 컴포넌트를 B2 EmployeeProfilePage의 근태 탭(comingSoon → 실제 컴포넌트)으로 교체

### Task 8: 검증

```bash
# 1. 기존 STEP 3 근태 미파괴 확인
#    - 출퇴근 기록 정상 저장
#    - 기존 근태 대시보드 동작

# 2. 근무유형별 출퇴근 처리
#    - 고정: 9:10 출근 → 지각 판정
#    - 유연: 10:30 출근 → 코어타임 지각 경고
#    - 교대: 배정 교대조 대비 실제 근무 비교
#    - 재택: 업무시작/종료 기록

# 3. 교대근무 스케줄
#    - 교대조 정의 CRUD
#    - 월간 달력 일괄 배정
#    - 패턴 반복 적용
#    - 교대 변경 요청 → 매니저 승인

# 4. 52시간 3단계 경고
#    - 44h → 주의 알림 생성
#    - 48h → 경고 알림 생성
#    - 52h → 차단 + HR 해제 기능

# 5. 법인별 설정
#    - CTR-KR: 52시간 상한
#    - CTR-US: 40시간 기본 + FLSA
#    - 법인 전환 시 설정 반영

# 6. B2 직원 프로필 근태 탭 연결

# 7. [A] 트랙과의 충돌 확인
#    - TRACK_A.md 확인하여 겹치는 테이블/라우트 없는지 검증

npx tsc --noEmit
npm run build
# context/TRACK_B.md 업데이트 (SHARED.md, TRACK_A.md 수정 금지)
```

---

## 산출물 체크리스트

- [ ] Prisma 모델 4개 (ShiftDefinition, ShiftSchedule, ShiftChangeRequest, WorkHourAlert)
- [ ] B1 attendance_settings Admin UI (/settings/attendance)
- [ ] 근무유형 엔진 (고정/유연/교대/재택 처리 로직)
- [ ] 교대근무 스케줄: 교대조 정의 CRUD + 월간 달력 + 패턴 반복 + 변경 요청
- [ ] 52시간 3단계 경고 (주의44h → 경고48h → 차단52h)
- [ ] 근태 대시보드 강화 (52시간 모니터링 위젯 + 근무유형별 현황)
- [ ] B2 직원 프로필 근태 탭 연결
- [ ] 기존 STEP 3 미파괴 확인
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 성공
- [ ] **context/TRACK_B.md 업데이트** (아래 내용 기록)

---

## context/TRACK_B.md 업데이트 내용 (세션 종료 시)

```markdown
## B6-1 완료 (날짜)

### DB 테이블
- shift_definitions, shift_schedules, shift_change_requests
- work_hour_alerts
- 기존 출퇴근 테이블 확장 (workType 필드)
- migrate 이름: b_b6_attendance

### 핵심 함수
- processAttendance() — 근무유형별 출퇴근 처리
- checkWorkHourAlert() — 52시간 3단계 경고
- getWeeklyHours() — 주간 근무시간 합산

### [A] 트랙 참고사항
- 이 세션의 테이블은 [A] 트랙과 독립적 (충돌 없음)
- 출퇴근 테이블에 workType 필드 추가했으므로 A 트랙에서 해당 테이블 사용 시 인지 필요

### 다음 세션 주의사항 (B 트랙)
- B6-2: attendance_settings의 52시간 임계값을 휴가 계산과 연동
- B6-2: 근태 도메인 통합 승인함에 교대 변경 요청도 포함
- B7-1a: 야간수당, 연장수당 계산 시 shift_definitions.isNightShift 참조
- B7-1a: 월 근무시간 합산 → 급여 계산 입력
- B10-1: 초과근무율 → 번아웃 지표 입력
- B10-1: work_hour_alerts 이력 → 이직 예측 입력
```

---

## 주의사항

1. **교대근무 스케줄의 시간대(timezone) 처리** — 6개국 법인이므로 각 법인의 로컬 시간대로 교대 시간을 관리해야 합니다. 서버는 UTC, 표시는 법인별 timezone으로 변환. `attendance_settings`에 `timezone` 필드 포함.

2. **야간교대의 날짜 경계 처리** — 22:00~06:00 야간조는 날짜가 바뀝니다. `ShiftSchedule.date`는 해당 교대의 시작일 기준으로 저장하세요. 06:00 퇴근은 다음 날이지만, 스케줄 date는 전날입니다.

3. **유연근무 월/주 단위 합산** — 유연근무는 일 8시간이지만, 주간 총량(40시간)도 모니터링해야 합니다. 어떤 날 6시간만 일하고 다른 날 10시간 일하는 건 가능하지만, 주 40시간을 넘으면 연장근무 처리.

4. **기존 출퇴근 데이터와 근무유형 매핑** — STEP 3 기존 출퇴근 레코드에 `workType`이 없으므로, 마이그레이션 시 전체를 `'fixed'`로 기본 설정하세요. 교대근무 직원은 HR이 수동으로 변경.

5. **52시간 차단은 한국법인(CTR-KR)만** — 다른 법인은 경고만 하고 차단은 법인 설정에 따라 on/off. `attendance_settings.enableBlocking: boolean` 필드로 제어.

6. **migrate 이름에 `b_` 접두사 필수** — [A] 트랙과의 migrate lock 충돌을 방지합니다. 두 트랙이 동시에 migrate를 돌리면 안 됩니다.
