# CTR HR Hub — 전면 QA + E2E 자동화 + UX/UI 리뷰 플랜

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 전체 84개 모듈의 기능 검증, Playwright E2E 자동화, UX/UI 폴리싱을 통해 프로덕션 배포 가능 상태 달성

**Architecture:** 4단계 순차 실행 — 수동 QA로 현재 상태 파악 → 버그 수정 → E2E 자동화로 회귀 방지 고정 → UX/UI 리뷰로 시각적 폴리싱

**Tech Stack:** Playwright (E2E), browse/gstack (수동 QA), Next.js 15 + localhost:3002

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
cd /Users/sangwoo/VibeCoding/HR_Hub/ctr-hr-hub
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

## Phase 1: Track B — 수동 QA (browse 스킬) (5~7 세션)

> **도구:** `/browse` 또는 `/qa` 스킬 (localhost:3002)
> **방법:** 각 모듈별로 실제 브라우저에서 CRUD 플로우 실행
> **산출물:** 모듈별 QA 리포트 → `docs/qa-reports/UI-{module}.md`
> **역할 순환:** 각 모듈을 SA → HR → Manager → Employee 순으로 테스트

### Session B-1: Core HR (Employee + Organization + Directory)

#### Task B-1-1: Employee CRUD (HR_ADMIN)
1. `/directory` 접속 → 직원 목록 렌더링 확인
2. `/employees/new` → 신규 직원 생성 폼 작성 → 제출 → 성공 확인
3. `/employees/[id]` → 생성된 직원 상세 → 정보 편집 → 저장
4. 직원 비활성화/삭제 → 디렉토리에서 제거 확인
5. `/employees/me` (EMPLOYEE 로그인) → 셀프서비스 프로필 편집

#### Task B-1-2: Organization (HR_ADMIN)
1. `/org` → 조직도 렌더링 확인 (React Flow)
2. 부서 생성/수정/삭제
3. `/org-studio` → 조직 구조 편집

#### Task B-1-3: Directory 검색 (ALL ROLES)
1. 검색 필터 동작 확인 (이전 P0: 검색 미작동)
2. 역할별 조회 범위 차이 확인

#### 검증 포인트:
- [ ] 직원 생성 폼 모든 필수 필드 동작
- [ ] 수정 후 즉시 반영 (리스트/상세 모두)
- [ ] 삭제 시 확인 모달 표시
- [ ] EMPLOYEE는 자기 정보만 접근 가능
- [ ] 이전 P0 #32, #33 (IDOR 방어) 재검증

---

### Session B-2: Leave + Attendance

#### Task B-2-1: Leave Pipeline (Employee → Manager)
1. EMPLOYEE 로그인 → `/leave` → 휴가 신청 폼
2. 날짜 선택 → 일수 자동 계산 확인 (이전 P0: 자동계산 미작동)
3. 제출 → MANAGER 로그인 → `/approvals/inbox` → 승인
4. 승인 확인 모달 존재 확인 (이전 P0: 원클릭 승인)
5. EMPLOYEE 재로그인 → 잔여일수 변동 확인 (이전 P0: 4일 vs 139일)

#### Task B-2-2: Attendance (Employee + Admin)
1. EMPLOYEE → `/attendance` → 출퇴근 기록
2. Clock-in → Clock-out → 기록 확인
3. HR_ADMIN → `/attendance/admin` → 관리자 뷰
4. `/attendance/shift-calendar`, `/attendance/shift-roster` 렌더링

#### 검증 포인트:
- [ ] 휴가 잔여일수 정합성
- [ ] 승인 플로우 전체 동작
- [ ] 출퇴근 기록 즉시 반영
- [ ] 이전 P0 #3 (이중 잔여일수 업데이트) 재검증
- [ ] 이전 P0 #4, #5 (holidays/work-schedules 500) 재검증

---

### Session B-3: Payroll Pipeline

