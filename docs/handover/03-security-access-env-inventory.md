# 환경 변수 인벤토리

> **자동 생성**: `npx tsx scripts/handover/extract-env-inventory.ts`
> **생성일**: 2026-05-12
> **원본**: `.env.example` + `src/**/*.ts(x)` 내 `process.env.*` 참조
> ⚠️ 본 문서는 수동 편집 금지. `.env.example` 또는 코드 변경 시 스크립트 재실행.
> 본 문서는 `docs/handover/03-security-access.md` 의 일부로 import 됩니다.

---

## 요약

| 분류 | 개수 |
|------|------|
| 전체 환경 변수 | 49 |
| `.env.example` 등록 | 37 |
| 코드에서 실제 사용 중 | 23 |
| .env.example에 있으나 코드 미사용 (cleanup 후보) | 26 |
| 코드에서 사용하나 .env.example 누락 (⚠️ 신규 추가 필요) | 12 |
| **클라이언트 노출** (`NEXT_PUBLIC_*`) | 3 |

---

## ⚠️ 즉시 조치 필요

### .env.example 누락 (코드에서 사용 중)

다음 변수들은 코드에서 참조되지만 `.env.example` 에 문서화되지 않았습니다. **인계 전 .env.example 에 추가 필수**:

| 변수명 | 사용 위치 | 사용 횟수 |
|--------|----------|----------|
| `HOME_PREVIEW` | `src/lib/home-preview/guard.ts` | 1 |
| `NEXT_PHASE` | `src/lib/env.ts` | 1 |
| `NEXT_PUBLIC_SHOW_TEST_ACCOUNTS` | `src/app/(auth)/login/LoginPageContent.tsx` | 1 |
| `NEXT_PUBLIC_TEST_MODE` | `src/components/ui/MotionConfig.tsx` | 1 |
| `NEXT_RUNTIME` | `src/instrumentation.ts` | 1 |
| `NODE_ENV` | `src/middleware.ts`, `src/lib/prisma.ts`, `src/lib/observability/query-counter-extension.ts` | 8 |
| `PRISMA_LOG_QUERIES` | `src/lib/observability/query-counter-extension.ts` | 1 |
| `PRISMA_QUERY_DEBUG` | `src/app/(dashboard)/layout.tsx`, `src/lib/permissions.ts`, `src/lib/observability/query-counter-extension.ts` | 3 |
| `SLOW_QUERY_MS` | `src/lib/observability/query-counter-extension.ts` | 1 |
| `SLOW_QUERY_SAMPLE_RATE` | `src/lib/observability/query-counter-extension.ts` | 1 |
| `VERCEL_ENV` | `src/lib/home-preview/guard.ts` | 1 |
| `VERCEL_URL` | `src/lib/env.ts` | 2 |

### 미사용 변수 (cleanup 후보)

