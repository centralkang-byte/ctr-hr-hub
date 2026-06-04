# 멀티테넌트 누출 Remediation — 트리아지

> **출처**: `multi-tenant-leak-hunt` 워크플로 첫 실행 (2026-06-04, 29 에이전트 · 2.7M 토큰).
> **재생성**: "run the multi-tenant-leak-hunt workflow" — 코드 변경 후 언제든 현재 main 기준으로 갱신.
> **상태**: 발견 박제 단계. 수정 미착수 (런칭 전 필수 P0).

## 요약

- **확정 ~88건 (P0 58 · P1 29 · P2 1)**, 검증 단계가 후보 167 중 **53건을 오탐으로 기각** → 잔존 신뢰도 높음.
- **사람 검증 2/2 진짜**: `payroll/attendance-reopen`(파괴적 cross-tenant 삭제), `payroll/global`(PAYROLL.VIEW로 전 법인 노출).
- ⚠️ analytics/settings는 워크플로의 패턴 주장 — **개별 수정 전 검증**. 88은 "확정 버그"가 아니라 "고품질 트리아지 큐".

## 근본원인 4종 (진짜 수정 타겟 = 88줄이 아니라 이 패턴)

| 패턴 | 라우트 | 내용 |
|---|---|---|
| RC-A | 17 (analytics) | 핸들러 `async (req)` → `user` 도달불가, 생 파라미터 직결 |
| RC-B | 31 | `user`는 있는데 `resolveCompanyId` 미호출 (#121 클래스) |
| RC-C | 29 | id로 find 후 소유권 미검증 (파괴적 쓰기 다수) |
| RC-D | 3 | 삼항 깨짐 — SUPER 경로가 파라미터 없을 때만 발동 |

**시스템 처방**: `withPermission` 핸들러가 `user: SessionUser`를 받고 companyId 쿼리 전 `resolveCompanyId`를 부르도록 lint/타입 규칙 → 클래스 전체를 컴파일 타임에 차단(88번 손보기 대신).

## 우선순위 (워크플로 합성)

1. **급여 파괴적 5개 (P0, ~30분)** — 한 줄 가드 each: attendance-reopen:51 · calculate:46 · [runId]/submit-for-approval:39 · [runId]/adjustments/complete:22 · attendance-close:27(`resolveCompanyId`로 교체). 가드: `if (user.role!=='SUPER_ADMIN' && X.companyId!==user.companyId) throw forbidden()`
2. **settings/approval-flows 풀 CRUD (P0)** — GET/POST/PUT/DELETE 4메서드 모두 user 전파+소유권 누락.
3. **analytics 17개 missing-user-arg (P0, 기계적)** — executive/summary·drilldown·ai-report 우선.
4. **leave/type-defs 파괴적 쓰기 (P0)** — PUT/DELETE/accrual-rules 소유권 가드.
5. **settings compensation/promotion/evaluation (P0)** — 6개 + 3 override, `resolveCompanyId` 한 줄씩.

## 확정 P0 라우트 전체 (unique)

```
payroll: dashboard(GET) global(GET) attendance-close(POST) attendance-status(GET)
         attendance-reopen(POST) [runId]/submit-for-approval(POST)
         [runId]/adjustments/complete(POST) import-mappings(GET,POST)
         whitelist/[anomalyId](DELETE) calculate(POST)
settings: approval-flows(GET,POST,PUT,DELETE) promotion(GET,PUT) compensation(GET,PUT)
          evaluation(GET,PUT) promotion/override(POST) compensation/override(POST)
          evaluation/override(POST) job-grades(GET,POST) employee-titles(POST)
analytics: ai-report/generate(POST) ai-report(GET) attendance/overview(GET) attendance(GET)
           compensation(GET) executive/drilldown(GET) executive/summary(GET) overview(GET)
           payroll/overview(GET) performance/overview(GET) performance(GET)
           prediction/burnout(GET) prediction/turnover(GET) recruitment(GET)
           team-health(GET) team-health-scores(GET) turnover(GET) turnover/overview(GET) workforce(GET)
onboarding: crossboarding(POST) instances/[id]/sign-off(POST) instances/[id]/sign-off-summary(GET)
leave: type-defs/[id](PUT,DELETE) type-defs/[id]/accrual-rules(PUT) accrual(POST)
training: mandatory-config(POST) mandatory-config/[id](PATCH,DELETE) mandatory-config/enroll(POST)
기타: compliance/kr/severance-interim/calculate(GET) employees/[id]/documents/[docId]/download(GET)
      employees/[id]/certificate-requests/[requestId]/approve(POST) directory(GET)
      benefit-claims/[id](GET,PATCH) attendance/work-hour-alerts/[id](PATCH)
      departments(GET) grade-title-mappings(GET) job-grades(GET)
      entity-transfers/[id]/execute(PUT) ai/executive-report(POST) performance/peer-review/candidates(GET)
```

전체 attack path + fix는 워크플로 재실행으로 재생성. 메모리: [[hrhub-multitenant-leak-systemic]].
