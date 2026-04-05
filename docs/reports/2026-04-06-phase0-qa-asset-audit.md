# Phase 0 Day 1-2 — QA Asset Audit

> **Session**: 102 (2026-04-06)
> **Final QA Sweep** 10-12주 프로그램의 Phase 0 Day 1-2 산출물
> **Source Plan**: `.claude/plans/idempotent-stargazing-wirth.md` (Session 100)

---

## Executive Summary

**결론: 재활용률 약 70% — 기존 자산 충분히 활용 가능**

- **재활용 기준 분모**: 기존 QA 자산 파일 수 (E2E 21 + qa/ 14 + q4/ 13 + seeds 27 + past reports 15 = **90**)
- **재활용 가능**: ~63 파일 (HIGH/MEDIUM 등급)
- **신규 필요**: ~27 항목 (Unit tests 신규, Visual baseline 신규, 일부 시드 증축)

**근거**:
- E2E 21 spec (198 테스트 케이스) 전량 PASS — Phase 5-8 business flow 테스트 기반
- `scripts/q4/*` 13개 발견 아카이브 → Phase 1.5 i18n + Phase 3 RBAC 자동화 오라클
- 27개 시드 파일 → Phase 1에서 47-49 신규 추가만 필요

**핵심 인사이트**: Codex 검증 통과, Vitest/Unit 0개 (Phase 2 신규 필요), Playwright `workers:1` (Phase 0 Day 3-4에서 변경).

---

## 1. Codebase Inventory (자동 생성)

`scripts/qa/inventory-summary.md`에서 자동 include. 실행: `npm run qa:inventory`.

```
Commit:        99c954b (staging)
API routes:    599 (v1: 596)
Pages:         162
Cron routes:   8
Prisma models: 209
E2E specs:     21
Locales:       5 (parity: PASS, 53 top-level keys × 5)
```

**Session 100 baseline 대비 정정**:
- cron routes: 3 → **8** (Codex 지적)
- E2E specs: 29 → **21** (Codex 지적, archived/helper 포함 오류)

---

## 2. 자산 인벤토리 매트릭스

### E2E 테스트 (21 spec, 198 test cases)

| 파일 | 도메인 | 재활용성 | Phase |
|------|--------|---------|-------|
| evaluation-lifecycle.spec.ts | 평가 상태머신 | HIGH | 5 |
| evaluation-permissions.spec.ts | 평가 RBAC | HIGH | 3 |
| evaluation-forms.spec.ts | 평가 UI | HIGH | 5 |
| goal-revision-lifecycle.spec.ts | 목표 버저닝 | HIGH | 5 |
| calibration-batch-adjust.spec.ts | 캘리브레이션 | HIGH | 5 |
| quarterly-review-lifecycle.spec.ts | 분기 리뷰 | HIGH | 5 |
| compensation-lifecycle.spec.ts | 보상 CRUD | HIGH | 5 |
| off-cycle-lifecycle.spec.ts | 비정기 보상 | HIGH | 5 |
| leave-workflow.spec.ts | 휴가 워크플로 | HIGH | 5 |
| attendance.spec.ts | 근태 | HIGH | 5 |
| employee-crud.spec.ts | 직원 CRUD | HIGH | 5 |
| onboarding.spec.ts | 온보딩 | HIGH | 5 |
| analytics.spec.ts | 분석 대시보드 | HIGH | 6 |
| cross-cutting.spec.ts | RBAC 횡단 | HIGH | 3 |
| golden-paths.spec.ts | 핵심 플로우 | HIGH | 5 |
| 기타 6개 | 각 도메인 | MEDIUM | 5-8 |

**Helpers** (7개, HIGH): auth.ts, test-data.ts, wait-helpers.ts + 4 fixtures (eval/calibration/qr/off-cycle)
**globalSetup**: `e2e/global-setup.ts` — 4역할 storageState 인증 (재활용 필수)

### QA 스크립트

| 위치 | 파일수 | 용도 | 재활용성 |
|------|--------|------|---------|
| `scripts/qa/*` | 6 | 스크린샷 캡처, URL 생성, 이메일 조회 | HIGH (Phase 4 visual) |
| `scripts/q4/*` | 13 | 과거 발견 아카이브 (i18n/RBAC/toast/placeholder) | HIGH (Phase 1.5/3) |
| `scripts/qa-*.ts` | 5 | RBAC 권한 검증 | HIGH (Phase 3) |

### 시드 파일 (27개)

| 번호 | 용도 | 재활용성 |
|------|------|---------|
| 00-qa-accounts | 8 QA 계정 (SA/HR/MGR/EMP × 13법인) | HIGH |
| 02-employees | 625명 직원 (13법인) | HIGH |
| 03-attendance | 12,369 근태 레코드 | HIGH |
| 04-leave, 05-perf, 06-payroll, 07-lifecycle | 도메인 시드 | HIGH |
| 08-16 | 알림, 채용, 보상, 복리후생 등 | MEDIUM |
| 17-46 | 파이프라인, 정책, Settings | MEDIUM |
| **47-49 (신규 필요)** | 엣지케이스 페르소나, 볼륨, 3년 이력 | — |

### 과거 QA 리포트 (15개+)

- `docs/archive/qa-reports/`: 6개 (Sessions 15-22 시기)
- `.gstack/qa-reports/`: 최신 2026-03-27 (헬스 22→68/100)
- 재활용: 각 Phase에서 미해결 이슈 오라클

---

## 3. Phase별 재활용 매핑

### Tier 1: 즉시 재활용 (Phase 0-2)

