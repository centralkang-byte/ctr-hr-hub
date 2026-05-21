# Phase 3a · Stage 4 Pre-flight — 코드베이스 적용 사전 검증

> **base SHA**: `9a940408` (Session 228, batch 04 Stage 3 통과 후 + RECORD 사양화)
> **작성일**: 2026-05-21 KST
> **작성자**: 가디언 (proto 디자인 SSOT 트랙)
> **목적**: PR-5A 머지 전 HOLD 슬롯 (~62h) 활용한 코드베이스 트랙 사전 audit. src/ 변경 0, read-only audit only.

---

## §0. 1분 요약

- **3 RECORD 코드베이스 트랙 사전 검증** (N+17/N+18/N+23). proto only (N+19~N+22)는 별도 turn 불요.
- **주요 변경 권고 (Stage 3 사양화 대비)**:
  - **N+17**: 코드베이스에 `/directory` + `/employees` 양립. DirectoryClient 이미 `viewMode: list|grid` 토글 보유. **EmployeeListClient에 토글 포팅 + /directory redirect** 권고
  - **N+18**: ⚠️ **DB 무관 주장 부분 정정**. Prisma 에 career 데이터 모델 (Education/Certification/Activity) 0건. graceful empty 진입 가능하나 데이터 소스 별도 트랙 명시 필요
  - **N+23**: ⚠️ **F14 합본 부적합 확정**. EmployeeDetailClient = Radix UI Tabs (a11y free). F14 N+9 임계치 미달 (현재 2/5) + 가디언 G4 "현행 유지 확정". **코드베이스 작업 0**, proto만
- **Stage 4 진입 순서 재조정 후보**: N+18 의 graceful empty 결정 + N+23 의 작업 0 확인 시 우선순위 변동 가능

## §1. 파일 인벤토리

| RECORD | 파일 | 핵심 결론 |
|---|---|---|
| N+17 | [n17-directory-absorption.md](./n17-directory-absorption.md) | 사양 OK, EmployeeListClient 토글 포팅 |
| N+18 | [n18-7tab-alignment.md](./n18-7tab-alignment.md) | **DB 부재 finding** — graceful empty 또는 별도 모델 트랙 |
| N+23 | [n23-tab-a11y-f14-merge.md](./n23-tab-a11y-f14-merge.md) | **F14 합본 부적합** — 코드베이스 작업 0, proto만 |

## §2. Stage 4 진입 순서 재권고

| 순서 | RECORD | 트랙 | 블라스트 | 비고 |
|---|---|---|---|---|
| 1 | **N+21** | proto only | 가장 작음 | 데모 한계 배너 — 카나리 1번 |
| 2 | **N+19** | proto only | 작음 | data.js 5건 SSOT — 카나리 2번 |
| 3 | **N+20** | proto only | 작음 | 위저드 옵션 SSOT — 카나리 3번 |
| 4 | **N+22** | proto only | 작음 | 상태 chip SSOT — 카나리 4번 |
| 5 | **N+23 (proto only)** | proto only | 작음 | proto 수동 tablist만 — 코드베이스 작업 0 (본 audit 결과) |
| 6 | **N+17** | proto + 코드베이스 | 중간 | /directory redirect + 토글 포팅 |
| 7 | **N+18** | proto + 코드베이스 | 중~큼 | graceful empty UI + 별도 모델 트랙 |

**변경 사유 (Session 228 마지막 권고와 차이)**:
- N+23 트랙이 코드베이스 작업 0 으로 확정 → 우선순위 N+22 다음으로 상승 (5번)
- N+17 / N+18 트랙 순서 유지 (N+17 = redirect+토글 = 단순, N+18 = DB 부재 finding 으로 가장 복잡)

## §3. 별도 트랙 후보 (본 pre-flight 결과 신규)

본 audit 에서 발견된 별도 트랙 후보. 본 batch 04 진입 0, 별도 plan 자료.

1. **career 데이터 모델 트랙** (N+18 부산물): Prisma 에 `EmployeeEducation` / `EmployeeCertification` / `EmployeeActivity` 3 모델 신설. schema migration + RLS + API + i18n. **별도 batch 후보** (예: batch 06 — 직원 경력 데이터)
2. **수동 tablist 임계치 모니터링** (N+23 부산물): 현재 2 surface (LeaveClient, MyTasksClient). 5+ 임계 도달 시 자동 합본 트랙 진입. EmployeeListClient 다중필터 추가 시 3번째 surface 발생 가능 — N+17 작업 시 surface 카운트 갱신 필요

## §4. 가드 (본 pre-flight 준수)

- ❌ src/ / prisma/ / messages/ 변경 0 — 본 commit 전수 docs/ 만
- ❌ batch 04 §7 RECORD body 갱신 — pre-flight 결과는 별도 stage4-preflight/ 만
- ❌ 새 RECORD 번호 reserve — 본 audit 은 N+17/N+18/N+23 검증만, 신규 finding 등장 시 별도 RECORD 가능성만 메모
- ✅ docs/phase-3a/stage4-preflight/ 하위 4 markdown 신규
- ✅ phase3a-audit 워크트리에서만 commit

---

**상태**: ACTIVE (Stage 4 진입 입력 SSOT)
**다음 갱신**: PR-5A 머지 후 N+21 카나리 진입 시
