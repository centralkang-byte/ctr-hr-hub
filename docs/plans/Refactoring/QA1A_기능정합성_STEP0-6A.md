# QA-1: 기능 정합성 매트릭스 — STEP 0 ~ 6A
# Phase 4.5 — 전체 개발 완료 후, N1 진입 전 품질 검증
# Claude Code에서 바로 실행 | 코드 수정 금지 — 읽기 전용 감사만 수행

---

## ★ 세션 시작: context.md + CLAUDE.md 먼저 읽어줘

이번 세션 목표:
**STEP 0~6A 전체 기능이 실제로 구현되어 있는지 코드 레벨에서 검증하고,
누락/미완성/불일치를 매트릭스로 정리하는 것.**

---

## Phase A: 파일 구조 스캔

```bash
# 1. 전체 페이지 라우트 목록
find src/app -name "page.tsx" -o -name "page.ts" | sort > /tmp/qa_routes.txt
cat /tmp/qa_routes.txt

# 2. 전체 API 라우트 목록
find src/app/api -name "route.ts" -o -name "route.tsx" | sort > /tmp/qa_apis.txt
cat /tmp/qa_apis.txt

# 3. 컴포넌트 + lib 목록
find src/components -name "*.tsx" | wc -l
find src/lib -name "*.ts" -o -name "*.tsx" | sort > /tmp/qa_libs.txt

# 4. 사이드바 메뉴 정의
grep -rn "href\|path\|route" src/components/*Sidebar* src/components/*Nav* src/components/*Layout* 2>/dev/null | head -50
```

---

## Phase B: STEP별 기능 검증

**각 항목을 아래 상태로 분류:**
- ✅ **완료** — 페이지 + API + DB 모두 존재
- ⚠️ **부분** — 일부만 있음 (예: 페이지 있으나 API 누락)
- ❌ **미구현** — 코드 자체가 없음
- 🔍 **확인 필요** — 코드는 있으나 동작 여부 불확실

---

### STEP 0: 인증 & 공통 인프라

| # | 기능 | 확인 포인트 | 상태 |
|---|------|-----------|------|
| 0-1 | Supabase Auth 로그인 | auth 관련 페이지 존재 + createClient | |
| 0-2 | RBAC 5개 역할 | SUPER_ADMIN/HR_ADMIN/HR_MANAGER/MANAGER/EMPLOYEE 미들웨어/가드 | |
| 0-3 | CompanySelector (법인 전환) | CompanySelector 컴포넌트 + 헤더 배치 | |
| 0-4 | 다법인 시드 데이터 | CTR-KR/CN/RU/US/VN/MX 6개 법인 | |
| 0-5 | 레이아웃 (사이드바+헤더) | Dashboard 레이아웃 컴포넌트 | |
| 0-6 | Pretendard 폰트 | layout.tsx 또는 globals.css | |
| 0-7 | API 응답 형식 통일 | `{ success, data, error, meta }` 패턴 | |
| 0-8 | 감사 로그 | audit_logs 테이블 + INSERT 함수 | |

```bash
grep -rn "SUPER_ADMIN\|HR_ADMIN\|HR_MANAGER" src/ --include="*.ts" --include="*.tsx" | head -20
grep -rn "CompanySelector\|company_id" src/components/ --include="*.tsx" | head -10
grep -rn "CTR-KR\|CTR-CN\|CTR-RU" supabase/ src/ | head -10
grep -rn "Pretendard" src/ public/ | head -5
grep -rn "audit_log" src/ supabase/ --include="*.ts" --include="*.sql" | head -10
```

---

### STEP 1: DB 스키마 초기 세팅 (전체 테이블 존재 확인)

