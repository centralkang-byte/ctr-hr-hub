# Phase 3a · Stage 4 Pre-flight — 코드베이스 적용 사전 검증

> **base SHA**: `ac243446` (Session 228, batch 04 + 05 Stage 3 통과 후)
> **작성일**: 2026-05-21 KST (batch 04 부분), 2026-05-21 KST (batch 05 부분 추가)
> **작성자**: 가디언 (proto 디자인 SSOT 트랙)
> **목적**: PR-5A 머지 전 HOLD 슬롯 활용한 코드베이스 트랙 사전 audit. src/ 변경 0, read-only audit only.

---

## §0. 1분 요약

### Batch 04 (employees) 트랙 — 3 RECORD

- **N+17**: 코드베이스에 `/directory` + `/employees` 양립. DirectoryClient 이미 `viewMode: list|grid` 토글 보유. **EmployeeListClient에 토글 포팅 + /directory redirect** 권고
- **N+18**: ⚠️ **DB 무관 주장 부분 정정**. Prisma 에 career 데이터 모델 (Education/Certification/Activity) 0건. graceful empty 진입 가능하나 데이터 소스 별도 트랙 (batch 06) 격상 후보
- **N+23**: ⚠️ **F14 합본 부적합 확정**. EmployeeDetailClient = Radix UI Tabs (a11y free). F14 N+9 임계치 미달. **코드베이스 작업 0**, proto만

### Batch 05 (org) 트랙 — 4 RECORD 신규 추가

- **N+24**: page-h + wd-status-chips. `PageHeader` SSOT 이미 10+ surface 사용 (재사용), **StatusChips SSOT 신규 신설 필요** (batch 03/04 공통화 권고)
- **N+26**: DeptFlowNode AVATAR_PALETTE 10색 hardcoded inline 발견. **mine highlight 부재 → prop 추가 + 토큰화**. B3I dotted-line 미터치
- **N+27** ⭐: ✅ **schema migration 불필요 확정**. `OrgRestructurePlan.changes` = `Json` free-form, ChangeType 확장은 TypeScript union만. **batch 04 N+18 같은 정정 발생 안 함**. WizardShell SSOT 신설 + 4 step + 6+ changeType 매핑
- **N+30**: pure functions 매핑 layer (proto 6 ↔ codebase 6 ChangeType + 'split' 추가 + 'transfer_employee' null). schema 무관, unit test 16+ cases

## §1. 파일 인벤토리

### Batch 04 트랙

| RECORD | 파일 | 핵심 결론 |
|---|---|---|
| N+17 | [n17-directory-absorption.md](./n17-directory-absorption.md) | 사양 OK, EmployeeListClient 토글 포팅 |
| N+18 | [n18-7tab-alignment.md](./n18-7tab-alignment.md) | **DB 부재 finding** — graceful empty 또는 batch 06 격상 |
| N+23 | [n23-tab-a11y-f14-merge.md](./n23-tab-a11y-f14-merge.md) | **F14 합본 부적합** — 코드베이스 작업 0, proto만 |

### Batch 05 트랙 (신규)

| RECORD | 파일 | 핵심 결론 |
|---|---|---|
| N+24 | [n24-page-h-status-chips.md](./n24-page-h-status-chips.md) | PageHeader SSOT 재사용 + StatusChips 신규 SSOT 신설 |
| N+26 | [n26-deptflownode-tokenize.md](./n26-deptflownode-tokenize.md) | AVATAR_PALETTE 토큰화 + mine highlight prop 추가 |
| N+27 ⭐ | [n27-restructure-wizard-rework.md](./n27-restructure-wizard-rework.md) | **schema migration 불필요** (Json free-form) |
| N+30 | [n30-step-changetype-mapping.md](./n30-step-changetype-mapping.md) | pure functions 매핑 layer ~80 lines + 16 unit test |

## §2. Stage 4 진입 순서 재권고 (cross-batch)