#### Task B-3-1: Payroll 전체 플로우 (HR_ADMIN)
1. `/payroll` → 급여 실행 목록
2. 급여 실행 생성 버튼 → 모달/폼 (이전 P0: 버튼 무반응)
3. 생성 → 근태 마감 → 계산 → 검토 → 승인 → 확정
4. `/payroll/[runId]/review` → 상세 검토 화면
5. `/payroll/[runId]/publish` → 급여명세서 발행

#### Task B-3-2: Employee 급여 확인
1. EMPLOYEE → `/payroll/me` → 내 급여명세서 목록
2. 명세서 상세 보기

#### Task B-3-3: Payroll 설정 (HR_ADMIN)
1. `/payroll/adjustments` → 수당/공제 관리
2. `/payroll/import` → CSV 가져오기
3. `/payroll/simulation` → 급여 시뮬레이션

#### 검증 포인트:
- [ ] 급여 실행 생성~확정 전체 파이프라인
- [ ] 직원 급여명세서 접근 가능
- [ ] 이전 P0 #7, #8, #9 (payroll 접근/권한) 재검증
- [ ] 이전 P0 #38 (ATTENDANCE_CLOSED 상태 수용) 재검증

---

### Session B-4: Performance + CFR

#### Task B-4-1: Performance Cycle (HR_ADMIN → Manager → Employee)
1. HR_ADMIN → `/performance` → 평가 주기 목록
2. 평가 주기 생성 → 목표 설정 기간 → 평가 기간 설정
3. EMPLOYEE → `/performance/goals` → 목표 작성 → 제출
4. MANAGER → 목표 승인 → 평가 작성
5. HR_ADMIN → `/performance/calibration` → 캘리브레이션
6. 결과 확정 → EMPLOYEE 결과 확인

#### Task B-4-2: CFR (1:1, Recognition, Pulse)
1. MANAGER → `/performance/one-on-one` → 1:1 미팅 생성
2. `/performance/recognition` → 칭찬 작성 → 좋아요
3. HR_ADMIN → `/performance/pulse` → 펄스 서베이 생성

#### 검증 포인트:
- [ ] 평가 주기 전체 라이프사이클
- [ ] 이전 P0 #10~#19 (Performance RBAC 전체) 재검증
- [ ] 이전 P0 #40, #41 (excludeProbation, grade fallback) 재검증

---

### Session B-5: Recruitment + Onboarding/Offboarding

#### Task B-5-1: Recruitment Pipeline (HR_ADMIN)
1. `/recruitment` → 채용 공고 목록
2. `/recruitment/new` → 공고 생성 → 게시
3. 지원자 등록 → 파이프라인 이동 (서류→면접→오퍼→채용)
4. `/recruitment/board` → 칸반 보드 확인
5. 채용 확정 → 직원 전환

#### Task B-5-2: Onboarding (HR_ADMIN + Employee)
1. HR_ADMIN → `/onboarding` → 온보딩 인스턴스 생성
2. 체크리스트 진행 (PENDING → IN_PROGRESS → DONE)
3. EMPLOYEE → `/onboarding/me` → 셀프서비스
4. `/onboarding/checkins` → 체크인 기록

#### Task B-5-3: Offboarding (HR_ADMIN)
1. `/offboarding` → 퇴직 프로세스 시작
2. `/offboarding/exit-interviews` → 퇴직 면담

#### 검증 포인트:
- [ ] 채용→온보딩 연계 플로우
- [ ] 이전 P0 #20~#25 (Recruitment/Onboarding RBAC) 재검증
- [ ] 이전 P0 #43 (Employee DELETE 의존성 체크) 재검증

---

### Session B-6: Analytics + AI + Compliance + Settings

#### Task B-6-1: Analytics (HR_ADMIN + SA)
1. `/analytics` → 전체 대시보드 (이전: 403 전멸)
2. 8개 서브 대시보드 순회: workforce, compensation, attendance, performance, turnover, team-health, payroll, recruitment
3. `/analytics/predictive` → 이탈/번아웃 예측
4. AI 리포트 생성

#### Task B-6-2: Compliance (HR_ADMIN)
1. `/compliance` → 국가별 컴플라이언스 (kr, cn, ru)
2. GDPR, 데이터 보존, PII 감사

