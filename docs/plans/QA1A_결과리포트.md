# QA-1A 기능 정합성 감사 리포트 — STEP 0~6A

## 감사일: 2026-03-01
## 감사 범위: 코드 레벨 읽기 전용 (수정 없음)

---

## 요약

| 구분 | 전체 | ✅ 완료 | ⚠️ 부분 | ❌ 미구현 |
|------|------|---------|---------|----------|
| STEP 0 (인증/인프라) | 8 | 8 | 0 | 0 |
| STEP 1 (DB 스키마) | 25 | 25 | 0 | 0 |
| STEP 2 (코어HR+조직도) | 17 | 16 | 1 | 0 |
| STEP 2.5 (Gap 보완) | 10 | 10 | 0 | 0 |
| STEP 3 (온보딩/퇴직) | 10 | 10 | 0 | 0 |
| STEP 4 (근태/휴가) | 14 | 12 | 2 | 0 |
| STEP 5 (채용/징계) | 21 | 20 | 1 | 0 |
| STEP 6A (성과관리) | 33 | 9 | 8 | 16 |
| **합계** | **138** | **110 (80%)** | **12 (9%)** | **16 (12%)** |

---

## STEP 0: 인증 & 공통 인프라

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| 0-1 | Supabase Auth 로그인 | ✅ | `src/app/(auth)/login/page.tsx` 존재 |
| 0-2 | RBAC 5개 역할 | ✅ | `SUPER_ADMIN/HR_ADMIN/HR_MANAGER/MANAGER/EMPLOYEE` — 250회+ 참조 |
| 0-3 | CompanySelector (법인 전환) | ✅ | 컴포넌트 11회 참조 |
| 0-4 | 다법인 시드 데이터 | ✅ | CTR-KR/CN/RU/US/VN/MX 6개 법인 확인 |
| 0-5 | 레이아웃 (사이드바+헤더) | ✅ | `src/app/(dashboard)/layout.tsx` + `Sidebar.tsx` |
| 0-6 | Pretendard 폰트 | ✅ | `layout.tsx` CDN 로드 + `globals.css` 폰트패밀리 |
| 0-7 | API 응답 형식 통일 | ✅ | `apiSuccess/apiError` 패턴 전체 API에 적용 |
| 0-8 | 감사 로그 | ✅ | `AuditLog` Prisma 모델 + `audit_logs` 테이블 |

---

## STEP 1: DB 스키마 (123개 모델)

| # | 테이블 그룹 | 상태 | 비고 |
|---|------------|------|------|
| 1-1 | 조직/권한 (companies, departments, roles 등) | ✅ | |
| 1-2 | 직원 마스터 (employees) | ✅ | |
| 1-3 | 인사 이력 (employee_histories, employee_documents) | ✅ | |
| 1-4 | 퇴직 (terminations→EmployeeOffboarding, exit_interviews) | ✅ | |
| 1-5 | 징계/상벌 (disciplinary_actions, reward_records) | ✅ | |
| 1-6 | 온보딩 (onboarding_templates, onboarding_tasks, onboarding_checkins) | ✅ | |
| 1-7 | 근태 (attendances, attendance_terminals) | ✅ | |
| 1-8 | 휴가 (leave_policies, leave_balances, leave_requests) | ✅ | |
| 1-9 | 채용 (job_postings, applicants, applications, interview_evaluations) | ✅ | |
| 1-10 | 성과 (performance_cycles, mbo_goals, performance_evaluations) | ✅ | |
| 1-11 | CFR (one_on_ones, recognitions) | ✅ | |
| 1-12 | 캘리브레이션 (calibration_rules/sessions/adjustments) | ✅ | |
| 1-13 | 연봉/보상 (salary_bands, compensation_history) | ✅ | |
| 1-14 | 복리후생 (benefit_policies, employee_benefits, allowance_records) | ✅ | |
| 1-15 | Payroll (payroll_runs, payroll_items) | ✅ | |
| 1-16 | 알림 (notifications, notification_triggers) | ✅ | |
| 1-17 | AI (ai_logs) | ✅ | |
| 1-18 | L&D (training_courses, training_enrollments) | ✅ | |
| 1-19 | Pulse (pulse_surveys, pulse_questions, pulse_responses) | ✅ | |
| 1-20 | Self-Service (profile_change_requests) | ✅ | |
| 1-21 | Succession (succession_plans, succession_candidates) | ✅ | |
| 1-22 | Attrition (attrition_risk_history) | ✅ | |
| 1-23 | 챗봇 RAG (hr_documents, hr_document_chunks, hr_chat_sessions) | ✅ | |
| 1-24 | 다면평가 (peer_review_nominations, collaboration_scores) | ✅ | |
| 1-25 | MV 8개 | ✅ | mv_headcount_daily 외 7개 (mv_analytics.sql) |

