# Executive Summary — CTR HR Hub

> **Date:** 2026-03-12
> **For:** CTR Group Leadership
> **Prepared by:** Engineering Team

---

## What It Is

CTR HR Hub is a unified, enterprise-grade Human Resources management platform purpose-built for CTR Group. It replaces fragmented HR tools across our 6 country operations (Korea, China, Russia, Vietnam, Spain, Japan) with a single, multilingual system that manages the full employee lifecycle — from recruiting and onboarding through performance management, payroll, and offboarding. The platform currently handles 1,200+ employee records across multiple legal entities, with role-based access control ensuring that each employee, manager, and HR administrator sees exactly the data relevant to their role and company.

---

## What It Does

### Core HR (Foundation)
- **Employee Management:** Central employee registry with effective dating — every organizational change (transfer, promotion, reassignment) is tracked with full history
- **Organization Chart:** Real-time interactive org chart based on position hierarchy, not individual reporting lines
- **Multi-Entity Support:** 6 legal entities managed under one platform with data isolation between companies
- **Position Management:** 140+ positions across 15 global job families, supporting cross-entity comparisons

### Talent Management
- **Recruitment ATS:** AI-powered applicant screening through an 8-stage hiring pipeline with kanban board and duplicate detection
- **Performance Management:** Complete 7-step annual cycle — goal setting (MBO), mid-year check-in, evaluation (self + manager + peer), calibration, and result notification — with AI-drafted evaluations and bias detection
- **Succession Planning:** Readiness assessment and candidate tracking for critical positions
- **Skills & Competency:** Skill matrix with gap analysis, self-assessment, and training recommendations

### Operations
- **Attendance:** Flexible shift management including 3-shift rotation, 52-hour weekly monitoring (Korean labor law), and mobile GPS-based clock-in
- **Leave Management:** Policy engine supporting unlimited leave types, accrual rules, negative balance, and a unified approval inbox for managers
- **Payroll:** Korean payroll tax engine (6 deduction categories), year-end settlement, global payroll integration, and automatic anomaly detection before disbursement
- **Benefits:** Benefit plans with dynamic enrollment forms, approval workflows, and budget tracking

### Intelligence
- **7 Analytics Dashboards:** Executive summary, workforce demographics, payroll analysis, performance distribution, attendance patterns, turnover trends, and team health metrics
- **AI Reports:** Automated HR insight reports powered by Claude AI (optional integration)
- **Turnover Prediction:** ML-based attrition risk scoring using tenure, compensation, and engagement signals
- **Burnout Detection:** Overtime patterns and leave usage analysis to identify at-risk employees

### Platform
- **7 Languages:** Korean (primary), English, Chinese, Russian, Vietnamese, Spanish, Portuguese — all UI elements, notifications, and error messages are localized
- **Notifications:** In-app bell notifications, email alerts, and Microsoft Teams integration
- **Compliance:** Korean KEDO electronic document management, Chinese social insurance calculation, Russian labor code automation, GDPR/PII data protection, and privacy impact assessments (DPIA)
- **Self-Service Portal:** Employees can view payslips, request leave, update personal information, view attendance records, and track their year-end settlement — all without contacting HR

---

## Platform Metrics

| Category | Metric | Count |
|----------|--------|:-----:|
| **Data Model** | Database tables | 194 |
| | Enum types | 131 |
| **Backend** | API endpoints | 523 |
| | Domain event handlers | 13 |
| | Automated nudge rules | 11 |
| | Scheduled cron jobs | 6 |
| **Frontend** | Interactive pages | 146 |
| | Sidebar menu items | 30+ |
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
