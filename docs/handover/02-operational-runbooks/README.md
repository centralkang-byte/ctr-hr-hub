# 운영 런북 (Operational Runbooks)

> **대상**: CTR Group 인프라팀 (1차) + 개발팀 (2차)
> **목적**: CEO 솔로 운영 → 인프라팀 독립 운영 가능 수준의 task-level 절차서
> **사용법**: 인프라팀이 새벽 3시에 보고 따라할 수 있어야 함. 막힘 없이.

## 인덱스

| # | 런북 | 자동/수동 | 대상 |
|---|------|----------|------|
| 01 | [배포 파이프라인](01-deploy-pipeline.md) | 자동+검증 | 인프라 |
| 02 | [환경 변수 추가·회수](02-env-add-remove.md) | 자동 | 인프라 |
| 03 | [DB 마이그레이션](03-db-migration.md) | 자동+CEO | 인프라 + 개발 |
| 04 | [Cron 카탈로그](04-cron-catalog.md) | **🤖 자동 생성** (`scripts/handover/extract-cron-catalog.ts`) | 인프라 |
| 05 | [시드 관리](05-seed-management.md) | 자동+CEO | 인프라 + 개발 |
| 06 | [Build & npm scripts](06-build-scripts.md) | 자동 | 인프라 + 개발 |
| 07 | [GitHub Actions CI/CD](07-github-actions.md) | 자동 | 인프라 |
| 08 | [모니터링 (Sentry / Vercel)](08-monitoring.md) | 자동 | 인프라 |
| 09 | [알림 채널 운영](09-alert-channels.md) | 🟡 CEO 작성 필요 | 인프라 |
| 10 | [장애 대응](10-incident-response.md) | 🟡 CEO 작성 필요 | 인프라 |
| 11 | [미등록 cron 수동 트리거](11-cron-manual-trigger.md) | 자동 | 인프라 |
| 12 | [급여 월간 운영 흐름](12-payroll-monthly-flow.md) | 🟡 CEO 작성 필요 | 인프라 + HR |

## 자동 생성 런북

자동 생성된 런북은 코드·설정이 변경되면 스크립트 재실행으로 갱신:

```bash
# Cron 카탈로그 재생성 (vercel.json + src/app/api/v1/cron/ 변경 시)
npx tsx scripts/handover/extract-cron-catalog.ts

# 환경 변수 인벤토리 재생성 (.env.example + process.env 사용 변경 시)
npx tsx scripts/handover/extract-env-inventory.ts
```

⚠️ 🤖 마크된 문서는 **수동 편집 금지** — 스크립트 재실행으로만 갱신.