> **총 Prisma 모델: 123개, MV: 8개**

---

## STEP 2: 코어 HR + 조직도 + 설정

| # | 기능 | 경로 | 상태 | 비고 |
|---|------|------|------|------|
| 2-1 | 홈/대시보드 | /dashboard | ✅ | 역할별 분기 (HrAdminHome/ManagerHome/EmployeeHome/ExecutiveHome) |
| 2-2 | 직원 목록 | /employees | ✅ | DataTable + 검색/필터 (354줄) |
| 2-3 | 직원 상세 | /employees/[id] | ⚠️ | 탭: basic/histories/documents/discipline/compensation — **eval 탭 없음**, compensation은 "coming soon" |
| 2-4 | 직원 등록 | /employees/new | ✅ | 616줄 폼 |
| 2-5 | 조직도 | /org | ✅ | 트리 시각화 + 과거 시점 스냅샷 지원 |
| 2-6 | 조직 개편 관리 | /settings/org-changes | ✅ | 740줄 |
| 2-7 | 법인/브랜딩 | /settings/branding | ✅ | 207줄 |
| 2-8 | 용어 커스터마이징 | /settings/terms | ✅ | |
| 2-9 | 동적 옵션 (Enum) | /settings/enums | ✅ | 329줄 |
| 2-10 | 커스텀 필드 | /settings/custom-fields | ✅ | 312줄 |
| 2-11 | 워크플로우 | /settings/workflows | ✅ | 369줄 |
| 2-12 | 이메일 템플릿 | /settings/email-templates | ✅ | 316줄 |
| 2-13 | 평가 척도 | /settings/evaluation-scale | ✅ | 239줄 |
| 2-14 | 모듈 관리 | /settings/modules | ✅ | 124줄 |
| 2-15 | HR 문서 관리 | /settings/hr-documents | ✅ | HrDocumentManager 컴포넌트 |
| 2-16 | Manager Hub | /manager-hub | ✅ | 5개 API (summary/alerts/pending-approvals/performance/team-health) |
| 2-17 | Command Palette | (컴포넌트) | ✅ | `CommandPalette.tsx` 321줄 |

---

## STEP 2.5: 협업 Gap 보완

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| 2.5-1 | 계약 이력 (ContractHistory) | ✅ | Prisma 모델 + `/employees/[id]/contracts` (242줄) |
| 2.5-2 | 비자/취업허가 (WorkPermit) | ✅ | Prisma 모델 + `/employees/[id]/work-permits` (260줄) |
| 2.5-3 | 법인별 급여 주기 | ✅ | Company 모델에 포함 |
| 2.5-4 | 멕시코 법정 수당 | ✅ | `src/lib/labor/mx.ts` |
| 2.5-5 | 러시아 13월 상여 | ✅ | `src/lib/labor/ru.ts` |
| 2.5-6 | 폴란드 노동법 | ✅ | `src/lib/labor/pl.ts` |
| 2.5-7 | 한국 연차 촉진 3단계 | ✅ | `api/v1/cron/leave-promotion/route.ts` (113줄) + LeavePromotionLog 모델 |
| 2.5-8 | 채용→직원 전환 | ✅ | Application 모델 확장 |
| 2.5-9 | 평가 알림 | ✅ | NotificationTrigger 모델 |
| 2.5-10 | 과거 시점 조직도 | ✅ | OrgSnapshot 모델 + `/api/v1/org/snapshots` (161줄) + OrgClient 날짜선택기 |

---

## STEP 3: 온보딩 + 퇴직 + 셀프서비스

