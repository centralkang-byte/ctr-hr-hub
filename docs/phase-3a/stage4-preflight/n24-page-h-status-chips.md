# N+24 Pre-flight — page-h + wd-status-chips 도입 (OG-004 + OG-014 + Q5=A)

> **base SHA**: `ac243446` · **트랙**: codebase (proto 정합) · **우선**: HIGH
> **결정 (Stage 3 Q5=A)**: OrgClient toolbar → page-h + wd-status-chips 4건 (root 법인 + 부서 카운트 + 내 팀 + 발효일)
> **본 pre-flight 결과 (요약)**: PageHeader SSOT 이미 존재 (재사용), wd-status-chips은 신규 SSOT 신설 필요.

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### 코드베이스 page-h SSOT 현황

| 경로 | 라인 | 핵심 발견 |
|---|---|---|
| `src/components/shared/PageHeader.tsx` | ~28 | **이미 SSOT 존재**. Props: `title / description / actions`. 10+ surface에서 재사용 중 |
| 사용 surface (grep 결과) | — | attendance(3), offboarding(3), recruitment(2+), delegation, etc. OrgClient만 미사용 |
| `src/app/(dashboard)/org/OrgClient.tsx:550` | — | 현재 toolbar = `<h1>` + `flex flex-wrap items-center gap-3` 인라인 (PageHeader 패턴 미적용) |

### wd-status-chips SSOT 현황

- **grep 결과 0건** — codebase에 status-chip SSOT 없음
- **신규 컴포넌트 신설 필요**: `src/components/shared/StatusChips.tsx` 또는 `WdStatusChips.tsx`

### Proto 측

```jsx
// _design-reference/page-org.jsx:21-30
<div className="page-h">
  <div>
    <h1>조직도</h1>
    <div className="greet-sub">전사 조직 구조를 항해서 탐색해요.</div>
    <div className="wd-status-chips">
      <span className="sc"><span className="dot" /><b>{root.name}</b> · {root.count}</span>
      <span className="sc accent"><span className="dot" />부서 <b>{depts.length}개</b></span>
      <span className="sc success"><span className="dot" />내 팀 · <b>{data.orgTree.hrTeam.name}</b></span>
      <span className="sc zero"><span className="dot" />발효일 <b>2026.05.16</b></span>
    </div>
  </div>
  <div className="right">...</div>
</div>
```

### batch 04 / batch 03 cross-ref

- batch 04 EM-013 도 "패턴 B chips (재직/휴직/퇴사예정/입사예정 4 chip)" 결정 (Q3=A)
- batch 03 WorkletGrid도 KPI 영역 일부 chip 패턴 사용
- **SSOT 공통화 권고**: batch 03/04/05 모두 chip 패턴 도입 → 공통 StatusChips SSOT 신설이 정합

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) 변경 surface

| surface | 파일 | 변경 종류 | line delta |
|---|---|---|---|
| OrgClient main | `src/app/(dashboard)/org/OrgClient.tsx` | toolbar → PageHeader + StatusChips | ~30 신규 - ~20 삭제 = +10 |
| 신규 SSOT | `src/components/shared/StatusChips.tsx` | 신규 컴포넌트 | +60~80 |
| (optional) PageHeader 확장 | `src/components/shared/PageHeader.tsx` | actions slot 검증만 (이미 지원) | 0 |
| i18n | `messages/{ko,en,zh,vi,es}.json` | chips 라벨 4 키 × 5 locale | +20 entries |

### (b) StatusChips SSOT spec

신규 컴포넌트 `src/components/shared/StatusChips.tsx`:

```tsx
interface StatusChip {
  label: string                              // "부서 12개"
  value?: string | number                    // bold 강조 부분
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'zero'
  icon?: ReactNode                           // optional dot 또는 lucide icon
}

interface StatusChipsProps {
  chips: StatusChip[]
  className?: string
}
```

- proto 4 variant (`sc / sc.accent / sc.success / sc.zero`) → Workday wt 토큰 매핑
- 모바일 reflow: `flex-wrap`
- a11y: 단순 표시용 (role 무 — group context)

### (c) OrgClient 통합

현재 (line 550-580 추정):
```tsx
<div className="flex flex-wrap items-center gap-3 px-6 py-3 bg-muted/30 shrink-0">
  <h1 className="text-lg font-bold...">{t('orgChart')}</h1>
  {/* View mode toggle */}
  ...
  {/* Search */}
  ...
  {/* Matrix toggle */}
  ...
  <EffectiveDatePicker ... />
  <RestructureButton ... />
</div>
```

