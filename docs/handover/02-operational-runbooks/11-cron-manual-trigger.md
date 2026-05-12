# 11. 미등록 Cron 수동 트리거

> **대상**: 인프라팀 + HR 운영
> **배경**: 현재 5개 cron이 `vercel.json` 에 미등록이라 자동 실행되지 않음. 등록 전까지 수동 트리거 또는 영향 감수.
> **자동 카탈로그**: [04-cron-catalog.md](04-cron-catalog.md)

## 미등록 cron 5개

| 이름 | API Path | 영향 | 수동 빈도 권장 |
|------|---------|------|---------------|
| `leave-promotion` | `/api/v1/cron/leave-promotion` | 한국 연차 사용촉진 통보 미발송 | 회계연도 종료 60·30·10일 전 (최소 3회/년) |
| `auto-acknowledge` | `/api/v1/cron/auto-acknowledge` | acknowledge 큐 누적 | 매주 1회 |
| `eval-reminder` | `/api/v1/cron/eval-reminder` | 평가 마감 D-day 알림 미발송 | 평가 사이클 마감 D-7/D-1 |
| `overdue-check` | `/api/v1/cron/overdue-check` | 결재 over-due 알림 미발송 | 매일 또는 매주 |
| `org-snapshot` | `/api/v1/cron/org-snapshot` | 조직도 일별 스냅샷 부재 | 매일 |

## 수동 트리거 명령

```bash
# CRON_SECRET 환경 변수 필요 (Vercel env 또는 .env.local)
export CRON_SECRET="<your-cron-secret>"
PROD_URL="https://hr.ctr.co.kr"

# leave-promotion (한국 연차 사용촉진)
curl -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$PROD_URL/api/v1/cron/leave-promotion"

# auto-acknowledge
curl -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$PROD_URL/api/v1/cron/auto-acknowledge"

# eval-reminder
curl -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$PROD_URL/api/v1/cron/eval-reminder"

# overdue-check
curl -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$PROD_URL/api/v1/cron/overdue-check"

# org-snapshot
curl -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$PROD_URL/api/v1/cron/org-snapshot"
```

응답: JSON `{ "ok": true, "processed": N, ... }` 또는 5xx 에러.

## 검증

수동 트리거 후:
1. **Vercel Logs**: `vercel logs --follow` 또는 대시보드에서 `/api/v1/cron/<name>` 호출 로그 확인. 200 OK + 처리 건수 확인.
2. **Sentry**: 새 에러 발생 안 했는지 확인.
3. **알림 발송 확인**:
   - `leave-promotion` → `LeavePromotionLog` 테이블에 신규 row 추가됨
   - `eval-reminder` → 평가 미제출자에게 알림 + 알림 센터 확인
   - `overdue-check` → over-due 결재에 알림 발송
   - `org-snapshot` → `OrgSnapshot` 또는 동등 테이블에 일별 row
   - `auto-acknowledge` → acknowledge 큐 길이 감소

## 등록 권장

각 cron의 영구 등록은 [04-cron-catalog.md](04-cron-catalog.md) §운영 SOP 참조. `vercel.json` 에 path + schedule 추가 후 push.

권장 schedule (운영 정책 확정 후 적용):

```json
{
  "crons": [
    { "path": "/api/v1/cron/leave-promotion", "schedule": "0 0 * * *" },
    { "path": "/api/v1/cron/auto-acknowledge", "schedule": "0 0 * * *" },
    { "path": "/api/v1/cron/eval-reminder", "schedule": "0 0 * * *" },
    { "path": "/api/v1/cron/overdue-check", "schedule": "0 0 * * *" },
    { "path": "/api/v1/cron/org-snapshot", "schedule": "0 0 * * *" }
  ]
}
```

⚠️ **`leave-promotion`은 한국 근로기준법 §61 정합성 별도 검토 필요**. 현재 코드 의도는 60/30/10일 전이나 §61이 요구하는 시점은 6개월/2개월 전. cron 등록과 함께 시점 정합화 PR 필요 (시스템 fix 트랙 #4).

## 관련 문서

- [04-cron-catalog.md](04-cron-catalog.md) — 전체 cron 카탈로그 (자동 생성)
- [docs/manuals/leave.md §9 #10·#11](../../manuals/leave.md) — leave-promotion 알려진 제약
- [STATUS.md §10 #1, #4, #8](../../../../Documents/Obsidian%20Vault/projects/hr-hub/STATUS.md) — 시스템 fix 트랙
