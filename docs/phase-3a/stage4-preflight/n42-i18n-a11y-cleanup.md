# N+42 Pre-flight — i18n 5 locale + a11y SSOT + N+18 우회로 grep verification (최후)

> **base SHA**: `6f4ffe84` · **트랙**: codebase + i18n + docs · **우선**: LOW (최후 RECORD)
> **결정 (Stage 3 Q6=A)**: 5 locale ~150 키 + drawer a11y SSOT (batch 08 N+44) 정합 + N+18 우회로 0 verification
> **본 pre-flight 결과 (요약)**: ✅ i18n SSOT 명확 + axe-core baseline cross-ref (batch 08 N+47) + N+18 grep pattern 사전 정의.

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### i18n SSOT 현황

```
messages/
├── ko.json     (한국어, primary)
├── en.json     (English)
├── zh.json     (中文)
├── vi.json     (Tiếng Việt)
└── es.json     (Español)
```

- 가드: 기존 키 편집/삭제 금지, 신규 키 추가 OK (CLAUDE.md)
- 본 N+42 = ~150 신규 키 (career namespace)

### N+18 우회로 grep pattern 사전 정의

batch 04 N+18 implementation = `CareerTab.tsx` 안에 4 EmptyState placeholder. N+41 머지 후 우회로 코드 0 verification:

```bash
# N+42 verification grep patterns:

# 1. Career-related EmptyState 호출 (모두 제거되어야 함)
grep -rn "<EmptyState" src/components/employees/career/ src/app/\(dashboard\)/employees/\[id\]/ \
  | grep -iE "education|certification|training|activity|career"
# Expected: 0 matches

# 2. N+18 graceful empty placeholder pattern (구체 패턴)
grep -rn "graceful empty\|TODO.*career\|N+18\|graceful empty 우회" src/components/employees/
# Expected: 0 matches

# 3. CareerTab.tsx EmptyState import (없어야 함, 4 섹션 풀 UI 마이그레이션 후)
grep -n "import.*EmptyState" src/components/employees/career/CareerTab.tsx
# Expected: 0 matches (또는 다른 의미 재사용 시 explicit comment)
```

### batch 08 N+47 a11y baseline cross-ref

`docs/phase-3a/stage4-preflight/n47-a11y-ssot-axe-baseline.md`:
- `.claude/rules/accessibility.md` 기존 SSOT 확장
- axe-core CI baseline 도입 (batch 08 N+47 implementation 후)
- N+42 = batch 08 N+47 적용된 a11y baseline 활용

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) i18n 5 locale × ~150 키 신설

```
messages/{ko,en,zh,vi,es}.json
└── employees.career.*
    ├── educations.{degree.*, status.*, school, major, period, addNew, editTitle, ...}     (~30 keys × 5 = 150)
    ├── certifications.{name, issuer, acquiredAt, expiresAt, status.*, ...}               (~25 keys × 5 = 125)
    ├── trainings.{course, hours, type.*, date, status.*, ...}                            (~20 keys × 5 = 100)
    └── activities.{type.*, title, description, period, ...}                              (~25 keys × 5 = 125)
```

대략 키 카운트:
- educations: 6 (EducationDegree) + 4 (EducationStatus) + 8 (form labels) = 18 키
- certifications: 3 (status: active/expiring/expired) + 8 (form labels) = 11 키
- trainings: 3 (type 매핑) + 3 (status) + 8 (form labels) = 14 키
- activities: 7 (ActivityType) + 8 (form labels) = 15 키
- 공통: form button labels (저장/취소/추가/편집/삭제 etc.) = 10 키 (기존 재사용 검토)

**총 ~58 unique keys × 5 locale = ~290 entries**

→ 사전 가정 ~150 entries는 보수적 추정. 실 ~290 entries 가능. Stage 4 implementation 시 정확 검증.

### (b) batch 08 N+44 drawer a11y SSOT 검증

- N+41 신설 EmployeeCareerDrawer.tsx (Radix Sheet 기반) = batch 08 N+44 정합 검증
- axe-core 0 violation × 4 섹션 drawer
- keyboard nav (Tab / Esc / focus return) 검증

### (c) N+18 우회로 코드 verification

- grep target = career-related EmptyState 호출 = 0
- 또는 EmptyState 호출 명시 (재사용 의미 명확 시) — comment with justification

### (d) 예상 총 line delta

- i18n 5 locale: +290 entries (parsed JSON 약 +320 lines × 5 = +1600 lines)
- a11y SSOT 검증: docs 0 (verification only)
- N+18 grep verification: docs 0 (verification only)
- **순 총합**: i18n 약 +1600 lines (대부분 JSON entries)

