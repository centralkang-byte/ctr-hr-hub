# CTR HR Hub — Page Catalog (Q-0)

> 스캔일: 2026-03-12 | 총 페이지: **152** (H-3 레거시 정리 후)
> Auth: NextAuth (Microsoft Entra ID + Credentials test login)

## Summary by Section

| Section | Pages | Role |
|---------|:-----:|------|
| Auth | 1 | ALL |
| Home | 3 | ALL |
| My Space | 15 | ALL |
| Team | 4 | MANAGER+ |
| HR Management | 18 | HR_ADMIN+ |
| Recruitment | 14 | HR_ADMIN+ |
| Performance/Compensation | 26 | HR_ADMIN+ |
| Payroll | 13 | HR_ADMIN+ |
| Insights | 14 | MANAGER+ |
| Compliance | 7 | HR_ADMIN+ |
| Settings | 7 | HR_ADMIN+ |
| Other (training, delegation, etc.) | 30 | Mixed |
| **Total** | **152** | |

---

## Detailed Catalog

### 🏠 Home & Auth

| Route | Type | 대상 | 설명 | 핵심 액션 |
|-------|------|------|------|-----------|
| `/(auth)/login` | form | ALL | 로그인 (Azure AD + 테스트 이메일) | 로그인 |
| `/home` | dashboard | ALL | 홈 대시보드 (위젯 그리드, 태스크 허브) | 퀵 액션 |
| `/dashboard` | dashboard | ALL | 대시보드 (대체 경로) | — |
| `/dashboard/compare` | dashboard | MANAGER+ | 대시보드 비교 보기 | 필터, 비교 |
| `/notifications` | table | ALL | 알림 목록 (읽음/안읽음) | 읽음 처리 |
| `/approvals/inbox` | table | MANAGER+ | 승인 인박스 (통합) | 승인, 반려 |
| `/approvals/attendance` | table | MANAGER+ | 근태 승인 | 승인, 반려 |
| `/403` | other | ALL | 권한 없음 페이지 | — |
| `/offline` | other | ALL | 오프라인 페이지 | — |

### 👤 My Space (나의 공간)

| Route | Type | 설명 | 핵심 액션 |
|-------|------|------|-----------|
| `/my` | dashboard | 나의 공간 허브 | — |
| `/my/tasks` | table | 나의 업무 (Unified Task Hub) | 인라인 승인/반려 |
| `/my/profile` | detail | 내 프로필 | 수정, 사진 변경 |
| `/my/benefits` | table | 내 복리후생 | 신청 |
| `/my/internal-jobs` | table | 사내 채용 (내부 공모) | 지원 |
| `/my/leave` | form | 내 휴가 신청/현황 | 신청, 취소 |
| `/my/offboarding` | detail | 나의 퇴직처리 현황 | 태스크 완료 |
| `/my/skills` | form | 스킬 자기평가 | 수정 |
| `/my/training` | table | 나의 교육 이수 현황 | 등록, 수료 |
| `/my/year-end` | form | 연말정산 (KR) | 제출, 수정 |
| `/my/settings/notifications` | settings | 알림 설정 (개인) | 토글 |
| `/employees/me` | detail | 내 직원 상세 (대체 경로) | — |
| `/attendance` | dashboard | 출퇴근 (나의 근태) | 출근, 퇴근 |
| `/leave` | form | 휴가 신청/현황 (대체 경로) | 신청, 취소 |
| `/performance` | dashboard | 내 성과 개요 | — |

### 👥 Team (팀 관리) — MANAGER+

| Route | Type | 설명 | 핵심 액션 |
|-------|------|------|-----------|
| `/manager-hub` | dashboard | 팀 현황 대시보드 | — |
| `/attendance/team` | table | 팀 근태 현황 | — |
| `/leave/team` | table | 팀 휴가 현황 | 승인, 반려 |
| `/team/skills` | table | 팀 스킬 매트릭스 | — |
| `/delegation/settings` | form | 위임 설정 (생성/해제) | 생성, 해제 |

### 🏢 HR Management (인사 관리) — HR_ADMIN+

