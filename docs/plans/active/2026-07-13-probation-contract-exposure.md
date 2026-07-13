# 수습/계약 만료 라이프사이클 UI 노출 (UAT P1 #3) — 플랜

> 2026-07-13 (S340). UAT SSOT: `2026-07-12-uat-phase3-results.md` P1 #3 (+P3 raw PROBATION 노출 포함).
> Ground truth: 백엔드는 대부분 구축됨 — `/api/v1/contracts/expiring` (소비처 0), nudge 룰 2종(probation-ending·contract-expiring, cron 등록됨), ContractHistory 모델, evaluate/convert 엔드포인트. **순수 노출/배선 갭.**

## 원인 구조

- `EmployeeAssignment.status`는 free-text String — 시드가 `'PROBATION'`을 실제로 씀
- `STATUS_MAP`(status.ts:65)엔 `PROBATION: 'warning'` 있음 (색은 정상) — **텍스트 라벨 맵 2곳(목록)·1곳(상세)에만 키 부재** → raw enum 노출
- `employeeSearchSchema.status` zod enum(4값)이 PROBATION 거부 → 필터 불가
- `employees/[id]/contracts` 페이지는 존재하나 **진입 링크 0곳** (고아)
- Employee에 `contractEndDate`·`probationEndDate` 등 필드 존재하나 상세 미노출

## 변경 (v1 — 3묶음)

### A. PROBATION 라벨·필터 정합
1. `src/lib/schemas/employee.ts` — `employeeSearchSchema.status` enum에 `'PROBATION'` 추가 (Prisma enum·DB 무변경 — assignment.status는 TEXT)
2. `EmployeeListClient.tsx` — 두 라벨 맵(136·272)에 PROBATION 추가 + 필터 드롭다운(634) 옵션 추가
3. `EmployeeDetailClient.tsx` — STATUS_LABELS(157)에 PROBATION 추가
4. `messages/*.json` 5개 — `employee.statusProbation` 키 **추가** (기존 키 무변경)

### B. 상세 페이지 계약/수습 노출 + 진입 동선
5. `EmployeeDetailClient.tsx` — 탭에 "계약" 추가 → `ContractsClient` 임베드. **[Gate1-1] 탭 렌더 자체를 employees create/update 권한(HR_UP) 보유 시로 게이트** — MANAGER/EMPLOYEE 상세 접근자에게 계약 민감정보 비노출
6. 상세 헤더에 만료 경고: `contractEndDate` 경과 시 error 배지("계약 만료 경과"), ≤30일 시 warning 배지("계약 만료 임박 D-n"); **[Gate1-4] 수습 배지 = 활성 primary assignment `status === 'PROBATION'` 기준** + `probationEndDate` 표기. 경고 배지도 HR 권한자에게만 (같은 게이트)

### C. HR 홈 만료 임박 위젯
7. 신규 `src/components/dashboard/ExpiringContractsWidget.tsx` — 기존 `/api/v1/contracts/expiring?days=30` 소비, KpiWidget/WidgetEmpty/WidgetSkeleton 패턴 준수, 행 클릭 → 직원 상세
8. `HrAdminHomeV2.tsx` — HomeSection에 위젯 삽입
9. **[Gate1-2] `/api/v1/contracts/expiring` RBAC 축소**: EMPLOYEES VIEW(=EMPLOYEE도 보유)로는 과다 — HR_UP 게이트(핸들러 내 role 체크 또는 manage 퍼미션)로 제한
10. **[Gate1-3] 동 route `select.assignments.where`에 company filter 재적용** (복수 active primary 이상데이터 시 타법인 메타 혼입 방지)

### 구현 중 확인 게이트
- **[Gate1-5]** 목록 status 필터가 `assignments.some.status`(TEXT) 경로인지 확인 — `Employee.status`/Prisma enum 경유면 PROBATION 필터가 무시되므로 그 지점까지 수정 범위에 포함

## 명시적 비범위 (v2+)
- Prisma `EmployeeStatus` enum에 PROBATION 추가 (migration 게이트 — 별도 결정)
- 계약 만료 시 자동 상태 전환·차단 (정책 결정 필요)
- MANAGER/EXECUTIVE 홈 위젯
- probation evaluate/convert UI (엔드포인트만 존재 — 별 트랙)

## 리스크/가드
- 멀티테넌트: `/contracts/expiring` route의 companyId 스코프 **구현 전 확인 필수** (과거 systemic 누출 이력)
- `messages/*.json` append-only 준수
- 상세 API select 추가 시 RBAC 노출 검토 (계약일자 = HR 민감도 중간, 상세 접근권 있는 롤에겐 무해 판단)
- 테스트: tsc·lint + 브라우저 dogfood (수습 시드 직원 목록 필터/라벨, 계약만료 직원 상세 경고, HR 홈 위젯)
