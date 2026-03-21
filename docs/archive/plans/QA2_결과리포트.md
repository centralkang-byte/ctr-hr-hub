# QA-2 빌드·코드 품질 감사 리포트

## 감사일: 2026-03-01
## 범위: 전체 코드베이스 (src/ + supabase/)

---

## 총 요약

| 지표 | 결과 |
|------|------|
| tsc --noEmit | **0 errors** |
| npm run build | **성공** |
| ESLint errors | **0개** |
| ESLint warnings | **119개** |
| 고아 컴포넌트 | **7개** |
| 비표준 API 응답 | **6개** |
| Auth 체크 누락 API | **158/294 (54%)** |
| company_id 필터 누락 | **22개** |
| RLS 정책 | **0개** |
| 감사 로그 참조 | **2건 (극히 적음)** |
| 500줄 이상 파일 | **29개** |

---

## A. 빌드 + 타입 검증 ✅

| 항목 | 결과 | 판정 |
|------|------|------|
| `npx tsc --noEmit` | 0 errors | ✅ PASS |
| `npm run build` | 성공 (exit 0) | ✅ PASS |
| ESLint errors | 0개 | ✅ PASS |
| ESLint warnings | 119개 | ⚠️ 허용 범위 |

### ESLint 경고 상세 (119건)

| 규칙 | 건수 | 심각도 |
|------|------|--------|
| `@typescript-eslint/no-unused-vars` | 105 | 낮음 (클린업 권장) |
| `react-hooks/exhaustive-deps` | 9 | 중간 (의도적 제외 가능) |
| `@next/next/no-img-element` | 5 | 낮음 (next/image 권장) |

---

## B. 데드코드 + 미사용 import

### 고아 컴포넌트 7개 (다른 파일에서 참조 없음)

| 파일 | 비고 |
|------|------|
| `src/components/icons/CoreValueIcons.tsx` | 아이콘 세트 — 향후 사용 가능 |
| `src/components/payroll/SeveranceCalculator.tsx` | 퇴직금 계산기 — 향후 사용 가능 |
| `src/components/recruitment/ConvertToEmployeeButton.tsx` | 채용→입사 전환 — 향후 사용 가능 |
| `src/components/shared/CustomFieldsSection.tsx` | 커스텀 필드 — 향후 사용 가능 |
| `src/components/shared/LoadingSpinner.tsx` | 로딩 스피너 — 유틸리티 |
| `src/components/shared/ModuleGate.tsx` | 모듈 게이트 — 향후 사용 가능 |
| `src/components/shared/PermissionGate.tsx` | 권한 게이트 — 향후 사용 가능 |

> 대부분 향후 확장용 컴포넌트. 즉시 삭제 불필요하나 N1+ 단계에서 활용 또는 정리 필요.

### 미사용 import (ESLint 기반)

- `no-unused-vars` 105건: 대부분 destructuring 시 미사용 변수. `_` 접두사 리팩토링 권장.

---

## C. API 응답 패턴 일관성

### 표준 형식: `{ success, data, error }`

| 지표 | 수치 |
|------|------|
| 전체 API 라우트 | 294개 |
| 표준 형식 준수 | 288개 (98%) |
| 비표준 | 6개 (2%) |

### 비표준 API 목록

| 라우트 | 사유 |
|--------|------|
| `/api/v1/locale` | 단순 locale 반환 (표준 불필요) |
| `/api/v1/compliance/cron/retention` | Cron 내부 처리 |
| `/api/v1/push/vapid-key` | VAPID 공개키 반환 |
| `/api/v1/teams/webhook` | MS Teams 웹훅 수신 |
| `/api/v1/teams/bot` | MS Teams 봇 응답 |
| `/api/v1/monitoring/health` | 헬스체크 (표준 불필요) |

> 모두 외부 연동 또는 내부 유틸 API. 의도적 비표준으로 문제 없음.

---

## D. RBAC / 보안 감사

### 🔴 Auth 체크 현황

| 지표 | 수치 |
|------|------|
| 전체 API | 294개 |
| Auth 체크 있음 | 136개 (46%) |
| Auth 체크 없음 | 158개 (54%) |

> **주의:** grep 기반 탐지이므로 미들웨어/레이아웃 레벨 인증이 적용되어 있을 수 있음.
> Next.js `middleware.ts`에서 전역 세션 체크가 있다면, 개별 라우트에서 중복 체크 불필요.
> 다만, **역할 기반 접근제어(RBAC)**는 개별 API에서 확인 필요.

### 주요 누락 영역

| 영역 | 누락 수 | 위험도 |
|------|---------|--------|
| Settings API (20+) | ~26개 | 🔴 높음 (관리자 전용이어야 함) |
| Compliance API | ~30개 | 🟡 중간 |
| Payroll API | ~10개 | 🔴 높음 (급여 데이터) |
| Analytics API | ~9개 | 🟡 중간 |
| HR Documents | ~2개 | 🟡 중간 |

### company_id 필터 누락 (22건)