| # | 기능 | 경로 | 상태 | 비고 |
|---|------|------|------|------|
| 3-1 | 온보딩 템플릿 | /settings/onboarding | ✅ | 738줄 |
| 3-2 | 온보딩 현황 | /onboarding | ✅ | 419줄 |
| 3-3 | 내 온보딩 | /onboarding/me | ✅ | 335줄 |
| 3-4 | 감성 체크인 | /onboarding/checkin | ✅ | 271줄 |
| 3-5 | 체크인 관리 | /onboarding/checkins | ✅ | 443줄 |
| 3-6 | 퇴직 체크리스트 설정 | /settings/offboarding | ✅ | 692줄 |
| 3-7 | 퇴직 처리 | /offboarding | ✅ | 622줄 |
| 3-8 | 퇴직 상세 (상태머신) | /offboarding/[id] | ✅ | 813줄 |
| 3-9 | 퇴직 면담 | (퇴직 내) | ✅ | API: exit-interview + AI summary |
| 3-10 | Self-Service 수정 요청 | /settings/profile-requests | ✅ | 309줄 + API |

---

## STEP 4: 근태/휴가/단말기

| # | 기능 | 경로 | 상태 | 비고 |
|---|------|------|------|------|
| 4-1 | 근무 일정 관리 | /settings/work-schedules | ✅ | 414줄 |
| 4-2 | 출퇴근 기록 | /attendance | ✅ | 406줄 + clock in/out UI |
| 4-3 | 단말기 연동 API | /api/v1/terminals/clock | ✅ | 152줄 — 경로가 스펙(`/attendance/terminal`)과 다름 |
| 4-4 | 52시간 준수 | (근태 내) | ✅ | `kr.ts`: `MAX_WEEKLY_HOURS=52` + `validateWorkHours()` |
| 4-5 | 초과근무 신청 | — | ⚠️ | clock-out 시 자동 계산만 있음. **별도 신청/승인 워크플로 없음** |
| 4-6 | 휴가 정책 관리 | /settings/leave-policies | ✅ | |
| 4-7 | 직원 휴가 잔여 | (직원별) | ✅ | EmployeeLeaveBalance 모델 |
| 4-8 | 휴가 신청 | /leave | ✅ | 535줄 |
| 4-9 | 팀 휴가 관리 | /leave/team | ✅ | 331줄 |
| 4-10 | HR 휴가 관리 | /leave/admin | ✅ | 394줄 |
| 4-11 | 공휴일 관리 | /settings/holidays | ✅ | 393줄 |
| 4-12 | 교대근무/시프트 | /attendance/shift-calendar | ✅ | 674줄 + /settings/shift-patterns |
| 4-13 | 국가별 노동법 | src/lib/labor/ | ✅ | 10개 파일 (kr/cn/eu/us/ru/vn/mx/pl + index + types) |
| 4-14 | 관리자 근태 | /attendance/admin | ⚠️ | 페이지 존재하나 사이드바에서 `allAttendance`로 매핑 |

---

## STEP 5: 채용 ATS + 징계/포상

| # | 기능 | 경로 | 상태 | 비고 |
|---|------|------|------|------|
| 5-1 | 채용 공고 목록 | /recruitment | ✅ | RecruitmentListClient |
| 5-2 | 공고 등록 | /recruitment/new | ✅ | PostingFormClient |
| 5-3 | 공고 상세 | /recruitment/[id] | ✅ | PostingDetailClient |
| 5-4 | 공고 수정 | /recruitment/[id]/edit | ✅ | PostingEditClient |
| 5-5 | 파이프라인 칸반 | /recruitment/[id]/pipeline | ✅ | HTML5 native drag-and-drop (dnd-kit 미사용) |
| 5-6 | 지원자 목록 | /recruitment/[id]/applicants | ✅ | |
| 5-7 | 지원서 접수 | /recruitment/[id]/applicants/new | ✅ | |
| 5-8 | AI 이력서 분석 | lib/claude.ts | ⚠️ | 함수명 `analyzeResume` (스펙: `screenCandidate`) — 기능 동일 |
| 5-9 | 면접 일정 | /recruitment/[id]/interviews | ✅ | |
| 5-10 | 면접 등록 | /recruitment/[id]/interviews/new | ✅ | |
| 5-11 | 면접 평가 | (면접 내) | ✅ | 모달 + evaluate API |
| 5-12 | 오퍼 관리 | (파이프라인 내) | ✅ | 오퍼 모달 + offer API |
| 5-13 | 채용 대시보드 | /recruitment/dashboard | ✅ | KPI + BarChart 퍼널 |
| 5-14 | 채용 비용 분석 | /recruitment/cost-analysis | ✅ | |
| 5-15 | 역량 라이브러리 | /settings/competencies | ✅ | |
| 5-16 | 징계 목록 | /discipline | ✅ | |
| 5-17 | 징계 등록 | /discipline/new | ✅ | |
| 5-18 | 징계 상세 | /discipline/[id] | ✅ | |
| 5-19 | 포상 목록 | /discipline/rewards | ✅ | CTR 핵심가치 연계 |
| 5-20 | 포상 등록 | /discipline/rewards/new | ✅ | |
| 5-21 | 포상 상세 | /discipline/rewards/[id] | ✅ | |

