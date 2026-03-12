# CTR HR Hub

> Enterprise HR SaaS platform for CTR Group — a multinational manufacturer operating across 6 countries (Korea, China, Russia, Vietnam, Spain, Japan) with 1,200+ employees.

---

## Key Metrics

| Metric | Count |
|--------|:-----:|
| Prisma Models | 194 |
| Prisma Enums | 131 |
| API Routes | 523 |
| Client Pages | 146 |
| Domain Event Handlers | 13 |
| Nudge Rules | 11 |
| Locales (i18n) | 7 (ko, en, zh, ru, vi, es, pt) |
| Seed Scripts | 26 |
| Cron Jobs | 6 |
| Protected Infrastructure Files | 44 |

---

## Modules

All 16 modules are fully implemented (UI + API + DB):

| Module | Description |
|--------|-------------|
| **Core HR** | Employee management, org chart, position-based reporting, effective dating via `EmployeeAssignment` |
| **Onboarding / Offboarding** | Crossboarding support, task templates, exit interviews, milestone tracking |
| **Attendance** | Shift + flexible + 52-hour monitoring, 3-shift roster, mobile GPS punch |
| **Leave** | Policy engine, accrual engine, unified approval inbox, real-time balance, negative balance, cancel refinement |
| **Recruitment ATS** | AI screening, 8-stage pipeline, kanban board, duplicate detection, internal job posting |
| **Performance** | MBO + CFR + BEI + Calibration + AI draft + Bias detection + 9-Block EMS, 7-step pipeline |
| **Payroll** | KR tax engine (6-state machine), year-end settlement, global payroll integration, anomaly detection |
| **HR Analytics** | 7 unified dashboards (Executive, Workforce, Payroll, Performance, Attendance, Turnover, Team Health), AI report |
| **Skills** | Competency matrix + gap analysis + self-assessment |
| **LMS Lite** | Mandatory training tracking + skill gap recommendations |
| **Benefits** | Catalog + dynamic forms + approval workflow + budget tracking |
| **Compensation** | Salary bands, raise matrix, simulation, AI recommendations |
| **People Directory** | Search + profile cards + skill filters |
| **Self-Service** | Profile edit, attendance view, leave requests, payslips, year-end settlement |
| **Notifications** | Bell icon + trigger settings + i18n (7 languages) + Microsoft Teams integration |
| **Compliance** | KR KEDO + CN Social Insurance + RU Labor Code + GDPR/PII/DPIA |

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 15.5 |
| Language | TypeScript | 5.x |
| Database | Supabase PostgreSQL | — |
| ORM | Prisma | 7.4 |
| Auth | NextAuth.js + Microsoft Entra ID (Azure AD) | 4.24 |
| Styling | TailwindCSS + Custom Design System | 4.x |
| Charts | Recharts | 3.7 |
| Icons | Lucide React | 0.575 |
| i18n | next-intl | 4.8 |
| Validation | Zod | 4.3 |
| Animation | Framer Motion | 12.35 |
| Dates | date-fns | 4.1 |
| Deployment | Vercel | — |
| AI | Anthropic Claude (optional) | — |

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20.x (tested on v24.14.0)
- **npm** ≥ 10.x
- **PostgreSQL** 15+ (via Supabase or local)
- **Git**

### Installation

```bash
# Clone the repository
git clone https://github.com/centralkang-byte/ctr-hr-hub.git
cd ctr-hr-hub

# Install dependencies
npm install

# This automatically runs `prisma generate` via the postinstall script
```

### Environment Variables

Create a `.env.local` file from the template:

```bash
cp .env.example .env.local
```

Configure all required variables:

| Variable | Required | Description |
|----------|:---:|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string. **CRITICAL:** Use Direct Connection (port `5432`), NOT Pooler (port `6543`). Pooler blocks DDL operations like `prisma db push`. Format: `postgresql://user:pass@host:5432/dbname` |
| `DIRECT_URL` | ⬜ | Direct connection URL for Prisma migrations (same as DATABASE_URL for local dev) |
| `NEXTAUTH_URL` | ✅ | Application URL. Local: `http://localhost:3002`, Production: your Vercel URL |
| `NEXTAUTH_SECRET` | ✅ | NextAuth session encryption secret. Generate with: `openssl rand -base64 32` |
| `AZURE_AD_CLIENT_ID` | ✅ | Microsoft Entra ID (Azure AD) application client ID |
| `AZURE_AD_CLIENT_SECRET` | ✅ | Microsoft Entra ID client secret |
| `AZURE_AD_TENANT_ID` | ✅ | Microsoft Entra ID tenant ID |
| `NEXT_PUBLIC_SUPABASE_URL` | ⬜ | Supabase project URL (for Supabase features) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ⬜ | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | ⬜ | Supabase service role key (server-side only) |
| `ANTHROPIC_API_KEY` | ⬜ | Anthropic Claude API key — for AI reports, evaluation drafts, bias detection |
| `OPENAI_API_KEY` | ⬜ | OpenAI API key — for document embedding (HR Document Chat) |
| `CRON_SECRET` | ✅ | Authentication secret for cron job endpoints |
| `REDIS_URL` | ⬜ | Redis connection URL — for caching and rate limiting |
| `AWS_ACCESS_KEY_ID` | ⬜ | AWS access key — for S3 document storage |
| `AWS_SECRET_ACCESS_KEY` | ⬜ | AWS secret key |
| `AWS_REGION` | ⬜ | AWS region (default: `ap-northeast-2`) |
| `S3_BUCKET` | ⬜ | S3 bucket name for file uploads |
| `SES_FROM_EMAIL` | ⬜ | AWS SES sender email address |
| `TERMINAL_API_SECRET` | ⬜ | Authentication secret for attendance terminal API |
| `TEAMS_BOT_ID` | ⬜ | Microsoft Teams bot ID |
| `TEAMS_BOT_PASSWORD` | ⬜ | Microsoft Teams bot password |
| `TEAMS_WEBHOOK_SECRET` | ⬜ | Microsoft Teams incoming webhook secret |
| `VAPID_PUBLIC_KEY` | ⬜ | Web Push VAPID public key (generate: `npx web-push generate-vapid-keys`) |
| `VAPID_PRIVATE_KEY` | ⬜ | Web Push VAPID private key |
| `FIREBASE_PROJECT_ID` | ⬜ | Firebase project ID — for mobile push notifications |

### Database Setup

```bash
# Push schema to database (creates/updates tables)
npx prisma db push

# Generate Prisma client
npx prisma generate

# Seed with demo data (26 seed scripts)
npm run seed:dev
```

### Development Server

```bash
npm run dev
# → http://localhost:3002
```

### Production Build

```bash
npm run build
npm start
```

---

## Project Structure

```
ctr-hr-hub/
├── prisma/
│   ├── schema.prisma          # 194 models, 131 enums
│   ├── seed.ts                # Master seed runner
│   └── seeds/                 # 26 domain-specific seed scripts
├── src/
│   ├── app/
│   │   ├── api/v1/            # 523 API routes (RESTful)
│   │   ├── (dashboard)/       # 146 Client pages (16 modules)
│   │   ├── login/             # Authentication page
│   │   └── layout.tsx         # Root layout with providers
│   ├── components/
│   │   ├── layout/            # Sidebar, TopBar, AppShell
│   │   ├── shared/            # Shared components (EmptyState, etc.)
│   │   └── ui/                # Design system components
│   ├── config/
│   │   └── navigation.ts      # Sidebar IA (30+ items, 4 layers)
│   ├── hooks/                 # Custom React hooks (useSubmitGuard, useConfirmDialog, etc.)
│   ├── lib/
│   │   ├── api/               # API client, response helpers, companyFilter
│   │   ├── auth/              # Auth utilities (NextAuth, RBAC)
│   │   ├── analytics/         # Turnover prediction, burnout detection
│   │   ├── compliance/        # KR/CN/RU + GDPR modules
│   │   ├── delegation/        # Approval delegation resolver
│   │   ├── events/            # Domain event bus + 13 handlers
│   │   ├── leave/             # Accrual engine, balance renewal
│   │   ├── nudge/             # Nudge engine + 11 rules
│   │   ├── payroll/           # KR tax calculator, state machine
│   │   ├── performance/       # 7-step pipeline state machine
│   │   └── shared/            # Task state machine, common utilities
│   └── types/                 # TypeScript type definitions
├── messages/                  # i18n translations (7 locales)
│   ├── ko.json                # Korean (primary)
│   ├── en.json                # English
│   ├── zh.json                # Chinese
│   ├── ru.json                # Russian
│   ├── vi.json                # Vietnamese
│   ├── es.json                # Spanish
│   └── pt.json                # Portuguese
├── docs/
│   ├── RLS_POLICY_DESIGN.md   # Row-Level Security design (194 models classified)
│   ├── E2E_VERIFICATION.md    # 5 E2E scenario verification results
│   └── guides/
│       └── UX_CHARTER.md      # 30-article UX design charter
├── context/
│   ├── SHARED.md              # Project state (single source of truth)
│   └── CLAUDE.md              # Design tokens + coding patterns
├── vercel.json                # Vercel deployment config
├── tailwind.config.ts         # Design system tokens
└── package.json               # Dependencies (52 prod, 13 dev)
```

