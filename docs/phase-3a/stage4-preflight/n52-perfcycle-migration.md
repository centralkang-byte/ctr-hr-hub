# N+52 Pre-flight — PerfCycleWizard 마이그레이션 (Q4 점진 4) ⚠️ 가디언 사전 가정 정정

> **base SHA**: `4ff48de6` · **트랙**: codebase · **우선**: MEDIUM
> **결정 (Stage 3 Q4=C)**: 점진 마이그레이션 4번째
> **본 pre-flight 결과 (요약)**: ⚠️ **가디언 사전 가정 정정** — codebase PerfCycleWizard **wizard 패턴 부재**. `CreateCycleModal` 단일 modal form (multi-step 0).

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### ⚠️ CRITICAL 정정 발견 — CreateCycleModal 단일 form

**가디언 사전 가정** (Stage 1 audit + Stage 2 카드): "PerfCycleWizard inline 4-step 패턴, WizardShell consumer 마이그레이션 대상"

**CC grep 검증 결과**:
```
$ find src -name "*PerfCycle*" -o -name "*cycle*new*"
(empty)

$ grep -c "step|Step|wizard|Wizard" src/app/(dashboard)/performance/PerformanceClient.tsx
0
```

**대신 발견**: `src/app/(dashboard)/performance/cycles/CyclesClient.tsx`:
```tsx
// Line 146-148
{showCreateForm && (
  <CreateCycleModal
    onClose={() => setShowCreateForm(false)}
    onCreated={() => { setShowCreateForm(false); fetchCycles() }}
  />
)}

// Line 152-154
function CreateCycleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  // 단일 form (cycle name + period + mboWeight + cfrWeight + ...)
  // step state 0건, navigation 0건
  ...
}
```

→ **CreateCycleModal = 단일 modal form** (multi-step wizard 아님 확정)

### proto PerfCycleWizard 패턴 (참고)

`_design-reference/wizards.jsx` PerfCycleWizard:
- 4 proto 위저드 모두 `WizardShell` consumer
- PerfCycleWizard step 추정: 기본정보 / weights / 일정 / 결재선

### 정정 사유 분석

**proto vs codebase 결렬**:
- proto = 위저드 (multi-step, 4 step 추정)
- codebase = 단일 modal form (`CreateCycleModal`, weights/period 한 화면)

**원인 추정**:
- codebase 성과 사이클 생성 = 운영진(HR)이 빈번 작업 아님 (분기/반기당 1회) → 단일 form UX 정합
- 사이클 생성 자체는 단순 (이름/기간/weight) — multi-step 부담
- Stage 1 audit 시점에 codebase 정확 검증 미수행

---

## §2. ⭐ Stage 3 결정 정정 의제 (N+51와 동일 패턴)

가디언 사전 가정 정정 = **N+52 scope 재정의 필요**

### 옵션 A — 신규 wizard 패턴 도입 (proto SSOT 정합)
- CreateCycleModal → PerfCycleWizard 신규 4-step 분할 + WizardShell consumer
- **scope**: ~150~200 lines
- **회귀 위험**: HIGH (단일 modal → 4-step)
- **production 영향**: 사이클 생성 빈도 낮음 = 회귀 영향 작음, 단 UX 큰 변경

### 옵션 B — 현행 단일 modal form 유지 (codebase paradigm leader) ⭐ CC 권고
- CreateCycleModal 그대로 유지
- **scope**: 0 (변경 없음)
- **proto SSOT 결렬**: 인정 — production paradigm 우선

### 옵션 C — hybrid: 단일 form 유지 + WizardShell wrapper만
- CreateCycleModal → WizardShell (1 step only)
- **scope**: ~30 lines (WizardShell wrapper 적용)
- **장점**: SSOT 일관성 (Dialog 컨테이너 통합)
- **단점**: 1 step wizard = step indicator 의미 없음

### CC 권고 = 옵션 B (현행 유지)