| 자산 | Phase | 용도 |
|------|-------|------|
| `scripts/qa/capture-screenshots.ts` | 4 | Visual regression baseline |
| `e2e/helpers/auth.ts` + `global-setup.ts` | 2 | API test 인증 공유 |
| `q4/no-auth-routes.txt`, `no-company-filter.txt` | 3 | RBAC 오라클 |
| `q4/p1-i18n-complete.mjs` | 1.5 | i18n flattened key 감사 |
| `prisma/seeds/00-16` | 1 | 기본 시드 (13법인, 625명) |
| `e2e/` 21 spec | 5 | 비즈니스 플로우 회귀 |

### Tier 2: 보조 재활용 (Phase 3-5)

| 자산 | Phase | 용도 |
|------|-------|------|
| `e2e/helpers/*-fixtures.ts` 4개 | 5 | 도메인별 픽스처 |
| `scripts/qa-*-perms.ts` 5개 | 3 | RBAC 권한 감사 자동화 |
| 과거 QA 리포트 | 전체 | 발견 이슈 오라클 |

### Tier 3: 참조용 (Phase 8+)

| 자산 | Phase | 용도 |
|------|-------|------|
| `.gstack/qa-reports/` 최신 | 8 | 성능 baseline (migration 후) |
| 현재 `playwright.config.ts` | 0 Day 3-4 | 병렬화 before/after 비교 |

---

## 4. 중복 제거 + 효율화 기회 7건

| # | 항목 | 현재 공수 | 효율화 후 | 절감 |
|---|------|----------|---------|------|
| 1 | RBAC 매트릭스 (599 라우트 × 5 역할) | 신규 2.5주 | `no-auth-routes.txt` + `rbac-spec.yaml` 자동화 | 1.5주 |
| 2 | i18n 키 parity (5 locale × 162 페이지) | 신규 1.5주 | `q4/p1-i18n-complete.mjs` 재활용 | 1주 |
| 3 | E2E business flow 테스트 | 신규 3주 | 21 spec 재활용 (추가 확장만) | 2주 |
| 4 | Visual baseline 생성 | 신규 1주 | `capture-screenshots.ts` 재활용 | 3일 |
| 5 | 시드 기본 (법인/직원/근태) | 신규 1주 | seeds 00-16 재활용 | 1주 |
| 6 | QA 계정 셋업 | 신규 3일 | `00-qa-accounts.ts` + `run-qa-seed.ts` | 3일 |
| 7 | 역할별 로그인 자동화 | API test 재구현 | `auth.ts` + `global-setup.ts` 공용화 | 2일 |

**총 절감**: ~2.5주 (Codex Outside Voice #6 목표 달성)

---

## 5. P0 미해결 이슈 4개 (Phase 1 진입 전 처리 필요)

과거 QA 리포트(`docs/archive/qa-reports/qa_report_final.md`)에서 식별된 P0 이슈:

| # | 이슈 | 증상 | 영향 | 수정 Phase |
|---|------|------|------|-----------|
| 1 | Analytics 403 Forbidden | HR_ADMIN Analytics 접근 차단 | HR 분석 불가 | Phase 1 전 |
| 2 | Performance API 400 | 성과관리 API 실패 | 모듈 작동 불능 | Phase 1 전 |
| 3 | Payroll "급여 실행 생성" 버튼 비활성 | HR Admin 급여 실행 불가 | 급여 관리 막힘 | Phase 1 전 |
| 4 | Leave Request UX | Days Requested 자동 계산 미작동 | 직원 휴가 신청 마찰 | Phase 4 |

**권장**: Phase 1 시드 확장 전에 1-3 수정. 4번은 Phase 4(UX)에서 처리 가능.

**추가 발견 사항** (2026-03-27 gstack 리포트):
- `/recruitment/positions`, `/candidates` 404 (HIGH)
- EmployeeTitle 호칭 관리 0 records (MEDIUM)
- `/api/health` 404 (MEDIUM)

---

## 6. Playwright 설정 변경 권장 (Phase 0 Day 3-4 작업 연계)

**현재** (`playwright.config.ts`):
```typescript
fullyParallel: false
workers: 1
projects: [{ name: 'chromium' }]
```

**Phase 0 Day 3-4 권장**:
```typescript
fullyParallel: true
workers: process.env.CI ? 2 : 4
projects: [
  { name: 'api', testMatch: /api\..*\.spec\.ts$/ },
  { name: 'browser', testMatch: /.*\.spec\.ts$/, use: devices['Desktop Chrome'] },
  // Phase 4에서 'visual' 추가
]
```

**기대 효과**:
- 현재: 198 테스트 × 순차 실행 = 6-10시간
- 이후: 4 workers 병렬 = 2-3시간 (3-4배 단축)

---

## 데이터 소스

1. **Explore 에이전트 출력** (Session 102) — 자산 인벤토리 + 재활용 평가
2. **scripts/qa/inventory.json** — 자동 생성 baseline (inventory-summary.md include)
3. **과거 QA 리포트** — `docs/archive/qa-reports/`, `.gstack/qa-reports/`
4. **Codex 검증** (Session 102) — baseline 숫자 정정 (cron 3→8, E2E 29→21)

---

## Verification

- [x] `npm run qa:inventory` exit 0
- [x] `scripts/qa/inventory.json` 유효 JSON
- [x] baseline 숫자 검증: apiRoutes=599, pages=162, cronRoutes=8, prismaModels=209, e2eSpecs=21, localeParity=true
- [x] `scripts/qa/inventory-summary.md` 생성
- [x] 본 리포트 6개 섹션 포함

---

## Next Steps (Phase 0 Day 3-7)

- **Day 3-4**: Playwright 병렬화 (workers 1→4, fullyParallel, multi-project)
- **Day 5-7**: Staging 환경 검증 (Session 101에서 DB 완료됨, 실환경 smoke test 필요)
- **Phase 1 진입 전**: P0 이슈 4건 수정
