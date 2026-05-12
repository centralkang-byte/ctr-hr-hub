# 07. GitHub Actions CI/CD

> **대상**: 인프라팀
> **원본**: `.github/workflows/*.yml`
> **현재 워크플로 수**: 4개

## 워크플로 카탈로그

| 워크플로 | 파일 | 트리거 | 목적 |
|---------|------|--------|------|
| **E2E Tests** | [e2e.yml](../../../.github/workflows/e2e.yml) | push/PR to main | Playwright E2E 전체 — main 머지 gating |
| **E2E API Phase 6A** | [e2e-api-phase6a.yml](../../../.github/workflows/e2e-api-phase6a.yml) | staging push | Phase 6A 쿼리 예산 5개 라우트 X-Query-Count 관찰 |
| **Seed Validate Phase 6B** | [seed-validate-phase6b.yml](../../../.github/workflows/seed-validate-phase6b.yml) | staging push + manual | `scripts/seed-validate-phase6b.ts` 32 invariants |
| **Visual Baseline** | [visual-baseline.yml](../../../.github/workflows/visual-baseline.yml) | staging (workflow file 변경 시) + manual | Linux Chromium visual regression baselines (330개) |

## Node 버전 정합

- **e2e.yml**: Node 24 (npm 11)
- **e2e-api-phase6a.yml, visual-baseline.yml, seed-validate-phase6b.yml**: Node 24 (validated shape)

> Node 20은 npm 10이 `@swc/helpers >=0.5.17` 강제하나 `next@15.5.12`가 `0.5.15` exact-pin → `npm ci` 실패. **Node 24 LTS 표준**.

## CI 의존 서비스

각 워크플로는 다음 서비스 컨테이너 사용:

| 워크플로 | Postgres | pgvector | Redis | QA-seed | Prisma SSL |
|---------|----------|----------|-------|---------|-----------|
| e2e.yml | ✅ | ⚠️ (pre-162 gap) | ⚠️ | ⚠️ | ⚠️ |
| e2e-api-phase6a.yml | ✅ Postgres 16 | ✅ | ✅ | ✅ | ✅ |
| seed-validate-phase6b.yml | ✅ Postgres 16 | ✅ | — | — | ✅ |
| visual-baseline.yml | ✅ Postgres 16 | ✅ | ✅ | ✅ | ✅ |

⚠️ `e2e.yml`은 Session 162 이전 셋업이라 일부 서비스 누락. Phase 9 cleanup 백로그.

## 수동 트리거 (workflow_dispatch)

```bash
# 특정 브랜치로 워크플로 실행
gh workflow run e2e.yml --ref <branch>
gh workflow run e2e-api-phase6a.yml --ref staging
gh workflow run seed-validate-phase6b.yml --ref staging
gh workflow run visual-baseline.yml --ref staging
```

## CI 실행 모니터링

```bash
# 최근 실행 목록
gh run list --workflow=e2e.yml --limit=5

# 특정 실행 상세
gh run view <run-id>

# 실패한 step 로그
gh run view <run-id> --log-failed

# 실행 중인 워크플로 watch
gh run watch <run-id>
```

## 비밀 (GitHub Secrets)

CI는 GitHub repository secrets 에서 다음을 사용 (예상):
- `DATABASE_URL` (staging 또는 CI test DB)
- `NEXTAUTH_SECRET`
- `AZURE_AD_*` (테스트 OAuth)
- `ANTHROPIC_API_KEY` (E2E에서 AI 기능 테스트 시)
- 기타 envs

⚠️ **정확한 secrets 목록은 GitHub UI 에서 확인**: Settings → Secrets and variables → Actions.

인계 직후 모든 GitHub secret도 회전 권장 (CEO 개인 GitHub 계정에 묶였을 가능성).

## Branch protection rules

(현재 설정 확인 필요 — `Settings → Branches → Branch protection rules`)

권장:
- `main` 브랜치: PR 필수 + e2e.yml passing 필수 + 최소 1 approval (인계 후 적용)
- `staging` 브랜치: 자유 push 허용 (개발 가속용)

## CI 실패 패턴

| 증상 | 원인 | 해결 |
|------|------|------|
| `Missing @swc/helpers@0.5.21` | Node 20 사용 | Node 24로 전환 |
| `relation does not exist` | 마이그레이션 누락 | `prisma migrate deploy` 워크플로에 추가 |
| Visual diff failures | Phase 4 디자인 변경 후 baseline 미갱신 | `npm run test:visual:update` 로컬 + commit |
| E2E flake (가끔 fail) | 특정 케이스의 race condition | `playwright.config.ts` retries 또는 fixture cleanup 개선 |

자세한 패턴: [TROUBLESHOOTING.md](../../../TROUBLESHOOTING.md)

## 신규 워크플로 추가

1. `.github/workflows/<name>.yml` 작성
2. 트리거 명확히 정의 (push branches, paths, workflow_dispatch)
3. 서비스 컨테이너 명세 (Postgres 16 + pgvector 등)
4. Node 24 사용
5. 실패 시 알림 채널 결정 (현재 GitHub Notifications에 의존)
6. 본 문서 카탈로그 갱신

## 관련 문서

- [01-deploy-pipeline.md](01-deploy-pipeline.md) — Vercel 배포 (별도)
- [08-monitoring.md](08-monitoring.md) — Sentry 알림 연동
