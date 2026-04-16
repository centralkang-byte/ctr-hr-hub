# CTR HR Hub — 전면 QA + E2E 자동화 + UX/UI 리뷰 플랜

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 전체 84개 모듈의 기능 검증, Playwright E2E 자동화, UX/UI 폴리싱을 통해 프로덕션 배포 가능 상태 달성

**Architecture:** 4단계 순차 실행 — `/qa` 스킬로 UI 테스트 + 즉시 수정 → 잔여 버그 정리 → E2E 자동화로 회귀 방지 고정 → UX/UI 리뷰로 시각적 폴리싱

**Tech Stack:** Playwright (E2E), gstack `/qa` 스킬 (헤드리스 브라우저 QA), Next.js 15 + localhost:3002

**환경:** localhost:3002, `NEXT_PUBLIC_SHOW_TEST_ACCOUNTS=true`

**기존 QA 참조:** `docs/qa-reports/QF-FINAL-CONSOLIDATED-REPORT.md` (1,132 API 테스트, 44 P0 수정 완료, 34 P1 잔존)

---

## Phase 0: 사전 준비 (1 세션)

### Task 0-1: 환경 확인 + Dev 서버 기동

**Step 1:** Dev 서버 상태 확인
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/login
# Expected: 200
```

**Step 2:** 서버가 안 떠있으면 기동
```bash
cd /Users/sangwoo/Documents/Project/HR_Hub/ctr-hr-hub
npm run dev
```

**Step 3:** 테스트 계정 로그인 가능 확인
- `http://localhost:3002/login` 접속
- 테스트 계정 버튼 4개 표시 확인 (SA/HR/Manager/Employee)

### Task 0-2: 이전 QA P1/P2 리스트 정리

**Files:**
- Read: `docs/qa-reports/QF-FINAL-CONSOLIDATED-REPORT.md`

**Step 1:** P1 34건 + P2 67건 목록을 체크리스트로 변환
**Step 2:** 수동 QA 시 해당 항목 재검증 포함

---

## Phase 1: Track B — `/qa` 스킬 테스트 + 즉시 수정 (5~7 세션)

> **도구:** `/qa` 스킬 (gstack 헤드리스 브라우저)
> **대상:** `http://localhost:3002`
> **방법:** 모듈별 `/qa` 실행 — 버그 발견 → 소스코드 수정 → 재검증 → atomic commit
> **산출물:** `.gstack/qa-reports/qa-report-localhost-3002-{date}.md` + 스크린샷
> **Tier:** Standard (critical + high + medium 수정)
> **역할 순환:** 각 모듈을 SA → HR → Manager → Employee 순으로 테스트
>
> ### `/qa` 스킬 동작 방식
> 1. 헤드리스 브라우저로 페이지 탐색 + 스크린샷 수집
> 2. 버그 발견 시 심각도 분류 (critical/high/medium/low)
> 3. 소스코드 위치 파악 → 최소한의 수정 적용
> 4. `fix(qa): ISSUE-NNN — description` 형식으로 개별 커밋
> 5. 수정 후 재검증 (before/after 스크린샷)
> 6. 헬스 스코어 산출 (0~100, 카테고리별 가중 평균)
>
> ### 세션별 `/qa` 실행 명령
> ```
> /qa http://localhost:3002/{module-path} --scope "Focus on {module} CRUD and workflows"
> ```
> 인증이 필요하므로 각 세션 시작 시 테스트 계정 로그인 필요:
> - 로그인 URL: `http://localhost:3002/login`
> - 테스트 계정 버튼 클릭으로 자동 로그인

### Session B-1: Core HR (Employee + Organization + Directory)

**`/qa` 실행:**
```
/qa http://localhost:3002 --scope "Focus on Employee CRUD (/directory, /employees, /employees/new, /employees/me), Organization (/org, /org-studio), and Directory search. Test with HR_ADMIN first, then EMPLOYEE for self-service."
```

**테스트 시나리오 (qa가 자동 탐색 + 아래 항목 중점 검증):**

