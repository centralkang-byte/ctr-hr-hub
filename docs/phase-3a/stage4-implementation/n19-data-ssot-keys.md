# N+19 Implementation — data.js 10 SSOT 키 신설 + 인라인 array 해소 (Phase A 2순위)

> **base SHA**: `d868be4d` (main, PR-5A #63 머지 직후)
> **선행 PR**: [#64](https://github.com/centralkang-byte/ctr-hr-hub/pull/64) (`fde915ef`, N+21 SSOT) + [#65](https://github.com/centralkang-byte/ctr-hr-hub/pull/65) (`df2617f8`, N+21 wizards 통합)
> **본 PR**: `feat/n19-data-ssot-keys` — Phase A 2번째 PR (audit §6.2 #② 권고)
> **작성일**: 2026-05-22 KST (Session 230)
> **선행 audit**: [phase-a-entry-audit.md §6.1 2순위](./phase-a-entry-audit.md#61-권고-진입-순서-phase-a-8-record) + §2 scope estimate + §5 위험도 (`5e063d37`)
> **선행 doc**: [N+19 사전 inquiry 답변](#) (m0036 readonly, 7 항목 + ambiguity 명시)

---

## §1. 10 SSOT 키 list (batch 04 §7 N+19 L317-326 단일 진실)

`_design-reference/data.js`에 신설/확장된 10 SSOT 키:

| # | 키 | 종류 | proto surface | finding |
|---|---|---|---|---|
| 1 | `employeeDetail.mboHistory[]` | 신설 (4 entries) | page-employee-detail.jsx perf 탭 (L284-310) | EM-003 |
| 2 | `employeeDetail.praises[]` | 신설 (6 entries) | 동 perf 탭 (L304-323) | EM-003 |
| 3 | `employeeDetail.evaluation[]` | **확장** (3 → 4 entries) — 기존 키 존재(`a147d919` L461) | 동 perf 탭 평가 이력 | EM-003 |
| 4 | `employeeDetail.education[]` | 신설 (3 entries) | 동 career 탭 학력 (L329-348) | EM-004 |
| 5 | `employeeDetail.certifications[]` | 신설 (5 entries) | 동 career 탭 자격증 table (L352-365) | EM-004 |
| 6 | `employeeDetail.trainings[]` | 신설 (5 entries) | 동 career 탭 교육 이수 (L373-389) | EM-004 |
| 7 | `employeeDetail.activities[]` | 신설 (5 chip) | 동 career 탭 사내 활동 (L398) | EM-004 |
| 8 | `employeeDetail.attendance30.daily[]` | **확장** (기존 5 summary 키 + daily 30 entries 추가) | AttendanceMiniCalendar (L434-442) | EM-005 |
| 9 | `directoryStats[employeeCode].quickStats` | 신설 (14 직원 fully 다양화) | inspector.jsx 빠른 통계 (L161-169) | EM-007 |
| 10 | `directoryStats[employeeCode].recentActivity[]` | 신설 (14 직원, 2-4 entries 각) | inspector.jsx 최근 활동 (L175+) | EM-008 |

**audit 본문 카운트 inconsistency** (별도 turn 정정 의제 — m0036 추가 의제 #1):
- audit §0/§1.2/§6.2 "5 SSOT 키" / §2/§6.1 "7 키" → **정확 = 10 키** (9 신설 + 1 evaluation 확장)
- batch 04 §7 본문 "5건" = **5 finding** 의미 (EM-003/004/005/007/008), 키 카운트 아님

**evaluation 결정**: 기존 L461 `evaluation: [` 3 entries 존재 확인 → **확장 채택** (3 → 4 entries, 2025 H1 entry 추가).

**directoryStats SSOT 분리 채택**: 사양서 표기 "directory[i].quickStats" → entry inline 추가 시 LOC 폭증 + 가독성 저하. **별 SSOT key (`data.directoryStats[code]`)** 채택. 14 직원 fully 다양화 (5+ 직원 시각 verify acceptance 충족).

**attendance30 회귀 방어**: 기존 `{ workDays: 22, late: 1, absent: 0, leaveUsed: 1, avgWork: "8h 24m" }` summary 5 키 **그대로 유지** + `daily: [...]` 30 entries 신설 (1-char codes p/l/a/v compact). 기존 회귀 0.

---

## §2. 5 finding cascading 해소 (1 PR 동시)

| finding | 현상 | 해소 |
|---|---|---|
| **EM-003** [MED] perf 탭 하드코딩 | MBO 4행 / 받은 칭찬 6건 / 평가 이력 카드 인라인 | `mboHistory[]` + `praises[]` + `evaluation[]` 확장 SSOT 참조 |
| **EM-004** [MED] career 탭 전체 하드코딩 | 학력 3 / 자격증 5 / 교육 5 / 활동 5 chip 인라인 | `education[]` + `certifications[]` + `trainings[]` + `activities[]` SSOT 참조 |
| **EM-005** [MED] AttendanceMiniCalendar 의사난수 | `(i*31)%100` 패턴 — 전 직원 동일 | `attendance30.daily[]` 30 entries 시드 다양화 |
| **EM-007** [MED] EmployeeInspector "빠른 통계" 고정 | 잔여연차 12.5 / OT 4.2h / 등급 E — 직원 무관 동일 | `directoryStats[code].quickStats` 14 직원 다양화 |
| **EM-008** [LOW] EmployeeInspector "최근 활동" 하드코딩 | 4 entries 전 직원 동일 | `directoryStats[code].recentActivity[]` 14 직원 다양화 |

→ **5 finding 1 PR cascading 해소** ✅ (audit §6.2 #② 권고 정합)

---

## §3. 가드 (Phase A 정의 정합)

| 가드 | 결과 |
|---|---|
| `src/` diff empty | ✅ Pure proto only (Phase A 정의) |
| `messages/` diff empty | ✅ 한국어 hardcoded mock data (proto 패턴 정합) |
| `prisma/` diff empty | ✅ DB schema 무관 |
| `_design-reference/ui.jsx` 미터치 | ✅ PR #64 SSOT 단일 source 유지 |
| `_design-reference/wizards.jsx` 미터치 | ✅ PR #65 scope 유지 |
| 다른 `_design-reference/` 파일 미터치 | ✅ 3 파일 한정 (`data.js` + `page-employee-detail.jsx` + `inspector.jsx`) |
| `attendance30` 기존 5 summary 키 회귀 0 | ✅ summary + daily 양면 (기존 5 키 그대로) |
| 신규 키 명명 conflict 0 | ✅ 사전 grep — `mboHistory`/`praises`/`directoryStats` 등 기존 부재 확인 |

---

## §4. Verification 결과

### acceptance #1: 인라인 array literal 0건

```text
$ grep -nE '\[.*\{.*name.*\}' \
    _design-reference/page-employee-detail.jsx \
    _design-reference/inspector.jsx \
    _design-reference/data.js
(0 matches) ✅
```

### acceptance #2: 직원별 quickStats/recentActivity 다양화

`data.directoryStats`에 14 직원 fully 다양화 entries:

| 직원 (code) | quickStats (잔여연차/OT/등급) | recentActivity 카운트 |
|---|---|---|
| 강성민 (CTR-KR-3026) | 12.5 / 4.2 / A | 4 |
| 강하준 (CTR-KR-3066) | 8.0 / 2.1 / B+ | 3 |
| 강하준 (CTR-KR-3006) | 14.0 / 6.8 / B | 2 |
| 권동혁 (CTR-KR-3055) | 5.5 / 3.4 / A- | 3 |
| 권시우 (CTR-KR-3035) | 11.0 / 1.5 / B | 2 |
| 권하은 (CTR-KR-3015, 휴직) | 9.5 / 0 / — | 1 |
| 김민준 (CTR-KR-3001) | 7.0 / 8.2 / A | 2 |
| 김민준 (CTR-KR-3061) | 6.5 / 4.5 / B+ | 2 |
| 김수빈 (CTR-KR-3041) | 10.5 / 5.0 / A- | 2 |
| 박지훈 (CTR-KR-3088) | 4.0 / 7.1 / S | 2 |
| 이상민 (CTR-KR-3091) | 3.5 / 5.8 / A | 2 |
| 정유진 (CTR-KR-3022) | 6.0 / 4.8 / A- | 2 |
| 홍채원 (CTR-KR-3077) | 2.0 / 9.5 / S | 3 |
| 최승현 (CTR-KR-3045) | 8.5 / 6.3 / A | 2 |

**14 직원 모두 quickStats 3 값 다양화** — 전 직원 동일 패턴 (EM-007 EM-008) 해소 ✅

inspector.jsx fallback: lookup 미발견 시 default `{ leaveRemaining: "—", avgOt: "—", recentGrade: "—" }` + recentActivity = `[]` (안전).

### scope = +125 net LOC (S~M PR, audit §2 ~100 예상 정합 범위)

```text
$ git diff --stat
_design-reference/data.js                  | 154 +++++++++++++++++++++++++++-
_design-reference/inspector.jsx            |  18 ++--
_design-reference/page-employee-detail.jsx |  89 ++++++-----------
3 files changed, 193 insertions(+), 68 deletions(-)
```

net = +125 LOC. audit §2 예상 ~100 LOC와 비교 약간 큼 — directoryStats 14 직원 fully 다양화로 인한 추가 (~50 LOC). 가드 정합.

---

## §5. cross-batch carry-over (Phase C/D/E consumer 단언)

audit §3.3 단방향 그래프 정합 — N+19 data.js SSOT는 **upstream**, 후속 Phase C/D/E가 정방향 consumer:

| 후속 RECORD | Phase | N+19 SSOT 키 reuse |
|---|---|---|
| **N+18** | C | `employeeDetail.education[]` / `certifications[]` / `trainings[]` / `activities[]` — codebase 측 career 탭 graceful empty 진입 시 그대로 reuse |
| **N+30** | C | `employeeDetail` 키 매핑 layer 입력 데이터 |
| **N+37~N+42 (batch 06)** | E | Prisma `EmployeeEducation` / `EmployeeCertification` / `EmployeeActivity` 모델 seed 정합 — N+19 proto data SSOT가 codebase seed 청사진 역할 |

**역의존 0** ✅ — N+19는 Phase A SSOT layer (audit §3.2 단방향 verify 정합).

---

## §6. Out of Scope (별도 turn)

- **audit 본문 카운트 정정 (§0/§1.2/§2/§6.1/§6.2 "5/7 키" → "10")** — m0036 추가 의제 #1, surgical 정정 별도 turn
- **N+18 codebase career graceful empty** (Phase C, 별도 트랙)
- **N+30 mapping layer** (Phase C, 별도 트랙)
- **batch 06 Prisma 모델 seed** (Phase E, EmployeeEducation/Certification/Activity)
- **N+20 / N+22 진입** (Phase A 후속, sequential)
- **PR #64 / PR #65 머지** (정상 review, 본 PR과 무관)

---

**상태**: ACTIVE (본 commit 직후 PR open)
**다음 갱신**: PR 머지 후 phase3a-audit 브랜치 N+19 entry "DONE" mark + audit §0/§1.2/§2/§6.1/§6.2 카운트 정정 turn
**책임 단언**: 본 PR이 N+19 acceptance (인라인 array 0건 + 직원별 다양화)의 SSOT 적용. 5 finding (EM-003/004/005/007/008) cascading 1 PR 해소.
