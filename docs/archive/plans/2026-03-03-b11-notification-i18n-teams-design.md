# B11 설계 문서: 알림 시스템 강화 + i18n 보완 + Teams 연동 완성

> 작성일: 2026-03-03
> 세션: B11 (Phase B 최종)
> 전략: 기존 코드 최대 활용 + 이벤트 연결 중심

---

## 1. 현황 분석

### 기존 구현 (활용)
- `Notification` + `NotificationTrigger` Prisma 모델 존재
- `notifications.ts` — 3채널 dispatcher (fire-and-forget)
- `NotificationBell.tsx` — 헤더 벨 아이콘 컴포넌트
- `/notifications` 페이지 — 전체 알림 목록
- `adaptive-cards.ts` — 7종 Adaptive Card 빌더
- `teams-actions.ts`, `teams-bot.ts`, `teams-digest.ts`
- `next-intl` v4.8.3 설치됨
- `messages/ko.json` 3094줄 (완전), 5개 언어 파일 존재
- `/settings/teams` 페이지

### B11 추가 필요
- Notification 모델: `priority`, `metadata`, `channels[]` 필드 추가
- 신규 모델: `NotificationPreference`, `TeamsWebhookConfig`
- 디스패처: debounce(5분), quiet hours, per-user prefs, Supabase Realtime
- 이벤트 연결: 4개 필수 + 3개 권장
- UI: `/my/settings/notifications`, Teams webhook 다중 채널 UI
- i18n: 알림 타입 키 보완

---

## 2. 스키마 설계

### 기존 Notification 모델 확장 (additive migration)
```prisma
model Notification {
  // 기존 필드 유지
  id          String   @id @default(uuid())
  employeeId  String   @map("employee_id")
  triggerType String   @map("trigger_type")
  title       String
  body        String
  channel     NotificationChannel  // 기존 유지
  isRead      Boolean  @default(false)
  readAt      DateTime?
  link        String?
  createdAt   DateTime @default(now())

  // 신규 추가
  priority    String   @default("normal")  // low|normal|high|urgent
  metadata    Json?
  channels    String[] @default(["IN_APP"])  // 전송된 채널들

  // 기존 관계 유지
  employee    Employee @relation(...)
  trigger     NotificationTrigger? @relation(...)
  teamsCardActions TeamsCardAction[]
}
```

### 신규 모델 2개
```prisma
model NotificationPreference {
  id              String   @id @default(uuid())
  employeeId      String   @unique
  preferences     Json     // { "leave_approved": { in_app: true, email: false, teams: false } }
  quietHoursStart String?  // "22:00"
  quietHoursEnd   String?  // "08:00"
  timezone        String   @default("Asia/Seoul")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  employee        Employee @relation(...)
}

model TeamsWebhookConfig {
  id          String   @id @default(uuid())
  companyId   String
  channelName String
  webhookUrl  String
  eventTypes  String[] @default([])
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  company     Company  @relation(...)
}
```

---

## 3. 디스패처 강화

### 핵심 로직 (기존 `dispatchNotification()` 교체)
1. `NotificationPreference` 조회 (없으면 기본값: in_app=true)
2. 방해금지 시간 체크 (urgent는 예외)
3. 5분 debounce (동일 type+employeeId, 5분 이내 중복 방지)
4. IN_APP: `prisma.notification.create()` + Supabase Realtime broadcast
5. EMAIL: 기존 `sendEmail()` 연동
6. TEAMS: `TeamsWebhookConfig` 조회 → Adaptive Card 전송

---

## 4. 이벤트 연결 계획

### 필수 (4개)
| 이벤트 | 연결 파일 |
|-------|---------|
| `leave_approved`, `leave_rejected` | `src/app/api/v1/leave/requests/[id]/route.ts` PATCH |
| `overtime_warning_48h`, `overtime_blocked_52h` | `src/lib/attendance/workHourAlert.ts` |
| `payslip_issued` | `src/app/api/v1/payroll/runs/[id]/approve/route.ts` |
| `turnover_risk_critical` | `src/lib/analytics/predictive/turnoverRisk.ts` |

### 권장 (3개)
| 이벤트 | 연결 파일 |
|-------|---------|
| `benefit_approved` | `src/app/api/v1/benefit-claims/route.ts` |
| `onboarding_task_overdue` | 온보딩 체크 로직 |
| `evaluation_deadline` | B3 평가 API |

---

## 5. UI 컴포넌트

### 신규
- `/my/settings/notifications` — 이벤트별 채널 on/off + 방해금지 시간
- `/settings/integrations` — Teams webhook 다중 채널 설정 (기존 `/settings/teams` 강화)

### 강화
- `NotificationBell.tsx` — priority 색상 뱃지 추가
- `/notifications` — 필터(유형/읽음), priority 정렬

---

## 6. i18n

- `messages/ko.json`, `en.json` — notification.types.* 키 추가
- 기존 4개 언어 파일 — 구조만 추가 (번역 값 추후)

---

## 7. 마이그레이션

- 이름: `notification_system`
- 타입: additive (기존 필드 변경 없음, 신규 필드/모델만 추가)
- 위험도: 낮음