`.env.example` 에 있지만 `src/` 어디서도 참조하지 않는 변수들. **삭제 검토 또는 사용처 추적**:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AZURE_AD_CLIENT_ID`
- `AZURE_AD_CLIENT_SECRET`
- `AZURE_AD_TENANT_ID`
- `EMBEDDING_PROVIDER`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_SENTRY_DSN`
- `PLAYWRIGHT_BASE_URL`
- `REDIS_URL`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_DSN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SES_FROM_EMAIL`
- `TEAMS_APP_ID`
- `TEAMS_BOT_ID`
- `TEAMS_BOT_PASSWORD`
- `TEAMS_WEBHOOK_SECRET`
- `TERMINAL_API_SECRET`
- `TERMINAL_HEARTBEAT_INTERVAL`
- `VAPID_PRIVATE_KEY`
- `VAPID_PUBLIC_KEY`
- `WEB_PUSH_EMAIL`

---

## 카테고리별 환경 변수

### AI (Anthropic + OpenAI) (3개)

| 변수명 | 필수 | env.example | 코드 사용 | 클라이언트 노출 |
|--------|:----:|:-----------:|:---------:|:---------------:|
| `ANTHROPIC_API_KEY` | ⬜ | ✅ | ✅ (2) | 🔒 서버 |
| `EMBEDDING_PROVIDER` | ❓ | ✅ | ❌ | 🔒 서버 |
| `OPENAI_API_KEY` | ⬜ | ✅ | ✅ (1) | 🔒 서버 |

### AWS (S3 + SES) (5개)

| 변수명 | 필수 | env.example | 코드 사용 | 클라이언트 노출 |
|--------|:----:|:-----------:|:---------:|:---------------:|
| `AWS_ACCESS_KEY_ID` | ❓ | ✅ | ❌ | 🔒 서버 |
| `AWS_REGION` | ❓ | ✅ | ✅ (1) | 🔒 서버 |
| `AWS_SECRET_ACCESS_KEY` | ❓ | ✅ | ❌ | 🔒 서버 |
| `S3_BUCKET` | ❓ | ✅ | ✅ (1) | 🔒 서버 |
| `SES_FROM_EMAIL` | ❓ | ✅ | ❌ | 🔒 서버 |

### 인증 (NextAuth + Azure AD) (5개)

| 변수명 | 필수 | env.example | 코드 사용 | 클라이언트 노출 |
|--------|:----:|:-----------:|:---------:|:---------------:|
| `AZURE_AD_CLIENT_ID` | ✅ | ✅ | ❌ | 🔒 서버 |
| `AZURE_AD_CLIENT_SECRET` | ✅ | ✅ | ❌ | 🔒 서버 |
| `AZURE_AD_TENANT_ID` | ✅ | ✅ | ❌ | 🔒 서버 |
| `NEXTAUTH_SECRET` | ✅ | ✅ | ✅ (2) | 🔒 서버 |
| `NEXTAUTH_URL` | ✅ | ✅ | ✅ (2) | 🔒 서버 |

### Cron 인증 (1개)

| 변수명 | 필수 | env.example | 코드 사용 | 클라이언트 노출 |
|--------|:----:|:-----------:|:---------:|:---------------:|
| `CRON_SECRET` | ✅ | ✅ | ✅ (1) | 🔒 서버 |

### 기타 (9개)

| 변수명 | 필수 | env.example | 코드 사용 | 클라이언트 노출 |
|--------|:----:|:-----------:|:---------:|:---------------:|
| `CSP_STRICT_MODE` | ❓ | ✅ | ✅ (1) | 🔒 서버 |
| `HOME_PREVIEW` | ❓ | ❌ | ✅ (1) | 🔒 서버 |
| `NEXT_PHASE` | ❓ | ❌ | ✅ (1) | 🔒 서버 |
| `NEXT_RUNTIME` | ❓ | ❌ | ✅ (1) | 🔒 서버 |
| `PLAYWRIGHT_BASE_URL` | ❓ | ✅ | ❌ | 🔒 서버 |
| `PRISMA_LOG_QUERIES` | ❓ | ❌ | ✅ (1) | 🔒 서버 |
| `PRISMA_QUERY_DEBUG` | ❓ | ❌ | ✅ (3) | 🔒 서버 |
| `SLOW_QUERY_MS` | ❓ | ❌ | ✅ (1) | 🔒 서버 |
| `SLOW_QUERY_SAMPLE_RATE` | ❓ | ❌ | ✅ (1) | 🔒 서버 |

### 데이터베이스 (Supabase) (2개)

| 변수명 | 필수 | env.example | 코드 사용 | 클라이언트 노출 |
|--------|:----:|:-----------:|:---------:|:---------------:|
| `DATABASE_POOL_SIZE` | ❓ | ✅ | ✅ (1) | 🔒 서버 |
| `DATABASE_URL` | ✅ | ✅ | ✅ (4) | 🔒 서버 |

### 푸시 알림 (Firebase) (3개)

| 변수명 | 필수 | env.example | 코드 사용 | 클라이언트 노출 |
|--------|:----:|:-----------:|:---------:|:---------------:|
| `FIREBASE_CLIENT_EMAIL` | ❓ | ✅ | ❌ | 🔒 서버 |
| `FIREBASE_PRIVATE_KEY` | ❓ | ✅ | ❌ | 🔒 서버 |
| `FIREBASE_PROJECT_ID` | ❓ | ✅ | ❌ | 🔒 서버 |

### 모니터링 (Sentry) (6개)

| 변수명 | 필수 | env.example | 코드 사용 | 클라이언트 노출 |
|--------|:----:|:-----------:|:---------:|:---------------:|
| `NEXT_PUBLIC_SENTRY_DSN` | ❓ | ✅ | ❌ | 🌐 노출 |
| `SENTRY_AUTH_TOKEN` | ❓ | ✅ | ❌ | 🔒 서버 |
| `SENTRY_CSP_REPORT_URI` | ❓ | ✅ | ✅ (1) | 🔒 서버 |
| `SENTRY_DSN` | ❓ | ✅ | ❌ | 🔒 서버 |
| `SENTRY_ORG` | ❓ | ✅ | ❌ | 🔒 서버 |
| `SENTRY_PROJECT` | ❓ | ✅ | ❌ | 🔒 서버 |

### 클라이언트 노출 (NEXT_PUBLIC_*) (2개)

| 변수명 | 필수 | env.example | 코드 사용 | 클라이언트 노출 |
|--------|:----:|:-----------:|:---------:|:---------------:|
| `NEXT_PUBLIC_SHOW_TEST_ACCOUNTS` | ❓ | ❌ | ✅ (1) | 🌐 노출 |
| `NEXT_PUBLIC_TEST_MODE` | ❓ | ❌ | ✅ (1) | 🌐 노출 |

### Vercel 플랫폼 (3개)

| 변수명 | 필수 | env.example | 코드 사용 | 클라이언트 노출 |
|--------|:----:|:-----------:|:---------:|:---------------:|
| `NODE_ENV` | ❓ | ❌ | ✅ (8) | 🔒 서버 |
| `VERCEL_ENV` | ❓ | ❌ | ✅ (1) | 🔒 서버 |
| `VERCEL_URL` | ❓ | ❌ | ✅ (2) | 🔒 서버 |

### 캐시 (Redis / Upstash) (1개)

| 변수명 | 필수 | env.example | 코드 사용 | 클라이언트 노출 |
|--------|:----:|:-----------:|:---------:|:---------------:|
| `REDIS_URL` | ⬜ | ✅ | ❌ | 🔒 서버 |

### Teams 알림 (4개)

| 변수명 | 필수 | env.example | 코드 사용 | 클라이언트 노출 |
|--------|:----:|:-----------:|:---------:|:---------------:|
| `TEAMS_APP_ID` | ❓ | ✅ | ❌ | 🔒 서버 |
| `TEAMS_BOT_ID` | ❓ | ✅ | ❌ | 🔒 서버 |
| `TEAMS_BOT_PASSWORD` | ❓ | ✅ | ❌ | 🔒 서버 |
| `TEAMS_WEBHOOK_SECRET` | ❓ | ✅ | ❌ | 🔒 서버 |

### 출퇴근 단말기 (2개)

| 변수명 | 필수 | env.example | 코드 사용 | 클라이언트 노출 |
|--------|:----:|:-----------:|:---------:|:---------------:|
| `TERMINAL_API_SECRET` | ❓ | ✅ | ❌ | 🔒 서버 |
| `TERMINAL_HEARTBEAT_INTERVAL` | ❓ | ✅ | ❌ | 🔒 서버 |

### 웹 푸시 (VAPID) (3개)

| 변수명 | 필수 | env.example | 코드 사용 | 클라이언트 노출 |
|--------|:----:|:-----------:|:---------:|:---------------:|
| `VAPID_PRIVATE_KEY` | ❓ | ✅ | ❌ | 🔒 서버 |
| `VAPID_PUBLIC_KEY` | ❓ | ✅ | ❌ | 🔒 서버 |
| `WEB_PUSH_EMAIL` | ❓ | ✅ | ❌ | 🔒 서버 |

---

## 시크릿 회수·교체 SOP

인계 시점에 **반드시** 회전해야 하는 시크릿 (CEO 개인 계정 의존):

| 변수 | 회수 절차 | 교체 빈도 |
|------|----------|----------|
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` 재생성 → Vercel env 갱신 → 배포 → 모든 세션 invalidate | 인계 직후 |
| `AZURE_AD_CLIENT_SECRET` | Azure Portal → 앱 등록 → 새 client secret 생성 → 이전 만료 | 인계 직후 + 6개월마다 |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM 사용자 새 키 발급 → Vercel 갱신 → 이전 키 삭제 | 인계 직후 + 6개월마다 |
| `ANTHROPIC_API_KEY` | Anthropic console → 새 키 발급 → 이전 키 revoke | 인계 직후 |
| `OPENAI_API_KEY` | OpenAI console → 새 키 발급 → 이전 키 revoke | 인계 직후 |
| `CRON_SECRET` | `openssl rand -base64 32` → Vercel env 갱신 → 배포 | 인계 직후 + 6개월마다 |
| `FIREBASE_PRIVATE_KEY` | Firebase console → 서비스 계정 새 키 발급 → 이전 키 삭제 | 인계 직후 |
| `TEAMS_BOT_PASSWORD` / `TEAMS_WEBHOOK_SECRET` | Azure AD bot 새 password → Vercel 갱신 | 인계 직후 |
| `VAPID_PRIVATE_KEY` | `web-push generate-vapid-keys` → 클라이언트에 새 public 키 배포 | 변경 시 모든 구독자 재구독 필요 — 신중 |

## 환경 변수 수정 절차 (Session 212 패턴)

```bash
# 1. 추가
vercel env add VAR_NAME production

# 2. 확인
vercel env ls

# 3. 회수
vercel env rm VAR_NAME production

# 4. 로컬 .env 동기화
vercel env pull .env.local

# 5. 변경 후 재배포
vercel redeploy <deployment-id> --prod
```

⚠️ `vercel env add/rm`은 preview/development 환경에도 함께 영향 줄 수 있음 — environment 명시 필수.

---

_본 문서 끝._