**근거** (N+51와 동일):
1. **production paradigm 보존** (batch 05 Q6 패턴)
2. **회귀 위험 회피** — 단일 modal → wizard 분할 = UX 큰 변경
3. **proto SSOT는 visual reference** — UX paradigm 강제 X
4. **N+52 = "비대상" 결정 권고** — Stage 4 implementation 시 CreateCycleModal 무변경

---

## §3. 변경 surface 인벤토리 + 예상 line delta (옵션 B 권고)

### (a) 변경 파일

| 파일 | 변경 | line delta |
|---|---|---|
| `src/app/(dashboard)/performance/cycles/CyclesClient.tsx` (line 152 CreateCycleModal) | **변경 0** | 0 |

→ **N+52 옵션 B 채택 시 변경 0**

### (b) 옵션 A 진입 시 (참고)

- CreateCycleModal → 4-step 분할
- form schema → step별 partial schema
- ~150~200 lines

### (c) 옵션 C 진입 시 (선택)

- WizardShell wrapper (1 step) — ~30 lines
- step indicator 표시 안 함 (`steps={[]}` 또는 hide prop)

---

## §4. 위험 / 의존성 / 가드

### 위험 (옵션 B)
- **R1 (LOW)**: proto SSOT 결렬 인정 — batch 09 §7 정정 commit 필요
- **R2 (LOW)**: 향후 사이클 생성 복잡도 증가 시 wizard 격상 가능 (별도 트랙)

### 의존성 (옵션 B)
- **batch 09 §7 N+52 entry 정정** (옵션 B 채택 명시)

### 가드
- ❌ 단일 modal → wizard 강제 변환 금지
- ❌ proto SSOT visual reference 외 UX paradigm 강제 X
- ✅ batch 05 Q6 패턴 정합

---

## §5. Implementation 단계 (옵션 B 채택 시)

1. **사전 합의 게이트** (필수):
   - 옵션 A / B / C 결정 (가디언 또는 사용자)
   - 추천 = B (현행 유지)
2. **옵션 B 채택 시**:
   - batch 09 §7 N+52 entry 정정 commit (별도 turn 또는 본 pre-flight cross-ref)
   - Stage 4 implementation 시 N+52 비대상 처리

---

## §6. Verification (verify 계획)

### 옵션 B (권고)
- ✅ 변경 0
- ✅ batch 09 §7 N+52 정정 commit 완료
- ✅ proto SSOT 결렬 명문화

---

## §7. 정정 결과 권고

**N+52 결정 = 옵션 B (현행 유지)**

batch 09 §7 N+52 entry **정정 권고**:
- "PerfCycleWizard 마이그레이션 [MEDIUM]" → "PerfCycleWizard 비대상 [LOW, CreateCycleModal 단일 form paradigm leader, proto SSOT 결렬 인정]"

**별도 트랙 후보**: batch 10+ "Performance cycle wizard UX 도입" (사이클 생성 복잡도 증가 시)

---

## §8. N+51 + N+52 통합 정정 권고

본 pre-flight 결과 N+51 (JobPosting) + N+52 (PerfCycle) **두 RECORD 모두 가디언 사전 가정 정정**:

| RECORD | 사전 가정 | 검증 결과 | 권고 |
|---|---|---|---|
| N+51 | wizard inline | 단일 form (StickyActionBar) | 옵션 B (비대상) |
| N+52 | wizard inline | 단일 modal (CreateCycleModal) | 옵션 B (비대상) |

→ **batch 09 §7 두 entry 정정 commit 권고** (단일 turn 처리 가능)

**batch 09 Stage 4 actual scope 정정**:
- 사양 = N+48~N+53 6 RECORD
- 정정 후 actual = N+48 + N+49 + N+50 + **N+51 비대상** + **N+52 비대상** + N+53 = **4 RECORD codebase 변경**

---

**상태**: pre-flight 완료, ⚠️ 가디언 사전 가정 정정 (옵션 B 권고, N+51와 동일 패턴)
**Stage 4 예상 PR 크기**: 옵션 B = 0 변경
