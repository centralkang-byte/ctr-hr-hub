# 02. 환경 변수 추가·회수

> **대상**: 인프라팀
> **참고**: 전체 환경 변수 인벤토리는 [03-security-access-env-inventory.md](../03-security-access-env-inventory.md) (자동 생성).
> **빈도**: 신규 통합 추가 시 + 시크릿 회전 시 + 인계 직후 1회 (모든 시크릿 회전).

## Vercel CLI 표준 명령

```bash
# 추가 (값은 프롬프트 입력)
vercel env add VAR_NAME production
vercel env add VAR_NAME preview
vercel env add VAR_NAME development

# 목록 조회
vercel env ls

# 회수 (Session 212 패턴)
vercel env rm VAR_NAME production

# 로컬 .env 동기화 (Vercel → .env.local)
vercel env pull .env.local

# 변경 후 재배포 (변경 즉시 반영하려면 필수)
vercel redeploy <deployment-id> --prod
```

## ⚠️ Session 212 가르침

**`vercel env rm VAR production` 실행 시 preview/development 환경의 같은 변수도 함께 제거될 수 있음.** 환경 명시 필수.

올바른 예: `vercel env rm NEXT_PUBLIC_SHOW_TEST_ACCOUNTS production` → production만 제거.

## 신규 변수 추가 시 체크리스트

새 외부 통합 또는 기능 플래그 추가 시:
- [ ] `.env.example` 에 변수 이름 + 1줄 설명 추가
- [ ] `.env.local` (로컬 개발용) 에 실제 값 추가
- [ ] Vercel 3 환경 (production / preview / development) 에 각각 추가
- [ ] `src/lib/env.ts` 또는 zod 스키마가 있다면 검증 룰 추가
- [ ] 사용 위치에서 `process.env.VAR_NAME ?? '<safe default>'` 또는 fail-fast 처리
- [ ] `scripts/handover/extract-env-inventory.ts` 재실행 (인벤토리 갱신)
- [ ] 핸드오버 [05-vendor-contracts.md](../05-vendor-contracts.md) 에도 외부 서비스 추가

## 변수 회수 시 체크리스트

- [ ] 코드에서 `process.env.VAR_NAME` 참조 모두 제거 (or fallback 정리)
- [ ] Vercel 3 환경에서 각각 `vercel env rm`
- [ ] `.env.example` 에서 삭제
- [ ] `.env.local` 에서 삭제
- [ ] 외부 서비스 측에서도 키 revoke (Anthropic console / AWS IAM 등)
- [ ] 재배포 + 헬스체크
- [ ] 인벤토리 재생성

## 인계 직후 30일 시크릿 회전 계획

인계 시 모든 시크릿이 CEO 개인 계정으로 발급된 상태일 가능성 → 30일 안에 전부 회전:

자세한 회전 절차: [03-security-access-env-inventory.md §시크릿 회수·교체 SOP](../03-security-access-env-inventory.md#시크릿-회수교체-sop)

## 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| 변수 추가했는데 코드에서 `undefined` | 재배포 안 함 | `vercel redeploy <id> --prod` |
| `vercel env pull` 후 .env.local에 일부 빠짐 | `--environment` 플래그 누락 | `vercel env pull .env.local --environment=development` |
| Vercel에 추가했는데 production만 적용 안 됨 | environment scope 잘못 | `vercel env ls`로 confirm 후 production에 명시적 추가 |
| Build error: "Environment variable X not defined" | preview/development env 누락 | 3 환경 모두에 추가 |

## 관련 문서

- [03-security-access.md](../03-security-access.md) — IAM owner + 시크릿 회수
- [DEPLOYMENT.md](../../../DEPLOYMENT.md) — Vercel 초기 셋업 시 env 설정