| 라우트 | 비고 |
|--------|------|
| attendance/today, weekly-summary, monthly | 개인 근태 → 세션 기반 가능 |
| home/pending-actions | 세션 기반 가능 |
| notifications/* (4건) | 세션 기반 가능 |
| onboarding/me, tasks | 개인 온보딩 → 세션 기반 가능 |
| leave/requests/[id], balances | 개인 휴가 → 세션 기반 가능 |
| compliance/kr/severance-interim/calculate | 계산 전용 |
| payroll/severance/[employeeId] | 🔴 직접 company_id 필요 |
| teams/config/test, channels | Teams 연동 |
| migration/templates | 마이그레이션 |
| analytics/refresh | 관리자 전용 |
| cron/leave-promotion | Cron 내부 |

> 개인 데이터 API는 세션에서 user_id 추출로 격리 가능. 관리자/급여 API는 company_id 필터 추가 권장.

### 🔴 RLS 정책: 0개

PostgreSQL Row Level Security 정책 미적용. QA-1에서도 지적된 Critical 이슈.

---

## E. 감사 로그

| 지표 | 수치 |
|------|------|
| 코드 내 audit 참조 | 2건 |
| 쓰기 API 중 감사 로그 누락 | 33건 |

> **감사 로그 시스템이 거의 미적용 상태.**
> `settings/audit-logs` 페이지와 API는 존재하나, 실제 다른 API에서 감사 로그를 기록하는 코드가 거의 없음.
> HR 시스템 특성상 급여/인사변경/권한변경 등에 감사 로그 필수.

---

## F. 코드 규모 + 복잡도

### 전체 규모

| 항목 | 수치 |
|------|------|
| 전체 TS/TSX 파일 | 762개 |
| 전체 코드 라인 | **102,255줄** |
| 컴포넌트 파일 | 118개 |
| 컴포넌트 총 라인 | 19,267줄 |
| 컴포넌트 평균 | **163줄/파일** |

### 500줄 이상 파일 (29개) — 분할 검토 대상

| 라인 | 파일 |
|------|------|
| 944 | `employees/[id]/EmployeeDetailClient.tsx` |
| 813 | `offboarding/[id]/OffboardingDetailClient.tsx` |
| 740 | `settings/org-changes/OrgChangesClient.tsx` |
| 738 | `settings/onboarding/OnboardingSettingsClient.tsx` |
| 702 | `recruitment/[id]/interviews/InterviewListClient.tsx` |
| 692 | `settings/offboarding/OffboardingSettingsClient.tsx` |
| 687 | `settings/salary-bands/SalaryBandsClient.tsx` |
| 674 | `attendance/shift-calendar/ShiftCalendarClient.tsx` |
| 661 | `settings/data-migration/DataMigrationClient.tsx` |
| 649 | `settings/audit-logs/AuditLogClient.tsx` |
| 635 | `recruitment/cost-analysis/CostAnalysisClient.tsx` |
| 622 | `offboarding/OffboardingDashboardClient.tsx` |
| 616 | `employees/new/EmployeeNewClient.tsx` |
| 610 | `recruitment/[id]/pipeline/PipelineClient.tsx` |
| 602 | `settings/salary-matrix/SalaryMatrixClient.tsx` |
| 596 | `payroll/bank-transfers/BankTransfersClient.tsx` |
| 577 | `settings/shift-patterns/ShiftPatternsClient.tsx` |
| 577 | `performance/PerformanceClient.tsx` |
| 570 | `settings/competencies/CompetencyListClient.tsx` |
| ... | (이하 9개 파일) |

> 대부분 Client 페이지 컴포넌트. 탭/모달 등을 하위 컴포넌트로 분리하면 개선 가능하나, 기능상 문제 없음.

---

## 🔴 Critical — 즉시 조치 필요 (3건)

| # | 항목 | 상세 |
|---|------|------|
| 1 | **RLS 정책 0개** | PostgreSQL 행 보안 미적용. multi-tenant 격리가 앱 레이어에만 의존 |
| 2 | **감사 로그 미적용** | 쓰기 API 33건에 감사 로그 없음. HR 컴플라이언스 요구사항 미충족 |
| 3 | **Settings API RBAC 누락** | 관리자 전용 API에 역할 체크 없음 (미들웨어 확인 필요) |

## 🟡 권장 개선 (4건)

| # | 항목 | 상세 |
|---|------|------|
| 1 | ESLint unused-vars 105건 | `_` 접두사 리네이밍으로 정리 |
| 2 | 고아 컴포넌트 7개 | N1+ 활용 또는 정리 |
| 3 | company_id 필터 보강 | 급여/관리자 API에 명시적 필터 추가 |
| 4 | 500줄+ 파일 29개 | 컴포넌트 분할로 유지보수성 개선 |

## 🟢 정보 (양호)

| # | 항목 | 상세 |
|---|------|------|
| 1 | 빌드 | tsc 0 errors, build 성공 |
| 2 | ESLint errors | 0개 |
| 3 | API 응답 패턴 | 98% 표준 준수 |
| 4 | 코드 규모 | 102K줄, 762파일 — HR SaaS 규모 적절 |
| 5 | 컴포넌트 평균 | 163줄 — 양호 |

---

## 빌드 수정 필요 여부

**수정 불필요.** tsc 0 errors, build 성공 상태.
