# Executive Summary — CTR HR Hub

> **Date:** 2026-05-12 (Session 218 refresh — Sessions 168~217 추가분 반영)
> **For:** CTR Group Leadership
> **Prepared by:** Engineering Team (CEO 솔로 개발 → IT 팀 인계 단계)

---

## What It Is

CTR HR Hub is a unified, enterprise-grade Human Resources management platform purpose-built for CTR Group. It replaces fragmented HR tools across our 6 country operations (Korea, China, Russia, Vietnam, Spain, Japan) — operating **13 legal entities** — with a single, multilingual system that manages the full employee lifecycle from recruiting and onboarding through performance management, payroll, and offboarding. The platform currently handles 1,200+ employee records with role-based access control ensuring that each employee, manager, and HR administrator sees exactly the data relevant to their role and company.

---

## What It Does

### Core HR (Foundation)
- **Employee Management:** Central employee registry with effective dating (`EmployeeAssignment` append-only) — every organizational change (transfer, promotion, reassignment) is tracked with full history
- **Organization Chart:** Real-time interactive org chart based on position hierarchy + 52 부서장(`Department.head_employee_id`) for approval routing (Session 201)
- **Multi-Entity Support:** 13 legal entities managed under one platform with data isolation between companies (RLS + `resolveCompanyId` SSOT)
- **Position Management:** 140+ positions across 15 global job families, supporting cross-entity comparisons

### Talent Management
- **Recruitment ATS:** AI-powered applicant screening through a 10-stage hiring pipeline (OFFER_ACCEPTED/DECLINED 포함), kanban board, duplicate detection, do-not-rehire 통합 차단
- **Performance Management:** Complete 7-step annual cycle — goal setting (MBO) + **GoalRevision 배치 수정**, **AI 자기평가 도우미** (Claude), **QuarterlyReview 듀얼 제출** (직원·매니저 + 마스킹), **캘리브레이션 DnD 배치 조정** (@dnd-kit 9-block), 결과 통지, 성장 여정 시각화 (MyResult 라인 차트)
- **Compensation Management:** **Off-Cycle Comp 3 발의 경로** (매니저 제안 / HR 주도 / 자동 트리거) + ApprovalFlow 다단계 + 급여 역전 방어 + Self-approval Skip + 미래 시행일 cron. **Compensation Letter PDF** 생성 → S3 저장 → 이메일 배치 발송 → 버전 관리. **Total Rewards Statement** (`/my/total-rewards`) — 기본급/상여/수당/복리후생/포상 연간 집계 + 도넛 차트. **PayBandChart** 4곳 시각화
- **Skills & Competency:** Skill matrix with gap analysis, self-assessment, and training recommendations

### Operations
- **Attendance:** Flexible shift management including 3-shift rotation, 52-hour weekly monitoring (Korean labor law), and mobile GPS-based clock-in
- **Leave Management:** Policy engine supporting 220+ leave types (6 카테고리), accrual rules, negative balance, **DesignatedLeaveDay 지정연차** 자동 차감, 통합 결재 inbox. 사용촉진 cron 미구현 (수동 운영)
- **Leave of Absence (휴직):** 6-state 워크플로 (REQUESTED→APPROVED→ACTIVE→RETURN_REQUESTED→COMPLETED/REJECTED) + 복직 신청 + CRON 복귀 알림 (D-7/D-3/D-1) + **PayrollAdjustment cross-month 일할계산 자동 생성**
- **Payroll:** Korean payroll tax engine (4대보험 + 소득세, 9-state pipeline), year-end settlement, 해외 5개 법인 외부 처리 결과 업로드, 6개 이상 감지 규칙
- **Onboarding/Offboarding:** DAY_1/7/30/90 마일스톤, **4 게이트 강제 집행 엔진** (IT계정/퇴직면담/인수인계/자산반납), 인수인계 워크플로 UI (인수자 지정 + 인계 태스크), **재고용 방지(do-not-rehire) 토글**, OffboardingDocument 4 종 (CONSENT/HANDOVER/EXIT/NDA), 퇴직 분석 대시보드
- **Benefits:** Benefit plans with dynamic enrollment forms, approval workflows, and budget tracking