#### HR_ADMIN 역할:
1. `/directory` → 직원 목록 렌더링 + 검색 필터 동작
2. `/employees/new` → 신규 직원 생성 폼 → 제출 → 성공
3. `/employees/[id]` → 상세 → 편집 → 저장
4. 삭제 → 확인 모달 → 디렉토리 반영
5. `/org` → 조직도 (React Flow) + 부서 CRUD
6. `/org-studio` → 조직 구조 편집

#### EMPLOYEE 역할 (재로그인):
7. `/employees/me` → 셀프서비스 프로필 편집
8. 다른 직원 URL 직접 접근 시도 → 403 확인

#### 이전 P0 재검증:
- [ ] #32 IDOR: EMPLOYEE → 다른 직원 프로필 접근 차단
- [ ] #33 IDOR: EMPLOYEE → 다른 직원 insights 접근 차단
- [ ] 검색 필터 동작 (이전: 미작동)

---

### Session B-2: Leave + Attendance

**`/qa` 실행:**
```
/qa http://localhost:3002 --scope "Focus on Leave management (/leave, /leave/team, /leave/admin, /approvals/inbox) and Attendance (/attendance, /attendance/admin, /attendance/shift-calendar, /attendance/shift-roster). Test leave request→approval pipeline across EMPLOYEE and MANAGER roles. Test clock-in/clock-out for EMPLOYEE."
```

**핵심 플로우:**
1. EMPLOYEE → `/leave` → 휴가 신청 → 날짜 선택 → 일수 자동 계산 → 제출
2. MANAGER → `/approvals/inbox` → 승인 확인 모달 → 승인
3. EMPLOYEE → 잔여일수 차감 확인
4. EMPLOYEE → `/attendance` → Clock-in → Clock-out
5. HR_ADMIN → `/attendance/admin` → 관리자 뷰 확인

#### 이전 P0 재검증:
- [ ] #3 이중 잔여일수 업데이트 방어
- [ ] #4, #5 holidays/work-schedules 500 에러
- [ ] 휴가 잔여일수 정합성 (이전: 4일 vs 139일)

---

### Session B-3: Payroll Pipeline

**`/qa` 실행:**
```
/qa http://localhost:3002 --scope "Focus on Payroll pipeline (/payroll, /payroll/adjustments, /payroll/import, /payroll/simulation, /payroll/me). Test full payroll lifecycle: create run → close attendance → calculate → review → approve → publish. Then test EMPLOYEE payslip view at /payroll/me."
```

**핵심 플로우:**
1. HR_ADMIN → 급여 실행 생성 → 근태 마감 → 계산 → 검토 → 승인 → 확정
2. HR_ADMIN → 수당/공제 관리, CSV import, 시뮬레이션
3. EMPLOYEE → `/payroll/me` → 급여명세서 확인

#### 이전 P0 재검증:
- [ ] #7, #8, #9 payroll 접근/권한
- [ ] #38 ATTENDANCE_CLOSED 상태 수용
- [ ] 급여 실행 생성 버튼 동작 (이전: 무반응)

---

### Session B-4: Performance + CFR

**`/qa` 실행:**
```
/qa http://localhost:3002 --scope "Focus on Performance management (/performance, /performance/goals, /performance/calibration, /performance/peer-review, /performance/one-on-one, /performance/recognition, /performance/pulse). Test full performance cycle: create cycle → goals → evaluation → calibration → results. Also test CFR features (1:1, recognition, pulse). Multi-role: HR_ADMIN creates cycle, EMPLOYEE sets goals, MANAGER evaluates."
```

**핵심 플로우:**
1. HR_ADMIN → 평가 주기 생성 → 기간 설정
2. EMPLOYEE → 목표 작성 → 제출
3. MANAGER → 목표 승인 → 평가 작성
4. HR_ADMIN → 캘리브레이션 → 결과 확정
5. MANAGER → 1:1 미팅, 칭찬, 펄스 서베이

#### 이전 P0 재검증:
- [ ] #10~#19 Performance RBAC 전체
- [ ] #40 excludeProbation 설정 가능
- [ ] #41 grade fallback (varchar/enum)

---

### Session B-5: Recruitment + Onboarding/Offboarding