| Route | Type | 설명 | 핵심 액션 |
|-------|------|------|-----------|
| `/employees` | table | 직원 목록 | 검색, 필터, 엑셀 |
| `/employees/new` | form | 직원 등록 | 생성 |
| `/employees/[id]` | detail | 직원 상세 | 수정, 발령 |
| `/employees/[id]/contracts` | table | 계약 이력 | 추가 |
| `/employees/[id]/work-permits` | table | 취업 허가 관리 | 추가 |
| `/directory` | table | 구성원 디렉토리 | 검색, 프로필 |
| `/org` | tree | 조직도 | 드래그, 검색 |
| `/org-studio` | tree | 조직 변경 스튜디오 | 시뮬레이션 |
| `/organization/skill-matrix` | table | 조직 스킬 매트릭스 | — |
| `/attendance/admin` | table | 근태 관리 (HR) | 수정, 마감 |
| `/attendance/shift-calendar` | dashboard | 교대 캘린더 | — |
| `/attendance/shift-roster` | table | 교대 편성표 | 편성 |
| `/leave/admin` | dashboard | 휴가 관리 (HR) | 일괄 부여 |
| `/onboarding` | dashboard | 온보딩 대시보드 | — |
| `/onboarding/[id]` | detail | 온보딩 상세 (태스크, sign-off) | 태스크 완료, sign-off |
| `/onboarding/me` | detail | 나의 온보딩 | 태스크 완료 |
| `/onboarding/checkin` | form | 온보딩 체크인 폼 | 제출 |
| `/onboarding/checkins` | table | 체크인 관리 (HR) | — |
| `/offboarding` | dashboard | 오프보딩 대시보드 | — |
| `/offboarding/[id]` | detail | 오프보딩 상세 | 태스크 완료 |
| `/offboarding/exit-interviews` | dashboard | 퇴직 면담 통계 (익명) | — |
| `/discipline` | table | 징계/포상 목록 | — |
| `/discipline/[id]` | detail | 징계 상세 | — |
| `/discipline/new` | form | 징계 등록 | 생성 |
| `/discipline/rewards` | table | 포상 목록 | — |
| `/discipline/rewards/[id]` | detail | 포상 상세 | — |
| `/discipline/rewards/new` | form | 포상 등록 | 생성 |

### 👥 Recruitment (채용) — HR_ADMIN+

| Route | Type | 설명 | 핵심 액션 |
|-------|------|------|-----------|
| `/recruitment` | table | 채용 공고 목록 | 검색, 필터 |
| `/recruitment/new` | form | 채용 공고 등록 | 생성 |
| `/recruitment/[id]` | detail | 채용 공고 상세 | 수정 |
| `/recruitment/[id]/edit` | form | 채용 공고 수정 | 저장 |
| `/recruitment/[id]/pipeline` | pipeline | 파이프라인 보기 | 단계 이동 |
| `/recruitment/[id]/applicants` | table | 지원자 목록 | AI 스크리닝 |
| `/recruitment/[id]/applicants/new` | form | 지원자 등록 | 생성 |
| `/recruitment/[id]/interviews` | table | 면접 목록 | — |
| `/recruitment/[id]/interviews/new` | form | 면접 등록 | 생성 |
| `/recruitment/board` | kanban | 칸반 보드 | 드래그 |
| `/recruitment/dashboard` | dashboard | 채용 대시보드 | — |
| `/recruitment/cost-analysis` | dashboard | 채용 비용 분석 | — |
| `/recruitment/requisitions` | table | 채용 요청 목록 | — |
| `/recruitment/requisitions/new` | form | 채용 요청 등록 | 생성 |
| `/recruitment/talent-pool` | table | 인재 풀 | 검색 |

### 📊 Performance & Compensation

| Route | Type | 설명 | 핵심 액션 |
|-------|------|------|-----------|
| `/performance/admin` | dashboard | 성과 관리 (HR) | — |
| `/performance/goals` | table | 목표 관리 목록 | — |
| `/performance/goals/new` | form | 목표 등록 | 생성 |
| `/performance/team-goals` | table | 팀 목표 | — |
| `/performance/team-results` | table | 팀 성과 결과 | — |
| `/performance/results` | table | 성과 결과 (HR) | — |
| `/performance/calibration` | dashboard | 캘리브레이션 | 조정 |
| `/performance/cycles` | table | 평가 주기 목록 | 생성, 상태 전환 |
| `/performance/cycles/[id]` | detail | 평가 주기 상세 (7-state pipeline) | 단계 진행 |
| `/performance/manager-eval` | form | 매니저 평가 | 저장, 제출 |
| `/performance/manager-evaluation` | form | 매니저 평가 (대체) | 저장, 제출 |
| `/performance/self-eval` | form | 자기 평가 | 저장, 제출 |
| `/performance/my-goals` | table | 나의 목표 | 등록, 제출 |
| `/performance/my-checkins` | table | 나의 체크인 | 기록 |
| `/performance/my-evaluation` | form | 나의 평가 | 자기평가 제출 |
| `/performance/my-peer-review` | table | 나의 동료 평가 | 평가 제출 |
| `/performance/my-result` | detail | 나의 성과 결과 (data masking) | 확인 |
| `/performance/peer-review` | table | 동료 평가 관리 | — |
| `/performance/peer-review/[cycleId]/setup` | form | 동료 평가 셋업 | 후보 지정 |
| `/performance/peer-review/evaluate/[nominationId]` | form | 동료 평가 작성 | 제출 |
| `/performance/peer-review/results/[cycleId]` | dashboard | 동료 평가 결과 | — |
| `/performance/comp-review` | dashboard | 보상 리뷰 | 승인, 반려 |
| `/performance/one-on-one` | table | 1:1 미팅 목록 | 생성 |
| `/performance/one-on-one/[id]` | detail | 1:1 미팅 상세 | 기록, 완료 |
| `/performance/notifications` | table | 성과 알림 | — |
| `/performance/pulse` | table | 펄스 서베이 목록 | 생성 |
| `/performance/pulse/[id]/respond` | form | 펄스 응답 | 제출 |
| `/performance/pulse/[id]/results` | dashboard | 펄스 결과 | — |
| `/performance/recognition` | dashboard | 리코그니션 (칭찬) | 보내기 |
| `/compensation` | dashboard | 보상 관리 | — |
| `/benefits` | table | 복리후생 관리 (HR) | — |
| `/succession` | table | 승계 계획 | — |
| `/talent/succession` | table | 인재 풀/승계 (대체 경로) | — |

