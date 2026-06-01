# N+47 Pre-flight — a11y SSOT 문서 + axe-core baseline (최후)

> **base SHA**: `1401e8ca` · **트랙**: docs + CI · **우선**: LOW
> **결정 (Stage 3 Q5=A+B)**: A11Y-001 정의 명문화 + a11y SSOT 문서 + axe-core baseline CI
> **본 pre-flight 결과 (요약)**: ⭐ **`.claude/rules/accessibility.md` 기존 존재** — 신규 SSOT 신설 X, 기존 확장 정합.

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### ⭐ 기존 a11y SSOT 발견

```
.claude/rules/
├── accessibility.md      ⭐ 기존 SSOT 존재
├── api.md
├── assignments.md
├── components.md
├── data-fetching.md
├── database.md
├── design.md
├── error-handling.md
├── i18n.md
├── pages.md
```

→ **신규 SSOT 신설 X**. 기존 `accessibility.md` 확장 정합 (가디언 메타룰 "기존 SSOT 재사용 우선").

### 기존 a11y 검증 패턴 cross-ref

(`accessibility.md` 본문 검증 필요, 본 pre-flight 는 location 권고만)

### axe-core 도입 검증

| 위치 | 검증 결과 |
|---|---|
| `package.json` 의 `@axe-core/playwright` | (검증 필요) — Stage 4 implementation 시 확인 |
| `playwright.config.ts` | (검증 필요) |
| `vitest.config.ts` (a11y unit) | (검증 필요) |

→ axe-core CI 도입 여부 Stage 4 implementation 시 정확 확인 후 분기:
- **(A)** 이미 도입 → baseline 캡처만
- **(B)** 미도입 → `@axe-core/playwright` 신규 설치 + config 통합

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) `.claude/rules/accessibility.md` 확장

| 변경 | 내용 | line delta |
|---|---|---|
| F14 정의 명문화 | "수동 button group 포함 (informal + 공식 tablist 통합)" 정의 + 임계 5+ | +20 |
| Radix Tabs vs radiogroup 결정 가이드 | panel 전제 분기 + sample 코드 | +30 |
| `useArrowKeyNavigation` hook 사용 가이드 | API 인용 + sample 코드 | +25 |
| WAI-ARIA roving tabindex 표준 | 외부 link + 핵심 원칙 | +15 |
| 5 surface 정합 표 (cross-batch reference) | A11Y-001~A11Y-018 cross-ref | +20 |

**accessibility.md 합계**: **~110 lines 추가**

### (b) axe-core baseline 도입

| 분기 (A) 이미 도입 | 분기 (B) 미도입 |
|---|---|
| baseline 캡처 5 surface 0 violation 검증 | `@axe-core/playwright` 설치 + playwright.config 통합 |
| CI gate 추가 (`if violations > 0 fail`) | baseline 캡처 + CI gate |
| ~30 lines | ~80 lines (config + baseline + CI) |

### (c) F14 N+9 RECORD 정정 commit (별도 turn 가능)

- `docs/phase-3a/batch-cards/01-myspace-leave.md` §7 N+9 정의 명문화 patch
- 또는 별도 RECORD entry (F14a 또는 F14.1)

### (d) 예상 총 line delta

- accessibility.md: +110
- axe-core: +30~+80 (분기에 따라)
- F14 N+9 정정: +10 (별도 turn 가능)
- **순 총합**: ~+150 lines (docs + CI)

---

## §3. i18n / DB / API 영향 평가

- **i18n**: 0 (docs)
- **DB**: 0
- **API**: 0
- **CI**: axe-core gate 추가 (playwright 또는 vitest)

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (LOW)**: `.claude/rules/accessibility.md` 기존 본문과 결렬 위험 — 본 pre-flight 는 location 권고만, 본문은 N+47 implementation 시 read + 확장
- **R2 (LOW)**: axe-core baseline = 5 surface (N+44/N+45/N+46 머지 후 캡처). 미머지 시 baseline 캡처 무의미

### 의존성
- **N+43 / N+44 / N+45 / N+46 머지 후 진입 필수** (최후 RECORD)
- **PR-5A 머지** 후
- 다른 RECORD 의존성 없음 (최후 RECORD)

### 가드
- ❌ `.claude/rules/accessibility.md` 신규 파일 신설 금지 (기존 확장)
- ❌ N+47 단독 진입 금지 (N+43~N+46 머지 후 baseline 의미)
- ❌ axe-core baseline = surface 별 따로 (5 surface 별도 fixture)
- ✅ F14 N+9 정의 명문화 cross-ref (별도 commit 또는 본문 합본)
- ✅ A11Y-001 finding 해소 명시

---

## §5. Implementation 단계 (N+43~N+46 머지 후, 최후 진입)

1. **사전 합의 게이트**:
   - axe-core 도입 여부 검증 — `package.json` + `playwright.config.ts` 확인
   - F14 N+9 정의 명문화 위치 (accessibility.md vs 01-myspace-leave.md §7 patch)
2. **branch**: `feat/a11y-conventions-axe-baseline`
3. **commit 1 (accessibility.md 확장)**:
   - F14 정의 명문화 + Radix vs radiogroup 가이드 + hook 가이드 + 5 surface cross-ref (~110 lines)
4. **commit 2 (axe-core baseline — 분기에 따라)**:
   - (A) 이미 도입: 5 surface baseline 캡처
   - (B) 미도입: `@axe-core/playwright` 설치 + config 통합
5. **commit 3 (CI gate)**:
   - playwright.yml workflow에 axe-core fail-on-violation
6. **commit 4 (F14 N+9 정의 정정, 선택)**:
   - `01-myspace-leave.md` §7 N+9 patch (별도 commit 또는 turn)
7. **e2e 회귀**: 5 surface axe-core 0 violation 검증
8. **codex Gate 1+2**: 표준
9. **PR open**: `feat/a11y-conventions-axe-baseline` → main

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error (CI config 변경 시)
- ✅ **lint**: clean
- ✅ **axe-core baseline**: 5 surface 0 violation (N+43~N+46 머지 후)
- ✅ **CI gate**: PR 차단 시뮬레이션 (violation > 0 = fail)
- ✅ **accessibility.md SSOT**: cross-batch 참조 가능 (batch 09 WizardShell + 향후 batch)
- ✅ **F14 정의 결렬 (A11Y-001) 해소**: 정의 명문화 + 임계 5+ 도달 명시

---

## §7. 별도 트랙 후보

- **F14 N+9 정의 명문화 patch**: 별도 commit 또는 turn (`01-myspace-leave.md` §7 N+9 본문 정정)
- **axe-core baseline 5 surface 별도 fixture**: 각 surface 별 a11y test fixture 정합

---

**상태**: pre-flight 완료, 최후 RECORD (N+43~N+46 머지 후 진입)
**Stage 4 예상 PR 크기**: 3-4 commits, +110 docs + 30~80 CI, 2-3 file diff
