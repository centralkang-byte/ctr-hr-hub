# 09. 알림 채널 운영

> **대상**: 인프라팀
> **작성 상태**: 🟡 **CEO 작성 필요** — 시스템에 설정된 외부 채널의 실제 ID·webhook URL·sender 이메일 등은 CEO만 알고 있음. 본 문서는 골격만 제공.

## 채널 인벤토리 (CEO 채우기)

CTR HR Hub에서 외부 알림을 발송하는 채널 3종 + 인앱:

| 채널 | 용도 | 식별자 (CEO 작성) | 책임자 (인계 후) |
|------|------|-------------------|-----------------|
| **AWS SES** | 사용자 이메일 (휴가 알림, 보상 레터 등) | `SES_FROM_EMAIL` = `<TODO: hr-noreply@ctr.co.kr 또는 실제 sender>` | 인프라팀 (AWS 계정 owner) |
| **Microsoft Teams** | HR/매니저 결재 알림 | Teams App ID = `<TODO: AZURE_AD에 등록된 봇>`, Webhook = `<TODO>` | 인프라팀 + Azure AD admin |
| **Web Push (VAPID)** | 직원 브라우저 푸시 | VAPID public key = (클라이언트에 배포된 공개키) | 인프라팀 |
| **In-app 알림 센터** | `/notifications` 페이지 | (DB `Notification` 테이블) | 개발팀 |

## TODO: CEO 작성 항목

### 1. AWS SES sender 이메일

- [ ] 현재 `SES_FROM_EMAIL` 값:
- [ ] 어떤 도메인에서 발송? (DKIM/SPF 등록 도메인)
- [ ] AWS SES Sandbox vs Production 상태:
- [ ] 발송 한도 (rate limit, daily quota):
- [ ] AWS 계정 owner (인계 시 이양 대상):

### 2. Microsoft Teams 봇

- [ ] Teams App ID:
- [ ] Bot framework registration:
- [ ] `TEAMS_BOT_ID`, `TEAMS_BOT_PASSWORD`, `TEAMS_WEBHOOK_SECRET` 변수 값 어떻게 발급:
- [ ] 어떤 Teams 채널·DM에 알림 발송:
- [ ] 운영 관리자 (Azure AD admin):

### 3. Firebase 푸시 (모바일 alts?)

- [ ] `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` 어디서 사용:
- [ ] 현재 활성화 상태 (mobile app 있나 vs deprecated):

### 4. Web Push (VAPID)

- [ ] `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `WEB_PUSH_EMAIL` 생성 시점·방법:
- [ ] 클라이언트 구독 수 (대략):
- [ ] 키 교체 시 모든 구독자 재구독 필요 — 정책:

## 알림 발송 코드 진입점

코드 위치 (개발팀 reference):
- `src/lib/email.ts` — AWS SES 클라이언트 + 템플릿 발송
- `src/lib/notifications/` (또는 동등 디렉토리) — 알림 생성·전달
- Teams 알림: `src/lib/teams.ts` 또는 `src/lib/notifications/teams.ts` 확인 필요
- Web push: `src/lib/push.ts` 또는 동등 파일

## 알림 운영 가이드 (CEO 채우기)

### 일별 발송량 (현재 추정)

- [ ] 일별 평균 SES 발송:
- [ ] 일별 Teams 메시지:
- [ ] 일별 web push:

### 알림 silent fail 사례 (과거 경험)

- [ ] 사례 1 (Session XX): nudge cron 작동 안 함 (Session 208 `Role.name` silent-fail fix)
- [ ] 사례 2:
- [ ] 사례 3:

### 알림 누락 시 디버깅

```bash
# 1. 알림 발송 로그 (있다면)
# DB: NotificationLog 테이블 또는 ActivityLog

# 2. Vercel Logs 에서 알림 발송 라우트 호출 확인
vercel logs --follow

# 3. AWS SES 발송 통계
# AWS Console → SES → Sending statistics

# 4. Sentry에서 알림 관련 에러
# 카테고리: notifications / email
```

## 알림 silent fail 알려진 위험

- **`Role.name` 매칭 silent-fail** (Session 207-208): 코드가 `role.name='X'` 매칭하지만 시드는 display name 'X Name'으로 발급된 경우 항상 0 row → 알림 0건. Session 207-209에서 4 사이트 fix. 향후 동일 패턴 도입 금지.
- **`EmployeeRole.endDate=null` 누락**: 만료된 role row가 알림 대상에 포함될 수 있음 (Session 209 fix).
- **Cron 미등록**: [11-cron-manual-trigger.md](11-cron-manual-trigger.md) 참조. 5개 cron이 등록 전까지 알림 silent.

## 관련 문서

- [11-cron-manual-trigger.md](11-cron-manual-trigger.md) — cron 미동작 영향
- [10-incident-response.md](10-incident-response.md) — 알림 발송 실패 시 대응
- [docs/manuals/leave.md §4.4](../../manuals/leave.md) — 휴가 알림 흐름

---

**CEO 작성 완료 후**: 본 문서 상단의 🟡 마크를 🟢로 변경.
