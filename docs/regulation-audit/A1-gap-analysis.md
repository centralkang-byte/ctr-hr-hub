# A1: 위임전결규정 Gap 분석

> **규정**: CP-A-03-04 전결관리규정 Rev13 + 부표#1 업무전결권한기준표
> **시스템**: CTR HR Hub (track-b-phase3-v2 branch)
> **작성일**: 2026-03-27

---

## Gap 요약

| # | 모듈 | Gap 유형 | 심각도 | 수정 가능성 |
|---|------|---------|--------|-----------|
| G1 | 급여 | 전결 체인 역할명 불일치 | 🔴 HIGH | 즉시 수정 (approval-chains.ts) |
| G2 | 증명서 | HR_ADMIN만 승인 (규정: 팀장) | 🟡 MED | RBAC seed 수정 |
| G3 | 징계 | HR_ADMIN만 생성 (규정: CEO) | 🟡 MED | 설계 검토 필요 |
| G4 | 근태 | 승인자 역할 검증 없음 | 🟡 MED | 코드 수정 필요 |
| G5 | 위임 | 휴가만 지원 (규정: 전 업무) | 🟡 MED | 모델 확장 필요 |
| G6 | 합의 | 합의 프로세스 미구현 | 🟠 LOW | 신규 기능 (별도 Phase) |
| G7 | 궐위/대행 | 자동화 미구현 | 🟠 LOW | 설계 변경 (별도 Phase) |
| G8 | 채용 | 충원요청 CEO 전결 미확인 | 🟡 MED | ApprovalFlow 시드 확인 |
| G9 | 휴직 | 모듈 미구현 (규정: 본부장) | 🔴 HIGH | B1 별도 과제 |
| G10 | 교육 | 모듈 미구현 | 🟠 LOW | 별도 과제 |

---

## 상세 Gap 분석

### G1: 급여 승인 체인 역할명 불일치 🔴

**규정**: 급여/상여 지급 → 본부장(Division Director) 전결
**규정**: 퇴직금 지급 정산서 → CEO 전결

**현재 시스템** (`src/lib/payroll/approval-chains.ts`):
```typescript
'CTR':    ['HR_MANAGER', 'CFO'],        // ❌ 규정: 본부장 전결
'CTR-CN': ['GENERAL_MANAGER'],           // ⚠️ 확인 필요
'CTR-US': ['CONTROLLER'],               // ⚠️ 해외법인 자체 규정
'DEFAULT': ['HR_ADMIN'],                 // ❌ 규정 근거 없음
```

**Gap**: `HR_MANAGER`, `CFO`는 전결 규정상 역할명이 아님. 규정에 따르면:
- 일반 급여: 본부장(DIV_DIRECTOR) 단독 전결 또는 본부장→대표(CEO) 2단계
- 퇴직금: CEO 단독 전결

**수정 방향**:
- 즉시: `PAYROLL_APPROVAL_CHAINS` 값을 규정에 맞게 조정
- 단, 현재 역할 시스템(EmployeeRole)에 `HR_MANAGER`, `CFO` 등이 이미 할당되어 있을 수 있으므로 실제 Role 테이블 확인 후 매핑 결정
- 핵심 질문: **시스템의 Role은 직급(직책)을 의미하는가, 아니면 HR 시스템 내 역할을 의미하는가?**

---

### G2: 증명서 발급 승인 권한 불일치 🟡

**규정**: 인사사항 증명서 발급 → 팀장 전결
**현재**: `perm(MODULE.EMPLOYEES, ACTION.UPDATE)` → HR_ADMIN, SUPER_ADMIN만 보유

**Gap**: MANAGER(팀장)가 직원 증명서 발급을 승인할 수 없음

**수정 방향**: RBAC 시드에서 MANAGER 역할에 `employees_update` 또는 별도 `certificates_approve` 권한 추가

---

### G3: 징계 승인 권한 불일치 🟡

**규정**: 사원포상 및 징계 → **CEO** 전결
**현재**: `perm(MODULE.DISCIPLINE, ACTION.CREATE)` → HR_ADMIN, SUPER_ADMIN만 보유

**Gap**:
- 규정상 징계는 CEO 전결사항이나, 시스템에서는 HR_ADMIN이 단독으로 생성/처리
- 또한 규정은 "징계위원회 구성"을 요구하나 시스템에 해당 워크플로우 없음

**수정 방향**:
- 징계 생성은 HR_ADMIN 유지 (기안)
- 최종 확정은 CEO 승인 단계 추가 필요 → ApprovalFlow 연결
- 단, 이는 설계 변경이므로 별도 Phase (A5: 징계규정 정합성)에서 처리

---

### G4: 근태 승인자 역할 검증 부재 🟡

**규정**: 근태관리 → 팀장 전결
**현재**: `AttendanceApprovalRequest`에 임의 `approverIds` 배열 → 역할 검증 없음

**Gap**: 아무 직원이든 approverIds에 넣으면 승인 가능. 팀장/관리자 검증 없음.

