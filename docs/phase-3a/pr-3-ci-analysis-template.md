# PR-3 CI 회귀 분석 (실 결과 — 2026-05-19)

> PR #61 open 후 실 CI 결과. 방법론 = PR-2 #60 / PR-1 #59 14-/13-tail
> known-unrelated 대조. 분석 자료 (base SHA `f96cf765` 불변, claude/phase3a-audit 커밋).

## 0. 입력

- PR-3: https://github.com/centralkang-byte/ctr-hr-hub/pull/61 (OPEN, base main, head `f96cf765`, MERGEABLE)
- E2E run: `26094362679` (`feat/leave-reskin-ws-d-ws-c`, pull_request)
- 변경 surface: `leave` (LeaveClient StatusBadge·toast / `/my/leave` redirect / 링크 9곳)

## 1. CI 잡별 status

| 체크 | 결과 | 비고 |
|---|---|---|
| `e2e` | **failure** | 12 failed · 1 flaky · **1628 passed** (run `26094362679`) |
| `Vercel` | **pass** | Deployment completed (preview 생성 — STATUS "preview 소멸" 대비 양호) |
| `Vercel Preview Comments` | pass | — |
| `Supabase Preview` | skipping | 관례 |

## 2. 기준선 (known-unrelated SSOT)

| 참조 | 브랜치 | tally | tail |
|---|---|---|---|
| PR-2 #60 | `feat/lv002-at004-chart` (run `26073461532`) | 14 failed · 3 flaky · 1614 passed | 14-tail (STATUS 227 무관 확정) |
| **PR-3 #61** | `feat/leave-reskin-ws-d-ws-c` (run `26094362679`) | **12 failed · 1 flaky · 1628 passed** | **13건 ⊆ PR-2 (신규 0)** |

known-unrelated 2 고정: `evaluation-forms:49` · `onboarding:24` (Phase 9 / Session 214).
패턴: 이질 seed/시퀀스 (CI `prisma db push --force-reset`, MV 의도적 미생성 —
Session 226 인과 정정 확정, `42P01`=safeMvQuery 양성 노이즈).

## 3. 대조 판정 (게이트)

| 단언 | 기준 | 결과 |
|---|---|---|
| ① leave surface green | `leave-workflow.spec.ts` 기존 Leave(8) + 신규 S1~S5(99·113·121·131·149) | ✅ **전수 ✓ PASS**, 실패 집합 내 leave-workflow = **0건** |
| ② tail = known 패턴 | PR-3 실패 ⊆ PR-2 14-tail ∪ known 2 (신규 0) | ✅ **PR-3 ∖ PR-2 = 공집합** (comm -23 빈 출력) |
| ③ 신규 회귀 0 | PR-3 변경(StatusBadge·redirect·링크 9) 기인 실패 0 | ✅ **0** — 변경 surface 무관 실패만 |

### PR-3 실패 13 (전수 known-unrelated)

```
[api]  compensation-transfers-selfservice:175  ai-recommend (smoke)
[api]  employees-crud:149                       DELETE soft delete
[api]  leave-requests:152                        POST (approval flow — API seed/seq, ≠ flows/leave)
[api]  payroll-operations:329                    GET exchange-rates
[api]  payroll-operations:336                    GET attendance-status
[api]  peer-review-succession-competency:288     POST nominations
[api]  peer-review-succession-competency:344     POST 2nd nomination
[api]  performance-goals-reviews:127             revision on goal 1
[api]  performance-goals-reviews:254             peer review candidates
[api]  shift-schedules-roster:240                POST schedules
[api]  training-pulse-misc-final:71              PATCH mandatory-config
[browser] evaluation-forms:49                    my-result (known 2)
[browser] onboarding:24                          offboarding (known 2)
```
11 `[api]` = 이질 seed/시퀀스 · 2 `[browser]` = known 2. PR-2 17(14+3)의 진부분집합.
PR-3가 PR-2 대비 실패 **−2**, passed **+14** (회귀 없음, 오히려 우수).

**판정: ✅ PASS** — tail known-unrelated 확정, 신규 회귀 0. 머지 안전 보조 시그널.

## 4. 머지 게이트 4 조건 (가디언 확정)

| 조건 | 상태 |
|---|---|
| CI green (= tail known-unrelated 확정) | ✅ 충족 (신규 회귀 0, leave surface green) |
| 가디언 추가 라운드 0 (CI 분석 통과) | ✅ 본 분석 PASS — 라운드 3 트리거 부재 |
| PR-1(`942b12ea`) 머지 +3일 = **2026-05-22 이후** | ⏳ 현재 2026-05-19 → **3일 미경과** (대기) |
| 사용자 admin-override (self-merge 금지) | ⏳ 사용자 전속 결정 |

→ CI/가디언 게이트 2건 ✅ 충족. 시간축(2026-05-22+) + 사용자 머지 결정 잔여.

## 5. 가디언 가드 (PR open 후)

- ② 위반(신규 known-unrelated 외): 해당 없음
- ③ 위반(신규 회귀): 해당 없음
- Vercel preview = **생성됨**(pass) → 시각 확인 가능 surface 존재 (M3 known-deferred 일부 해소 여지, 별도)
