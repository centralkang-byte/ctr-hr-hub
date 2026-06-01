# N+26 Pre-flight — DeptFlowNode mine highlight 토큰화 (OG-003 + OG-015 + X3 + Q3=A)

> **base SHA**: `ac243446` · **트랙**: codebase + proto · **우선**: HIGH
> **결정 (Stage 3 Q3=A)**: DeptFlowNode SSOT 유지 (B3I production), proto OrgNode 색상 인라인 → 토큰화 + mine highlight 정합
> **본 pre-flight 결과 (요약)**: AVATAR_PALETTE 10색 hardcoded inline 발견, mine highlight 부재. 토큰화 + mine prop 추가 필요.

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### 코드베이스 DeptFlowNode 현황

**파일**: `src/components/org/DeptFlowNode.tsx` (186 lines)
**역할**: ReactFlow 커스텀 노드, Phase 4 Batch 8 결과물 (`// CTR HR Hub — DeptFlowNode / Phase 4 Batch 8: 리디자인된 조직도 트리 노드`)

**현재 색상 패턴**:

```tsx
// L45-57: AVATAR_PALETTE 10색 hardcoded inline
const AVATAR_PALETTE = [
  '#6366f1', // primary (violet)
  '#0ea5e9', // sky
  '#16a34a', // tertiary (green)
  '#f59e0b', // warning (amber)
  '#e11d48', // error (rose)
  '#7c3aed', // accent (purple)
  '#06b6d4', // cyan
  '#ea580c', // orange
  '#84cc16', // lime
  '#ec4899', // pink
] as const

// Handle: !bg-primary (라인 ~186)
```

### 발견사항

| 항목 | 현황 | 정정 권고 |
|---|---|---|
| **AVATAR_PALETTE 10색** | hex 인라인 hardcoded | → wt-1~8 토큰 매핑 또는 별도 `--org-node-N` 토큰 |
| **mine 속성** | 부재 | → `isMine: boolean` prop 추가, green tint 토큰 적용 |
| **다크 변형** | 미정의 (light hex만) | → Phase 4 합본 (OG-018) |
| **Handle 색상** | `!bg-primary` (Tailwind) | → 유지 (이미 토큰) |
| **isRoot 색상** | `'bg-white/20 text-white'` 등 (Tailwind) | → 유지 (이미 토큰) |
| **B3I dotted-line** | OrgClient에서 matrix-edges → ReactFlow edges | → **미터치** (B3I production SSOT) |

### Proto OrgNode 색상 (page-org.jsx:88-120)

```jsx
// 인라인 oklch 3 variant:
mine ? "oklch(95% 0.05 155)"          // mine green tint
highlight ? "var(--accent)"           // root highlight (이미 토큰)
: "oklch(60% 0.18 263)"               // 일반 노드 (violet)

text: mine ? "var(--success)" : "white"
```

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) 코드베이스 변경

| 파일 | 변경 | line delta |
|---|---|---|
| `src/components/org/DeptFlowNode.tsx` | AVATAR_PALETTE → 토큰 references + `isMine` prop + mine highlight 스타일 | ~30 lines (palette 교체 + prop 추가 + 분기) |
| `tailwind.config.ts` 또는 `globals.css` | wt token mapping 검증 (이미 정합 시 변경 0) | 0~5 |
| `src/app/(dashboard)/org/OrgClient.tsx` | DeptFlowNode invoke 시 `isMine` prop 계산 (user의 부서 lookup) | ~10 |

### (b) Proto 변경

| 파일 | 변경 |
|---|---|
| `_design-reference/page-org.jsx` | OrgNode 인라인 oklch → CSS 변수 정합 (proto-side는 직접 hsl/var 또는 inline 유지 OK, but inline 0건 권고) |

### (c) 토큰 매핑 표