#### Task B-6-3: Settings 44탭 (SA + HR_ADMIN)
1. `/settings` → 6개 카테고리 순회
2. 각 탭 로드 + 기본 CRUD 동작 확인
3. 설정 변경 → 저장 → 새로고침 후 유지 확인

#### 검증 포인트:
- [ ] Analytics 8개 대시보드 전부 렌더링
- [ ] 이전 P0 #26~#29 (Analytics/AI 500/403) 재검증
- [ ] Settings 44탭 전부 접근 가능

---

### Session B-7: Security + Cross-Module 재검증

#### Task B-7-1: RBAC 경계 테스트
1. EMPLOYEE로 로그인 → HR 전용 URL 직접 접근 시도
   - `/employees` (목록), `/payroll` (관리), `/settings` → 403/리다이렉트
2. MANAGER로 → SA 전용 URL 접근 시도
3. URL 파라미터 조작 (다른 직원 ID로 접근) → IDOR 방어 확인

#### Task B-7-2: Cross-Module Integration
1. Hire-to-Retire: 채용 → 온보딩 → 근태 → 급여 → 성과 → 퇴직
2. Time-to-Pay: 출퇴근 → 근태 마감 → 급여 계산
3. Perf-to-Pay: 성과 결과 → 보상 연계

#### 검증 포인트:
- [ ] 4개 역할 접근 제어 무결성
- [ ] IDOR 방어 (#32, #33)
- [ ] 모듈 간 데이터 연계 정합성

---

## Phase 2: Bug Fix (1~3 세션)

> Phase 1에서 발견된 버그를 심각도 순으로 수정
> **산출물:** 수정 커밋 + 업데이트된 QA 리포트

### Task 2-1: P0 버그 즉시 수정
- 발견 즉시 수정, 개별 커밋
- `npx tsc --noEmit` + `npm run lint` 통과 필수

### Task 2-2: P1 버그 수정
- 기존 P1 34건 중 재현 확인된 항목 수정
- Phase 1에서 새로 발견된 P1 수정

### Task 2-3: P2 판단
- P2는 UX/UI 리뷰 단계에서 함께 처리할지 결정

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

> **도구:** `/browse` 또는 `/design-review` 스킬
> **기준:** QF-DEFINITIVE v6의 UX-1~8 범위
> **산출물:** `docs/qa-reports/UI-REVIEW-{n}.md`

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
| Phase 1: Track B 수동 QA | 7 | ~5시간 | B-1~B-7 |
| Phase 2: Bug Fix | 1~3 | ~2시간 | 발견 건수에 따라 |
| Phase 3: Track A E2E | 5 | ~4시간 | 12개 spec 파일 |
| Phase 4: UX/UI | 3 | ~2시간 | UX-1~3 |
| **합계** | **~16** | **~13시간** | |

---

## 산출물 목록

```
docs/qa-reports/
├── UI-B1-CoreHR.md              ← Phase 1
├── UI-B2-LeaveAttendance.md
├── UI-B3-Payroll.md
├── UI-B4-Performance.md
├── UI-B5-RecruitOnboard.md
├── UI-B6-AnalyticsSettings.md
├── UI-B7-SecurityCrossModule.md
├── BUGFIX-PHASE2-REPORT.md      ← Phase 2
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
Phase 1: Track B (수동 QA)
    B-1 (CoreHR) ──→ B-2 (Leave/Att) ──→ B-3 (Payroll)
                                              ↓
    B-4 (Perf) ←─────────────────────────────┘
        ↓
    B-5 (Recruit/Onboard) → B-6 (Analytics/Settings) → B-7 (Security)
    ↓
Phase 2: Bug Fix (P0 즉시, P1 순차)
    ↓
Phase 3: Track A (Playwright E2E — Phase 2 완료 후)
    3-0 (Helpers) → 3-1~3-8 (각 모듈 — 병렬 가능) → 3-9 (전체 실행)
    ↓
Phase 4: UX/UI (기능 안정화 후)
    UX-1 → UX-2 → UX-3
```
