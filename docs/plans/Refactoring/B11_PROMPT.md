# B11: 알림 시스템 + i18n + Microsoft Teams 연동

> **역할**: 당신은 CTR HR Hub의 CTO이자 시니어 풀스택 개발자입니다.
> **스택**: Next.js (App Router) + Supabase + PostgreSQL + **Prisma ORM** + Tailwind CSS
> **순서**: B10 완료 → REVIEW-1/2 → FIX 완료 → **이 세션**
> **선행 완료**: Phase B 전체(B1~B10) + 코드 리뷰 + 리팩토링 완료 상태. 정리된 코드베이스 위에서 횡단 관심사를 통합합니다.

---

## DB 접근 규칙 (전 세션 공통)

- 모든 테이블 생성/변경은 `prisma/schema.prisma` → `npx prisma migrate dev --name notification_system`
- 쿼리는 **Prisma Client만** 사용 (raw SQL 금지)
- Supabase는 Auth + Storage + Realtime 용도만

---

## ⚠️ 시작 전 필수 확인

```bash
# 1. 컨텍스트 읽기
# 리뷰+FIX 과정에서 context 파일이 통합되었을 수 있음
# 아래 3개 중 존재하는 파일을 모두 읽으세요
cat context/SHARED.md
cat context/TRACK_A.md 2>/dev/null
cat context/TRACK_B.md 2>/dev/null

# 2. 리뷰 보고서 확인 — FIX에서 정리된 내용 파악
cat REVIEW_1_REPORT.md 2>/dev/null
cat REVIEW_2_REPORT.md 2>/dev/null

# 3. 디자인 시스템 + UI 패턴 확인
cat CLAUDE.md
cat CTR_UI_PATTERNS.md

# 4. Supabase Realtime 설정 확인 (인앱 알림용)

# 5. 기존 알림/토스트 구현 확인 (리팩토링에서 변경되었을 수 있음)

# ⚡ 이 세션 결과는 context/SHARED.md에 기록하세요
```

---

## 세션 목표

1. **알림 시스템**: 전체 모듈의 이벤트를 인앱 알림 + 이메일 + Teams로 통합 전달
2. **i18n (국제화)**: 6개 법인의 언어(한국어/영어/중국어/러시아어/베트남어/스페인어)에 대한 기초 프레임워크
3. **Microsoft Teams 연동**: 적응형 카드(Adaptive Cards)로 HR 알림을 Teams 채널에 푸시