| proto / DeptFlowNode | 토큰 (제안) | 다크 변형 |
|---|---|---|
| AVATAR_PALETTE[0] `#6366f1` | `--wt-1` 또는 `--org-node-1` | known-deferred |
| AVATAR_PALETTE[1] `#0ea5e9` | `--wt-2` (=info 토큰?) | known-deferred |
| AVATAR_PALETTE[2] `#16a34a` | `--wt-3` (=success?) | known-deferred |
| ... 7 more | `--wt-4` ~ `--wt-8` (cycling) | known-deferred |
| proto mine `oklch(95% 0.05 155)` | `--wt-success-bg` 또는 신규 `--org-node-mine-bg` | known-deferred |
| proto mine text | `--wt-success-fg` 또는 `text-success` | known-deferred |
| proto root highlight | `var(--accent)` (이미 토큰) | 정합 |

### (d) 예상 총 line delta

~40 lines (DeptFlowNode 30 + OrgClient 10), proto ~5 lines. **토큰 신설 시 globals.css ~5 lines 추가** (`--org-node-mine-*` 변수 정의).

---

## §3. i18n / DB / API 영향 평가

- **i18n**: 변경 0
- **DB**: 변경 0
- **API**: 변경 0
- **유저 부서 lookup**: 기존 session.user.department 또는 employee API 재사용 (별도 호출 0)

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (HIGH)**: AVATAR_PALETTE 10색 → wt-1~8 매핑 시 **8 토큰 vs 10색 불일치**. cycling 처리 (`palette[i % 8]`) 또는 신규 토큰 2건 추가 필요
- **R2 (MEDIUM)**: B3I dotted-line edge 색상은 OrgClient에서 처리 (매트릭스 edges), DeptFlowNode 외부. **미터치 가드 필수**
- **R3 (LOW)**: isMine 계산 — user.companyId × employee.departmentId 조회. EmployeeListClient/EmployeeDetailClient에서 동일 패턴 grep 후 SSOT 재사용

### 의존성
- **PR-5A 머지** 후 진입
- **N+24 SSOT 진입 후 가능** (page-h + StatusChips 정합 후 토큰 검증 후속)

### 가드
- ❌ B3I dotted-line edge 색상 미터치 (matrix-edges API 별도)
- ❌ ReactFlow Controls / 줌 컨트롤 색상 미터치 (라이브러리 기본값)
- ❌ AVATAR_PALETTE 외 다른 hex 인라인 0건 도입
- ✅ Workday wt 토큰만 사용
- ✅ 다크 known-deferred → OG-018 entry, Phase 4 합본

---

## §5. Implementation 단계 (PR-5A 머지 후)

1. **사전 합의 게이트**: 8 vs 10 색 cycling 정책 + 신규 토큰 신설 여부
2. **branch**: `feat/org-deptflownode-tokenize`
3. **commit 1 (토큰 정의)**:
   - `globals.css` `--org-node-mine-bg` / `--org-node-mine-fg` 신규 (필요 시)
   - tailwind.config.ts wt-1~8 매핑 검증
4. **commit 2 (DeptFlowNode 정합)**:
   - AVATAR_PALETTE → wt token reference (cycling)
   - `isMine: boolean` prop 추가 + mine highlight 분기
5. **commit 3 (OrgClient invoke 정합)**:
   - DeptFlowNode invoke 시 `isMine = dept.id === user.department.id` 계산
   - 또는 `useMyDepartment()` hook 재사용
6. **e2e**: `e2e/flows/org-tree-mine.spec.ts` — 본인 부서 노드 green highlight
7. **gstack 시각**: 라이트 회귀 (다크 known-deferred)
8. **codex Gate 1+2**: 표준
9. **PR open**: `feat/org-deptflownode-tokenize` → main

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error
- ✅ **lint**: clean (hex literal 0건 grep)
- ✅ **e2e**: 본인 부서 노드 시각 식별 + 비-본인 노드 default 색상
- ✅ **시각 회귀**: 10색 palette 재현 정합 (cycling 검증) + mine green tint
- ✅ **B3I 회귀 0**: matrix-edges 점선 표시 미변동 검증
- ✅ **회귀 0**: ReactFlow Controls / Handle / Background 시각 무변동

---

**상태**: pre-flight 완료
**Stage 4 예상 PR 크기**: 3 commits, ~40 lines + 토큰 ~5 lines, 3-4 file diff
