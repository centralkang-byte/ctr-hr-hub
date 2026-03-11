# Architecture Overview — CTR HR Hub

> Generated from codebase analysis (2026-03-12, Q-1)

---

## Folder Structure

```mermaid
graph TD
    ROOT["ctr-hr-hub/"]
    SRC["src/"]
    APP["app/"]
    DASH["(dashboard)/"]
    API["api/v1/"]
    LIB["lib/"]
    COMP["components/"]
    HOOKS["hooks/"]
    CONFIG["config/"]
    PRISMA["prisma/"]

    ROOT --> SRC
    ROOT --> PRISMA
    SRC --> APP
    SRC --> LIB
    SRC --> COMP
    SRC --> HOOKS
    SRC --> CONFIG

    APP --> DASH
    APP --> API

    DASH --> D_HOME["home/"]
    DASH --> D_MY["my/ (9 pages)"]
    DASH --> D_EMP["employees/"]
    DASH --> D_ATT["attendance/"]
    DASH --> D_LEAVE["leave/"]
    DASH --> D_PERF["performance/"]
    DASH --> D_PAY["payroll/"]
    DASH --> D_REC["recruitment/"]
    DASH --> D_ANA["analytics/"]
    DASH --> D_SET["settings/ (hub + 6 cat)"]
    DASH --> D_COMP["compliance/"]

    LIB --> L_FMT["format/ (number, date, text)"]
    LIB --> L_STY["styles/ (11 constants)"]
    LIB --> L_ANI["animations/ (variants, transitions)"]
    LIB --> L_AUTH["auth.ts"]
    LIB --> L_PRI["prisma.ts"]
    LIB --> L_SET["settings/"]

    COMP --> C_UI["ui/ (shared primitives)"]
    COMP --> C_SET["settings/"]
    COMP --> C_DOM["domain/ (module-specific)"]

    PRISMA --> P_SCHEMA["schema.prisma"]
    PRISMA --> P_SEEDS["seeds/ (26 files)"]
```

---

## Data Flow

```mermaid
sequenceDiagram
    participant C as Client Component
    participant A as API Route (v1)
    participant P as Prisma Client
    participant DB as PostgreSQL (Supabase)
    participant S as NextAuth Session

    C->>S: Check session (useSession)
    S-->>C: JWT token + employee info
    C->>A: fetch('/api/v1/...')
    A->>S: getServerSession()
    S-->>A: Session with employeeId
    A->>P: prisma.model.findMany(...)
    P->>DB: SQL Query
    DB-->>P: Result Set
    P-->>A: Typed Objects
    A-->>C: JSON Response
```

---

## Auth Flow

```mermaid
flowchart LR
    USER[User] --> LOGIN[/login page/]
    LOGIN -->|Email| CRED[Credentials Provider]
    LOGIN -->|SSO| ENTRA[Microsoft Entra ID]

    CRED --> SSO_DB[(SsoIdentity)]
    SSO_DB --> EMP[(Employee)]
    EMP --> PERM[loadEmployeePermissions]
    PERM --> JWT[JWT Token]

    ENTRA --> SSO_DB
    JWT --> SESSION[Session]
    SESSION --> APP[App Pages]

    style CRED fill:#5E81F4,color:#fff
    style ENTRA fill:#0078d4,color:#fff
```

---

## Event Pipeline

```mermaid
flowchart TD
    ACTION[User Action] --> DOMAIN[Domain Event]
    DOMAIN --> HANDLER[Event Handler]
    HANDLER --> SE1[Side Effect: Notification]
    HANDLER --> SE2[Side Effect: Audit Log]
    HANDLER --> SE3[Side Effect: Status Update]
    HANDLER --> SE4[Side Effect: Nudge Check]

    SE4 --> NUDGE{Nudge Rule Match?}
    NUDGE -->|Yes| SEND[Send Nudge]
    NUDGE -->|No| SKIP[Skip]

    subgraph Pipelines
        PAY[Payroll Pipeline: 8 states]
        PERF[Performance Pipeline: 8 states]
    end

    DOMAIN --> PAY
    DOMAIN --> PERF
```

---

## Key File Reference

| Category | File | Purpose |
|----------|------|---------|
| **Auth** | `src/lib/auth.ts` | NextAuth config (Entra ID + Credentials) |
| **DB** | `src/lib/prisma.ts` | Prisma singleton (PrismaPg adapter) |
| **Navigation** | `src/config/navigation.ts` | Sidebar menu structure (749 lines) |
| **Settings** | `src/components/settings/settings-config.ts` | Settings hub tab definitions |
| **Process Settings** | `src/hooks/useProcessSetting.ts` | Hook for process settings API |
| **Middleware** | `src/middleware.ts` | Security headers (CSP, HSTS) |
| **Layout** | `src/app/(dashboard)/layout.tsx` | Dashboard layout with sidebar |
| **Format** | `src/lib/format/index.ts` | Number, date, text utilities |
| **Styles** | `src/lib/styles/index.ts` | 11 style constant modules |
| **Animations** | `src/lib/animations/variants.ts` | framer-motion animation presets |

---

## Module Overview (152 pages)

| Module | Pages | Key Features |
|--------|:-----:|-------------|
| Home | 1 | Dashboard with KPI cards, task widget |
| My Space | 12 | Personal profile, tasks, leave, payroll, goals |
| Employees | 8 | Directory, detail, contracts, work permits |
| Attendance | 6 | Clock, shift calendar, roster, team view |
| Leave | 5 | Request, admin, team, calendar |
| Performance | 20 | Cycles, goals, evaluations, peer review, calibration |
| Payroll | 12 | Runs, simulation, bank transfers, year-end |
| Recruitment | 10 | Jobs, pipeline, applicants, talent pool |
| Onboarding | 6 | Checklist, templates, check-in |
| Offboarding | 4 | Exit interview, tracking |
| Analytics | 14 | Workforce, payroll, turnover, AI report |
| Settings | 7 | Hub + 6 categories (44 tabs) |
| Compliance | 7 | GDPR, data retention, DPIA, PII audit |
| Other | 40 | Compensation, succession, training, discipline, etc. |
