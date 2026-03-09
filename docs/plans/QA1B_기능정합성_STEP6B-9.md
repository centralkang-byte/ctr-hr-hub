# QA-1B: 기능 정합성 매트릭스 — STEP 6B ~ 9
# Phase 4.5 — QA-1A (STEP 0~6A) 완료 후 이어서 실행
# Claude Code에서 바로 실행 | 코드 수정 금지 — 읽기 전용 감사만 수행

---

## ★ 세션 시작: context.md + CLAUDE.md + QA-1A 리포트 먼저 읽어줘

이번 세션 목표:
**STEP 6B~9 전체 기능이 실제로 구현되어 있는지 코드 레벨에서 검증하고,
QA-1A 리포트에 이어서 통합 매트릭스를 완성하는 것.**

---

## 상태 분류 기준 (QA-1A와 동일)
- ✅ **완료** — 페이지 + API + DB 모두 존재
- ⚠️ **부분** — 일부만 있음
- ❌ **미구현** — 코드 자체가 없음
- 🔍 **확인 필요** — 코드는 있으나 동작 여부 불확실

---

### STEP 6B: 연봉·보상 + 복리후생 + Attrition + L&D + Succession

#### 6B-① 연봉·보상

| # | 기능 | 경로 | 확인 포인트 | 상태 |
|---|------|------|-----------|------|
| 6B-1 | 급여 밴드 관리 | /settings/salary-bands | CRUD + Compa-Ratio 5단계 (0.80~1.20+) | |
| 6B-2 | 연봉 조정 매트릭스 | /settings/salary-matrix | 3×3 매트릭스 (EMS블록 × 밴드포지션) | |
| 6B-3 | 연봉 조정 시뮬레이션 | /compensation/simulation | 필터 + 개별 입력 + 전체 예산 계산 | |
| 6B-4 | AI 연봉 추천 | (시뮬레이션 내) | suggestSalaryAdjustment (lib/claude.ts) | |
| 6B-5 | 연봉 조정 확정 | /compensation | 일괄 승인 + salary_adjustments INSERT | |
| 6B-6 | 연봉 이력 조회 | (직원 프로필 내) | 연봉 변동 차트 + Compa-Ratio 추이 | |
| 6B-7 | 보상 구조 | (보상 내) | compensation_packages 테이블 | |

```bash
find src/app -path "*compensation*" -o -path "*salary*" | grep "page.tsx" | sort
grep -rn "salary_bands\|salary_adjustments\|compensation_packages\|compa.ratio\|Compa" src/ --include="*.ts" --include="*.tsx" | head -15
grep -rn "suggestSalaryAdjustment" src/lib/ --include="*.ts" | head -5
```

#### 6B-② 복리후생

| # | 기능 | 경로 | 확인 포인트 | 상태 |
|---|------|------|-----------|------|
| 6B-8 | 복리후생 정책 관리 | /settings/benefits | 9유형 CRUD + 대상자 범위 | |
| 6B-9 | 직원 복리후생 (EMPLOYEE) | /benefits/me | 내 혜택 목록 + 신청 | |
| 6B-10 | 복리후생 관리 (HR) | /benefits/admin | 전사 현황 + 신청 처리 | |
| 6B-11 | 수당 기록 | (복리후생 내) | allowance_records CRUD | |

```bash
find src/app -path "*benefits*" | grep "page.tsx" | sort
grep -rn "benefit_policies\|benefit_enrollments\|allowance_records" src/ --include="*.ts" --include="*.tsx" | head -10
```

#### 6B-③ Attrition Risk

| # | 기능 | 경로 | 확인 포인트 | 상태 |
|---|------|------|-----------|------|
| 6B-12 | 위험 점수 산출 | lib/ | 6요인 모델 (재직기간/급여/성과/근태/펄스/1:1) | |
| 6B-13 | AI 보정 | lib/claude.ts | predictAttritionRisk | |
| 6B-14 | Attrition 대시보드 | /analytics/attrition | KPI + 도넛 + 히트맵 + 추이 | |
| 6B-15 | 매니저 뷰 | (매니저 허브 내) | 팀 위험 인원 하이라이트 | |
| 6B-16 | 예측 정확도 피드백 | (퇴직 연동) | 실제 퇴직 → 피드백 루프 | |

