# Settings cross-tenant 격리 — 멀티테넌트 누출 remediation (batch 3)

> **출처**: `multi-tenant-leak-hunt` 워크플로 트리아지(2026-06-04) + S263 핸들러 단위 코드 정밀화
> **상태**: 설계 승인됨 (2026-06-04 / S263) — 구현 대기
> **선행 패턴**: payroll [#129](https://github.com/centralkang-byte/ctr-hr-hub/pull/129) / [#130](https://github.com/centralkang-byte/ctr-hr-hub/pull/130) (cross-tenant 가드 확립)
> **메모리**: [[hrhub-multitenant-leak-systemic]] · [[hrhub-settings-global-override]] · [[phase3a-audit-drift]]

---

## 범위 (이번 PR)

settings 버킷 **cross-tenant 격리만**. 비-SUPER는 자기 `companyId`만 접근, SUPER_ADMIN만 cross-tenant.
기존 쓰기 권한(seed: HR_ADMIN = 전 모듈 쓰기)은 **보존**. 순수 "타 법인 데이터" 누출만 차단.

## 비범위 (→ 바로 다음 별도 PR: HQ 계층 권한)

사용자 정책: **법인(leaf) HR 읽기전용 + 본사 HR이 산하 법인 설정 쓰기.**
- 자동차부문 HQ = `CTR`(주) → 산하 `CTR-MOB`·`CTR-ECO`·해외 5
- 나머지 부문 HQ = `CTR-HOLD`(홀딩스) → `CTR-ROB`·`CTR-ENR`·`CTR-FML`

회사 계층(`Company.parentCompanyId`)은 스키마+seed 데이터 **둘 다 이미 존재**([seed.ts:100](../../../prisma/seed.ts)). 단 "본사 HR이 산하 쓰기" 권한 로직은 **전무** → 신규 헬퍼(`canManageCompanySettings(user, targetCompanyId)` 회사계층 재귀) + perm 재설계 필요. 범위가 커서 P0 누출 차단과 분리.

---

## 누출 19개 핸들러 (코드 검증 완료)

> 트리아지 "13 라우트 모두"는 라우트 단위 거친 카운트. 실제 핸들러 단위 = **9파일 / 19핸들러 누출 + 5핸들러 이미 가드**(드리프트, 양방향).

| # | 파일 | 핸들러(라인) | 유형 | 처방 |
|---|---|---|---|---|
| 1 | settings/approval-flows | GET(41) | RC-A | 패턴2-GET |
| 2 | 〃 | POST(66) | RC-C | 패턴2-ownership |
| 3 | 〃 | PUT(109) | RC-C | 패턴2-ownership |
| 4 | 〃 | DELETE(158) | RC-A+C | 패턴2-ownership (+user 인자) |
| 5–6 | settings/promotion | GET(23)·PUT(35) | RC-B | 패턴1 |
| 7–8 | settings/compensation | GET(26)·PUT(36) | RC-B | 패턴1 |
| 9–10 | settings/evaluation | GET(30)·PUT(43) | RC-B | 패턴1 |
| 11–12 | settings/promotion/override | POST(14)·DELETE(26) | RC-A | 패턴1 (+user 인자) |
| 13–14 | settings/compensation/override | POST(14)·DELETE(26) | RC-A | 패턴1 (+user 인자) |
| 15–16 | settings/evaluation/override | POST(15)·DELETE(29) | RC-A | 패턴1 (+user 인자) |
| 17 | settings/job-grades | GET(15, 삼항 19–23) | RC-D | 패턴1 (SUPER 전체조회 보존) |
| 18 | settings/job-grades | POST(50, cid 65) | RC-B | 패턴1 |
| 19 | settings/employee-titles | POST(42, cid 56) | RC-B | 패턴1 |

### 이미 가드됨 — 손대지 않음 (회귀 확인 대상)
- `job-grades` PUT(91→가드 102)·DELETE(131→가드 141)
- `employee-titles` GET(15→가드 17)·PUT(81→가드 91)·DELETE(118→가드 128)

---

## 가드 패턴

### 패턴 1 — `resolveCompanyId` 치환 (15 핸들러, 글로벌 차원 없음)

```ts
import { resolveCompanyId } from '@/lib/api/companyFilter'  // PROTECTED SSOT — import만

// 기존: const companyId = searchParams.get('companyId') ?? user.companyId
//       const companyId = body.companyId ?? user.companyId
// 변경:
const companyId = resolveCompanyId(user, searchParams.get('companyId'))  // 또는 body.companyId
```

- 비-SUPER → `user.companyId` 강제. SUPER → 요청 companyId 허용.
- **RC-A override 6핸들러**: 핸들러 시그니처에 `user: SessionUser` 추가(`async (req, _ctx, user)`) 후 치환.
- **RC-D job-grades GET**: 삼항을 교체하되 **SUPER가 companyId 미지정 시 전체조회(`{}`) 보존**:
  ```ts
  const requested = searchParams.get('companyId')
  const companyFilter =
    user.role === 'SUPER_ADMIN' && !requested ? {}
    : { companyId: resolveCompanyId(user, requested) }
  ```

### 패턴 2 — ownership 가드 (4 핸들러, approval-flows, 글로벌 보존)

approval-flows는 `companyId = null`(전사 공용 글로벌)이 정상 존재 → **글로벌·자기법인 통과, 타 법인만 차단**.

```ts
// GET — user 인자 추가, 비-SUPER는 자기법인 + 글로벌(null)
if (user.role !== 'SUPER_ADMIN') {
  where.OR = [{ companyId: user.companyId }, { companyId: null }]
} else if (companyId) {
  where.OR = [{ companyId }, { companyId: null }]
}
// (SUPER + companyId 미지정 → 기존 전체조회 보존)

// POST: 비-SUPER는 companyId를 자기법인으로 강제 (글로벌 null/타법인 생성 불가)
//   const companyId = user.role === 'SUPER_ADMIN' ? (parsed.companyId ?? null) : user.companyId
// PUT/DELETE: existing 조회 후 (글로벌 null·타법인 모두 non-SUPER 차단)
if (user.role !== 'SUPER_ADMIN' && existing.companyId !== user.companyId) {
  throw forbidden()   // null !== user.companyId → 글로벌도 차단
}
// PUT은 가드를 step deleteMany 전에 / DELETE는 user 인자 추가 + findUnique 선행
```

> **글로벌(null) 쓰기는 SUPER만** (Codex Gate 1 P0 — 글로벌 오염 차단: 한 법인 HR이 전사 공유 설정 변경 방지). 본사 HR 글로벌 쓰기 확대는 2단계 HQ 권한. **글로벌 읽기**는 비-SUPER도 보존(GET `OR [자기법인, null]`).
>
> **Codex P0 추가 발견**: `notification-triggers` PUT/DELETE/restore도 동일 글로벌 오염(글로벌 trigger를 비-SUPER가 수정/삭제/복구 가능; 타법인은 이미 findFirst scoped) → **scope 포함**. `grade-title-mappings`는 4메서드 이미 `companyId !== user.companyId` 가드 확인(누출 아님, 에러타입 badRequest는 P2). settings 40 라우트 중 raw companyId 입력 받는 13개만 검토 대상 — 나머지 27개는 raw companyId 입력 없어 cross-tenant param 안전(id 라우트 findFirst scoping은 별도 audit known gap).

---

## 테스트 (실 dev 서버 e2e)

| 시나리오 | 기대 |
|---|---|
| 한지영(CTR HR_ADMIN) `GET ?companyId=CTR-CN` | 자기(CTR)로 스코프 또는 빈/403 (타 법인 데이터 노출 X) |
| 한지영 `PUT/DELETE` 타 법인(CTR-CN) 레코드 id | **403 forbidden** |
| 한지영 override POST/DELETE `companyId=CTR-CN` | **403** (자기 법인 강제) |
| 대조영(SUPER) `?companyId=CTR-CN` | cross-tenant 통과 |
| 비-SUPER approval-flows GET | 자기법인 + 글로벌(null) 읽기 OK |
| job-grades GET 비-SUPER `?companyId=CTR-CN` | 자기 법인으로 강제 (RC-D 차단) |
| 회귀: 이미 가드된 5핸들러 | 동작 불변 |

---

## 참고

- `resolveCompanyId` SSOT: [companyFilter.ts](../../../src/lib/api/companyFilter.ts) (PROTECTED — import만, 수정 금지)
- 확립 inline 가드: payroll `if (user.role !== ROLE.SUPER_ADMIN && X.companyId !== user.companyId) throw forbidden()`
- 에러: `forbidden()` AppError 팩토리 ([api.md](../../../.claude/rules/api.md) §7)
- 새 추상 도입 없음 — #129/#130과 동일 결, lint/타입 규칙(시스템 처방)은 멀티테넌트 트랙 종료 후 별도
