# 보안·접근 권한

> **대상**: 인프라팀 (1차) + CEO (시크릿 이양)
> **작성 상태**: 🟡 **부분 자동 + CEO 채우기 필요** — env 인벤토리는 자동, IAM owner·계정 매핑은 CEO만 알고 있음.
> **자동 인벤토리**: [03-security-access-env-inventory.md](03-security-access-env-inventory.md) (스크립트 재실행으로 갱신)

---

## 1. IAM Owner 인벤토리 (🟡 CEO 채우기)

현재 CEO 개인 계정에 묶였을 가능성 있는 owner 권한들. **인계 30일 안에 CTR 그룹 계정으로 이양** 필수.

| 서비스 | 현재 Owner (TODO) | Owner 이메일 | 이양 대상 | 이양 절차 | 이양 시점 |
|--------|-------------------|-------------|----------|----------|----------|
| **Vercel team** | <TODO: centralkang@gmail.com 또는 CTR 계정?> | | 인프라팀 + CEO 백업 | Vercel Dashboard → Team Settings → Members → 권한 추가 + Transfer Ownership | 인계 직후 |
| **Supabase organization** | <TODO> | | 인프라팀 + CEO 백업 | Supabase Dashboard → Organization → Settings → Members | 인계 직후 |
| **Supabase project** (`ctr-hr-hub` prod) | <TODO> | | 인프라팀 | 위와 동일 | 인계 직후 |
| **AWS root account** | <TODO> | | 인프라팀 + CTR 법인 결제 | AWS Console → IAM → 새 user 생성 + root 권한 + MFA + CTR 결제 카드 등록 | 인계 직후 |
| **AWS IAM users** (S3 + SES) | <TODO> | | 인프라팀 | 새 access key 발급 → Vercel env 갱신 → 이전 key 삭제 | 인계 직후 |
| **Anthropic console** | <TODO> | | 인프라팀 + CTR 법인 결제 | Anthropic console → Members → 권한 추가 + 결제 카드 변경 | 인계 직후 |
| **OpenAI organization** | <TODO> | | 인프라팀 + CTR 법인 결제 | OpenAI dashboard → Organization → Members + Billing | 인계 직후 |
| **Azure AD tenant** | <TODO> | | 인프라팀 + IT 보안 | Azure Portal → Microsoft Entra → 역할 할당 (Application Administrator 등) | 인계 직후 |
| **Azure AD 앱 등록 (CTR HR Hub)** | <TODO> | | 인프라팀 | 앱 등록 → Owners 탭 추가 | 인계 직후 |
| **GitHub organization (centralkang-byte)** | centralkang | | 인프라팀 + CEO 백업 | GitHub Settings → People → 권한 추가 + ownership transfer | 인계 직후 |
| **Sentry organization** | <TODO> | | 인프라팀 + 개발팀 | Sentry → Organization Settings → Members | 인계 직후 |
| **Firebase project** | <TODO> | | 인프라팀 | Firebase Console → 사용자 및 권한 | 인계 직후 |
| **도메인 DNS (hr.ctr.co.kr)** | <TODO: 어느 등록처? GoDaddy / Cloudflare / 가비아?> | | 인프라팀 (CTR 통합 도메인 관리) | 등록처 계정 인증 → owner 변경 또는 DNS 관리 위임 | 인계 직후 |
| **Vercel 도메인 연결** | (위와 동일) | | 인프라팀 | Vercel → Settings → Domains | 인계 직후 |
| **결제 카드 (각 서비스)** | <TODO: CEO 개인 카드?> | | CTR 법인 카드 | 각 서비스 billing 페이지 → 카드 변경 | 인계 직후 |

### 권한 이양 체크리스트 (Tier 3 핸드오버 체크리스트와 연동)

- [ ] Vercel team owner 추가 (인프라팀 리드 + CEO 본인 백업)
- [ ] Supabase organization owner 추가
- [ ] AWS root + IAM users 신규 발급 + MFA + 이전 키 revoke
- [ ] Anthropic / OpenAI billing 카드 변경
- [ ] Azure AD admin 권한 추가
- [ ] GitHub org owner 추가
- [ ] Sentry org owner 추가
- [ ] Firebase project owner 추가
- [ ] 도메인 DNS owner 또는 위임
- [ ] 모든 서비스 결제 카드 → CTR 법인 카드 변경
- [ ] 모든 시크릿 회전 (다음 섹션)

---

## 2. 환경 변수 + 시크릿 인벤토리

자동 생성: [03-security-access-env-inventory.md](03-security-access-env-inventory.md)

49개 env 변수, 12개가 `.env.example` 미등록 (즉시 추가 필요), 클라이언트 노출 NEXT_PUBLIC_* 일부.

⚠️ **인계 직후 30일 안에 회전 권장 시크릿**: NEXTAUTH_SECRET, AZURE_AD_CLIENT_SECRET, AWS keys, ANTHROPIC_API_KEY, OPENAI_API_KEY, CRON_SECRET, FIREBASE_PRIVATE_KEY, TEAMS_BOT_PASSWORD, TEAMS_WEBHOOK_SECRET.

회전 절차: 환경 변수 인벤토리 문서의 §시크릿 회수·교체 SOP 참조.

---

## 3. RBAC 모델

CTR HR Hub는 5 roles × 16 modules × 8 actions = ~640 권한 매트릭스:

| 역할 | 권한 범위 | 비고 |
|------|----------|------|
| `SUPER_ADMIN` | 13개 법인 cross-company 전체 권한 | 시드: 대조영 (super@ctr.co.kr, CTR-HOLD) |
| `HR_ADMIN` | 본인 법인 인사 전체 권한 | 시드: 한지영 (CTR), 陈美玲 (CTR-CN) |
| `EXECUTIVE` | 본인 법인 임원 권한 (분석 + 결재) | 시드: 강대표 (CTR) |
| `MANAGER` | 본인 팀 직원 권한 | 시드: 박준혁, 김서연 (CTR) |
| `EMPLOYEE` | 본인 데이터만 | 시드: 이민준, 정다은, 송현우 (CTR) |

### RBAC 핵심 파일 (DO NOT TOUCH)

| 파일 | 역할 |
|------|------|
| `src/lib/api/companyFilter.ts` | `resolveCompanyId` — 법인 격리 SSOT |
| `src/lib/api/withRLS.ts` | RLS 트랜잭션 래퍼 |
| `src/lib/prisma-rls.ts` | Prisma RLS 클라이언트 |
| `src/middleware.ts` | 인증 미들웨어 |
| `src/lib/auth.ts` | NextAuth + EmployeeRole 매핑 |
| `src/lib/employee/active-roles.ts` | active role helper (Session 206 추가) |

⚠️ 위 파일들은 보안 핵심. 수정 시 architecture review + Codex Gate 1·2 필수.

---

## 4. 알려진 보안 위험

### Phase 3 보안 감사 결과 (완료)

[STATUS.md Phase 3](../../../Documents/Obsidian%20Vault/projects/hr-hub/STATUS.md) — Batch 1-4 완료. 다음 fix:
- RBAC SSOT
- 라우트 감사
- P0 authz 3건 fix
- CSP nonce
- OWASP Top 10 검토
- AI rate limit
- SSRF 방어

### 인계 후 재감사 권장 항목

- [ ] 신규 라우트 RBAC 적용 검증 (개발팀 신규 PR 마다)
- [ ] 정기 dependency 취약점 스캔 (`npm audit`)
- [ ] Vercel + Supabase + AWS 활성 access key 만료 정책 확립 (90일 권장)
- [ ] Sentry → 개인 정보 logging 차단 확인 (`scrub` 룰)
- [ ] CSP nonce + Strict-Transport-Security 헤더 적용 확인 (`vercel.json` headers)

### 시스템 fix 트랙 보안 관련

[STATUS.md §10](../../../Documents/Obsidian%20Vault/projects/hr-hub/STATUS.md) — 시스템 fix 10건 중 보안 관련:
- (보안 영역 직접 항목 없음 — 모두 법규 정합성 / 시스템 기능 / 운영 데이터)

다만 일부는 **법규 미준수 = 규제 리스크**:
- 출산휴가 60/30 분기 미적용 (한국 근로기준법)
- 퇴직금 주 15시간 검증 없음 (근로자퇴직급여보장법 §4①)
- 감액 동의서 강제 없음 (근로기준법)

---

## 5. 데이터 보호

### GDPR + 한국 개인정보보호법

- 컴플라이언스 허브: `/compliance` (GDPR / DPIA / 데이터 보존 / PII 감사)
- PII 자동 logging (Phase 3 완료)
- RLS = 법인 격리 (한 법인 HR_ADMIN이 다른 법인 직원 데이터 못 봄)

### Backup + 복원

| 데이터 | 백업 | 복원 RTO | 복원 RPO |
|--------|------|----------|----------|
| Supabase DB | 자동 일별 + PITR (Pro+) | <1시간 | <5분 |
| AWS S3 | versioning 활성화 권장 — 현재 상태 확인 필요 | — | — |
| Vercel deployment | Git 기반 → 무한 복원 | <5분 | <5분 |

⚠️ 인계 직후 S3 versioning 활성화 + 백업 복원 시뮬레이션 1회 권장.

---

## 6. 감사 로그

| 로그 종류 | 위치 | 보존 기간 |
|----------|------|----------|
| 도메인 이벤트 (27 handlers) | DB `DomainEvent` 테이블 (예상) | 영구 |
| PII access 감사 | DB 또는 application log | 6개월+ (한국 개인정보보호법 권장) |
| 결재 이력 | DB `ApprovalLog` 테이블 | 영구 |
| 로그인 이력 | DB `LoginLog` 또는 동등 | 6개월 |
| Vercel function 로그 | Vercel logs (기본 1일, Pro+ 더 길게) | 플랜에 따라 |
| Sentry 에러 로그 | Sentry (플랜에 따라 보존) | 플랜에 따라 |

---

## 7. 관련 문서

- [03-security-access-env-inventory.md](03-security-access-env-inventory.md) — 자동 env 인벤토리
- [02-operational-runbooks/02-env-add-remove.md](02-operational-runbooks/02-env-add-remove.md) — env 추가·회수 SOP
- [02-operational-runbooks/10-incident-response.md](02-operational-runbooks/10-incident-response.md) — 보안 사고 대응
- [05-vendor-contracts.md](05-vendor-contracts.md) — 벤더·계약 인벤토리

---

**CEO 작성 완료 후**: 본 문서 상단 🟡 → 🟢