```bash
grep -rn "attrition\|ATTRITION\|이직.*위험\|predictAttrition" src/ --include="*.ts" --include="*.tsx" | head -15
find src/app -path "*attrition*" | grep "page.tsx" | sort
```

#### 6B-④ L&D 교육관리

| # | 기능 | 경로 | 확인 포인트 | 상태 |
|---|------|------|-----------|------|
| 6B-17 | 교육 과정 관리 | /settings/training | 7유형 CRUD (CLASSROOM/ELEARNING/OJT...) | |
| 6B-18 | HR 교육 관리 | /training/admin | 수강 현황 + 일괄 배정 | |
| 6B-19 | 직원 교육 | /training/me | 내 교육 목록 + 수강 완료 | |
| 6B-20 | 매니저 교육 현황 | /training/team | 팀원 이수율 | |
| 6B-21 | 교육→성과 연계 | (프로필 내) | 교육 이력 + 역량 성장 | |

```bash
find src/app -path "*training*" | grep "page.tsx" | sort
grep -rn "training_courses\|training_enrollments" src/ --include="*.ts" --include="*.tsx" | head -10
```

#### 6B-⑤ Succession Planning

| # | 기능 | 경로 | 확인 포인트 | 상태 |
|---|------|------|-----------|------|
| 6B-22 | 핵심 직책 관리 | /succession | key_positions CRUD | |
| 6B-23 | 후계자 후보 관리 | (succession 내) | succession_candidates + 준비도 | |
| 6B-24 | EMS 연계 | (succession 내) | 9블록 → 후계자 적격성 | |
| 6B-25 | Succession 대시보드 | (succession 내) | 커버리지 + 준비도 차트 | |

```bash
find src/app -path "*succession*" | grep "page.tsx" | sort
grep -rn "key_positions\|succession_candidates" src/ --include="*.ts" --include="*.tsx" | head -10
```

---

### STEP 7: Payroll + HR Analytics + 알림

#### 7-① Payroll 급여처리

