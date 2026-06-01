# N+35 Pre-flight — 강제완료/리마인드 액션 정합 (ON-006 + ON-010)

> **base SHA**: `1cd4a77c` · **트랙**: codebase 미세 정합 · **우선**: LOW
> **결정 (Stage 3)**: codebase 실 API 유지, proto는 visual reference만 (button 위치/스타일)
> **본 pre-flight 결과 (요약)**: API endpoint 양쪽 모두 확인됨, mutation 변경 0, Hire Card 안의 actions area 만 정합 (N+32 의존).

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### 코드베이스 mutation API

- **force-complete**: `POST /api/v1/onboarding/[id]/force-complete/route.ts` ✅ **존재 확인됨** (Session 226 inventory)
- **remind / notification**: 별도 endpoint 추정 — `src/app/api/v1/notifications/` 또는 onboarding 내부 mutation. 확인 필요

### Proto 액션 패턴

```jsx
{p.status === "delay" ? (
  <button className="btn sm btn-primary" onClick={(e) => {
    e.stopPropagation();
    toast(`${p.name} 강제 완료`);
  }}>
    강제 완료
  </button>
) : (
  <button className="btn sm btn-primary" onClick={(e) => {
    e.stopPropagation();
    toast(`${p.name} 알림 발송`);
  }}>
    리마인드
  </button>
)}
```

→ proto = toast만 (mock). codebase는 실 API 호출 정합.

### Hire Card actions area (N+32 의존)

본 RECORD는 **N+32 OnboardingHireCard 컴포넌트 신설 후** 진입. Hire Card 안의 actions area (2 button 영역):

```tsx
<div className="hc-actions">
  <button>여정 보기</button>
  {/* status 분기 */}
  <button>강제 완료 or 리마인드</button>
</div>
```

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) 변경 파일

| 파일 | 변경 | line delta |
|---|---|---|
| `src/components/onboarding/OnboardingHireCard.tsx` (N+32 신설) | actions area = mutation API 호출 (toast 폴백 X) | +30 |
| 신규 hook `src/hooks/useOnboardingActions.ts` | force-complete + remind 통합 hook | +60 |
| `src/app/api/v1/notifications/onboarding-remind/route.ts` | **신규 endpoint** (선택) — onboarding remind 전용 알림 | +80 (선택) |
| `messages/*.json` | toast 메시지 5 locale (성공/실패) | +30 entries |

### (b) useOnboardingActions hook spec

```tsx
function useOnboardingActions() {
  const forceComplete = async (id: string, note?: string) => {
    await apiClient.post(`/api/v1/onboarding/${id}/force-complete`, { note })
    toast.success(t('forceCompleted'))
    mutate('/api/v1/onboarding/instances')
  }
  
  const remind = async (id: string) => {
    await apiClient.post(`/api/v1/notifications/onboarding-remind`, { onboardingId: id })
    toast.success(t('reminded'))
  }
  
  return { forceComplete, remind }
}
```

### (c) 권한 가드

- **forceComplete**: HR_ADMIN / EXECUTIVE / SUPER_ADMIN — 기존 API 권한 정합
- **remind**: HR_ADMIN / EXECUTIVE / MANAGER (본인 팀원만)

---

## §3. i18n / DB / API 영향 평가

### i18n
- toast 메시지 5 locale = ~30 entries (성공 + 실패 + 권한 거부)

### DB
- 변경 0 (기존 API 사용)
- `audit_logs` 자동 기록 (기존 패턴)

### API
- **force-complete**: 기존 endpoint 재사용 (변경 0)
- **remind**: 신규 endpoint 신설 가능성 OR 기존 notifications API 재사용 결정 게이트

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (LOW)**: remind API endpoint 존재 여부 — 부재 시 신규 신설 필요 (스코프 확장)
- **R2 (LOW)**: 권한 분기 — MANAGER role의 팀원 한정 remind 권한 검증

### 의존성
- **N+32 (OnboardingHireCard)** 선행 필수 — Hire Card actions area 안의 button
- **PR-5A 머지** 후

### 가드
- ❌ proto toast 폴백 사용 금지 (실 API 호출)
- ❌ force-complete 권한 우회 금지
- ✅ 기존 force-complete API 재사용

---

## §5. Implementation 단계 (N+32 선행 후)

1. **사전 합의 게이트**:
   - remind API endpoint 존재 여부 확인 → 부재 시 신설 spec
   - MANAGER role 권한 spec
2. **branch**: `feat/onboarding-hire-card-actions`
3. **commit 1 (hook + API endpoint, 필요 시)**:
   - useOnboardingActions hook
   - remind endpoint 신설 (선택)
4. **commit 2 (Hire Card actions area 통합)**:
   - status 분기 + mutation 호출 + toast
5. **e2e**: `e2e/flows/onboarding-hire-card-actions.spec.ts` — force-complete + remind × 권한 매트릭스
6. **gstack 시각**: actions area 정합
7. **codex Gate 1+2**: 표준
8. **PR open**: `feat/onboarding-hire-card-actions` → main

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error
- ✅ **lint**: clean
- ✅ **e2e**: 2 action × 권한 매트릭스 (HR_ADMIN/MANAGER/EMPLOYEE) 시나리오
- ✅ **mutation 회귀 0**: force-complete API schema 변동 0
- ✅ **권한 가드 검증**: MANAGER role 본인 팀원만 remind 가능

---

**상태**: pre-flight 완료, N+32 의존
**Stage 4 예상 PR 크기**: 2 commits, ~90 lines + 30 i18n entries, 3-4 file diff
