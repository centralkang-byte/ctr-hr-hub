# Talent Pool 멀티테넌트 격리 (P0 PII 누출) — 2026-06-18 (S325)

## 문제 (origin/main 코드 확인)
`TalentPoolEntry`·`Applicant` 에 회사 컬럼이 없어(지원→공고 경유 스코프) 인재 풀 관련 라우트가 전사(全社) PII 를 누출.

| 심각도 | 라우트 | 결함 |
|---|---|---|
| P0 | `recruitment/talent-pool` GET | 회사 필터 0 — 전사 후보 이름/이메일/전화 반환 |
| P0 | `recruitment/talent-pool` POST | 타 법인 후보 풀 등록 가능 |
| P0 | `recruitment/talent-pool/[id]` PATCH | findUnique→update, 회사 무검증 = by-id IDOR |
| P1 | `recruitment/applicants/[id]/timeline` | `_user` 미사용, 후보 전사 지원이력(타 법인 공고/회사명) 반환 |
| P0 | `recruitment/candidates/check` | email `findUnique` 무스코프 — 전사 후보 존재/공고 노출 (Codex G1 발견) |
| P1 | `recruitment/applicants/check-duplicate` | top-level 은 스코프, 중첩 `_count`·최근 application 은 전사 (Codex G1) |
| P1 | `dashboard/widgets/[widgetId]` getTalentPool | "filter is omitted" — 전사 풀 건수 (Codex G1) |

근본: `TalentPoolEntry.companyId` 부재 (STATUS S268 "talent-pool 별 task(스키마 마이그)").

## 접근 (CEO 승인) = companyId 컬럼 추가 (filter-via-applications 아님 — 수동 등록·다법인 후보 모호)
- `add_employee_offboarding_company_id`(S273) 패턴: Phase-1 nullable + 백필 + post-backfill NULL 가드 + idempotent FK + Phase-2 NOT NULL 분리.
- 공유 prod-disposable DB, 적용 시 talent_pool_entries **0 행** (백필 no-op, 무위험).

## 변경 (Codex Gate 1 반영)
1. `schema.prisma`: TalentPoolEntry `companyId String?` + `company` 관계 + `@@index`; Company 역관계 추가.
2. 마이그 `20260618120000_add_talent_pool_company_id`: nullable add + index + 백필(① sourcePosting → ② 단일법인 지원, 모호/무해결 = 중단) + 회사별 active 부분 유니크 인덱스 + FK RESTRICT.
3. talent-pool GET: `resolveCompanyFilter` + 중첩 applications 회사 필터.
4. talent-pool POST: 회사 server-side 결정·소유권 검증(비-SUPER 자사 강제, SUPER 는 sourcePosting/companyId/단일지원 유도) + 회사별 active 중복.
5. talent-pool/[id] PATCH: `updateMany({where:{id,...filter}})` — write SQL 에 테넌트 술어 유지.
6. timeline: findFirst 스코프 + 중첩 applications·talentPoolEntries 필터.
7. check-duplicate: 중첩 `_count`·application 회사 필터.
8. candidates/check: email findUnique→findFirst + 회사 결합 + 중첩 필터.
9. dashboard widget getTalentPool: companyId 직접 스코프.
10. e2e `talent-pool-cross-company.spec.ts`: CTR-CN 차단 + SUPER 전사 + 회귀.

## Phase 2 (배포 후, 별 후속)
구 인스턴스 종료 → NULL 재백필 → NULL 0 확인 → `SET NOT NULL` → Prisma `companyId String`.

## 잔여(별 task)
- `TalentPoolClient.tsx` 상태변경이 `apiClient.put`(HTTP PUT) 호출인데 라우트는 PATCH 만 export → 405 (선재 기능버그, 보안 무관).
- 본 트랙 = STATUS S268 "광의 by-id IDOR" 중 talent-pool 슬라이스 마감.
