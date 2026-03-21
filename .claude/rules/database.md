---
paths: ["prisma/**", "src/**/seed*", "scripts/**"]
---

# Database & Seed Conventions

- Seed scripts: modular files in `prisma/seeds/`, imported by `seed.ts`
- Idempotent: use `upsert` operations
- Deterministic UUIDs for seed data (reproducible)
- Schema changes require migration plan — do not modify `prisma/schema.prisma` without approval