---

## STEP 6A: 성과관리

### 6A-① 평가 사이클 + MBO

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| 6A-1 | 평가 사이클 CRUD | ⚠️ | 존재하나 상태머신 **5단계** (DRAFT→ACTIVE→EVAL_OPEN→CALIBRATION→CLOSED), 스펙은 7단계 |
| 6A-2 | 사이클 생성 | ✅ | NewCycleClient |
| 6A-3 | 사이클 상세 | ✅ | CycleDetailClient + advance 모달 |
| 6A-4 | 목표 CRUD | ✅ | GoalsClient + 진행률 |
| 6A-5 | 목표 생성 | ✅ | NewGoalClient (가중치 0-100) |
| 6A-6 | 목표 승인 플로우 | ✅ | DRAFT→PENDING_APPROVAL→APPROVED (스펙의 SUBMITTED와 동일) |
| 6A-7 | 팀 목표 현황 | ✅ | TeamGoalsClient + API |

### 6A-② 성과 평가 + EMS

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| 6A-8 | 자기평가/매니저 평가 UI | ⚠️ | PerformanceClient에 목표/진행률만 표시. **별도 평가 폼 UI 없음** |
| 6A-9 | EMS 9블록 자동 산출 | ✅ | `calculateEmsBlock()` in lib/ems.ts — 완전 구현 |
| 6A-10 | AI 평가 코멘트 | ❌ | `suggestEvalComment` — claude.ts에 **미구현** |

### 6A-③ 캘리브레이션

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| 6A-11 | 캘리브레이션 규칙 설정 | ❌ | `/settings/calibration` 페이지 **없음** |
| 6A-12 | 9블록 매트릭스 인터랙티브 | ⚠️ | analytics/performance에 **읽기 전용** 3×3 그리드만 존재 |
| 6A-13 | 블록 조정 (드래그/모달) | ⚠️ | CalibrationAdjustment Prisma 모델만 존재. **프론트/API 없음** |
| 6A-14 | AI 캘리브레이션 분석 | ❌ | claude.ts에 **미구현** |

### 6A-④ 성과 결과

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| 6A-15 | EMPLOYEE 결과 | ⚠️ | /performance에 목표/진행률만. 전용 결과 페이지 **없음** |
| 6A-16 | MANAGER 팀 결과 | ⚠️ | team-goals 뷰만. 전용 팀 결과 페이지 **없음** |
| 6A-17 | HR_ADMIN 전사 결과 | ⚠️ | analytics/performance에서 EMS 분포만. 전용 **없음** |

### 6A-⑤ CFR (1:1 + Recognition)

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| 6A-18 | 1:1 예약 + 기록 | ❌ | OneOnOne Prisma 모델만 존재. **페이지/API 없음** |
| 6A-19 | AI 미팅 노트 | ❌ | `generateOneOnOneNotes` **미구현** |
| 6A-20 | 30일+ 미실시 경고 | ⚠️ | manager-hub에서 카운트만 표시 |
| 6A-21 | Recognition 피드 | ❌ | `/performance/recognition` — 사이드바 링크 있으나 **페이지 없음** |
| 6A-22 | CTR 핵심가치 필수 | ✅ | `CTR_VALUES` 상수 정의됨 (constants.ts) |
| 6A-23 | 좋아요 + 알림 | ❌ | Recognition 모델에 likes 필드 없음. **미구현** |
| 6A-24 | Recognition 통계 | ❌ | 전용 통계 페이지/API **없음** |

### 6A-⑥ Pulse Survey

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| 6A-25 | 설문 CRUD | ❌ | Prisma 모델만 존재. 설정 페이지/API **없음** |
| 6A-26 | 기본 템플릿 10문항 | ❌ | **미구현** |
| 6A-27 | 직원 응답 폼 | ❌ | **미구현** |
| 6A-28 | 익명 응답 | ❌ | **미구현** |
| 6A-29 | 결과 대시보드 | ❌ | **미구현** |
| 6A-30 | AI Pulse 분석 | ❌ | **미구현** |

