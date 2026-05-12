# 05. 시드 관리

> **대상**: 개발팀 + 인프라팀
> **빈도**: clean DB 셋업 + 매년 1월 (4대보험 요율) + 기능 추가 시
> **현재 시드 파일 수**: 49개 (`prisma/seeds/00-qa-accounts.ts` ~ `49-edge-case-personas.ts`)

## 시드 실행

```bash
# 전체 시드 (clean DB → fully populated)
npx tsx prisma/seed.ts

# 개발용 빠른 시드 (필수 데이터만)
npm run seed:dev          # = npx tsx prisma/seed-dev.ts

# 시드 검증 (Phase 6B 32개 invariant 체크)
npm run seed:validate     # = tsx scripts/seed-validate-phase6b.ts
```

## 시드 파일 카테고리

| 시드 번호 | 도메인 | 비고 |
|----------|--------|------|
| 00-qa-accounts | 9개 QA 테스트 계정 | DO NOT TOUCH (CLAUDE.md), CI 의존 |
| 02-employees | 625+ 직원 (13 법인) | 대규모 fixture |
| 03-attendance | 출퇴근 3년치 | volume 시드 |
| 04-leave | 휴가 유형 219건 (취업규칙·경조지침) | KR/CN만 마스터 적재 — 해외 5개 누락 (매뉴얼 §9 #1) |
| 05-performance | 평가 사이클 | MBO + CFR |
| 06-payroll | 급여 실행 | 4대보험 + 소득세 |
| 07-lifecycle | 온보딩/오프보딩 마일스톤 | DAY_1/7/30/90 |
| 08-notifications | 도메인 이벤트 27 + nudge 11 | |
| 10-recruitment | ATS 10-stage 파이프라인 | |
| 11-compensation | 보상 검토 + merit matrix | |
| 35-statutory-leave-types | 법정 휴가 유형 12 법인 | **마스터 미연결** (매뉴얼 §10 #1) |
| 43-loa-types | LOA 유형 시드 | Session 166 → seed.ts에 import 추가됨 |
| 49-edge-case-personas | EDGE-001 ~ EDGE-030 (30 personas) | UAT 엣지케이스용 |

전체 49개 목록: `ls prisma/seeds/` 또는 `prisma/seed.ts` 진입점 참조.

## 시드 원칙

1. **Idempotent**: 모든 시드는 `upsert` 사용. 재실행 안전.
2. **Deterministic UUIDs**: 재현 가능한 ID. UUIDv5 또는 namespace 기반.
3. **순서 의존**: 파일명 prefix (00, 02, 03 ...) 순으로 실행. `seed.ts`가 순서 보장.
4. **DO NOT TOUCH**: `prisma/seed.ts` (master orchestrator), `prisma/seeds/00-qa-accounts.ts` (QA accounts).

## 매년 1월 4대보험 요율 갱신 SOP (한국)

```
배경: 한국 4대보험 요율이 매년 1월 1일 변경됨 (정부 고시).
      `prisma/seeds/06-payroll.ts` 또는 별도 요율 시드에 하드코딩됨.
      매년 1월에 수동 갱신 필요. (시스템 fix 트랙 §10 #9)
```

**연간 1월 작업** (인프라팀 또는 HR 담당자):

1. 정부 고시 확인 (국민건강보험공단, 국민연금공단, 고용보험)
2. 새 요율 확인:
   - 국민연금: 4.5% (근로자) / 4.5% (사업주) [예시, 실제는 매년 확인]
   - 건강보험: 3.545% [예시]
   - 장기요양: 건강보험료 × 12.95% [예시]
   - 고용보험: 0.9% [예시]
   - 산재보험: 업종별 (사업주만)
3. 시드 파일 수정 (예: `prisma/seeds/06-payroll.ts` 또는 `Tariff` 모델)
4. 운영 DB에 적용 — **단순 시드 재실행 NO**. 운영 DB는 시드를 다시 안 돌리므로 마이그레이션 또는 admin UI로 갱신:
   - Option A: 마이그레이션 SQL로 `UPDATE Tariff SET rate = X WHERE year = 2027`
   - Option B: Settings UI에서 HR_ADMIN이 수동 업데이트
5. 다음 급여 실행에서 적용 확인 (1월 급여 시뮬레이션)

> ⚠️ **자동화 후보**: 매년 정부 고시 API 확인 → PR 자동 생성. 현재 미구현, 시스템 fix 트랙.

## EDGE personas 갱신 (UAT용)

`prisma/seeds/49-edge-case-personas.ts`에 30 personas 시드. UAT 테스트북 v2와 매핑됨. 추가 personas 필요 시:
1. 새 EDGE-XXX 추가
2. `docs/uat/UAT_테스트북_v2.xlsx` 엣지케이스 시트에 시나리오 추가
3. `seed-validate-phase6b.ts` 에 invariant 추가 (cascade orphan check 등)

## 시드 검증 (Phase 6B)

`scripts/seed-validate-phase6b.ts` — 32개 invariant 체크:
- 모든 EDGE persona 존재 확인
- 휴가 유형 카테고리 그룹핑 6종 매칭
- 결재 플로우 시드 일관성
- 직원별 부서·직급 무결성
- LOA 유형 시드 (Session 166 fix)
- 외 cascade orphan raw-SQL 쿼리

CI (`seed-validate-phase6b.yml`) 매 staging push마다 자동 실행.

실패 시 출력: `assertion failure: <invariant name>` + 실패 행. 시드 추가 후 invariant 추가 안 하면 silent drift 발생 → 항상 새 시드 추가 시 invariant 도 추가.

## 운영 DB와 시드의 관계

| 환경 | 시드 실행? | 비고 |
|------|-----------|------|
| 로컬 dev DB | ✅ 매번 (clean DB 셋업) | 자유롭게 reset |
| Staging | ⚠️ 한 번만 (또는 reset 시) | volume 시드 + EDGE persona 적재 |
| Preview (PR) | ✅ 자동 (Supabase preview branch) | 매 PR마다 fresh |
| **Production** | ❌ **절대 X** | 시드 = 운영 데이터 덮어쓰기 위험 |

⚠️ Production DB에는 시드를 직접 돌리지 않습니다. 운영 데이터 갱신은:
- 마이그레이션 SQL
- Admin UI (Settings)
- 별도 데이터 import 스크립트 (예: `scripts/import-prod-migration.ts`)

## 본인결혼 시드 운영 DB 마이그레이션 (시스템 fix 트랙 #10)

CEO 정책으로 본인결혼 시드 7→5일로 변경됨 (Session 217 PR #43). 시드만 갱신했으므로 **운영 DB의 기존 직원 잔액은 7일 그대로**. 마이그레이션 필요:
- 운영 DB의 `LeaveTypeDef.maxDays` 또는 동등 필드를 5로 업데이트
- 이미 7일을 사용한 직원의 잔액 정정 정책 결정 (포기 / 환산 / 유예)
- 인계 첫 PR 후보.

## 관련 문서

- [03-db-migration.md](03-db-migration.md) — 시드 vs 마이그레이션 구분
- [docs/manuals/leave.md §10](../../manuals/leave.md) — 휴가 시드 추후 개선
- [STATUS.md §10 시스템 fix 트랙](../../../../Documents/Obsidian%20Vault/projects/hr-hub/STATUS.md) — 시드 관련 fix 항목들