| # | 기능 | 경로 | 확인 포인트 | 상태 |
|---|------|------|-----------|------|
| 7-1 | 급여 실행 관리 | /payroll | 6단계 상태머신 (DRAFT→PAID) | |
| 7-2 | 급여 계산 엔진 | (payroll 내) | 기본급+초과근무+수당-공제 계산 | |
| 7-3 | 한국 4대보험 | lib/labor/kr.ts | 국민연금/건보/고용/산재 자동 계산 | |
| 7-4 | 국가별 세율 | lib/labor/*.ts | 7개국 세율 적용 | |
| 7-5 | AI 이상 감지 | lib/claude.ts | validatePayroll (전월 대비 10%+ 경고) | |
| 7-6 | 급여 검토 + 승인 | (payroll 내) | 검토 테이블 + 승인 상태머신 | |
| 7-7 | 급여 명세서 | /payroll/me | EMPLOYEE PDF 조회 + 다운로드 | |
| 7-8 | PDF 생성 | lib/pdf.ts | PDFKit 또는 HTML→PDF | |
| 7-9 | 퇴직금 정산 (한국) | (payroll 내) | 평균임금 × 근속일수 ÷ 365 | |

```bash
find src/app -path "*payroll*" | grep "page.tsx" | sort
find src/app/api -path "*payroll*" | sort
grep -rn "payroll_runs\|payroll_details\|payslips" src/ --include="*.ts" --include="*.tsx" | head -10
grep -rn "validatePayroll\|4대보험\|국민연금\|건보\|고용보험" src/lib/ --include="*.ts" | head -10
ls src/lib/pdf* 2>/dev/null
```

#### 7-② HR Analytics (7개 대시보드)

| # | 기능 | 경로 | 확인 포인트 | 상태 |
|---|------|------|-----------|------|
| 7-10 | Analytics 메인 | /analytics | 전사 KPI 6개 + 알림 | |
| 7-11 | 인력 분석 | /analytics/workforce | 인원추이 + 부서분포 + 연령피라미드 | |
| 7-12 | 이직 분석 | /analytics/turnover | 이직률 추이 + 사유분석 + 재직기간 | |
| 7-13 | 성과 분석 | /analytics/performance | EMS 분포 + 부서비교 + MBO 달성 | |
| 7-14 | 근태 분석 | /analytics/attendance | 출근율 + 초과근무 + 지각 | |
| 7-15 | 채용 분석 | /analytics/recruitment | 퍼널 + 채용단가 + 소요일수 | |
| 7-16 | 보상 분석 | /analytics/compensation | 급여분포 + Compa-Ratio + 성별격차 | |
| 7-17 | 팀 건강 분석 | /analytics/team-health | 심리안전감 + 번아웃 + 펄스 추이 | |
| 7-18 | AI Executive Summary | /analytics/report | 월간 리포트 자동 생성 | |

```bash
find src/app -path "*analytics*" | grep "page.tsx" | sort
grep -rn "generateExecutiveSummary\|executiveSummary" src/lib/ --include="*.ts" | head -5
```

#### 7-③ 알림 시스템

| # | 기능 | 경로 | 확인 포인트 | 상태 |
|---|------|------|-----------|------|
| 7-19 | 알림 트리거 관리 | /settings/notifications | 이벤트별 ON/OFF + 채널 선택 | |
| 7-20 | 벨 아이콘 + 드롭다운 | (헤더) | 읽지 않은 알림 카운트 | |
| 7-21 | 알림 목록 페이지 | /notifications (또는 모달) | 전체 알림 이력 | |

```bash
find src/app -path "*notification*" | grep "page.tsx" | sort
grep -rn "notifications\|notification_preferences" src/ --include="*.ts" --include="*.tsx" | head -10
```

---

### STEP 8: 고도화 & 자동화

#### 8-① 설정 커스터마이제이션 (11개)

| # | 기능 | 경로 | 확인 포인트 | 상태 |
|---|------|------|-----------|------|
| 8-1 | 법인 관리 | /settings/company | SUPER_ADMIN CRUD + 로고/통화/시간대 | |
| 8-2 | 브랜딩 | /settings/branding | 로고+컬러+파비콘+로그인배경 | |
| 8-3 | 용어 커스터마이징 | /settings/terms | 한/영/중/러 오버라이드 | |
| 8-4 | 동적 ENUM | /settings/enum-options | 카테고리별 옵션 CRUD | |
| 8-5 | 커스텀 필드 빌더 | /settings/custom-fields | 7가지 타입 + 대상 엔티티 | |
| 8-6 | 워크플로우 설계기 | /settings/workflows | 워크플로우 빌더 (노드/조건/액션) | |
| 8-7 | 이메일 템플릿 | /settings/email-templates | CRUD + 변수 치환 + 미리보기 | |
| 8-8 | 평가 척도 설정 | /settings/evaluation | 척도 CRUD + 점수 매핑 | |
| 8-9 | 모듈 ON/OFF | /settings/modules | 9개+ 모듈 토글 | |
| 8-10 | 데이터 내보내기 | /settings/export | 템플릿 + Excel/CSV/PDF | |
| 8-11 | 대시보드 위젯 | /settings/dashboard | 위젯 CRUD + 드래그 배치 | |

```bash
find src/app -path "*settings*" | grep "page.tsx" | sort
grep -rn "tenant_settings\|customization\|branding\|custom_fields\|workflow_definitions" src/ --include="*.ts" --include="*.tsx" | head -15
```

#### 8-② Task-Centric 홈 + Manager Hub + 챗봇

| # | 기능 | 경로 | 확인 포인트 | 상태 |
|---|------|------|-----------|------|
| 8-12 | Task-Centric 홈 | /dashboard | PendingAction 13종 + 역할별 분기 | |
| 8-13 | Manager Insights Hub | /manager-hub | 5개 섹션 + 5 API | |
| 8-14 | HR 챗봇 UI | /hr-chatbot | RAG 기반 + 채팅 UI | |
| 8-15 | 챗봇 RAG 엔진 | lib/ | pgvector + 문서 임베딩 + 검색 | |
| 8-16 | 챗봇 분석 | /settings/hr-documents/analytics | 질문 통계 + 미답변 | |
| 8-17 | Command Palette | (컴포넌트) | Cmd+O + 직원/메뉴/규정 검색 | |

```bash
grep -rn "PendingAction\|pending.action\|task-centric\|TaskCard" src/ --include="*.tsx" | head -10
grep -rn "pgvector\|embedding\|hr_document_chunks\|chatbot_conversations" src/ --include="*.ts" --include="*.tsx" | head -10
grep -rn "CommandPalette\|command-palette\|Cmd.*O\|⌘" src/components/ --include="*.tsx" | head -5
```

#### 8-③ Teams 연동 (14개 항목)

| # | 기능 | 확인 포인트 | 상태 |
|---|------|-----------|------|
| 8-18 | Graph API 클라이언트 | lib/microsoft-graph.ts 존재 | |
| 8-19 | 3-Channel 알림 | IN_APP + EMAIL + TEAMS 분기 | |
| 8-20 | Adaptive Card 승인 | Teams에서 인라인 승인 처리 | |
| 8-21 | Teams HR 챗봇 봇 | Bot Framework 연동 | |
| 8-22 | 채널별 자동 알림 | 부서 채널 → 다이제스트 | |
| 8-23 | Teams App Manifest | manifest.json + 봇/탭/커넥터 | |
| 8-24 | Teams 탭 임베딩 | Configurable Tabs SSO | |
| 8-25 | 출퇴근 Teams 봇 | /clock-in /clock-out 명령어 | |
| 8-26 | Teams 미팅 → 1:1 기록 | Graph API callRecords → 자동 기록 | |
| 8-27 | Presence 연동 | 근무 상태 자동 동기화 | |
| 8-28 | Recognition → Teams | 채널 자동 게시 | |
| 8-29 | Pulse Survey 인라인 | Adaptive Card 응답 | |
| 8-30 | 온보딩 Teams 연동 | 체크리스트 알림 + 채널 | |
| 8-31 | 퇴직 Teams 자동화 | 프로세스 알림 + IT 비활성화 | |

```bash
grep -rn "microsoft.graph\|@microsoft/teams\|adaptive.card\|AdaptiveCard\|BotFramework" src/ --include="*.ts" --include="*.tsx" | head -15
find src/ -name "*teams*" -o -name "*graph*" | head -10
ls src/lib/microsoft* 2>/dev/null
```

#### 8-④ Outlook + Cron + PWA

| # | 기능 | 확인 포인트 | 상태 |
|---|------|-----------|------|
| 8-32 | Outlook 면접 자동 조율 | Graph API 캘린더 + 자동 초대 | |
| 8-33 | 연차 촉진 Cron | lib/cron/leave-promotion.ts + 3단계 알림 | |
| 8-34 | 과거 조직도 Cron | lib/cron/org-snapshot.ts + org_snapshots | |
| 8-35 | 평가 미이행 알림 Cron | lib/cron/eval-reminders.ts | |
| 8-36 | PWA manifest.json | public/manifest.json + service worker | |
| 8-37 | 모바일 우선 페이지 | 반응형 레이아웃 (출퇴근/승인/프로필) | |

```bash
ls src/lib/cron/ 2>/dev/null
find public -name "manifest*" -o -name "sw*" -o -name "service-worker*" 2>/dev/null
grep -rn "cron\|pg_cron\|schedule" supabase/migrations/ --include="*.sql" | head -10
```

---

### STEP 9: 다국어 + 컴플라이언스 + 외부 연동 + 보안

#### 9-① 다국어 i18n

| # | 기능 | 확인 포인트 | 상태 |
|---|------|-----------|------|
| 9-1 | next-intl 설정 | next-intl.config + middleware | |
| 9-2 | 7개 언어 메시지 파일 | messages/{ko,en,zh,ru,vi,es,pl}.json | |
| 9-3 | 번역 키 500~700개 | 네임스페이스별 키 구조 | |
| 9-4 | 언어 선택기 | 헤더 LocaleSwitcher 컴포넌트 | |
| 9-5 | 통화/날짜/숫자 포맷 | Intl.NumberFormat + DateTimeFormat | |
| 9-6 | HR 전문 용어 사전 | lib/i18n/glossary.json | |
| 9-7 | API 에러 다국어 | 에러 메시지 번역 키 참조 | |

```bash
ls messages/ src/messages/ src/i18n/ 2>/dev/null
find src -name "*intl*" -o -name "*locale*" -o -name "*i18n*" | head -10
grep -rn "next-intl\|useTranslations\|getTranslations" src/ --include="*.ts" --include="*.tsx" | head -10
ls src/lib/i18n/ 2>/dev/null
```

#### 9-② 국가별 컴플라이언스

| # | 기능 | 경로 | 확인 포인트 | 상태 |
|---|------|------|-----------|------|
| 9-8 | 러시아 군복무 명단 | /reports/ru/military | 대상자 추출 + 보고서 | |
| 9-9 | 러시아 연간 인원 보고 | /reports/ru/statistics | P-4/57-T 양식 | |
| 9-10 | 러시아 전자서명 КЭДО | /documents/sign | kedo_documents + 서명 플로우 | |
| 9-11 | 중국 노동국 인원 보고 | /reports/cn | 劳动用工备案 | |
| 9-12 | 중국 사회보험 신고 | /reports/cn | 社保申报 | |
| 9-13 | GDPR 대응 | (설정 내) | 개인정보 삭제요청 + 동의 + 로그 | |

```bash
find src/app -path "*reports*" -o -path "*documents*" | grep "page.tsx" | sort
grep -rn "kedo\|KEDO\|military\|군복무\|GDPR\|gdpr\|사회보험\|社保" src/ --include="*.ts" --include="*.tsx" | head -10
```

#### 9-③ 외부 시스템 연동

| # | 기능 | 확인 포인트 | 상태 |
|---|------|-----------|------|
| 9-14 | 연동 설정 UI | /settings/integrations 페이지 | |
| 9-15 | 더존 ERP 연동 | lib/integrations/douzone.ts (인터페이스) | |
| 9-16 | SAP 연동 | lib/integrations/sap.ts (인터페이스) | |
| 9-17 | eformsign 연동 | lib/integrations/eformsign.ts (전자서명) | |

```bash
find src/app -path "*integration*" | grep "page.tsx" | sort
ls src/lib/integrations/ 2>/dev/null
grep -rn "douzone\|더존\|SAP\|eformsign" src/ --include="*.ts" | head -10
```

#### 9-④ 기술 부채 + 보안/성능

| # | 기능 | 확인 포인트 | 상태 |
|---|------|-----------|------|
| 9-18 | IPO 컴플라이언스 | 급여 공시 + 주식보상 + 감사 강화 | |
| 9-19 | 교대근무 자동 순환 | /settings/shift-patterns + cron | |
| 9-20 | 급여 구성 상세 분리 | payroll_components 테이블 | |
| 9-21 | 은행 API 자동 이체 | lib/integrations/bank.ts (구조만) | |
| 9-22 | M365 계정 비활성화 | 퇴직 시 Graph API 계정 차단 | |
| 9-23 | 보안 감사 (RBAC 점검) | 전 API RLS + 역할 매트릭스 검증 | |
| 9-24 | 성능 최적화 | MV refresh + 인덱스 + 쿼리 최적화 | |

```bash
grep -rn "shift_patterns\|payroll_components\|ipo\|IPO" src/ supabase/ --include="*.ts" --include="*.sql" | head -10
grep -rn "RLS\|row_level_security\|POLICY" supabase/migrations/ --include="*.sql" | wc -l
```

---

## Phase C: AI 기능 전수 점검 (10개+)

STEP 0~9 전체에 걸쳐 정의된 AI 기능 전수 확인:

| # | AI 기능 | 위치 | STEP | 상태 |
|---|---------|------|------|------|
| AI-1 | AI 이력서 스크리닝 | screenCandidate | 5 | |
| AI-2 | AI 평가 코멘트 | suggestEvalComment | 6A | |
| AI-3 | AI 캘리브레이션 분석 | calibrationAnalysis | 6A | |
| AI-4 | AI 1:1 미팅 노트 | generateOneOnOneNotes | 6A | |
| AI-5 | AI Pulse 분석 | pulseSurveyAnalysis | 6A | |
| AI-6 | AI 다면평가 요약 | generatePeerReviewSummary | 6A | |
| AI-7 | AI 연봉 추천 | suggestSalaryAdjustment | 6B | |
| AI-8 | AI Attrition 예측 | predictAttritionRisk | 6B | |
| AI-9 | AI 급여 이상 감지 | validatePayroll | 7 | |
| AI-10 | AI Executive Summary | generateExecutiveSummary | 7 | |
| AI-11 | HR 챗봇 RAG | chatbot RAG pipeline | 8 | |

```bash
grep -rn "suggestEvalComment\|calibrationAnalysis\|generateOneOnOneNotes\|pulseSurveyAnalysis\|generatePeerReviewSummary\|suggestSalaryAdjustment\|predictAttritionRisk\|validatePayroll\|generateExecutiveSummary\|screenCandidate" src/lib/ --include="*.ts" | sort
grep -rn "ai_logs" src/ --include="*.ts" --include="*.tsx" | head -5
```

---

## Phase D: Cron Job 전수 점검 (6개)

| # | Cron | 위치 | STEP | 상태 |
|---|------|------|------|------|
| C-1 | 연차 촉진 3단계 | lib/cron/leave-promotion.ts | 2.5 | |
| C-2 | 과거 조직도 스냅샷 | lib/cron/org-snapshot.ts | 2.5 | |
| C-3 | 평가 미이행 알림 | lib/cron/eval-reminders.ts | 2.5 | |
| C-4 | MV refresh | pg_cron 스케줄 | 1 | |
| C-5 | collaboration_scores | pg_cron 매일 새벽 4시 | 6A | |
| C-6 | 비자 만료 알림 | (알림 시스템) | 2.5 | |

```bash
ls src/lib/cron/ 2>/dev/null
grep -rn "pg_cron\|cron\.schedule\|CRON" supabase/migrations/ --include="*.sql" | head -10
```

---

## Phase E: MV (Materialized View) 전수 점검 (8개)

| # | MV | 용도 | 상태 |
|---|-----|------|------|
| MV-1 | mv_headcount_daily | 인원 현황 | |
| MV-2 | mv_attendance_weekly | 주간 근태 | |
| MV-3 | mv_turnover_monthly | 월간 이직 | |
| MV-4 | mv_performance_cycle | 성과 사이클 | |
| MV-5 | mv_recruitment_funnel | 채용 퍼널 | |
| MV-6 | mv_compensation_band | 보상 분석 | |
| MV-7 | mv_team_health | 팀 건강 | |
| MV-8 | mv_analytics_kpi | 전사 KPI | |

```bash
grep -h "CREATE.*MATERIALIZED\|REFRESH.*MATERIALIZED" supabase/migrations/*.sql | sort
grep -rn "mv_headcount\|mv_attendance\|mv_turnover\|mv_performance\|mv_recruitment\|mv_compensation\|mv_team_health\|mv_analytics" src/ --include="*.ts" --include="*.tsx" | head -15
```

---

## Phase F: 통합 리포트

QA-1A 리포트와 합쳐서 `/tmp/qa1_full_audit.md`에 통합 저장:

```markdown
# CTR HR Hub — 전체 기능 정합성 감사 리포트
## 감사일: {날짜}
## 범위: STEP 0 ~ 9 + R1~R6 완료 상태

### 총 요약
- 전체 검증 항목: {QA-1A + QA-1B 합계}개
- ✅ 완료: {n}개 ({%})
- ⚠️ 부분: {n}개 ({%})
- ❌ 미구현: {n}개 ({%})
- 🔍 확인 필요: {n}개 ({%})

### STEP별 요약 (한 줄)
| STEP | 항목수 | ✅ | ⚠️ | ❌ | 🔍 |
|------|-------|---|---|---|---|
| 0 공통 | | | | | |
| 1 DB | | | | | |
| 2 코어HR | | | | | |
| 2.5 Gap | | | | | |
| 3 온보딩/퇴직 | | | | | |
| 4 근태/휴가 | | | | | |
| 5 채용/징계 | | | | | |
| 6A 성과 | | | | | |
| 6B 연봉/복리 | | | | | |
| 7 Payroll/Analytics | | | | | |
| 8 고도화 | | | | | |
| 9 글로벌 | | | | | |
| AI 기능 | | | | | |
| Cron | | | | | |
| MV | | | | | |

### STEP별 상세
(전체 매트릭스)

### 🔴 Critical — 즉시 조치 필요
### 🟡 Non-Critical — N1~N4 병행 보완 가능
### 🟢 N1 진입 전 권장사항
```

---

## ⚠️ 주의사항
1. **코드 수정 절대 금지** — 읽기 전용 감사만
2. QA-1A 리포트 결과를 참조해서 중복 검증 안 함
3. 빌드/타입체크는 QA-2에서 수행
4. 디자인 검증은 QA-3에서 수행
5. **Teams 연동 14개는 개별 코드 존재 여부만** — 실제 Teams 환경 테스트는 별도
6. **i18n은 파일 존재 + 키 수만 확인** — 번역 품질은 별도
7. 결과 리포트 반드시 파일 저장 + context.md 요약 추가