### 💰 Payroll (급여) — HR_ADMIN+

| Route | Type | 설명 | 핵심 액션 |
|-------|------|------|-----------|
| `/payroll` | dashboard | 급여 대시보드 (파이프라인) | 퀵 액션 |
| `/payroll/close-attendance` | form | 근태 마감 | 마감 실행 |
| `/payroll/adjustments` | table | 수동 조정 | 추가, 삭제 |
| `/payroll/anomalies` | table | 이상 검토 | 화이트리스트 |
| `/payroll/[runId]/review` | detail | 급여 검토 | 승인 진행 |
| `/payroll/[runId]/approve` | form | 급여 승인 | 승인, 반려 |
| `/payroll/[runId]/publish` | form | 급여 발행 | 명세서 발송 |
| `/payroll/simulation` | dashboard | 급여 시뮬레이션 | 시뮬레이션 실행 |
| `/payroll/bank-transfers` | table | 이체 내역 | CSV 다운로드 |
| `/payroll/global` | table | 글로벌 급여 | — |
| `/payroll/import` | form | 급여 데이터 임포트 | 업로드 |
| `/payroll/year-end` | dashboard | 연말정산 (HR) | — |
| `/payroll/me` | table | 내 급여명세서 목록 | — |
| `/payroll/me/[runId]` | detail | 내 급여명세서 상세 | 다운로드 |

### 📈 Insights (인사이트) — MANAGER+

| Route | Type | 설명 | 핵심 액션 |
|-------|------|------|-----------|
| `/analytics` | dashboard | Executive Summary | 필터 |
| `/analytics/workforce` | dashboard | 인력 분석 | 필터 |
| `/analytics/payroll` | dashboard | 급여 분석 | 필터 |
| `/analytics/performance` | dashboard | 성과 분석 | 필터 |
| `/analytics/attendance` | dashboard | 근태/휴가 분석 | 필터 |
| `/analytics/turnover` | dashboard | 이직 분석 | 필터 |
| `/analytics/team-health` | dashboard | 팀 건강 | 필터 |
| `/analytics/ai-report` | dashboard | AI 리포트 | 생성 |
| `/analytics/attrition` | dashboard | 이탈 위험 분석 | — |
| `/analytics/compensation` | dashboard | 보상 분석 | — |
| `/analytics/gender-pay-gap` | dashboard | 성별 급여 격차 | — |
| `/analytics/predictive` | dashboard | 예측 분석 | — |
| `/analytics/predictive/[employeeId]` | detail | 개인 예측 상세 | — |
| `/analytics/recruitment` | dashboard | 채용 분석 | — |
| `/analytics/report` | dashboard | 리포트 | — |

### 🛡️ Compliance (컴플라이언스) — HR_ADMIN+

| Route | Type | 설명 | 핵심 액션 |
|-------|------|------|-----------|
| `/compliance` | dashboard | 컴플라이언스 허브 | — |
| `/compliance/gdpr` | dashboard | GDPR/개인정보 | 요청 관리 |
| `/compliance/data-retention` | table | 데이터 보관 정책 | — |
| `/compliance/dpia` | table | DPIA | — |
| `/compliance/pii-audit` | table | PII 감사 | — |
| `/compliance/kr` | dashboard | 한국 컴플라이언스 | — |
| `/compliance/cn` | dashboard | 중국 컴플라이언스 | — |
| `/compliance/ru` | dashboard | 러시아 컴플라이언스 | — |

### ⚙️ Settings (설정) — HR_ADMIN+

| Route | Type | 설명 | 탭 수 |
|-------|------|------|:-----:|
| `/settings` | dashboard | 설정 허브 (카테고리 카드) | — |
| `/settings/organization` | settings | 조직/인사 설정 | 8 |
| `/settings/attendance` | settings | 근태/휴가 설정 | 8 |
| `/settings/payroll` | settings | 급여/보상 설정 | 8 |
| `/settings/performance` | settings | 성과/평가 설정 | 7 |
| `/settings/recruitment` | settings | 채용/온보딩 설정 | 6 |
| `/settings/system` | settings | 시스템 설정 | 7 |

### 📚 Other

| Route | Type | 설명 | 핵심 액션 |
|-------|------|------|-----------|
| `/training` | table | 교육 과정 관리 | 생성 |
| `/training/enrollments` | table | 교육 이수 관리 | — |
| `/(dashboard)` | other | 대시보드 레이아웃 | — |
