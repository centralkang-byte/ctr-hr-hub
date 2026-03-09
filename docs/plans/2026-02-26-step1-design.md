# CTR HR Hub — STEP1 Initial Setup Design

**Date:** 2026-02-26
**Status:** Approved
**Approach:** Layered Sequential (A)

## Overview

Complete project skeleton for CTR HR Hub v3.2 SaaS HR system.
No feature implementation — structure, schema, libs, components, and seed only.

## Scope

| Layer | Description | Scale |
|-------|-------------|-------|
| Project Init | Next.js 14 + TS strict + Tailwind + shadcn/ui | New project |
| Folder Structure | Full STEP0 directory tree | ~40 dirs |
| Prisma Schema | ERD v3.1 + v3.2 tables | 85+ models, 30+ enums |
| Common Libs | auth, prisma, permissions, errors, audit, api, env, constants, claude, s3, redis, terminal, attrition, labor/*, i18n/ko, terms, tenant-settings, enum-options, workflow, custom-fields | ~25 files |
| Common Components | DataTable, PageHeader, EmptyState, AiGeneratedBadge, PermissionGate, CompanySelector, LoadingSpinner, CommandPalette, HrChatbot, CustomFieldsSection, ModuleGate, BrandProvider | ~12 components |
| Seed Data | 13 companies, 5 roles, 66 permissions, 4 test accounts, onboarding/offboarding templates, salary_bands, benefits, holidays, v3.2 customization data | seed.ts |
| Home Layouts | EMPLOYEE/MANAGER/HR_ADMIN/EXECUTIVE shells | 4 views |
| MV SQL | 8 materialized views + unique indexes + pg_cron schedules | 1 SQL file |

## Tech Stack (Confirmed)

- **Framework:** Next.js 14 App Router, TypeScript strict
- **Styling:** Tailwind CSS + shadcn/ui
- **DB:** PostgreSQL 16 + Prisma ORM + pgvector + pg_cron
- **Auth:** NextAuth.js + Microsoft Entra ID (M365 SSO)
- **Cache:** Redis
- **Storage:** AWS S3 (presigned URL)
- **Validation:** Zod v4 + react-hook-form
- **Dates:** date-fns
- **AI:** Claude API (Anthropic)

## Key Architecture Decisions

1. **Multi-company isolation:** All queries filter by company_id
2. **RBAC:** role → permission with company_id binding
3. **Customization priority:** tenant_settings → DB enum → never hardcode
4. **Dynamic ENUMs:** tenant_enum_options table replaces hardcoded enums at runtime
5. **Workflow engine:** workflow_rules + workflow_steps for dynamic approval chains
6. **Server Component first:** Client components only when state needed
7. **Soft delete:** All tables have deleted_at column

## Execution Order

1. `npx create-next-app` + dependencies + shadcn/ui init
2. Full folder structure creation
3. Prisma schema (all 85+ models) → `db push`
4. Common lib files (dependency order: no-dep → with-dep)
5. Common components (UI primitives → complex)
6. Seed data (companies → roles → permissions → employees → templates → v3.2)
7. Role-based home layout shells
8. Materialized View SQL file
9. Type check: `tsc --noEmit` = 0 errors

## Spec References

- `/HR_Hub/Script/STEP0_공통규칙.txt` — Global coding rules
- `/HR_Hub/Script/STEP1_초기세팅.txt` — STEP1 full spec
- `/HR_Hub/Script/CTR_HR_Hub_ERD_Phase1_v3_2.mermaid` — ERD diagram
- `/HR_Hub/Script/CTR_HR_Hub_API_Design_v3_2.txt` — API design