---

## Architecture Decisions

These are intentional design decisions. Do not change without architecture review.

### 1. Effective Dating (EmployeeAssignment)
- `Employee → EmployeeAssignment (1:N)` — all organizational fields live on the assignment, not the employee
- 8 fields on EmployeeAssignment: `companyId`, `departmentId`, `jobGradeId`, `jobCategoryId`, `positionId`, `employmentType`, `contractType`, `status`
- Query pattern: `assignments: { some: { companyId, isPrimary: true, endDate: null } }`
- Enables historical tracking: old assignments have `endDate` set, new ones created for transfers

### 2. Position-Based Reporting
- `Position.reportsToPositionId → Position` — manager hierarchy is position-based, not employee-based
- No `Employee.managerId` field — removed by design
- Manager lookup traverses Position hierarchy

### 3. Global + Entity Override Pattern
- `companyId = NULL` → global default (applies to all companies)
- `companyId = <uuid>` → entity-specific override
- `getCompanySettings()` handles fallback: entity override → global default

### 4. Domain Event Cascade
- Fire-and-forget pattern via in-process event bus
- 13 handlers across 4 Golden Paths: Hire→Onboard, Payroll Pipeline, Performance Cycle, Offboarding
- Events are NOT queued — they execute synchronously in the same request (suitable for current scale)

### 5. Leave Balance — Dual Model
| Model | Role | Updated By |
|-------|------|------------|
| `EmployeeLeaveBalance` | Usage tracking SSOT | Leave request lifecycle (approve/reject/cancel) |
| `LeaveYearBalance` | Accrual engine output only | `accrualEngine.ts` (periodic batch) |
- **Never cross-update** between these two tables — this is intentional, not a bug

---

## Documentation Index

| Document | Location | Description |
|----------|----------|-------------|
| **Project State** | [context/SHARED.md](context/SHARED.md) | Single source of truth — module status, architecture decisions, QA history |
| **Coding Patterns** | [context/CLAUDE.md](context/CLAUDE.md) | Design tokens, component patterns, API patterns, naming conventions |
| **Deployment Guide** | [DEPLOYMENT.md](DEPLOYMENT.md) | Vercel + Supabase setup, cron jobs, rollback procedures |
| **Troubleshooting** | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common issues and solutions for build, DB, auth, UI |
| **RLS Design** | [docs/RLS_POLICY_DESIGN.md](docs/RLS_POLICY_DESIGN.md) | Row-Level Security policy design for all 194 models |
| **E2E Verification** | [docs/E2E_VERIFICATION.md](docs/E2E_VERIFICATION.md) | 5 critical business flow verifications |
| **UX Charter** | [docs/guides/UX_CHARTER.md](docs/guides/UX_CHARTER.md) | 30-article UX design principles and patterns |
| **Executive Summary** | [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md) | 1-page leadership overview of the platform |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 3002 |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run seed:dev` | Seed database with demo data (26 scripts) |
| `npx prisma db push` | Push schema changes to database |
| `npx prisma generate` | Regenerate Prisma client |
| `npx prisma studio` | Open Prisma Studio (DB browser) |
| `npx tsc --noEmit` | TypeScript type check (0 errors) |

---

## License

Proprietary — CTR Group Internal Use Only.