| 순서 | RECORD | Batch | 트랙 | 블라스트 | 비고 |
|---|---|---|---|---|---|
| 1 | **N+21** | 04 | proto only | 가장 작음 | 위저드 데모 한계 배너 |
| 2 | **N+19** | 04 | proto only | 작음 | data.js 5건 SSOT |
| 3 | **N+20** | 04 | proto only | 작음 | 위저드 옵션 SSOT |
| 4 | **N+22** | 04 | proto only | 작음 | 상태 chip SSOT |
| 5 | **N+23** | 04 | proto only | 작음 | proto 수동 tablist (코드베이스 작업 0) |
| 6 | **N+25** | 05 | proto only | 작음 | view tab 3→4 mode |
| 7 | **N+28** | 05 | proto only | 작음 | EffectiveDatePicker visual |
| 8 | **N+29** | 05 | proto only | 작음 | zoom + opacity |
| 9 | **N+24** | 05 | codebase | 중간 | PageHeader + StatusChips SSOT |
| 10 | **N+17** | 04 | codebase | 중간 | /directory redirect + 토글 포팅 |
| 11 | **N+26** | 05 | codebase | 중간 | DeptFlowNode mine highlight |
| 12 | **N+18** | 04 | codebase | 중~큼 | graceful empty UI |
| 13 | **N+30** | 05 | codebase | 중간 | mapping layer (N+27 선행 권고) |
| 14 | **N+27** ⭐ | 05 | codebase | 최대 | RestructureModal full-screen 재작업 |

**진입 순서 권고 근거**:
- proto only 8건 우선 (블라스트 작음, codebase 무영향)
- codebase 트랙은 SSOT 신설/공통화 우선 (N+24 StatusChips → N+17 view toggle → N+26 토큰 → N+18 graceful empty → N+30 mapping → N+27 wizard)
- N+27이 가장 큰 변경이므로 최후 진입 (mapping layer N+30 선행 후 즉시 활용)

## §3. 별도 트랙 후보 (cross-pre-flight)

### Batch 04 부산물

1. **career 데이터 모델 트랙** (N+18): Prisma 에 `EmployeeEducation` / `EmployeeCertification` / `EmployeeActivity` 3 모델 신설 → **batch 06 (직원 경력 데이터) 격상 후보**
2. **수동 tablist 임계치 모니터링** (N+23): 현재 2 surface (LeaveClient, MyTasksClient). 5+ 임계 도달 시 별도 a11y batch

### Batch 05 부산물 (신규)

3. **StatusChips SSOT cross-batch 공통화** (N+24): batch 03 dashboard + batch 04 employees + batch 05 org 모두 chip 패턴. 합본 SSOT 신설 별도 PR 권고
4. **WizardShell SSOT cross-batch 공통화** (N+27): Hire/Job/PerfCycle/Restructure 4 위저드 모두 proto 정합 → 공통 SSOT 신설 별도 batch 트랙 후보
5. **AVATAR_PALETTE wt 토큰 확장** (N+26): 8 토큰 vs 10색 cycling 정책 사전 결정 필요. 신규 토큰 `--org-node-mine-*` 또는 `--wt-9`/`--wt-10` 결정 게이트

## §4. 가드 (본 pre-flight 준수)

- ❌ src/ / prisma/ / messages/ 변경 0 — 본 commit 전수 docs/ 만
- ❌ batch 04/05 §7 RECORD body 갱신 — pre-flight 결과는 별도 stage4-preflight/ 만
- ❌ 새 RECORD 번호 reserve — N+17~N+30 already 검증만, 신규 finding은 별도 트랙 후보 메모만
- ❌ batch 06 entry 갱신 (격상 결정 미수신)
- ✅ docs/phase-3a/stage4-preflight/ 하위 8 markdown (4 batch 04 + 4 batch 05)
- ✅ phase3a-audit 워크트리에서만 commit

---

**상태**: ACTIVE (Stage 4 진입 입력 SSOT, batch 04 + 05 합본)
**다음 갱신**: PR-5A 머지 후 N+21 카나리 진입 시