| # | 테이블 그룹 | 핵심 테이블 | 상태 |
|---|------------|-----------|------|
| 1-1 | 조직/권한 | companies, departments, positions, roles | |
| 1-2 | 직원 마스터 | employees (50+ 컬럼) | |
| 1-3 | 인사 이력 | employee_histories, employee_documents | |
| 1-4 | 퇴직 | terminations, exit_interviews, offboarding_tasks | |
| 1-5 | 징계/상벌 | disciplines | |
| 1-6 | 온보딩 | onboarding_checklists, onboarding_tasks, onboarding_checkins | |
| 1-7 | 근태 | attendances, overtime_requests | |
| 1-8 | 휴가 | leave_policies, leave_balances, leave_requests | |
| 1-9 | 채용 | job_postings, applications, interview_evaluations | |
| 1-10 | 성과 | performance_cycles, mbo_goals, performance_evaluations | |
| 1-11 | CFR | one_on_ones, one_on_one_notes, recognitions | |
| 1-12 | 캘리브레이션 | calibration_rules, calibration_sessions, calibration_adjustments | |
| 1-13 | 연봉/보상 | salary_bands, salary_adjustments, compensation_packages | |
| 1-14 | 복리후생 | benefit_policies, benefit_enrollments, allowance_records | |
| 1-15 | Payroll | payroll_runs, payroll_details, payslips | |
| 1-16 | 알림 | notifications, notification_preferences | |
| 1-17 | AI | ai_logs | |
| 1-18 | L&D | training_courses, training_enrollments | |
| 1-19 | Pulse | pulse_surveys, pulse_questions, pulse_responses | |
| 1-20 | Self-Service | self_service_requests | |
| 1-21 | Succession | key_positions, succession_candidates | |
| 1-22 | Attrition | attrition_risk_history | |
| 1-23 | 챗봇 RAG | hr_documents, hr_document_chunks, chatbot_conversations | |
| 1-24 | 다면평가 | peer_review_cycles, peer_review_assignments, peer_review_responses, collaboration_scores | |
| 1-25 | MV 8개 | mv_headcount_daily 외 7개 | |

```bash
# 마이그레이션에서 CREATE TABLE 추출
grep -h "CREATE TABLE" supabase/migrations/*.sql | sed 's/.*CREATE TABLE\s*\(IF NOT EXISTS\s*\)\?//' | sed 's/\s*(.*//' | sort | uniq

# MV 목록
grep -h "CREATE.*MATERIALIZED\|CREATE.*VIEW" supabase/migrations/*.sql | head -20

# 코드에서 참조하는 테이블
grep -roh "from('\w\+')\|\.from('\w\+')" src/ --include="*.ts" --include="*.tsx" | sort | uniq -c | sort -rn | head -40
```

---

### STEP 2: 코어 HR + 조직도 + 설정

| # | 기능 | 경로 | 확인 포인트 | 상태 |
|---|------|------|-----------|------|
| 2-1 | 홈/대시보드 | /dashboard | KPI 카드 5개 + 승인대기 + 팀건강 + 주의인원 + 성과요약 | |
| 2-2 | 직원 목록 | /employees | DataTable + 검색/필터 + 법인별 격리 | |
| 2-3 | 직원 상세 | /employees/:id | 마스터-디테일 + 탭 (기본/이력/급여/평가/문서) | |
| 2-4 | 직원 등록 | /employees/new | 생성 폼 + 유효성 + API | |
| 2-5 | 조직도 | /org | 트리 시각화 + 부서/인원 표시 | |
| 2-6 | 조직 개편 관리 | /settings/org-changes | 개편 이력 CRUD + 상태머신 | |
| 2-7 | 법인 관리 | /settings/companies | SUPER_ADMIN 전용 CRUD | |
| 2-8 | 일반 설정 | /settings/customization/general | 법인명/로고/연도 기준 | |
| 2-9 | 용어 커스터마이징 | /settings/customization/terms | 한/영/중/러 용어 오버라이드 | |
| 2-10 | 동적 옵션 관리 | /settings/customization/options | ENUM 카테고리 CRUD | |
| 2-11 | 커스텀 필드 | /settings/customization/fields | 필드 빌더 (7가지 타입) | |
| 2-12 | 워크플로우 설정 | /settings/customization/workflows | 워크플로우 빌더 | |
| 2-13 | 이메일 템플릿 | /settings/customization/templates | 템플릿 CRUD + 변수 치환 | |
| 2-14 | 평가 척도 설정 | /settings/customization/evaluation | 척도 CRUD + 점수 매핑 | |
| 2-15 | 모듈 관리 | /settings/customization/modules | ON/OFF 토글 9개+ | |
| 2-16 | 규정 문서 관리 | /settings/hr-documents | 문서 업로드 + RAG 임베딩 | |
| 2-17 | Manager Hub | /manager-hub | 매니저 전용 5개 섹션 | |
| 2-18 | Command Palette | (컴포넌트) | Cmd+O 검색 | |