### Intelligence
- **V2 홈 (4 역할별)**: `/home`에서 SUPER_ADMIN/HR_ADMIN/MANAGER/EXECUTIVE/EMPLOYEE 각 역할별 맞춤 대시보드 (결재 inbox, 팀 현황, KPI, 인정 피드, 출퇴근 위젯)
- **7 Analytics Dashboards:** Executive summary, workforce demographics, payroll analysis, performance distribution, attendance patterns, turnover trends, and team health metrics
- **AI Reports:** Automated HR insight reports powered by Claude AI (Anthropic SDK)
- **Turnover Prediction:** ML-based attrition risk scoring using tenure, compensation, and engagement signals
- **Burnout Detection:** Overtime patterns and leave usage analysis to identify at-risk employees

### Platform
- **5 Languages:** Korean (primary), English, Chinese, Vietnamese, Spanish — UI / 알림 / 에러 메시지 / Teams·이메일 / 서버사이드 PDF·Excel 포함 완전 i18n (Phase 1 6,963건 → Batch 1-15)
- **Notifications:** In-app 알림 센터 (`/notifications`), AWS SES email, Microsoft Teams Bot, Web Push (VAPID)
- **Compliance:** Korean labor law, Chinese 사회보험 계산, Russian labor code automation, GDPR/PII 자동 logging, DPIA + 데이터 보존
- **Self-Service Portal:** Employees can view payslips, request leave + LOA, update personal information, view attendance records, year-end settlement, **내 총보상**, **내 분기리뷰**, **내 인정·칭찬**, **내 온보딩**, **내 오프보딩**, **내 내부공모** — all without contacting HR
- **Performance & Quality:** Phase 7 성능 — 번들 분석 + dynamic import 15곳 + cache 19종 + Sentry INP. Phase 5 visual baseline 330 자동 회귀. Phase 8 k6 부하 테스트 인프라.

---

## Platform Metrics

| Category | Metric | Count |
|----------|--------|:-----:|
| **Data Model** | Database tables (Prisma models) | 209 |
| | Enum types | 142 |
| | Prisma migrations | 43 |
| | Seed scripts | 49 |
| **Backend** | API endpoints | 600 |
| | Domain event handlers | 27 |
| | Automated nudge rules | 11 |
| | Cron handlers (code) | 8 (registered 3 / unregistered 5) |
| **Frontend** | Interactive pages | 163 |
| | Sidebar menu items | 30+ |
| **Quality** | Unit tests | ~525 |
| | API tests | ~1,500 |
| | E2E tests | ~150 (잔존 14 fail) |
| | Visual baselines | 330 |
| **Seed Data** | Demo data scripts | 26 |
| **Security** | Protected infrastructure files | 44 |
| **i18n** | Supported languages | 7 |

---

## Technology

Built on **Next.js 15** (React, TypeScript) with **Supabase PostgreSQL** as the database, **Prisma** as the ORM, and **Microsoft Entra ID** (Azure AD) for single sign-on via corporate credentials. Deployed on **Vercel** with auto-deployment from the main branch. AI features use **Anthropic Claude** and **OpenAI** APIs (optional).

---

## Security & Compliance

| Area | Current Status |
|------|:---:|
| **Authentication** | Microsoft Entra ID SSO — employees log in with their corporate Microsoft 365 credentials |
| **Authorization** | 5-tier RBAC — SUPER_ADMIN, HR_ADMIN, EXECUTIVE, MANAGER, EMPLOYEE. Each role has explicit permissions for each module. |
| **Multi-Tenant Isolation** | Application-level: every API route enforces company-level data isolation via `resolveCompanyId()` |
| **Database-Level Security (RLS)** | Designed — 194 models classified, priority-based implementation plan created. Adds database-layer protection so that even application bugs cannot expose other companies' data. |
| **Security Audit** | Completed — 523 API routes audited for auth/authz. 5 missing auth checks identified and fixed. |
| **Data Protection** | GDPR-compliant data retention policies, PII access logging, privacy impact assessments, and automated data purge via weekly cron job |
| **PII Handling** | Email addresses masked in logs (`u***@domain.com`). No `console.log` in production code. |

