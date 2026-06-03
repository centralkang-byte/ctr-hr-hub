# P0 Dogfood — N1 7-Layer Audit Triage (S250+)

> 2026-06-03. Source = `p0-readiness-audit` workflow (6 auditors, 6 워크플로 × 7레이어, read-only, #113 worktree).
> 원본 findings = audit output(872k tok). 본 문서 = **트리아지 SSOT** (버킷 분류 + grep 검증 결과).
> ⚠️ 정적 감사 → [[phase3a-audit-drift]] 위험. "UI 트리거 없음/다-분류"는 감사자 누락 가능 → **착수 전 grep 재검증 필수**.

## Dogfood Readiness (감사 판정)

| 워크플로 | 판정 | P0 |
|---|---|---|
| 입사 Onboarding | partial | 4 |
| 퇴사 Offboarding | **blocked** | 4 |
| 조직변경 Org Change | **blocked** | 2 |
| 휴가 Leave | partial | 2 |
| 근태 Attendance | partial | 2 |
| 급여 Payroll | **blocked** | 2 |

합 P0 16건. **그러나 트리아지 후 실제 신규 액션 대상은 소수** (아래).

---

## 검증 완료 (grep/read 5건) — 오탐 1, 실재 4

| # | 주장 | 검증 | 결론 |
|---|---|---|---|
| 퇴사 complete UI 없음 | 감사: 대시보드에 없음 | `OffboardingDetailClient.tsx:479` `apiClient.post('.../instances/${id}/complete')` + 버튼:492 존재 | **오탐** (감사자가 상세뷰 누락) |
| 급여 calculate UI 없음 | 감사: FE 트리거 0 | `.tsx` 전수 grep 0건 · attendance-close는 `ATTENDANCE_CLOSED`만 세팅(route:82,106) 자동 calc 없음 · pipeline 미노출 | **실재 P0** (기존결함·#113 무관) |
| 휴가 admin legacy 테이블 | 감사: legacy 읽음 | `admin/route.ts:91`·`admin/stats/route.ts:62` `prisma.employeeLeaveBalance.findMany` | **실재** |
| POST /employees cross-company | 감사: 가드 없음 | route.ts 142 isPrivileged만, `empCompanyId==user.companyId` 비교/`forbidden` 없음 | **실재**(empCompanyId 출처 최종확인 권장) |
| 퇴사 endDate 미마감 | 감사: assignment endDate 안 닫음 | complete-offboarding.ts 209-225 tx = status COMPLETED·tasks SKIPPED만 · 238은 severance용 companyId **읽기** | **실재** |

---

## Bucket A — #113 자체 = INTACT (감사가 재결함 안 잡음)

#113의 ④⑤⑥ 6개 수정은 감사에서 **재결함 미검출** → 자체로는 머지 가능:
- ④-A workType enum(NORMAL/OVERTIME/NIGHT/HOLIDAY) · ④-B offboarding task→status route
- ⑤-A positionId 배선 · ⑤-B 급여 PAID 버튼(**감사 확인: `PayrollPublishDashboardClient.tsx:199` 존재**) · ⑤-C 퇴사 4사유 seed
- ⑥-A year-balances IDOR · ⑥-B bulk-movements 가드
- ⚠️ 단 ⑤-B PAID 버튼은 **UI로 도달 불가** — 상류 급여 calculate 트리거 부재(Bucket D)로 run이 ATTENDANCE_CLOSED에서 막힘. ⑤-B 런타임 검증은 상태 수동 전진 필요.

## Bucket B — 오탐 (감사 과보고)

- 퇴사 complete UI 없음 → 존재(검증). 미검증 "다-분류 UI 없음" 류(조직 transfer 등)도 grep 재검증 시 일부 오탐 가능.

## Bucket C — 다역할 enablement (이미 DEFER 결정된 ⑥-C 트랙, 별 P1)

#113 플랜 line 66-68에서 **MANAGER 입사/퇴사 = DEFER** CEO 승인. 감사가 재발견한 것:
- 입사: MANAGER sign-off 403 · MANAGER task-status 403
- 퇴사: MANAGER/EXECUTIVE offboarding 권한 전무
- 근태: MANAGER 52h alert 해제 403 (perm UPDATE vs manage)
- 급여: 승인체인 role코드 `HR_MANAGER`/`CFO` 미시드 → HR_ADMIN override만 승인
→ 실재하나 **의도된 보류**. 별도 "다역할 권한+리포트 스코프 가드" P1 트랙.

## Bucket D — 신규 진짜 블로커 (HR_ADMIN 경로·데이터·보안, 대부분 기존결함·#113 무관)

**랭크(영향순):**
1. **급여 calculate UI 트리거 부재** [검증·blocked] — close 후 계산 단계로 못 넘어감. 급여가 UI로 end-to-end 실행 불가. `runs/[id]/calculate` route는 있으나 호출 FE 0.
2. **퇴사 완료 시 Assignment.endDate 미마감** [검증] — 퇴사자가 `endDate:null` 활성쿼리에 잔존. `complete-offboarding.ts` tx에 `assignment.updateMany(endDate)` 추가 필요.
3. **휴가 admin 대시보드 legacy 테이블** [검증] — KPI가 LeaveYearBalance(SSOT) 아닌 구테이블 → 0/오류. [[hrhub-leave-balance-dual-table]]
4. **POST /employees cross-company write** [검증] — HR_ADMIN이 타법인 직원 생성 가능. `if (role!==SUPER_ADMIN && empCompanyId!==user.companyId) forbidden`.
5. GET /onboarding/instances 회사 스코프 부재 [감사] — 전법인 노출. `_user` 무시 → resolveCompanyId 적용.
6. 휴가 admin page 서버 role 가드 부재 [감사] — MANAGER/EXEC가 깨진 빈 페이지 진입.
7. 퇴사 GET employees/[id]/offboarding가 MODULE.ONBOARDING 가드 [감사] — 모듈 오매칭.
8. 조직 /transfer append-only 위반(updateMany 인플레이스) + UI 트리거 부재 [감사·재검증요] — 단 bulk-movements/restructure가 조직변경 커버 → dogfood 우선순위 낮음.
9. 근태 수동보정이 overtimeMinutes 미재계산 [감사] — #113 ④-A 인접. 보정 후 52h alert 오류.
10. 급여 승인체인/whitelist/N+1 [감사] — 승인 multi-step·whitelist 탭·100인 timeout.

## P1/P2 swarm (dogfood-blocking 아님, 체계적 폴리시)

전 워크플로 공통: 빈 catch/토스트 누락(error-handling.md 위반 다수), mutation 후 cache invalidation 부재(EMPLOYEE_LIST/ORG_TREE stale), resolveCompanyId SSOT 미사용(수동 companyId), 성공 토스트 누락. → 별 "피드백 레이어 정합" 트랙.

---

## 권고

- **#113은 bounded 단위로 머지 가치 유지** — 감사 16건으로 부풀리지 말 것. #113 6수정 런타임 확인(⑤-B는 상태 수동전진) → 머지.
- **Bucket D = 신규 P0 dogfood 백로그.** 최대값 = #1 급여 calculate(급여가 UI로 한 번도 end-to-end 안 됨). 그 다음 #2 endDate·#3 휴가 admin·#4 cross-company.
- **Bucket C는 보류 유지**(기결정). **Bucket B/미검증은 착수 전 grep**.

---

## 조치 #1 — 급여 calculate UI 트리거 (구현+런타임 검증 완료, S250+)

Bucket D #1 해소. `CloseAttendanceClient`의 ATTENDANCE_CLOSED 분기에 "급여 계산" 버튼 추가(`POST /api/v1/payroll/runs/[id]/calculate` 동기 실행 → 성공 시 toast + `/payroll/[id]/review` 이동) + 죽은 알림 링크 `/payroll/calculate`→`/payroll/close-attendance` 교정. i18n 5로케일 `closeAtt.calculate`/`calculateSuccess` 추가. 영향 = 2 코드 + 5 메시지.

**런타임 dogfood (HR 한지영, 공유 DB, 로컬 preview)** — 급여 P0 워크플로 end-to-end 전 구간 200:
근태 마감(`attendance-close 200`) → **계산(`runs/[id]/calculate 200`, 99명/₩318,747,835)** → 승인 요청(PENDING_APPROVAL) → 승인×2(HR_MANAGER·CFO 단계 HR_ADMIN override) → APPROVED → **#113 ⑤-B 지급완료(`runs/[id]/paid 200`)** → PAID. tsc·eslint PASS, 콘솔 에러 0. → #113에 커밋.

**dogfood 부수 관찰**: 승인체인 P0(Bucket D #10) 재확인 — 단계가 미시드 role `HR_MANAGER`/`CFO`로 표시, HR_ADMIN override만 통과(실 HR_MANAGER/CFO 유저는 승인 불가). close-attendance 카드 회사 라벨 UUID 노출(사소). `sidebar/counts`·`unread-count` 수십 회 반복 폴링(별건).

## 조치 #2 — Bucket D #4 POST /employees cross-company write 차단 (PR #119, S255)

Bucket D #4 해소. `POST /api/v1/employees`가 body `companyId`(empCompanyId)를 호출자 법인 대조 없이 직원·발령·급여·이벤트 생성에 사용 → HR_ADMIN 타법인 직원 생성 가능. fail-closed 가드 추가(`route.ts`): `if (user.role !== ROLE.SUPER_ADMIN && empCompanyId !== user.companyId) throw forbidden()`, 첫 DB 조회 전 발화. 형제 라우트 `convert-to-employee:104` 동일 패턴. tsc·eslint·런타임 e2e(POST 경로 7 pass — 타법인 403/본인·SUPER 201 회귀無). → **[PR #119](https://github.com/centralkang-byte/ctr-hr-hub/pull/119)**.

## 조치 #3 — Bucket D #3 휴가 admin 잔액 SSOT 전환 (PR #120, S255) + **전제 정정**

⚠️ **트리아지 #3 premise 정정**: 위 "KPI가 … 0/오류"는 **부정확**. 런타임 실측상 legacy `employeeLeaveBalance` 기반 admin 대시보드는 **정상 작동**(74명/1472일/49.5%). 진짜 버그는 **legacy 정체(staleness)** — 휴가 신청 승인/취소·accrual 플로우가 SSOT `LeaveYearBalance`만 갱신하므로 admin이 읽는 legacy는 시드시점에 고정. [[phase3a-audit-drift]] 사례(정적 감사 ≠ 실상).

조치: `admin/route.ts:91`·`admin/stats/route.ts:62` 의 `employeeLeaveBalance.findMany` → `leaveYearBalance.findMany`, 필드 매핑(`granted = entitled+carriedOver+adjusted`, `used = used`), stats 미사용 `policy` include 제거. before→after(legacy→SSOT): usageRate 49.5→50.7%, emp 74→76, granted 1472→1502, **음수잔액 1명 신규 노출**(stale가 숨김). 시드(04-leave 등)가 legacy→SSOT mirror → fresh/CI 안전. tsc·eslint·e2e 5 pass(non-zero KPI 가드 추가). 잔여 legacy 소비처(analytics·offboarding·teams·my/page 등)는 이중테이블 빚 별 트랙. → **[PR #120](https://github.com/centralkang-byte/ctr-hr-hub/pull/120)**.