**`/qa` 실행:**
```
/qa http://localhost:3002 --scope "Focus on Recruitment (/recruitment, /recruitment/new, /recruitment/board, /recruitment/talent-pool), Onboarding (/onboarding, /onboarding/me, /onboarding/checkins), and Offboarding (/offboarding, /offboarding/exit-interviews). Test recruitment pipeline: create posting → add applicant → move through pipeline → hire. Test onboarding checklist progression. Test offboarding initiation."
```

**핵심 플로우:**
1. HR_ADMIN → 채용 공고 생성 → 지원자 → 파이프라인 → 채용 전환
2. HR_ADMIN → 온보딩 인스턴스 → 체크리스트 (PENDING → IN_PROGRESS → DONE)
3. EMPLOYEE → `/onboarding/me` → 셀프서비스 완료
4. HR_ADMIN → 퇴직 프로세스 시작 → 퇴직 면담

#### 이전 P0 재검증:
- [ ] #20~#25 Recruitment/Onboarding RBAC
- [ ] #43 Employee DELETE 의존성 체크

---

### Session B-6: Analytics + AI + Compliance + Settings

**`/qa` 실행 (2회 — 범위가 넓어 분할):**

**B-6a: Analytics + AI + Compliance**
```
/qa http://localhost:3002 --scope "Focus on Analytics (/analytics and all 8 sub-dashboards: workforce, compensation, attendance, performance, turnover, team-health, payroll, recruitment), Predictive (/analytics/predictive), AI report generation, and Compliance (/compliance, /compliance/gdpr, /compliance/kr, /compliance/cn, /compliance/ru). Verify all dashboards render with data (no blank screens, no 403 errors)."
```

**B-6b: Settings 44탭**
```
/qa http://localhost:3002 --exhaustive --scope "Focus on Settings (/settings and all 6 categories: system, organization, attendance, payroll, performance, recruitment). Visit every tab. Test CRUD: change a value → save → refresh → verify persistence. Test with SUPER_ADMIN."
```

#### 이전 P0 재검증:
- [ ] #26~#29 Analytics/AI 500/403
- [ ] Settings 44탭 전부 접근 가능 + CRUD 동작

---

### Session B-7: Security + Cross-Module 재검증

**`/qa` 실행 (2회):**

**B-7a: RBAC 경계**
```
/qa http://localhost:3002 --scope "Security audit: Test RBAC boundaries. Login as EMPLOYEE and try accessing HR-only URLs (/employees, /payroll, /settings, /recruitment). Login as MANAGER and try SA-only URLs (/settings/system). Test IDOR: as EMPLOYEE, manually navigate to /employees/{other-employee-id}. Verify 403 pages or redirects for all unauthorized access."
```

**B-7b: Cross-Module Integration**
```
/qa http://localhost:3002 --exhaustive --scope "Cross-module integration testing. Test end-to-end pipelines: (1) Hire-to-Retire: recruitment → onboarding → attendance → payroll → performance → offboarding. (2) Time-to-Pay: clock-in/out → close attendance → payroll calculate. (3) Perf-to-Pay: performance results → compensation review. Verify data flows correctly across modules."
```