---

## Project Status

### Complete and Operational

All core modules are fully coded, tested, and deployed:

- 16 HR modules (employee management through compliance)
- i18n framework with 7 locales (146 client files configured)
- Domain event system (13 handlers across 4 business pipelines)
- Nudge engine (11 automated reminder rules)
- Comprehensive seed data for demo/testing (26 scripts)
- UX safety measures (confirmation dialogs, submit guards, toast notifications)
- Security audit (523 routes verified)

### Architecture Documentation Complete

- RLS (Row-Level Security) policy designed for all 194 database models
- 5 end-to-end business flows verified through code path tracing
- 44 critical infrastructure files protected with architectural impact descriptions
- Full documentation set: README, Deployment Guide, Troubleshooting Guide

### Ready for Implementation (Next Phase — Q-5)

| Item | Description |
|------|-------------|
| RLS Implementation | Apply database-level isolation starting with salary/payroll data (highest sensitivity) |
| i18n Finalization | Convert remaining Korean-only UI elements (tab labels, page titles, form hints) |
| Locale Quality | Professional translation review for Chinese, Japanese, Vietnamese, Russian, Spanish |
| E2E Gap Resolution | Add data masking for pre-finalized performance results, automate crossboarding templates |
| Automated Testing | Playwright E2E tests for critical user flows |

---

## Development Timeline

| Phase | Period | Focus | Status |
|-------|--------|-------|:---:|
| Q-1 | Feb 2026 | Core HR + Attendance + Leave + Payroll | ✅ Complete |
| Q-2 | Feb 2026 | Performance + Recruitment + Analytics + Compliance | ✅ Complete |
| Q-3 | Mar 2026 | i18n framework + Navigation redesign + Stage 5 rebuild | ✅ Complete |
| Q-4 P1 | Mar 2026 | i18n string replacements (53 placeholders, 13 toasts) | ✅ Complete |
| Q-4 P2 | Mar 2026 | Security audit (523 routes, 5 auth fixes) | ✅ Complete |
| Q-4 P3 | Mar 2026 | UX safety (ConfirmDialog, submit guards, AlertDialog) | ✅ Complete |
| Q-4 P4 | Mar 2026 | EmptyState + remaining i18n (82 files updated) | ✅ Complete |
| Q-4 P5 | Mar 2026 | Code quality (console.log, type safety, N+1 queries) | ✅ Complete |
| Q-4 P6 | Mar 2026 | RLS design + infrastructure protection + E2E verification | ✅ Complete |
| Q-4 P7 | Mar 2026 | Documentation set (README, Deployment, Troubleshooting) | ✅ Complete |
| **Q-5** | **TBD** | **Global deployment prep: RLS, locale QA, automated testing** | 📋 Planned |

---

## Key Business Value

1. **Unified Platform:** Replaces 4+ separate tools with one integrated system, eliminating data silos and manual data transfer between departments
2. **Regulatory Compliance:** Built-in support for labor laws across 6 countries (Korean KEDO, Chinese social insurance, Russian labor code, EU GDPR)
3. **Self-Service:** Employees can handle routine HR tasks (leave requests, payslip viewing, profile updates) independently, reducing HR department workload
4. **Data-Driven Decisions:** 7 analytics dashboards and AI-powered insights give leadership real-time visibility into workforce metrics, turnover risk, and compensation equity
5. **Multilingual:** 7-language support enables each country office to use the system in their preferred language
6. **Security by Design:** Role-based access control, multi-tenant data isolation, and a comprehensive database-level security design protect sensitive employee and financial data