---

## §3. i18n / DB / API 영향 평가

- **i18n**: 5 locale × ~58 unique keys = ~290 entries
- **DB**: 0
- **API**: 0
- **a11y**: axe-core baseline 활용 (batch 08 N+47 통합 SSOT)

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (LOW)**: i18n 키 충돌 (기존 키 편집/삭제 금지) → 신규 namespace `employees.career.*` 사용
- **R2 (LOW)**: 다국어 번역 품질 — ko 정식, en 영문, zh/vi/es placeholder OK (CLAUDE.md i18n 가드)
- **R3 (MEDIUM)**: N+18 우회로 grep verification 실패 시 (코드 남아있음) → N+41 회귀 검토 필요

### 의존성
- **N+41 머지 후 최후 진입** (i18n 키 = N+41 consumer 호출 정합)
- **batch 08 N+47 axe-core baseline** 도입 권고 (a11y CI gate)
- **PR-5A 머지** 후

### 가드
- ❌ 기존 i18n 키 편집/삭제 금지 (CLAUDE.md DO NOT TOUCH)
- ❌ N+18 graceful empty placeholder 코드 남기기 금지 (점진 폐기 완료 verification)
- ✅ 신규 namespace `employees.career.*` 사용
- ✅ ko 정식, en 영문, zh/vi/es placeholder 수용 (CLAUDE.md i18n 가드)
- ✅ axe-core 0 violation 검증

---

## §5. Implementation 단계 (N+41 머지 후, 최후 진입)

1. **사전 합의 게이트**:
   - i18n 신규 키 inventory finalize (~58 unique × 5 locale)
   - 다국어 번역 책임자 (HR 운영팀 또는 CC 자동)
2. **branch**: `feat/employee-career-i18n-cleanup`
3. **commit 1**: ko.json + en.json 신규 키 (정식 번역)
4. **commit 2**: zh.json + vi.json + es.json 신규 키 (placeholder 수용 가능)
5. **commit 3**: N+18 우회로 grep verification + 잔여 코드 0 정정
6. **commit 4 (선택)**: axe-core baseline 캡처 (batch 08 N+47 정합)
7. **codex Gate 1+2**: 표준
8. **PR open**: `feat/employee-career-i18n-cleanup` → main

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error
- ✅ **lint**: clean
- ✅ **i18n**: 5 locale × ~58 keys = ~290 entries 검증 (`npm run i18n:check` 또는 동등 script)
- ✅ **axe-core**: 0 violation × 4 섹션 drawer + CareerTab
- ✅ **N+18 grep verification**: career-related EmptyState 0 matches (또는 명시적 재사용 comment)
- ✅ **점진 폐기 chain 완료**: batch 04 N+18 → batch 06 N+41 → batch 06 N+42 verification

---

## §7. ⭐ Phase 3a Stage 4 pre-flight 마지막 RECORD

본 N+42 = **Phase 3a Stage 4 pre-flight 마지막** (29/37 RECORD 완료):

| Batch | pre-flight 완료 RECORD | 누적 |
|---|---|---|
| batch 04 | N+17/N+18/N+23 | 3 |
| batch 05 | N+24/N+26/N+27/N+30 | 4 |
| batch 06 | **N+37/N+38/N+39/N+40/N+41/N+42** | 6 |
| batch 07 | N+31/N+32/N+34/N+35/N+36 | 5 |
| batch 08 | N+43/N+44/N+45/N+46/N+47 | 5 |
| batch 09 | N+48/N+49/N+50/N+51/N+52/N+53 | 6 |
| **합계** | — | **29 RECORD** |

**제외 RECORD** (8 = proto only + DEFERRED):
- proto only: N+19/N+20/N+21/N+22/N+25/N+28/N+29/N+33 = 8 (pre-flight 무관)
- DEFERRED: N+51/N+52 = 2 (옵션 B 채택, pre-flight 완료 후 비대상 확정)

→ **29 pre-flight + 8 proto only + 2 DEFERRED + 0 reserve = 39 total**

(실 카운트: 17~53 범위, 일부 skip 가능성 검증 필수, RECORD body 사양화 = 37)

---

**상태**: pre-flight 완료, Phase 3a Stage 4 pre-flight **마지막 RECORD**
**Stage 4 예상 PR 크기**: 4 commits, ~1600 lines (대부분 i18n JSON entries), 5-6 file diff