#### 검증 포인트:
- [ ] 4개 역할 접근 제어 무결성
- [ ] IDOR 방어 (#32, #33)
- [ ] 모듈 간 데이터 연계 정합성

---

## Phase 2: 잔여 버그 정리 (0~1 세션)

> `/qa` 스킬이 Phase 1에서 발견 즉시 수정 + atomic commit하므로, 대부분의 버그는 이미 해결됨.
> Phase 2는 `/qa`가 못 잡은 항목만 처리.

### Task 2-1: `/qa` deferred 항목 검토
- 각 세션의 QA 리포트에서 "deferred" 상태 항목 수집
- 소스코드 수정 불가능한 항목 (인프라, 외부 의존성) 분류

### Task 2-2: 기존 P1 잔존 항목 재검증
- `QF-FINAL-CONSOLIDATED-REPORT.md`의 P1 34건 중 `/qa`에서 재현 안 된 항목
- 수동 curl/API로 재현 시도 → 수정 또는 "won't fix" 판정

### Task 2-3: tsc + lint 최종 확인
```bash
npx tsc --noEmit   # 0 errors
npm run lint        # no new warnings
```

---

## Phase 3: Track A — Playwright E2E 자동화 (3~5 세션)

> **목표:** 핵심 비즈니스 플로우를 Playwright 테스트로 코드화
> **구조:** `e2e/` 디렉토리에 모듈별 spec 파일
> **기존 인프라:** `e2e/helpers/auth.ts` (loginAs, assertPageLoads)

### 파일 구조

```
e2e/
├── helpers/
│   ├── auth.ts                  (기존 — 로그인/페이지 검증)
│   ├── api.ts                   (신규 — API 호출 헬퍼)
│   └── selectors.ts             (신규 — 공통 셀렉터)
├── golden-paths.spec.ts         (기존 — 스모크 테스트)
├── auth-rbac.spec.ts            (신규)
├── employee-crud.spec.ts        (신규)
├── leave-pipeline.spec.ts       (신규)
├── attendance.spec.ts           (신규)
├── payroll-pipeline.spec.ts     (신규)
├── performance-cycle.spec.ts    (신규)
├── recruitment.spec.ts          (신규)
├── onboarding.spec.ts           (신규)
├── analytics.spec.ts            (신규)
├── settings.spec.ts             (신규)
├── security-idor.spec.ts        (신규)
└── cross-module.spec.ts         (신규)
```

### Task 3-0: E2E 헬퍼 확장

**Files:**
- Create: `e2e/helpers/api.ts`
- Create: `e2e/helpers/selectors.ts`

**Step 1:** API 헬퍼 작성 — 테스트 데이터 생성/정리용 API 직접 호출

```typescript
// e2e/helpers/api.ts
import { type Page } from '@playwright/test'

/** API를 직접 호출하여 테스트 데이터 생성 (UI 테스트 전 사전 조건 설정) */
export async function apiCall(page: Page, method: string, path: string, body?: object) {
  return page.evaluate(async ({ method, path, body }) => {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    return { status: res.status, data: await res.json().catch(() => null) }
  }, { method, path, body })
}
```

**Step 2:** 공통 셀렉터 작성

```typescript
// e2e/helpers/selectors.ts
export const SEL = {
  toast: '[data-sonner-toast]',
  errorBoundary: 'text=페이지를 불러올 수 없습니다',
  confirmModal: '[role="alertdialog"]',
  confirmOk: '[role="alertdialog"] button:has-text("확인")',
  submitBtn: 'button[type="submit"]',
  loadingSpinner: '[data-loading="true"], .animate-spin',
  emptyState: '[data-empty-state]',
  dataTable: 'table, [role="table"]',
  pagination: '[data-pagination]',
} as const
```

**Step 3:** 커밋
```bash
git add e2e/helpers/
git commit -m "test: add E2E helper utilities for API calls and common selectors"
```

---

### Task 3-1: Auth + RBAC 테스트

**Files:**
- Create: `e2e/auth-rbac.spec.ts`

**테스트 시나리오:**

```typescript
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

test.describe('Auth & RBAC', () => {
  // 4개 역할 로그인 성공
  for (const role of ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'] as const) {
    test(`${role} can login and reach home`, async ({ page }) => {
      await loginAs(page, role)
      await expect(page).toHaveURL(/\/home/)
    })
  }

  // EMPLOYEE 접근 제한
  test('EMPLOYEE cannot access /employees list', async ({ page }) => {
    await loginAs(page, 'EMPLOYEE')
    await page.goto('/employees')
    // 403 페이지 또는 리다이렉트 확인
    const url = page.url()
    const is403 = url.includes('/403') || await page.locator('text=권한이 없습니다').isVisible().catch(() => false)
    expect(is403).toBeTruthy()
  })

  test('EMPLOYEE cannot access /settings', async ({ page }) => {
    await loginAs(page, 'EMPLOYEE')
    await page.goto('/settings')
    const url = page.url()
    const blocked = url.includes('/403') || url.includes('/home')
    expect(blocked).toBeTruthy()
  })

  // MANAGER 접근 제한
  test('MANAGER cannot access /settings/system', async ({ page }) => {
    await loginAs(page, 'MANAGER')
    await page.goto('/settings/system')
    const url = page.url()
    const blocked = url.includes('/403') || url.includes('/home')
    expect(blocked).toBeTruthy()
  })
})
```

**Step:** 실행 확인
```bash
npx playwright test e2e/auth-rbac.spec.ts --reporter=list
```

**Step:** 커밋
```bash
git add e2e/auth-rbac.spec.ts
git commit -m "test(e2e): add auth and RBAC boundary tests for 4 roles"
```

---

### Task 3-2: Employee CRUD 테스트

**Files:**
- Create: `e2e/employee-crud.spec.ts`

**테스트 시나리오:**
1. HR_ADMIN 로그인 → `/directory` → 직원 목록 렌더링
2. `/employees/new` → 필수 필드 입력 → 제출 → 성공 토스트
3. 생성된 직원 상세 페이지 → 정보 수정 → 저장
4. EMPLOYEE 로그인 → `/employees/me` → 프로필 보기
5. EMPLOYEE → 자기 프로필 수정 (비상연락처 등)

**핵심 검증:**
- 폼 validation 에러 메시지 표시
- 성공 시 토스트/리다이렉트
- 목록에서 생성된 직원 확인

**Step:** 커밋
```bash
git add e2e/employee-crud.spec.ts
git commit -m "test(e2e): add employee CRUD lifecycle tests"
```

---

### Task 3-3: Leave Pipeline 테스트

**Files:**
- Create: `e2e/leave-pipeline.spec.ts`

**테스트 시나리오:**
1. EMPLOYEE 로그인 → `/leave` → 잔여일수 확인
2. 휴가 신청 폼 → 날짜 선택 → 일수 자동 계산 → 제출
3. 대기 상태 확인
4. MANAGER 로그인 → `/approvals/inbox` → 해당 건 존재 확인
5. 승인 → 확인 모달 → 승인 완료
6. EMPLOYEE 재로그인 → 잔여일수 차감 확인

**핵심 검증:**
- 신청~승인 전체 파이프라인
- 잔여일수 정합성
- 이전 P0 #3 (이중 업데이트) 방어

**Step:** 커밋
```bash
git add e2e/leave-pipeline.spec.ts
git commit -m "test(e2e): add leave request-approval pipeline test"
```

---

### Task 3-4: Payroll Pipeline 테스트

**Files:**
- Create: `e2e/payroll-pipeline.spec.ts`

**테스트 시나리오:**
1. HR_ADMIN → `/payroll` → 급여 실행 생성
2. 근태 마감 → 계산 실행
3. 검토 → 승인 → 확정
4. EMPLOYEE → `/payroll/me` → 급여명세서 확인

**Step:** 커밋
```bash
git add e2e/payroll-pipeline.spec.ts
git commit -m "test(e2e): add payroll pipeline end-to-end test"
```

---

### Task 3-5: Performance Cycle 테스트

**Files:**
- Create: `e2e/performance-cycle.spec.ts`

**테스트 시나리오:**
1. HR_ADMIN → 평가 주기 생성
2. EMPLOYEE → 목표 작성 → 제출
3. MANAGER → 목표 승인 → 평가 작성
4. HR_ADMIN → 캘리브레이션
5. EMPLOYEE → 결과 확인

**Step:** 커밋
```bash
git add e2e/performance-cycle.spec.ts
git commit -m "test(e2e): add performance evaluation cycle test"
```

---

### Task 3-6: Recruitment 테스트

**Files:**
- Create: `e2e/recruitment.spec.ts`

**테스트 시나리오:**
1. HR_ADMIN → 채용 공고 생성 → 게시
2. 지원자 등록 → 파이프라인 이동
3. 칸반 보드 렌더링
4. 채용 확정 → 직원 전환

**Step:** 커밋
```bash
git add e2e/recruitment.spec.ts
git commit -m "test(e2e): add recruitment pipeline test"
```

---

### Task 3-7: Onboarding + Analytics + Settings 테스트

**Files:**
- Create: `e2e/onboarding.spec.ts`
- Create: `e2e/analytics.spec.ts`
- Create: `e2e/settings.spec.ts`

**onboarding.spec.ts:**
- 온보딩 인스턴스 생성 → 체크리스트 진행 → 완료

**analytics.spec.ts:**
- 8개 대시보드 전부 렌더링 확인 (에러 없이)
- 데이터 존재 확인 (빈 화면 아님)

**settings.spec.ts:**
- 6개 카테고리 × 탭 순회
- 설정 변경 → 저장 → 새로고침 → 유지 확인

**Step:** 커밋
```bash
git add e2e/onboarding.spec.ts e2e/analytics.spec.ts e2e/settings.spec.ts
git commit -m "test(e2e): add onboarding, analytics, and settings tests"
```

---

### Task 3-8: Security + Cross-Module 테스트

**Files:**
- Create: `e2e/security-idor.spec.ts`
- Create: `e2e/cross-module.spec.ts`

**security-idor.spec.ts:**
- EMPLOYEE → 다른 직원 ID로 `/employees/[otherId]` 접근 → 403
- EMPLOYEE → 다른 직원 insights 접근 → 403
- Cross-company 데이터 격리 확인

**cross-module.spec.ts:**
- Hire-to-Retire 전체 플로우
- Time-to-Pay 플로우

**Step:** 커밋
```bash
git add e2e/security-idor.spec.ts e2e/cross-module.spec.ts
git commit -m "test(e2e): add security IDOR and cross-module integration tests"
```

---

### Task 3-9: 전체 E2E 실행 + CI 설정

**Step 1:** 전체 테스트 실행
```bash
npx playwright test --reporter=list
```

**Step 2:** Playwright config 업데이트 (병렬 실행 가능하도록)

**Files:**
- Modify: `playwright.config.ts`

```typescript
// 변경: 독립적인 테스트는 병렬 실행
fullyParallel: true,
workers: process.env.CI ? 2 : 4,
```

**Step 3:** 커밋
```bash
git add playwright.config.ts
git commit -m "test(e2e): enable parallel execution for independent test suites"
```

---

## Phase 4: UX/UI 리뷰 (2~3 세션)

> **도구:** `/design-review` 스킬 (gstack 헤드리스 브라우저) 또는 Antigravity Browser
> **기준:** QF-DEFINITIVE v6의 UX-1~8 범위
> **산출물:** `.gstack/qa-reports/` + `docs/qa-reports/UI-REVIEW-{n}.md`

### Session UX-1: Design Token + 목록/상세 일관성

#### Task UX-1-1: 디자인 토큰 검증
1. 색상 팔레트 일관성 (primary, secondary, accent)
2. 타이포그래피 (heading, body, caption 사이즈)
3. 스페이싱/간격 규칙
4. 카드/테이블/모달 스타일 일관성

#### Task UX-1-2: 목록 ↔ 상세 패턴
1. 10개 주요 목록 페이지 순회
2. 빈 상태(empty state) 디자인 일관성
3. 페이지네이션 패턴 일관성
4. 필터/정렬 UI 패턴

---

### Session UX-2: Interaction + Loading/Error States

#### Task UX-2-1: 인터랙션 패턴
1. 버튼 hover/active/disabled 상태
2. 폼 제출 시 로딩 상태
3. 삭제 확인 모달
4. 토스트 알림 위치/스타일

#### Task UX-2-2: Loading & Error States
1. 느린 네트워크 시 스켈레톤/스피너 표시
2. API 에러 시 Error Boundary 동작
3. 404 페이지 디자인
4. 403 페이지 디자인

---

### Session UX-3: 반응형 + i18n + 접근성

#### Task UX-3-1: 모바일 반응형
1. 주요 10개 페이지 모바일 뷰포트 (375px)
2. 테이블 → 카드 변환 확인
3. 네비게이션 (모바일 드로어)
4. 폼 입력 모바일 UX

#### Task UX-3-2: i18n 시각 검증
1. 5개 로케일 전환 시 레이아웃 깨짐 확인
2. 번역 키 미싱 (raw key 노출) 확인
3. 긴 번역 텍스트 오버플로우

#### Task UX-3-3: 접근성
1. 키보드 네비게이션 (Tab 순서)
2. 포커스 인디케이터 가시성
3. 색상 대비 (WCAG AA)

---

## 실행 타임라인

| 단계 | 세션 수 | 예상 시간 | 비고 |
|------|---------|----------|------|
| Phase 0: 사전 준비 | 0.5 | 15분 | 환경 확인 |
| Phase 1: `/qa` 테스트+수정 | 7~9 | ~5시간 | B-1~B-7 (B-6, B-7은 2회씩) |
| Phase 2: 잔여 버그 정리 | 0~1 | ~30분 | `/qa` deferred 항목만 |
| Phase 3: Playwright E2E | 5 | ~4시간 | 12개 spec 파일 |
| Phase 4: UX/UI 리뷰 | 3 | ~2시간 | UX-1~3 |
| **합계** | **~16** | **~12시간** | Phase 2 대폭 축소 |

> **Phase 1 효율**: `/qa`가 발견→수정→커밋→재검증을 한 루프로 처리하므로
> 이전 방식(수동 QA → 별도 Bug Fix)보다 ~2시간 절약

---

## 산출물 목록

```
.gstack/qa-reports/                        ← Phase 1 (/qa 자동 생성)
├── qa-report-localhost-3002-B1-*.md       ← 세션별 QA 리포트
├── qa-report-localhost-3002-B2-*.md
├── qa-report-localhost-3002-B3-*.md
├── qa-report-localhost-3002-B4-*.md
├── qa-report-localhost-3002-B5-*.md
├── qa-report-localhost-3002-B6a-*.md
├── qa-report-localhost-3002-B6b-*.md
├── qa-report-localhost-3002-B7a-*.md
├── qa-report-localhost-3002-B7b-*.md
├── screenshots/                           ← before/after 증거
│   ├── issue-001-*.png
│   └── ...
└── baseline.json                          ← 헬스 스코어 베이스라인

docs/qa-reports/
├── PHASE2-DEFERRED-REPORT.md    ← Phase 2 (잔여 항목)
├── E2E-COVERAGE-REPORT.md       ← Phase 3
├── UX-REVIEW-1.md               ← Phase 4
├── UX-REVIEW-2.md
└── UX-REVIEW-3.md

e2e/
├── helpers/
│   ├── auth.ts                  (기존)
│   ├── api.ts                   (신규)
│   └── selectors.ts             (신규)
├── golden-paths.spec.ts         (기존)
├── auth-rbac.spec.ts            (신규)
├── employee-crud.spec.ts        (신규)
├── leave-pipeline.spec.ts       (신규)
├── attendance.spec.ts           (신규)
├── payroll-pipeline.spec.ts     (신규)
├── performance-cycle.spec.ts    (신규)
├── recruitment.spec.ts          (신규)
├── onboarding.spec.ts           (신규)
├── analytics.spec.ts            (신규)
├── settings.spec.ts             (신규)
├── security-idor.spec.ts        (신규)
└── cross-module.spec.ts         (신규)
```

---

## 의존성 그래프

```
Phase 0 (환경 준비)
    ↓
Phase 1: /qa 테스트 + 즉시 수정
    B-1 (CoreHR) ──→ B-2 (Leave/Att) ──→ B-3 (Payroll)
         각 세션:                              ↓
         /qa 실행 → 발견 → 수정 → commit    B-4 (Perf)
         → 재검증 → 헬스 스코어                ↓
                                        B-5 (Recruit/Onboard)
                                              ↓
                                   B-6a (Analytics) + B-6b (Settings)
                                              ↓
                                   B-7a (RBAC) + B-7b (Cross-Module)
    ↓
Phase 2: 잔여 정리 (deferred 항목만, 대부분 이미 해결)
    ↓
Phase 3: Track A (Playwright E2E — 정상 동작 확인 후 코드로 고정)
    3-0 (Helpers) → 3-1~3-8 (각 모듈 — 병렬 가능) → 3-9 (전체 실행)
    ↓
Phase 4: UX/UI (/design-review 또는 Antigravity)
    UX-1 → UX-2 → UX-3
```
