# 벤더·계약 인벤토리

> **대상**: 인프라팀 + CFO
> **작성 상태**: 🟡 **부분 자동 + CEO 채우기 필요** — 사용 중인 외부 서비스는 코드에서 자동 식별, 결제·계약·연락처는 CEO 직접 작성.
> **자동 식별 기준**: `package.json` dependencies + `.env.example` 변수

---

## 자동 식별된 외부 서비스

`src/lib/*` 진입점 + dependency 패키지 + env 변수 기준 자동 인벤토리:

| 서비스 | 카테고리 | 코드 진입점 | 관련 env | 결제 (TODO) | 연락처 (TODO) |
|--------|---------|------------|---------|-------------|--------------|
| **Vercel** | 호스팅 + Edge + CDN + Analytics | (Vercel 자동) | (Vercel 자동) | 월 $XX/팀 | support@vercel.com |
| **Supabase** | PostgreSQL + Auth(미사용) + Storage(미사용) + pgvector | (DATABASE_URL) | `DATABASE_URL`, `DIRECT_URL`, `DATABASE_POOL_SIZE` | | support@supabase.io |
| **Microsoft Entra ID (Azure AD)** | OAuth SSO | `src/lib/auth.ts` (NextAuth provider) | `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID` | CTR Microsoft 365 라이선스 일부 | Microsoft 365 계정 관리자 |
| **AWS S3** | 파일 스토리지 (직원 문서, 보상 레터 PDF 등) | `src/lib/s3.ts` (`@aws-sdk/client-s3`) | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET` | 사용량 기반 | AWS Support |
| **AWS SES** | 이메일 발송 (휴가/결재/보상 알림) | `src/lib/email.ts` (`@aws-sdk/client-ses`) | `SES_FROM_EMAIL` + AWS 공통 | 사용량 기반 ($0.10/1000 emails) | AWS Support |
| **Anthropic** | AI 평가 초안 + AI 리포트 + 챗봇 | `src/lib/claude.ts` (`@anthropic-ai/sdk`) | `ANTHROPIC_API_KEY` | 사용량 기반 | support@anthropic.com |
| **OpenAI** | 문서 embedding (pgvector 검색용) | (embedding lib 또는 lib/openai.ts) | `OPENAI_API_KEY`, `EMBEDDING_PROVIDER` | 사용량 기반 | help@openai.com |
| **Sentry** | 런타임 에러 + 트랜잭션 + INP 모니터링 | `sentry.client.config.ts`, `sentry.server.config.ts` (`@sentry/nextjs`) | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` (CI) | 월 정액 | support@sentry.io |
| **Redis** (ioredis) | 캐시 (회사 정보, 권한, SWR) | `src/lib/redis.ts` 또는 동등 | `REDIS_URL` | 사용량 기반 (Upstash 등) | 공급자에 따름 |
| **Firebase** | 푸시 알림 (모바일 — 미사용일 가능) | (사용처 확인 필요) | `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` | 무료 ~ Spark 한도 | Firebase support |
| **Microsoft Teams (Bot Framework)** | Teams 채팅 알림 | (lib/teams 또는 src/lib/notifications/teams.ts) | `TEAMS_BOT_ID`, `TEAMS_BOT_PASSWORD`, `TEAMS_APP_ID`, `TEAMS_WEBHOOK_SECRET` | CTR Microsoft 365 라이선스 일부 | Microsoft 365 계정 관리자 |
| **Web Push (VAPID)** | 브라우저 푸시 (자체 발급, 외부 서비스 X) | `src/lib/push.ts` 또는 동등 (`web-push` 패키지) | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `WEB_PUSH_EMAIL` | 무료 | — |
| **GitHub** | 코드 호스팅 + Actions CI | (GitHub repo) | `GITHUB_TOKEN` (Actions) | 월 정액 (Pro+) | support@github.com |

---

## TODO: CEO 채우기 항목

각 서비스마다 다음을 채워야 핸드오버 완료:

### Vercel
- [ ] 현재 플랜: Hobby / Pro / Enterprise
- [ ] 월 비용: $
- [ ] 계약 시작·종료일:
- [ ] 청구 카드: <CEO 개인 카드 / CTR 법인 카드>
- [ ] 사용량 한도: bandwidth, builds, functions
- [ ] 한도 도달 시 알람 설정 여부:
- [ ] account manager / 연락처:

### Supabase
- [ ] 현재 플랜: Free / Pro / Team / Enterprise
- [ ] 월 비용: $
- [ ] DB size 한도:
- [ ] 백업 정책 (PITR 며칠?):
- [ ] 청구 카드:
- [ ] account manager:

### Azure AD (Microsoft 365)
- [ ] CTR 그룹 Microsoft 365 테넌트 ID:
- [ ] App registration 이름 + ID:
- [ ] 라이선스 (Business Premium / E3 / E5?):
- [ ] 청구: CTR Microsoft 365 통합 청구 vs 별도?

### AWS (S3 + SES)
- [ ] AWS 계정 ID (12자리):
- [ ] 청구 카드:
- [ ] 월 평균 비용:
- [ ] SES Production 모드 여부 (Sandbox는 발송 제한):
- [ ] S3 bucket 이름들:
- [ ] S3 versioning + lifecycle 정책:
- [ ] AWS support plan (Basic / Developer / Business):

### Anthropic
- [ ] organization 이름:
- [ ] 청구 카드:
- [ ] 월 사용량 (tokens / $):
- [ ] usage limit 설정 여부:
- [ ] 어떤 모델 사용 (Claude Opus 4.7 / Sonnet 4.6 / Haiku 4.5):

### OpenAI
- [ ] organization 이름:
- [ ] 청구 카드:
- [ ] 월 사용량:
- [ ] 어떤 모델 사용 (embedding-3-small / -large?):
- [ ] usage limit:

### Sentry
- [ ] organization 이름:
- [ ] 현재 플랜 + 월 비용:
- [ ] event quota:
- [ ] DSN URL:
- [ ] 청구 카드:

### Redis (Upstash 등?)
- [ ] 공급자 (Upstash / Redis Cloud / 직접 호스팅):
- [ ] URL:
- [ ] 청구 카드:
- [ ] 월 비용:

### Firebase
- [ ] 활성 사용 여부 (Yes / No / Deprecated):
- [ ] project ID:
- [ ] 청구 카드 (Spark 무료 한도 초과 시):

### GitHub
- [ ] organization (`centralkang-byte`):
- [ ] 플랜 (Free / Team / Enterprise):
- [ ] 월 비용:
- [ ] 청구 카드:
- [ ] Actions minutes 한도:

### 도메인 (hr.ctr.co.kr)
- [ ] 등록처 (GoDaddy / 가비아 / Cloudflare 등):
- [ ] 등록자 (CEO 개인 vs CTR 법인):
- [ ] 만료일:
- [ ] 자동 갱신 여부:
- [ ] DNS 관리 위임 (Cloudflare / Vercel / etc):
- [ ] SSL 인증서 (Vercel 자동 / 다른 CA):

### 기타 (운영 도구)
- [ ] Microsoft Teams 워크스페이스:
- [ ] Slack 워크스페이스 (사용 시):
- [ ] Notion 워크스페이스 (사용 시):
- [ ] 1Password / Bitwarden vault (시크릿 보관):

---

## 월간 비용 합계 (TODO)

CEO 채우기 후 합계 산출:

| 서비스 | 월 비용 (USD) | 비고 |
|--------|--------------|------|
| Vercel | $ | |
| Supabase | $ | |
| AWS (S3 + SES) | $ | |
| Anthropic | $ | |
| OpenAI | $ | |
| Sentry | $ | |
| Redis | $ | |
| GitHub | $ | |
| 도메인 (연 회비 / 12) | $ | |
| 기타 | $ | |
| **합계** | $ | |

⚠️ Microsoft 365는 별도 CTR 그룹 계약 — HR Hub 전용 비용 분리 어려움.

---

## 청구 카드 이양 SOP

인계 직후 30일 안에 CEO 개인 카드 → CTR 법인 카드 전환:

1. 각 서비스 billing 페이지 진입
2. 새 카드 추가
3. 기본 결제 수단으로 변경
4. 이전 카드 삭제 (1회 결제 cycle 후, 미환불 확인)
5. 영수증 수신 이메일 변경 (CTR finance 팀으로)

⚠️ **자동 갱신 카드 사용 권장**. 만료된 카드로 인한 서비스 중단 방지.

---

## 계약 만료 캘린더 (CEO 채우기)

| 서비스 | 다음 갱신·만료 | 알람 설정 |
|--------|--------------|----------|
| 도메인 hr.ctr.co.kr | <TODO> | <TODO> |
| Vercel | (월 자동 갱신) | 한도 알람 |
| Supabase | (월 자동 갱신) | 한도 알람 |
| Sentry | (연 계약?) | 만료 30일 전 |
| Microsoft 365 | (CTR 통합) | CTR IT 관리 |

---

## 관련 문서

- [03-security-access.md](03-security-access.md) — IAM owner + 시크릿 회수
- [02-operational-runbooks/08-monitoring.md](02-operational-runbooks/08-monitoring.md) — 각 서비스 모니터링 진입점
- [02-operational-runbooks/02-env-add-remove.md](02-operational-runbooks/02-env-add-remove.md) — env 변수 운영

---

**CEO 작성 완료 후**: 본 문서 상단 🟡 → 🟢