**UI 기준**: CLAUDE.md 디자인 토큰(green #00C853 primary, Pretendard) + CTR_UI_PATTERNS.md 인터랙션 패턴 준수.

---

## Part 1: 알림 시스템

### 핵심 설계 원칙

```
[이벤트 발생]
  ↓
[알림 디스패처] ← 이벤트 타입 + 수신자 결정
  ↓
┌─────────────────────────────────┐
│    채널 분배 (사용자 설정 기반)    │
├──────┬──────────┬───────────────┤
│ 인앱  │  이메일    │  Teams        │
│ 벨 🔔 │  SMTP     │  Webhook      │
└──────┴──────────┴───────────────┘
```

### Task 1: DB 마이그레이션

> 마이그레이션명: `notification_system`

```prisma
model Notification {
  id            String   @id @default(uuid()) @db.Uuid
  recipientId   String   @db.Uuid               // 수신자
  type          String   @db.VarChar(50)         // 이벤트 타입 (아래 목록)
  title         String   @db.VarChar(200)
  body          String   @db.Text
  link          String?  @db.VarChar(500)        // 클릭 시 이동 경로
  priority      String   @default("normal") @db.VarChar(10) // 'low' | 'normal' | 'high' | 'urgent'
  metadata      Json?                            // 이벤트별 추가 데이터
  isRead        Boolean  @default(false)
  readAt        DateTime?
  channels      String[] @default(["in_app"])    // 전송된 채널들
  createdAt     DateTime @default(now())

  @@index([recipientId, isRead, createdAt])
  @@map("notifications")
}

model NotificationPreference {
  id            String   @id @default(uuid()) @db.Uuid
  userId        String   @unique @db.Uuid
  preferences   Json                             // { "leave_approved": { in_app: true, email: true, teams: false }, ... }
  quietHoursStart String? @db.VarChar(5)         // "22:00"
  quietHoursEnd   String? @db.VarChar(5)         // "08:00"
  timezone      String   @default("Asia/Seoul") @db.VarChar(50)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@map("notification_preferences")
}

model TeamsWebhookConfig {
  id            String   @id @default(uuid()) @db.Uuid
  companyId     String   @db.Uuid
  company       Company  @relation(fields: [companyId], references: [id])
  channelName   String   @db.VarChar(100)        // "HR-알림"
  webhookUrl    String   @db.VarChar(500)        // Teams Incoming Webhook URL
  eventTypes    String[] @default([])            // 이 채널에 전송할 이벤트 타입들
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@map("teams_webhook_configs")
}
```

---

### Task 2: 이벤트 카탈로그 — 전체 모듈 알림 이벤트

| 모듈 | 이벤트 타입 | 수신자 | 우선순위 |
|------|-----------|--------|---------|
| **B4 채용** | `requisition_approved` | 요청자 | normal |
| | `candidate_applied` | HR | normal |
| | `interview_scheduled` | 면접관+후보자 | normal |
| | `offer_accepted` | HR+매니저 | high |
| **B5 온보딩** | `onboarding_task_due` | 담당자 | normal |
| | `onboarding_task_overdue` | 담당자+HR | high |
| | `offboarding_started` | 관련자 전원 | high |
| | `crossboarding_triggered` | 양쪽 HR+매니저 | high |
| **B6 근태/휴가** | `leave_approved` | 신청자 | normal |
| | `leave_rejected` | 신청자 | normal |
| | `overtime_warning_44h` | 직원+매니저 | normal |
| | `overtime_warning_48h` | 직원+매니저+HR | high |
| | `overtime_blocked_52h` | 직원+매니저+HR | urgent |
| | `shift_change_approved` | 요청자+교환상대 | normal |
| | `leave_expiry_30d` | 직원 | normal |
| **B7 급여** | `payslip_issued` | 직원 | normal |
| | `year_end_deadline` | 미제출 직원 | high |
| | `payroll_confirmed` | HR | normal |
| **B8 조직** | `profile_change_approved` | 직원 | normal |
| | `restructure_applied` | 영향 직원 전원 | high |
| **B9 교육/복리** | `mandatory_training_due` | 직원 | normal |
| | `training_expiry_30d` | 직원+HR | high |
| | `benefit_approved` | 직원 | normal |
| | `budget_threshold_80` | HR | high |
| **B10 분석** | `turnover_risk_critical` | HR+부서장 | urgent |
| | `burnout_risk_high` | HR+부서장 | high |
| | `team_health_at_risk` | HR+부서장 | high |
| **B3 성과** | `evaluation_cycle_start` | 전 직원 | normal |
| | `evaluation_deadline` | 미완료자 | high |
| | `calibration_ready` | HR+참여자 | normal |

---

### Task 3: 알림 디스패처

```typescript
// lib/notifications/dispatcher.ts

interface NotificationEvent {
  type: string;
  recipientIds: string[];
  title: string;
  body: string;
  link?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: Record<string, any>;
  companyId?: string;
}

async function dispatchNotification(event: NotificationEvent) {
  for (const recipientId of event.recipientIds) {
    // 1. 수신자 알림 설정 확인
    const prefs = await getNotificationPreferences(recipientId);
    const eventPref = prefs.preferences[event.type] ?? { in_app: true, email: false, teams: false };
    
    // 2. 방해금지 시간 체크
    if (isQuietHours(prefs) && event.priority !== 'urgent') {
      await queueNotification(event, recipientId);
      continue;
    }
    
    // 3. 중복 알림 방지 (동일 type + recipient, 5분 이내)
    const recent = await prisma.notification.findFirst({
      where: {
        recipientId,
        type: event.type,
        createdAt: { gte: subMinutes(new Date(), 5) }
      }
    });
    if (recent) continue;
    
    const channels: string[] = [];
    
    // 4. 인앱 알림 (항상)
    if (eventPref.in_app !== false) {
      await prisma.notification.create({
        data: {
          recipientId,
          type: event.type,
          title: event.title,
          body: event.body,
          link: event.link,
          priority: event.priority || 'normal',
          metadata: event.metadata,
          channels: ['in_app'],
        }
      });
      channels.push('in_app');
      
      // Supabase Realtime 즉시 푸시
      await supabase.channel(`notifications:${recipientId}`)
        .send({ type: 'broadcast', event: 'new_notification', payload: { title: event.title, type: event.type } });
    }
    
    // 5. 이메일 (인터페이스만 — 실제 SMTP는 배포 시)
    if (eventPref.email) {
      await sendEmailNotification(recipientId, event);
      channels.push('email');
    }
    
    // 6. Teams
    if (eventPref.teams && event.companyId) {
      await sendTeamsNotification(event);
      channels.push('teams');
    }
  }
}
```

---

### Task 4: 인앱 알림 UI

> **디자인**: CLAUDE.md 토큰 + CTR_UI_PATTERNS.md 드롭다운/리스트 패턴

**알림 벨 아이콘 (헤더 상단)**:
```
┌──────────────────────────────┐
│ [로고] CTR HR Hub     🔔(3)  │  ← 미읽음 뱃지
└──────────────────────────────┘
         ↓ 클릭
┌──────────────────────────────┐
│ 알림                [모두 읽음] │
├──────────────────────────────┤
│ 🔴 김과장 이직위험 Critical    │
│    개발팀 · 방금 전            │
│                              │
│ ● 연차 승인됨 (3/15~3/16)     │
│    박팀장 승인 · 2시간 전      │
│                              │
│ ● 법정교육 마감 30일 전       │
│    산업안전보건교육 · 어제      │
│                              │
│ ○ 급여명세서 발급 (3월분)      │
│    3일 전                     │
│                              │
│ [전체 알림 보기]               │
└──────────────────────────────┘
```

**미읽음 뱃지**: Supabase Realtime으로 실시간 업데이트. Realtime 불가 시 폴링(10초) fallback.
**전체 알림 페이지** (`/notifications`): 전체 목록 + 필터 (유형별, 읽음/미읽음)

---

### Task 5: 알림 설정 UI

> **경로**: `/my/settings/notifications`

```
┌─────────────────────────────────────────────────┐
│ 알림 설정                                        │
├─────────────────────────────────────────────────┤
│                      인앱   이메일  Teams         │
│ 근태/휴가                                        │
│ ├── 휴가 승인/반려   ☑     ☑      ☐            │
│ ├── 52시간 경고      ☑     ☑      ☑            │
│ └── 연차 소멸 임박   ☑     ☑      ☐            │
│                                                 │
│ 급여                                             │
│ ├── 급여명세서 발급   ☑     ☑      ☐            │
│ └── 연말정산 마감     ☑     ☑      ☐            │
│                                                 │
│ 교육                                             │
│ ├── 필수교육 마감     ☑     ☑      ☐            │
│ └── 수료증 만료       ☑     ☐      ☐            │
│                                                 │
│ 방해금지 시간:                                    │
│ [22:00] ~ [08:00] (urgent 제외)                  │
│                                                 │
│ [저장]                                           │
└─────────────────────────────────────────────────┘
```

---

## Part 2: i18n (국제화)

### Task 6: i18n 프레임워크 구축

**next-intl** 사용 (Next.js App Router 호환).

```
지원 언어:
ko: 한국어 (CTR-KR) — 기본
en: 영어 (CTR-US, 글로벌 기본)
zh: 중국어 간체 (CTR-CN)
ru: 러시아어 (CTR-RU)
vi: 베트남어 (CTR-VN)
es: 스페인어 (CTR-MX)
```

**이번 세션 범위**:
- ✅ i18n 프레임워크 설정 (`next-intl` 설치 + 설정)
- ✅ 공통 UI 문자열 번역 (메뉴, 버튼, 상태 라벨)
- ✅ 한국어 + 영어 완전 지원
- ✅ 중국어/러시아어/베트남어/스페인어 구조만 (키만 생성, 번역은 추후)
- ❌ 모든 페이지의 모든 문자열 번역 (추후 점진적)

**디렉토리 구조**:
```
messages/
├── ko.json      // 한국어 (완전)
├── en.json      // 영어 (완전)
├── zh.json      // 중국어 (공통 키만)
├── ru.json      // 러시아어 (공통 키만)
├── vi.json      // 베트남어 (공통 키만)
└── es.json      // 스페인어 (공통 키만)
```

**번역 키 구조**:
```json
{
  "common": {
    "save": "저장",
    "cancel": "취소",
    "confirm": "확인",
    "delete": "삭제",
    "edit": "편집",
    "search": "검색",
    "filter": "필터",
    "loading": "불러오는 중...",
    "noData": "데이터가 없습니다",
    "status": {
      "active": "활성",
      "inactive": "비활성",
      "pending": "대기",
      "approved": "승인",
      "rejected": "반려",
      "completed": "완료"
    }
  },
  "nav": {
    "dashboard": "대시보드",
    "organization": "조직",
    "recruitment": "채용",
    "employees": "직원",
    "attendance": "근태",
    "leave": "휴가",
    "payroll": "급여",
    "performance": "성과",
    "training": "교육",
    "benefits": "복리후생",
    "analytics": "분석",
    "settings": "설정",
    "my": "나의 공간"
  },
  "notifications": {
    "title": "알림",
    "markAllRead": "모두 읽음",
    "viewAll": "전체 알림 보기",
    "empty": "새로운 알림이 없습니다",
    "types": {
      "leave_approved": "휴가가 승인되었습니다",
      "leave_rejected": "휴가가 반려되었습니다",
      "overtime_warning": "주간 근무시간 {hours}시간 도달",
      "payslip_issued": "{month}월 급여명세서가 발급되었습니다",
      "training_due": "{courseName} 이수 마감 {daysLeft}일 전"
    }
  }
}
```

**사용자 언어 결정 순서**:
```
1. 사용자 설정 (profile.preferredLanguage)
2. 법인 기본 언어 (B1 company.defaultLanguage)
3. 브라우저 언어
4. 기본값: 'ko'
```

**통화 + 날짜 포맷**:
```typescript
// lib/i18n/formatters.ts
const formatCurrency = (amount: number, currency: string, locale: string) => {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
};

const formatDate = (date: Date, locale: string, style: 'short' | 'long' = 'short') => {
  return new Intl.DateTimeFormat(locale, { dateStyle: style }).format(date);
};

// formatCurrency(4000000, 'KRW', 'ko-KR')  → ₩4,000,000
// formatCurrency(8500, 'USD', 'en-US')      → $8,500.00
```

**next-intl 라우트 전략**: 기존 라우트 구조 유지, 언어는 **쿠키/헤더**로 결정 (URL 변경 없음).

---

## Part 3: Microsoft Teams 연동

### Task 7: Teams Incoming Webhook

```typescript
// lib/notifications/teams.ts

async function sendTeamsNotification(event: NotificationEvent) {
  const webhooks = await prisma.teamsWebhookConfig.findMany({
    where: {
      companyId: event.companyId,
      isActive: true,
      eventTypes: { has: event.type }
    }
  });
  
  for (const webhook of webhooks) {
    const card = buildAdaptiveCard(event);
    
    await fetch(webhook.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'message',
        attachments: [{
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: card
        }]
      })
    });
  }
}

function buildAdaptiveCard(event: NotificationEvent) {
  const priorityColor = {
    urgent: 'attention',
    high: 'warning',
    normal: 'default',
    low: 'light'
  }[event.priority || 'normal'];
  
  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: `🔔 ${event.title}`,
        weight: 'bolder',
        size: 'medium',
        color: priorityColor
      },
      {
        type: 'TextBlock',
        text: event.body,
        wrap: true
      }
    ],
    actions: event.link ? [
      {
        type: 'Action.OpenUrl',
        title: 'HR Hub에서 확인',
        url: `${process.env.NEXT_PUBLIC_APP_URL}${event.link}`
      }
    ] : []
  };
}
```

**Teams Webhook 설정 UI** (`/settings/integrations`):
```
┌─────────────────────────────────────────────────┐
│ 외부 연동 설정                  [법인: CTR-KR ▼]  │
├─────────────────────────────────────────────────┤
│ Microsoft Teams                                 │
│                                                 │
│ HR-알림 채널                                     │
│ Webhook URL: [https://outlook.office.com/w...] │
│ 전송 이벤트:                                     │
│ ☑ 52시간 경고/차단                               │
│ ☑ 이직위험 Critical                              │
│ ☑ 채용 합격/입사                                 │
│ ☑ 조직 개편 적용                                 │
│ ☐ 휴가 승인/반려                                 │
│ ☐ 급여명세서 발급                                │
│ [테스트 전송]  [저장]                             │
│                                                 │
│ [+ 채널 추가]                                    │
└─────────────────────────────────────────────────┘
```

---

### Task 8: 알림 이벤트 연결

> 리뷰+FIX로 코드가 정리된 상태이므로, 기존 프롬프트보다 연결 범위를 넓힙니다.

**이번 세션에서 실제 연결할 이벤트**:

| 우선순위 | 이벤트 | 연결 위치 |
|---------|--------|----------|
| 필수 | `leave_approved` / `leave_rejected` | B6-2 휴가 승인 API |
| 필수 | `overtime_warning_48h` / `overtime_blocked_52h` | B6-1 근무시간 체크 |
| 필수 | `payslip_issued` | B7-1a 급여명세서 발급 |
| 필수 | `turnover_risk_critical` | B10-1 배치 계산 |
| 권장 | `benefit_approved` | B9-2 복리후생 승인 |
| 권장 | `onboarding_task_overdue` | B5 온보딩 체크인 |
| 권장 | `evaluation_deadline` | B3 평가 마감 |

**나머지 미연결 이벤트는 context/SHARED.md에 연결 포인트 기록**:
```
// 각 이벤트별로 연결해야 할 파일 경로 + 함수명 기록
// 예: B4 requisition_approved → src/app/api/v1/recruitment/requisitions/[id]/approve/route.ts
```

---

### Task 9: 시드 + 빌드 검증

```bash
# 1. 인앱 알림
#    - 알림 벨 아이콘 미읽음 뱃지
#    - 드롭다운 알림 목록
#    - 클릭 → 해당 페이지 이동
#    - "모두 읽음" 동작
#    - Supabase Realtime 실시간 (불가 시 폴링 fallback)

# 2. 알림 설정
#    - 이벤트별 채널 on/off
#    - 방해금지 시간 설정

# 3. Teams 연동
#    - Webhook URL 설정 + 테스트 전송
#    - Adaptive Card 렌더링

# 4. i18n
#    - 한국어 ↔ 영어 전환
#    - 메뉴, 버튼, 상태 라벨 번역
#    - 통화/날짜 포맷 (KRW vs USD)

# 5. 이벤트 연결 동작 (최소 필수 4개)
#    - 휴가 승인 → 인앱 알림 생성
#    - 52시간 경고 → 인앱 + Teams
#    - 급여명세서 → 인앱 알림 생성
#    - 이직위험 Critical → HR+부서장 알림

# 6. 중복 알림 방지 (5분 debounce)

# 7. 빌드 검증
npx tsc --noEmit      # TypeScript 0 errors
npm run build         # Next.js 빌드 성공

# 8. context/SHARED.md 업데이트
```

---

## 검증 체크리스트

- [ ] Prisma 모델 3개 (Notification, NotificationPreference, TeamsWebhookConfig)
- [ ] 마이그레이션명: `notification_system`
- [ ] 알림 디스패처 (인앱 + 이메일 인터페이스 + Teams 3채널)
- [ ] 중복 알림 방지 debounce (5분)
- [ ] 인앱 알림 UI (벨 아이콘 + 드롭다운 + 전체 페이지)
- [ ] Supabase Realtime 실시간 푸시 (또는 폴링 fallback)
- [ ] 알림 설정 UI (`/my/settings/notifications`)
- [ ] Teams Incoming Webhook + Adaptive Card
- [ ] Teams 설정 UI (`/settings/integrations`) + Webhook URL 마스킹
- [ ] i18n 프레임워크 (next-intl + ko/en 완전 + 4언어 구조)
- [ ] 통화/날짜 포맷 유틸리티
- [ ] 언어 결정 순서: 사용자 설정 → 법인 기본 → 브라우저 → 'ko'
- [ ] 필수 이벤트 4개 실제 연결
- [ ] 권장 이벤트 3개 연결 (가능한 범위)
- [ ] 미연결 이벤트 전체 목록 + 연결 위치 context/SHARED.md에 기록
- [ ] CLAUDE.md 디자인 토큰 준수
- [ ] CTR_UI_PATTERNS.md 인터랙션 패턴 준수
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` 성공
- [ ] `context/SHARED.md` 업데이트 완료

---

## context/SHARED.md 업데이트 내용 (세션 종료 시)

```markdown
## B11 완료 (날짜)

### DB 테이블
- notifications, notification_preferences, teams_webhook_configs
- 마이그레이션: notification_system

### 핵심 함수
- dispatchNotification() — 이벤트 기반 알림 디스패치 (debounce 포함)
- sendTeamsNotification() — Teams Adaptive Card 전송
- buildAdaptiveCard() — 이벤트 → Adaptive Card 변환

### i18n
- next-intl 설정 완료 (쿠키/헤더 기반, URL 변경 없음)
- messages/ko.json, en.json (완전), zh/ru/vi/es (구조만)
- formatCurrency(), formatDate() 유틸리티

### 알림 연결 상태
✅ 연결 완료:
- leave_approved, leave_rejected (B6-2)
- overtime_warning_48h, overtime_blocked_52h (B6-1)
- payslip_issued (B7-1a)
- turnover_risk_critical (B10-1)
- (권장 이벤트 연결 결과)

⬜ 미연결 (연결 위치 기록됨 — 점진적 적용):
- B4: requisition_approved → (파일 경로)
- B5: onboarding_task_overdue → (파일 경로)
- ... (전체 목록 + 파일 경로)

### Phase B 전체 완료 🎉
```

---

## 주의사항

1. **이메일 전송은 인터페이스만** — Resend/SendGrid/AWS SES 등 실제 SMTP는 배포 시 구성. 환경변수 `SMTP_HOST`, `SMTP_API_KEY` 등.

2. **알림 폭탄 방지** — 동일 type + recipientId에 대해 **5분 이내 중복 방지** debounce 필수.

3. **Teams Webhook URL 보안** — Admin UI에서 마스킹 표시. DB 암호화 또는 환경변수 관리 권장.

4. **i18n은 점진적** — 공통 UI(메뉴, 버튼, 상태)만 번역. 모듈별 문자열은 추후 점진적 추가.

5. **next-intl 라우트** — 기존 라우트 유지, 언어는 **쿠키/헤더** 결정. `[locale]` 세그먼트 추가 불필요.

6. **Supabase Realtime fallback** — Realtime Broadcast 불가 시 **폴링(10초)** 구현.

7. **리뷰에서 변경된 코드 확인** — FIX 단계에서 API 구조, 컴포넌트 등이 변경되었을 수 있습니다. 리뷰 보고서와 SHARED.md를 반드시 확인한 뒤 알림 연결 위치를 결정하세요.