### 6A-⑦ 다면평가 (360°)

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| 6A-31 | AI 평가자 추천 | ❌ | `peer-recommend.ts` **없음** |
| 6A-32 | 평가자 선정 3모드 | ❌ | **미구현** |
| 6A-33 | 다면평가 폼 | ❌ | **미구현** |
| 6A-34 | AI 다면평가 요약 | ❌ | **미구현** |
| 6A-35 | peer_weight EMS 반영 | ✅ | `adjustCompetencyWithPeerReview()` in lib/ems.ts 완전 구현 |

---

## 사이드바 ↔ 라우트 정합성

### 사이드바에 있으나 라우트 없음 (9건)

| 사이드바 href | 상태 | 비고 |
|--------------|------|------|
| `/benefits/enrollments` | ❌ | benefits 내 탭으로만 존재 가능 |
| `/org/grades` | ❌ | 직급 관리 페이지 없음 |
| `/performance/competency` | ❌ | 역량 평가 전용 페이지 없음 |
| `/performance/one-on-one` | ❌ | 1:1 미팅 페이지 없음 |
| `/performance/recognition` | ❌ | Recognition 피드 페이지 없음 |
| `/performance/recognition/list` | ❌ | Recognition 목록 페이지 없음 |
| `/performance/results` | ❌ | 성과 결과 전용 페이지 없음 |
| `/settings/audit-log` | ⚠️ | 실제 경로는 `/settings/audit-logs` (복수형) |
| `/settings/roles` | ❌ | 역할 관리 전용 페이지 없음 |

### 라우트 있으나 사이드바에 없음 (주요 항목)

대부분 정상: 상세/생성/수정 페이지(`[id]`, `/new`, `/edit`)는 사이드바에 불필요.
주목할 항목:
- `/analytics/gender-pay-gap` — 사이드바에 미노출
- `/recruitment/cost-analysis` — 사이드바에 미노출
- `/settings/org-changes`, `/settings/monitoring`, `/settings/m365` 등 — 설정 하위 항목 미노출

---

## 판정 요약

### 🔴 Critical — 즉시 조치 필요 (16건)

**STEP 6A에 집중:**

1. **CFR 1:1 미팅** — 사이드바 링크 있으나 페이지/API 전무
2. **Recognition 피드** — 사이드바 링크 있으나 페이지 전무
3. **Pulse Survey 전체** — Prisma 모델만 있고 UI/API 6건 모두 미구현
4. **다면평가 (360°)** — Prisma 모델만 있고 UI/API 4건 미구현
5. **캘리브레이션 설정/인터랙션** — 읽기 전용 그리드만 존재
6. **AI 함수 3개 미구현** — suggestEvalComment, generateOneOnOneNotes, calibrationAnalysis

### 🟡 Non-Critical — 차후 보완 (12건)

1. 사이클 상태머신 5단계 vs 스펙 7단계 (기능적으로는 충분)
2. Employee 상세 탭에 eval 탭 없음 (compensation "coming soon")
3. 초과근무 별도 신청/승인 워크플로 없음 (자동 계산만)
4. Terminal API 경로 불일치 (`/terminals/clock` vs 스펙 `/attendance/terminal`)
5. AI resume 함수명 불일치 (`analyzeResume` vs `screenCandidate`)
6. 사이드바 ↔ 라우트 불일치 9건
7. 성과 결과 전용 페이지 3건 (employee/manager/admin)

### 🟢 N1 진입 전 권장사항

1. STEP 6A ❌ 항목 16건 → **별도 STEP 6A-보완 세션** 필요
2. 사이드바 dead link 9건 → 페이지 생성 또는 사이드바에서 제거
3. AI 함수 미구현 3건 → claude.ts에 추가 또는 스펙에서 제외 확정

---

## 코드베이스 통계 (참고)

| 항목 | 수량 |
|------|------|
| Prisma 모델 | 123 |
| MV | 8 |
| 페이지 (page.tsx) | 115 |
| API 라우트 (route.ts) | 294 |
| 컴포넌트 | 118 |
| 노동법 파일 (lib/labor/) | 10 |
| 사이드바 메뉴 항목 | 60+ |
