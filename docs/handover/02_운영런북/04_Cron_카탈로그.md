# Cron 카탈로그

> **자동 생성**: `npx tsx scripts/handover/extract-cron-catalog.ts`
> **생성일**: 2026-05-15
> **원본**: `vercel.json` crons 배열 + `src/app/api/v1/cron/` 핸들러 디렉토리
> ⚠️ 본 문서는 수동 편집 금지. 코드·vercel.json 변경 시 스크립트 재실행.

---

## 요약

| 분류 | 개수 |
|------|------|
| 코드 존재 + vercel.json 등록 = **실제 동작** | 4 |
| 코드 존재하나 **vercel.json 미등록** = **비동작** | 4 |
| vercel.json 등록되었으나 코드 없음 (orphan) | 0 |
| **전체 cron 핸들러** | 8 |

---

## Cron 매트릭스

| 이름 | 상태 | 스케줄 | API Path | 소스 파일 |
|------|------|--------|----------|----------|
| `apply-scheduled-comp` | 🟢 등록·동작 | `0 15 * * *` (매일 15:00 UTC (한국 00:00)) | `/api/v1/cron/apply-scheduled-comp` | `src/app/api/v1/cron/apply-scheduled-comp/route.ts` |
| `auto-acknowledge` | 🟡 코드 있음·미등록 | — | `/api/v1/cron/auto-acknowledge` | `src/app/api/v1/cron/auto-acknowledge/route.ts` |
| `eval-reminder` | 🟡 코드 있음·미등록 | — | `/api/v1/cron/eval-reminder` | `src/app/api/v1/cron/eval-reminder/route.ts` |
| `leave-promotion` | 🟢 등록·동작 | `0 2 * * *` | `/api/v1/cron/leave-promotion` | `src/app/api/v1/cron/leave-promotion/route.ts` |
| `loa-return-reminder` | 🟢 등록·동작 | `0 0 * * *` (매일 00:00 UTC) | `/api/v1/cron/loa-return-reminder` | `src/app/api/v1/cron/loa-return-reminder/route.ts` |
| `nudge-batch` | 🟢 등록·동작 | `0 1 * * *` (매일 01:00 UTC (한국 10:00)) | `/api/v1/cron/nudge-batch` | `src/app/api/v1/cron/nudge-batch/route.ts` |
| `org-snapshot` | 🟡 코드 있음·미등록 | — | `/api/v1/cron/org-snapshot` | `src/app/api/v1/cron/org-snapshot/route.ts` |
| `overdue-check` | 🟡 코드 있음·미등록 | — | `/api/v1/cron/overdue-check` | `src/app/api/v1/cron/overdue-check/route.ts` |

---

## 비동작 cron (미등록)

다음 cron들은 코드는 존재하지만 `vercel.json` crons 배열에 등록되지 않아 **자동 실행되지 않습니다**:

- **`auto-acknowledge`** (/api/v1/cron/auto-acknowledge) — CRON: secured by CRON_SECRET header, not user session
- **`eval-reminder`** (/api/v1/cron/eval-reminder) — CRON: secured by CRON_SECRET header, not user session
- **`org-snapshot`** (/api/v1/cron/org-snapshot) — CRON: secured by CRON_SECRET header, not user session
- **`overdue-check`** (/api/v1/cron/overdue-check) — CRON: secured by CRON_SECRET header, not user session

**임시 수동 트리거 방법** (인프라팀 참고):

```bash
# CRON_SECRET 환경 변수 필요 (.env.example 참조)
curl -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://hr.ctr.co.kr/api/v1/cron/<cron-name>
```

**등록 절차** (`vercel.json` crons 배열에 추가):

```json
{
  "crons": [
    { "path": "/api/v1/cron/<cron-name>", "schedule": "0 0 * * *" }
  ]
}
```

등록 후 `git push origin main` → Vercel auto-deploy → 다음 스케줄에 자동 발화.

---

## 알려진 위험

- **`leave-promotion`**: 한국 근로기준법 §61 사용촉진 통보용. cron 미동작 시 인사담당자가 수동으로 회계연도 종료 60/30/10일 전 통보·이력 기록 필요. (매뉴얼 `docs/manuals/leave.md` §9 #10·#11 참조)
- **`eval-reminder`**: 평가 마감 D-day 경과 시 HR 에스컬레이션 알림용. 미동작 시 평가 미제출자 발견 지연.
- **`overdue-check`**: 결재 over-due 알림. 미동작 시 결재함에서 stuck 발견 지연.
- **`org-snapshot`**: 조직도 일일 스냅샷. 미동작 시 분석 대시보드 일별 변화 추적 불가.
- **`auto-acknowledge`**: 자동 acknowledge 처리. 미동작 시 acknowledge 큐 누적.

---

## 운영 SOP

1. **매월 1일**: 본 카탈로그 재생성 후 등록 상태 변화 확인.
2. **신규 cron 추가 시**:
   - `src/app/api/v1/cron/<name>/route.ts` 작성
   - `vercel.json` crons에 path + schedule 추가
   - 본 카탈로그 재생성 후 PR 머지
   - 첫 실행 후 Sentry/Vercel logs로 동작 확인
3. **cron 삭제 시**:
   - `vercel.json`에서 먼저 제거 → 배포
   - 다음 스케줄 1회 skip 확인 후 코드 삭제
4. **장애 대응**: cron 실패 시 Vercel logs → Sentry → 수동 트리거 (위 curl 명령)

---

_본 문서 끝._
