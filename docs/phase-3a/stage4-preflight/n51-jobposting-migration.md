# N+51 Pre-flight — JobPostingWizard 마이그레이션 (Q4 점진 3) ⚠️ 가디언 사전 가정 정정

> **base SHA**: `4ff48de6` · **트랙**: codebase · **우선**: MEDIUM
> **결정 (Stage 3 Q4=C)**: 점진 마이그레이션 3번째
> **본 pre-flight 결과 (요약)**: ⚠️ **가디언 사전 가정 정정** — codebase JobPostingWizard **wizard 패턴 부재**. PostingFormClient는 단일 form (multi-step 0).

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### ⚠️ CRITICAL 정정 발견 — PostingFormClient 단일 form

**가디언 사전 가정** (Stage 1 audit + Stage 2 카드): "JobPostingWizard inline 4-step 패턴, WizardShell consumer 마이그레이션 대상"

**CC grep 검증 결과**:
```
$ grep -c "step|Step|wizard|Wizard" src/app/(dashboard)/recruitment/new/PostingFormClient.tsx
0
```

**파일 구조 검증** (445 lines):
- `useForm + zodResolver + z.object({...})` 단일 react-hook-form 패턴
- `<StickyActionBar>` (저장/취소) — wizard navigation 부재
- multi-step state 0건
- step indicator 0건

→ **PostingFormClient = 단일 form** (multi-step wizard 아님 확정)

### proto JobPostingWizard 패턴 (참고)

`_design-reference/wizards.jsx` (line 622 부근, OrgRestructure 외 다른 위저드 위치):
- 4 proto 위저드 모두 `WizardShell` consumer (Hire/JobPosting/PerfCycle/OrgRestructure)
- JobPostingWizard = step별 입력 + 결재선 + 발행 워크플로 추정 (Stage 1 audit 미세 검증 단계)

### 정정 사유 분석

**proto vs codebase 결렬**:
- proto = 위저드 (multi-step, 결재선 별도 step)
- codebase = 단일 form + 즉시 저장 (StickyActionBar 패턴)

**원인 추정**:
- codebase 채용공고 등록 = 직군별 옵션 + 결재 + 발행이 별도 endpoint 분리되어 있을 가능성
- 또는 production 운영팀이 단일 form UX 선호 (위저드 step 부담)
- Stage 1 audit 시점에 codebase 정확 검증 미수행

---

## §2. ⭐ Stage 3 결정 정정 의제

가디언 사전 가정 정정 = **N+51 scope 재정의 필요**

### 옵션 A — 신규 wizard 패턴 도입 (proto SSOT 정합)
- PostingFormClient → JobPostingWizard 신규 4-step 분할 + WizardShell consumer
- 단계: 기본정보 / 직군/조건 / 결재선 / 발행
- **scope**: ~150~200 lines (분할 + WizardShell 마이그레이션)
- **회귀 위험**: 매우 HIGH (단일 form → 4-step 분할 = UX 큰 변경)
- **production 영향**: HR 채용 운영팀 작업 흐름 변경 → 사전 합의 필수

### 옵션 B — 현행 단일 form 유지 (codebase paradigm leader)
- PostingFormClient 그대로 유지 (WizardShell 비대상)
- **scope**: 0 (변경 없음)
- **proto SSOT 결렬**: 인정 — production paradigm 우선 (batch 05 Q6 패턴 정합)
- **운명**: codebase 단일 form 패턴 = production 실수요 보존

### 옵션 C — hybrid (선택 wizard 모드)
- 단일 form 유지 + 신규 user 위한 "step-by-step 모드" 별도 추가
- **scope**: ~300+ lines (2 mode 코드 분기)
- **권고 안 함**: 코드 중복 + 유지비용 증가

### CC 권고 = 옵션 B (현행 유지)

**근거**:
1. **production paradigm 보존** — batch 05 Q6 패턴 (codebase only 기능 = production 실수요)
2. **회귀 위험 회피** — 단일 form → wizard 분할은 HR 작업 흐름 큰 변경
3. **proto SSOT는 visual reference** — UX paradigm 강제 X (batch 05 paradigm 정합)
4. **N+51 = "비대상" 결정 권고** — Stage 4 implementation 시 PostingFormClient 무변경

---

## §3. 변경 surface 인벤토리 + 예상 line delta (옵션 B 권고)

### (a) 변경 파일

| 파일 | 변경 | line delta |
|---|---|---|
| `src/app/(dashboard)/recruitment/new/PostingFormClient.tsx` | **변경 0** | 0 |
| (i18n) | 변경 0 | 0 |

→ **N+51 옵션 B 채택 시 변경 0** (PostingFormClient 단일 form paradigm 유지)

### (b) 옵션 A 진입 시 (참고)

만약 옵션 A 채택 시:
- PostingFormClient → 4-step 분할
- form schema (z.object) → step별 partial schema
- StickyActionBar → WizardShell footer
- ~150~200 lines

---

## §4. 위험 / 의존성 / 가드

### 위험 (옵션 B)
- **R1 (LOW)**: proto SSOT 결렬 인정 — batch 09 §7 사양 정정 필요
- **R2 (LOW)**: 향후 production 운영팀이 wizard UX 요청 시 별도 트랙 진입 가능 (N+51 reopen)

### 의존성 (옵션 B)
- **batch 09 §7 N+51 entry 정정** (옵션 B 채택 명시) — 별도 commit 또는 본 pre-flight cross-ref

### 가드
- ❌ 단일 form → wizard 강제 변환 금지 (옵션 A 권고 안 함)
- ❌ proto SSOT visual reference 외 UX paradigm 강제 X
- ✅ batch 05 Q6 패턴 정합 (codebase paradigm leader)
- ✅ batch 09 §7 N+51 정정 commit (옵션 B 채택 명문화)

---

## §5. Implementation 단계 (옵션 B 채택 시)

1. **사전 합의 게이트** (필수):
   - 옵션 A / B / C 결정 (가디언 또는 사용자)
   - 추천 = B (현행 유지)
2. **옵션 B 채택 시**:
   - 단계 1: batch 09 §7 N+51 entry 정정 commit (별도 turn)
   - 단계 2: Stage 4 implementation 시 N+51 비대상 처리
3. **옵션 A 채택 시** (별도 트랙):
   - 단계 1: PostingFormClient inventory 깊은 audit (form schema 분석)
   - 단계 2: 4-step 분할 design
   - 단계 3: WizardShell consumer 마이그레이션
   - 단계 4: HR 운영팀 UX 검증

---

## §6. Verification (verify 계획)

### 옵션 B (권고)
- ✅ 변경 0
- ✅ batch 09 §7 N+51 정정 commit 완료
- ✅ proto SSOT 결렬 명문화

### 옵션 A (참고)
- ✅ 4-step 통과 e2e
- ✅ form schema 정합
- ✅ HR 운영팀 UX 검증

---

## §7. 정정 결과 권고

**N+51 결정 = 옵션 B (현행 유지)**

batch 09 §7 N+51 entry **정정 권고**:
- "JobPostingWizard 마이그레이션 [MEDIUM]" → "JobPostingWizard 비대상 [LOW, codebase paradigm leader, proto SSOT 결렬 인정]"

**별도 트랙 후보** (옵션 A 격상 시):
- batch 10+ candidate: "Recruitment JobPosting wizard UX 도입" (사용자 합의 필수)

---

**상태**: pre-flight 완료, ⚠️ 가디언 사전 가정 정정 (옵션 B 권고)
**Stage 4 예상 PR 크기**: 옵션 B = 0 변경 / 옵션 A = ~150~200 lines (별도 트랙)