```bash
find src/app -path "*dashboard*" -name "page.tsx" | sort
find src/app -path "*employee*" -name "page.tsx" | sort
find src/app -path "*org*" -name "page.tsx" | sort
find src/app -path "*settings*" -name "page.tsx" | sort
grep -rn "CommandPalette\|command-palette" src/components/ --include="*.tsx" | head -5
```

---

### STEP 2.5: 협업 Gap 보완

| # | 기능 | 확인 포인트 | 상태 |
|---|------|-----------|------|
| 2.5-1 | 계약 이력 (contract_history) | 테이블 + 직원 프로필 탭 | |
| 2.5-2 | 비자/취업허가 (work_permits) | 테이블 + 만료 알림 + 프로필 탭 | |
| 2.5-3 | 법인별 급여 주기 | companies 확장 (payroll_frequency) | |
| 2.5-4 | 멕시코 법정 수당 | aguinaldo/vacation_premium 항목 | |
| 2.5-5 | 러시아 13월 상여 | thirteenth_salary 항목 | |
| 2.5-6 | 폴란드 노동법 | lib/labor/pl.ts | |
| 2.5-7 | 한국 연차 촉진 3단계 | lib/cron/leave-promotion.ts + leave_promotion_logs | |
| 2.5-8 | 채용→직원 전환 | applications 확장 + 전환 버튼 | |
| 2.5-9 | 평가 알림 9개 | 8-1~8-3 알림 이벤트 + 이메일 템플릿 | |
| 2.5-10 | 과거 시점 조직도 | org_snapshots + 날짜 선택기 | |

```bash
grep -rn "contract_history\|work_permits\|org_snapshots" supabase/migrations/ --include="*.sql" | head -10
grep -rn "leave.promotion\|leave-promotion" src/lib/ --include="*.ts" | head -5
ls src/lib/labor/ 2>/dev/null
```

---

### STEP 3: 온보딩 + 퇴직 + 셀프서비스

| # | 기능 | 경로 | 확인 포인트 | 상태 |
|---|------|------|-----------|------|
| 3-1 | 온보딩 템플릿 | /settings/onboarding | 템플릿 CRUD (Day 1/7/30/90) | |
| 3-2 | 온보딩 현황 | /onboarding | HR_ADMIN 대시보드 + 진행률 | |
| 3-3 | 내 온보딩 | /onboarding/me | EMPLOYEE 체크리스트 + 진행률 | |
| 3-4 | 감성 체크인 | /onboarding/checkin | 이모지 5단계 + 자유 코멘트 | |
| 3-5 | 퇴직 체크리스트 관리 | /settings/offboarding | 템플릿 CRUD | |
| 3-6 | 퇴직 처리 프로세스 | /offboarding | 7단계 상태머신 (INITIATION→COMPLETED) | |
| 3-7 | 퇴직 면담 | (퇴직 내) | Exit Interview 폼 + 요약 | |
| 3-8 | 업무 인수인계 | (퇴직 내) | 체크리스트 + 진행률 | |
| 3-9 | Attrition 피드백 루프 | (퇴직 내) | 퇴직 사유 → attrition_risk_history 피드백 | |
| 3-10 | Self-Service 수정 요청 | (직원 프로필) | self_service_requests + 승인 | |