신규 (예상):
```tsx
<PageHeader
  title={t('orgChart')}
  description={t('orgChartDesc')}
  actions={<RestructureButton onClick={openModal} />}
/>
<StatusChips chips={[
  { label: t('rootLabel'), value: `${root.name} · ${root.count}`, variant: 'default' },
  { label: t('deptCount'), value: `${departments.length}개`, variant: 'accent' },
  { label: t('myTeam'), value: hrTeam?.name ?? '-', variant: 'success' },
  { label: t('effectiveDate'), value: formatDate(effectiveDate), variant: 'zero' },
]} />
<div className="flex flex-wrap items-center gap-3 ...">
  {/* View mode + search + matrix + EffectiveDatePicker 유지 */}
</div>
```

---

## §3. i18n / DB / API 영향 평가

### i18n
- 신규 키 (5 locale): `orgChartDesc` / `rootLabel` / `deptCount` / `myTeam` (`effectiveDate` 이미 존재)
- 4 키 × 5 locale = **20 entries** (또는 description 단일 + 3 chip 라벨)

### DB
- 변경 0 (UI only, 기존 state 재사용)

### API
- 변경 0
- `hrTeam` 데이터: OrgClient의 `tree` state에서 user의 부서 lookup (또는 `/api/v1/employees/me/department` 추가 호출 검토)
- `effectiveDate`: EffectiveDatePicker state 그대로 사용

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (LOW)**: StatusChips SSOT 신설이 batch 03/04 공통 패턴이라 cross-batch 영향. 단독 진입보다 batch 03/04와 합본 진입 권고
- **R2 (MEDIUM)**: 모바일 reflow — chips 4건 + actions area 가로 overflow 위험. flex-wrap 검증 필수
- **R3 (LOW)**: `hrTeam` lookup이 OrgClient 외부 state — useMemo 또는 별도 hook

### 의존성
- **PR-5A 머지** 후 진입
- **StatusChips SSOT는 batch 03/04 공통화 권고** → 진입 순서: SSOT 신설 commit 1 + OrgClient 적용 commit 1 (총 2 commit)

### 가드
- ❌ PageHeader 시그니처 변경 금지 (10+ surface 회귀 위험)
- ❌ StatusChips SSOT 신설 시 batch 03/04와 미정합 토큰/variant 사용 금지
- ✅ Workday wt 토큰만 사용 (`--wt-1~8`)
- ✅ 다크 known-deferred (Phase 4 합본 — F19/F24/F26/EM-019/OG-018)

---

## §5. Implementation 단계 (PR-5A 머지 후)

1. **사전 합의 게이트**: StatusChips SSOT spec 확정 (batch 03/04와 공통화 vs 독립)
2. **branch**: `feat/shared-status-chips` (SSOT 신설) → `feat/org-page-header` (OrgClient 적용)
3. **commit 1 (SSOT 신설)**:
   - `src/components/shared/StatusChips.tsx` 신규 (~80 lines)
   - i18n 신규 키 5 locale
   - Storybook entry (있다면)
4. **commit 2 (OrgClient 적용)**:
   - OrgClient.tsx toolbar 영역 → PageHeader + StatusChips 패턴
   - 기존 view mode toggle / search / matrix / EffectiveDatePicker는 별도 row로 유지
5. **e2e**: `e2e/flows/org-toolbar.spec.ts` — page-h + 4 chips 렌더 + 모바일 reflow
6. **gstack 시각**: 라이트/다크/모바일 (3축, 다크는 Phase 4 known-deferred)
7. **codex Gate 1+2**: 표준
8. **PR open**: `feat/org-page-header` → main

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error
- ✅ **lint**: clean
- ✅ **e2e**: page-h + 4 chips 렌더 + chip 데이터 정합 + 모바일 reflow
- ✅ **시각 회귀**: gstack 라이트 + 모바일 (다크 = Phase 4 known-deferred)
- ✅ **a11y**: axe-core toolbar 영역 검사
- ✅ **회귀 0**: 10+ 기존 PageHeader 사용 surface 무변경

---

## §7. 별도 트랙 후보

- **StatusChips SSOT cross-batch 공통화**: batch 03 dashboard + batch 04 employees (EM-013) + batch 05 org (OG-013) 모두 chip 패턴 도입 → 합본 SSOT 신설 별도 PR 권고

---

**상태**: pre-flight 완료
**Stage 4 예상 PR 크기**: 2 commits, ~90 lines + 20 i18n entries, 3-4 file diff