**수정 방향**:
- 승인자 지정 시 MANAGER 이상 역할 체크 추가
- 또는 `getDirectReportIds()` 기반으로 직속상관만 승인자로 허용

---

### G5: 위임 범위 제한 🟡

**규정**: 전결권자 부재 시 차상급자가 **모든 업무** 대행 가능 (후결 필수)
**현재**: `DelegationScope = LEAVE_ONLY | ALL` (2가지만)

**Gap**:
- `ALL` 선택 시에도 실제로는 **휴가 승인만 위임 통합됨** (급여/채용/근태 미연결)
- 규정의 대행(代行) 개념이 시스템에 불완전하게 반영

**수정 방향**:
- 단기: 급여 승인에도 delegation 체크 추가
- 중기: scope를 세분화 (LEAVE/PAYROLL/RECRUITMENT/ATTENDANCE/ALL)
- 장기: 자동 궐위/대행 메커니즘

---

### G6: 합의(Agreement) 프로세스 미구현 🟠

**규정**: 다수의 HR 업무에 합의처 지정:
- 충원요청: 경영관리본부장 + 피플앤컬처팀
- 인사발령 (부문 간): 피플앤컬처팀 본부장
- 간접고용 채용: 피플앤컬처팀
- 휴직/복직/퇴직: 피플앤컬처팀
- 인사 소송: 법무팀

**현재**: 합의 워크플로우 없음. 단일 승인자 모델만 존재.

**수정 방향**:
- 신규 기능: ApprovalFlow에 `agreementSteps` 추가 (전결 전 합의 단계)
- 별도 Phase에서 설계

---

### G7: 궐위/대행 자동화 미구현 🟠

**규정**:
- 전결권자 궐위 → 차상급자 자동 전결
- 전결권자 부재 → 차상급자 대행 + 후결 필수

**현재**: 수동 ApprovalDelegation만 존재 (시간 기반, 수동 등록)

**수정 방향**:
- Position.reportsToPositionId 기반 자동 대행자 결정 로직
- 별도 Phase에서 설계

---

### G8: 채용 충원요청 CEO 전결 확인 필요 🟡

**규정**: 충원요청 → CEO 전결 (합의: 경영관리본부장 + 피플앤컬처팀)
**현재**: ApprovalFlow 기반 (설정 가능), 실제 시드 데이터 미확인

**확인 필요**: ApprovalFlow 시드에서 recruitment 모듈의 실제 승인 단계가 CEO를 포함하는지

---

### G9: 휴직 모듈 미구현 🔴

**규정**: 휴직계/사직서 → 본부장 전결 (합의: 피플앤컬처팀)
**현재**: LeaveOfAbsence 모듈 없음

**수정 방향**: B1 과제 (별도 Phase)

---

### G10: 교육 모듈 미구현 🟠

**규정**: 15개 이상의 교육 관련 전결 항목
**현재**: Training 모듈 없음

**수정 방향**: 별도 과제

---

## 즉시 수정 가능 항목 (이번 세션)

### Fix 1: 급여 승인 체인 정합성 메모 추가
- `approval-chains.ts`에 규정 근거 주석 추가
- 실제 Role 테이블 매핑 확인 후 조정 여부 결정
- **주의**: DO NOT TOUCH 파일 해당 여부 확인 필요

### Fix 2: ~~RBAC seed에 MANAGER 증명서 승인 권한 추가~~
- `prisma/seed.ts`는 DO NOT TOUCH → 별도 migration 또는 시드 스크립트 필요

---

## 수정 불가 항목 (설계 변경 필요)

| Gap | 필요 작업 | 예상 규모 | 권장 Phase |
|-----|----------|----------|-----------|
| G3 (징계 CEO 전결) | 징계 워크플로우에 CEO 승인 단계 추가 | M | A5 |
| G5 (위임 범위 확장) | DelegationScope 확장 + 각 모듈 통합 | L | 별도 |
| G6 (합의 프로세스) | ApprovalFlow 합의 단계 모델 추가 | XL | 별도 |
| G7 (궐위/대행 자동화) | Position 기반 자동 대행 로직 | L | 별도 |
| G9 (휴직) | LeaveOfAbsence 신규 모듈 | L | B1 |
| G10 (교육) | Training 신규 모듈 | XL | 별도 |

---

## 결론

**시스템 전결 정합성**: 약 **60%**

- ✅ 정합: 휴가(팀장/자기결재), 채용(HR 승인), 인사기록(팀장)
- ⚠️ 부분 정합: 급여(역할명 차이), 근태(검증 부재), 위임(휴가만)
- ❌ 미정합: 징계(CEO→HR_ADMIN), 증명서(팀장→HR_ADMIN), 합의 프로세스 전체

핵심 이슈는 **시스템 Role ≠ 규정 직급** 매핑이 명확하지 않다는 점.
규정은 직급 기반(팀장/본부장/대표)이고, 시스템은 HR 역할 기반(HR_ADMIN/MANAGER).
이 매핑 테이블을 확립하는 것이 모든 정합성 작업의 전제 조건.