```bash
find src/app -path "*onboarding*" -o -path "*offboarding*" | grep "page.tsx" | sort
grep -rn "exit_interview\|EXIT_INTERVIEW" src/ --include="*.ts" --include="*.tsx" | head -10
grep -rn "self_service_request" src/ --include="*.ts" --include="*.tsx" | head -10
```

---

### STEP 4: 근태/휴가/단말기

| # | 기능 | 경로 | 확인 포인트 | 상태 |
|---|------|------|-----------|------|
| 4-1 | 근무 일정 관리 | /settings/work-schedules | 근무 패턴 CRUD + 법인별 | |
| 4-2 | 출퇴근 기록 | /attendance | 출근/퇴근 버튼 + GPS/IP | |
| 4-3 | 단말기 연동 API | /api/attendance/terminal | 외부 단말기 webhook + API key | |
| 4-4 | 52시간 준수 | (근태 내) | 주52시간 경고 + 월간 현황 | |
| 4-5 | 초과근무 신청 | (근태 내) | 신청 폼 + 매니저 승인 | |
| 4-6 | 휴가 정책 관리 | /settings/leave-policies | 정책 CRUD + 국가별 룰 | |
| 4-7 | 직원 휴가 잔여 | (직원별) | leave_balances 자동 계산 | |
| 4-8 | 휴가 신청 | /leave | 신청 폼 + 기간 선택 + 유형 | |
| 4-9 | 매니저 휴가 관리 | /leave/team | 승인/반려 + 팀 캘린더 | |
| 4-10 | HR 휴가 관리 | /leave/admin | 전사 현황 + 일괄 처리 | |
| 4-11 | 공휴일 관리 | /settings/holidays | 국가별 공휴일 CRUD | |
| 4-12 | 교대근무 | (근태 내) | 교대 패턴 관리 | |
| 4-13 | 국가별 노동법 | lib/labor/*.ts | kr/cn/ru/us/vn/mx/pl 7개 | |

```bash
find src/app -path "*attendance*" -o -path "*leave*" | grep "page.tsx" | sort
find src/app/api -path "*attendance*" -o -path "*terminal*" | sort
ls src/lib/labor/ 2>/dev/null
grep -rn "52시간\|overtime\|주52\|WEEKLY_HOUR" src/ --include="*.ts" --include="*.tsx" | head -10
```

---

### STEP 5: 채용 ATS + 징계/포상

| # | 기능 | 경로 | 확인 포인트 | 상태 |
|---|------|------|-----------|------|
| 5-1 | 채용 공고 CRUD | /recruitment | 공고 목록 + 생성/수정/상태관리 | |
| 5-2 | 공고 등록 | /recruitment/new | 9필드+ 폼 + 역량 태그 | |
| 5-3 | 지원자 파이프라인 | /recruitment/:id/pipeline | 8단계 칸반 + dnd-kit | |
| 5-4 | 지원서 접수 | /recruitment/:id/applicants | 지원자 목록 + 필터 | |
| 5-5 | AI 이력서 분석 | (파이프라인 내) | screenCandidate (lib/claude.ts) | |
| 5-6 | 면접 일정 | /recruitment/:id/interviews | 일정 관리 + 면접관 배정 | |
| 5-7 | 면접 평가 | (면접 내) | 역량별 점수 + 코멘트 | |
| 5-8 | 오퍼 관리 | (파이프라인 내) | 오퍼 생성 + 승인 + 응답 | |
| 5-9 | 채용 대시보드 | /recruitment/dashboard | 퍼널 차트 + KPI | |
| 5-10 | 역량 라이브러리 | /settings/competencies | 역량 CRUD (CTR 핵심가치 매핑) | |
| 5-11 | 징계 목록 | /discipline | DataTable + 유형별 필터 | |
| 5-12 | 징계 등록 | (징계 내) | 7가지 유형 + 증빙 + 상태머신 | |
| 5-13 | 이의신청 | (징계 내) | 이의 폼 + 처리 | |
| 5-14 | 포상 관리 | (징계/포상 내) | 포상 CRUD + 유형 | |

```bash
find src/app -path "*recruitment*" -o -path "*discipline*" | grep "page.tsx" | sort
grep -rn "dnd-kit\|DndContext\|useSortable" src/ --include="*.tsx" | head -5
grep -rn "screenCandidate\|aiScreen\|이력서.*분석" src/ --include="*.ts" --include="*.tsx" | head -10
```

---

### STEP 6A: 성과관리 코어

#### 6A-① 평가 사이클 + MBO

| # | 기능 | 경로 | 확인 포인트 | 상태 |
|---|------|------|-----------|------|
| 6A-1 | 평가 사이클 CRUD | /settings/performance-cycles | 7단계 상태머신 | |
| 6A-2 | 사이클 상태 전환 | (설정 내) | DRAFT→GOAL_SETTING→...→FINALIZED | |
| 6A-3 | 목표 CRUD | /performance/goals | 가중치 합=100% 검증 | |
| 6A-4 | 목표 승인 플로우 | (목표 내) | DRAFT→SUBMITTED→APPROVED | |
| 6A-5 | 목표 진행률 | (목표 내) | mbo_progress + 차트 | |
| 6A-6 | 팀 목표 현황 | /performance/team-goals | MANAGER DataTable | |

#### 6A-② 성과 평가 + EMS

| # | 기능 | 경로 | 확인 포인트 | 상태 |
|---|------|------|-----------|------|
| 6A-7 | 자기평가 | /performance/self-eval | 목표+역량 5개 항목 점수 | |
| 6A-8 | 매니저 평가 | /performance/manager-eval | 좌우 분할 (자기평가 참고) | |
| 6A-9 | EMS 9블록 자동 산출 | lib/ems.ts | calculateBlock + thresholds | |
| 6A-10 | AI 평가 코멘트 | lib/claude.ts | suggestEvalComment | |

#### 6A-③ 캘리브레이션

| # | 기능 | 경로 | 확인 포인트 | 상태 |
|---|------|------|-----------|------|
| 6A-11 | 캘리브레이션 규칙 | /settings/calibration | 블록별 비율 가이드라인 | |
| 6A-12 | 9블록 매트릭스 | /performance/calibration | 3×3 인터랙티브 그리드 | |
| 6A-13 | 블록 조정 | (캘리브 내) | 드래그/모달 + calibration_adjustments | |
| 6A-14 | AI 캘리브레이션 분석 | lib/claude.ts | calibrationAnalysis | |
| 6A-15 | 결과 확정 | (캘리브 내) | FINALIZED + 알림 | |

#### 6A-④ 성과 결과

| # | 기능 | 경로 | 확인 포인트 | 상태 |
|---|------|------|-----------|------|
| 6A-16 | EMPLOYEE 결과 | /performance/results | EMS 카드 + Radar Chart | |
| 6A-17 | MANAGER 팀 결과 | /performance/team-results | 미니 매트릭스 + 팀원 목록 | |
| 6A-18 | HR_ADMIN 전사 결과 | /performance/admin | 전사 분포 + 부서 비교 | |

#### 6A-⑤ CFR (1:1 + Recognition)

| # | 기능 | 경로 | 확인 포인트 | 상태 |
|---|------|------|-----------|------|
| 6A-19 | 1:1 예약 + 기록 | /cfr/one-on-ones | 노트 + 액션아이템 | |
| 6A-20 | AI 미팅 노트 | lib/claude.ts | generateOneOnOneNotes | |
| 6A-21 | 30일+ 미실시 경고 | (매니저 대시보드) | 하이라이트 표시 | |
| 6A-22 | Recognition 피드 | /cfr/recognition | 소셜 피드 UI | |
| 6A-23 | CTR 핵심가치 필수 | (Recognition) | CHALLENGE/TRUST/RESPONSIBILITY/RESPECT | |
| 6A-24 | 좋아요 + 알림 | (Recognition) | 좋아요 카운트 + 받는사람 알림 | |
| 6A-25 | Recognition 통계 | (Recognition) | 핵심가치별 분포 + 부서별 + 랭킹 | |

#### 6A-⑥ Pulse Survey

| # | 기능 | 경로 | 확인 포인트 | 상태 |
|---|------|------|-----------|------|
| 6A-26 | 설문 CRUD | /settings/pulse-surveys | 질문 관리 | |
| 6A-27 | 기본 템플릿 10문항 | (설정 내) | 사전 정의 질문 로드 | |
| 6A-28 | 직원 응답 폼 | /pulse | 5가지 질문 유형 | |
| 6A-29 | 익명 응답 | (응답 내) | employee_id=null | |
| 6A-30 | 결과 대시보드 | /pulse/results | Radar + 히스토그램 + 추이 | |
| 6A-31 | AI Pulse 분석 | lib/claude.ts | pulseSurveyAnalysis | |

#### 6A-⑦ 다면평가 (360°)

| # | 기능 | 경로 | 확인 포인트 | 상태 |
|---|------|------|-----------|------|
| 6A-32 | AI 평가자 추천 | lib/peer-recommend.ts | collaboration_scores 기반 | |
| 6A-33 | 평가자 선정 3모드 | /settings/peer-review | HR배정/본인지명/혼합 | |
| 6A-34 | 다면평가 폼 | (평가 내) | 관계 유형별 질문 세트 | |
| 6A-35 | AI 다면평가 요약 | lib/claude.ts | generatePeerReviewSummary | |
| 6A-36 | peer_weight EMS 반영 | lib/ems.ts | adjustWithPeerReview | |

```bash
# 성과 전체
find src/app -path "*performance*" -o -path "*cfr*" -o -path "*pulse*" | grep "page.tsx" | sort
grep -rn "calculateBlock\|suggestEvalComment\|calibrationAnalysis\|generateOneOnOneNotes\|pulseSurveyAnalysis\|generatePeerReviewSummary\|adjustWithPeerReview" src/lib/ --include="*.ts" | head -15
grep -rn "CHALLENGE\|TRUST\|RESPONSIBILITY\|RESPECT" src/ --include="*.tsx" | head -10
```

---

## Phase C: 사이드바 ↔ 라우트 정합성

```bash
# 사이드바에 정의된 href 추출
grep -rn "href\|to=" src/components/*Sidebar* src/components/*Nav* --include="*.tsx" | grep -oP "(?:href|to)=['\"]([^'\"]+)" | sort | uniq

# 실제 존재하는 라우트
find src/app -name "page.tsx" | sed 's|src/app||;s|/page.tsx||' | sort

# 대조해서 불일치 식별
```

---

## Phase D: 결과 리포트

검증 결과를 `/tmp/qa1_functional_audit.md`에 저장:

```markdown
# QA-1 기능 정합성 감사 리포트 — STEP 0~6A
## 감사일: {날짜}

### 요약
- 전체 검증 항목: {N}개
- ✅ 완료: {n}개 ({%})
- ⚠️ 부분: {n}개 ({%})
- ❌ 미구현: {n}개 ({%})
- 🔍 확인 필요: {n}개 ({%})

### STEP별 상세
(매트릭스 결과)

### 사이드바 ↔ 라우트 불일치
- 사이드바에 있으나 라우트 없음: [목록]
- 라우트 있으나 사이드바에 없음: [목록]

### 🔴 Critical (즉시 조치)
### 🟡 Non-Critical (차후 보완)
### 🟢 N1 진입 전 권장사항
```

---

## ⚠️ 주의사항
1. **코드 수정 절대 금지** — 읽기 전용 감사만
2. 빌드/타입체크는 QA-2에서 수행
3. 디자인 검증은 QA-3에서 수행
4. 의심스러운 항목은 🔍로 — 단정짓지 말 것
5. 결과 리포트 **반드시 파일 저장** + context.md 요약 추가
6. 이 프롬프트는 QA-1 of 3 — STEP 6B~9는 QA-1B에서 별도 검증
