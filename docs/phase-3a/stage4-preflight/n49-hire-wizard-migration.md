# N+49 Pre-flight — HireWorkerWizard 마이그레이션 (Q4 점진 1, batch 04 N+21 cross-batch)

> **base SHA**: `4ff48de6` · **트랙**: codebase + cross-batch · **우선**: HIGH
> **결정 (Stage 3 Q4=C)**: 점진 마이그레이션 1번째 (Hire → OrgRestructure → ...)
> **본 pre-flight 결과 (요약)**: EmployeeNewClient.tsx (701 lines) 4-step inline 마이그레이션. batch 04 N+21 DemoLimitBanner slot 통합. page → Dialog 컨테이너 전환 위험.

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### EmployeeNewClient.tsx (701 lines, 4-step inline) 상세

기존 inline 구조 (Stage 1 audit cross-ref):

```tsx
// L181 step state
const [step, setStep] = useState(0)

// L214 validation per step
const validateStep = useCallback((stepNum: number, wizardData: WizardData): string | null => {
  if (stepNum === 0) { /* Step 1: 기본정보 validation */ }
  if (stepNum === 1) { /* Step 2: 고용정보 */ }
  if (stepNum === 2) { /* Step 3: 배정 */ }
  // ...
}, [])

// L266 next handler
const err = validateStep(step, data)
setStep((s) => s + 1)

// L317 ─── Render steps ───

// L608 ─── Step indicator ───
const isCompleted = i < step
const isCurrent = i === step
i < step ? 'bg-ctr-primary' : 'bg-muted-foreground/30'

// L655 ─── Step content ───
```

### 4 step 구성

| Step | Section | 검증 |
|---|---|---|
| 0 | 기본정보 | nameKo / nameEn / email / phone / birthDate / gender / nationality 등 |
| 1 | 고용정보 | hireDate / employmentType / contractDuration 등 |
| 2 | 배정 | departmentId / jobGradeId / employeeTitle / jobCategoryId / managerEmployeeId |
| 3 | 결재선 | (proto 정합 추정, codebase 검증 필요) |

### batch 04 N+21 DemoLimitBanner cross-ref

**가디언 사전 가정**: N+48 SSOT banner slot에 DemoLimitBanner 통합

**CC 검증 결과**:
- `DemoLimitBanner` codebase 0건 (batch 04 N+21 신설 예정)
- N+49 진입 시점에 batch 04 N+21 머지 완료 필요 또는 동반
- N+49 = WizardShell consumer + `<DemoLimitBanner>` import + banner prop 전달

### 컨테이너 전환 위험 ⚠️

- 현재 HireWorkerWizard = **page 패턴** (`<div className="space-y-6 p-6">`)
- WizardShell = **Radix Dialog** 기반 (full-screen modal)
- **page → Dialog 전환** = 라우팅 + 진입/이탈 흐름 변경 위험
  - 현재 라우팅: `/employees/new` 진입 → page render
  - Dialog 전환: trigger 위치 (다른 페이지에서 open) + onClose 이탈
  - **해결책 (a)**: `/employees/new` 페이지 유지 + Dialog 내부 wrapper (page = Dialog provider, 자동 open)
  - **해결책 (b)**: HireWorker만 page wrapper 패턴 (WizardShell이 page wrapper도 지원하도록 변형)
  - **추천**: (a) — N+48 SSOT 변경 없이 caller 측 Dialog provider 패턴

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) 변경 파일

| 파일 | 변경 | line delta |
|---|---|---|
| `src/app/(dashboard)/employees/new/EmployeeNewClient.tsx` | inline step state/indicator/content → WizardShell consumer | -120 / +40 = **-80 net** |
| `src/app/(dashboard)/employees/new/page.tsx` | Dialog provider 패턴 (해결책 a) | +5 |
| (i18n) | 기존 키 재사용 (변경 0) | 0 |

### (b) 마이그레이션 spec

```tsx
// EmployeeNewClient.tsx (after migration)
export function EmployeeNewClient() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  // validation logic 유지 (caller 측 state)
  
  return (
    <WizardShell
      open={true}                    // page 자동 open
      title={t('hireWorker.title')}
      sub={t('hireWorker.sub')}
      steps={HIRE_STEPS}            // 4-step array
      currentStep={step}
      onCancel={() => router.push('/employees')}
      onPrev={() => setStep(s => Math.max(0, s - 1))}
      onNext={() => {
        const err = validateStep(step, data)
        if (err) { toast.error(err); return }
        setStep(s => s + 1)
      }}
      onSubmit={() => handleSubmit()}
      canProceed={!validateStep(step, data)}
      banner={step === HIRE_STEPS.length - 1 ? <DemoLimitBanner /> : null}
    >
      {step === 0 && <Step0BasicInfo data={data} onChange={setData} />}
      {step === 1 && <Step1Employment data={data} onChange={setData} />}
      {step === 2 && <Step2Assignment data={data} onChange={setData} />}
      {step === 3 && <Step3Approval data={data} onChange={setData} />}
    </WizardShell>
  )
}
```

### (c) 컨테이너 전환 패턴 (해결책 a)

```tsx
// page.tsx (변경 minimal)
export default async function NewEmployeePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  return <EmployeeNewClient />
}

// EmployeeNewClient.tsx WizardShell 자체가 Dialog
// onCancel → router.push('/employees') (이탈 = 부모 라우팅)
```

### (d) 예상 총 line delta

- EmployeeNewClient: -80 net (코드 단순화)
- page.tsx: +5 (변경 minimal)
- **순 총합**: **-75 lines** (a11y 자동 보강)

---

## §3. i18n / DB / API 영향 평가

- **i18n**: 0 (기존 키 재사용)
- **DB**: 0
- **API**: 0 (mutation 패턴 무변경)

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (HIGH)**: page → Dialog 컨테이너 전환 = 진입/이탈 UX 변경. 회귀 가드 필수 (e2e 시나리오)
- **R2 (MEDIUM)**: validation logic 유지 (caller 측 state) — WizardShell `canProceed` prop 정합
- **R3 (MEDIUM)**: Step0~Step3 sub-component 분리 (현재 inline render) — 별도 refactor 권고 (선택)
- **R4 (LOW)**: batch 04 N+21 DemoLimitBanner 미머지 시 N+49 단독 진입 불가 (`banner` slot prop = `null` 임시)

### 의존성
- **N+48 (WizardShell SSOT)** 선행 필수
- **batch 04 N+21 (DemoLimitBanner)** 동반 또는 선행 (banner slot 활용)
- **PR-5A 머지** 후

### 가드
- ❌ HireWorker validation logic 변경 금지 (회귀 위험)
- ❌ `/employees/new` 라우팅 시그니처 변경 금지 (deep link 회귀)
- ❌ Step sub-component 시그니처 변경 금지 (caller 측 props 정합)
- ✅ batch 04 N+21 DemoLimitBanner slot 통합 (마지막 step만)
- ✅ e2e 4-step 통과 + 이탈 + 회귀 0 시나리오
- ✅ axe-core 0 violation

---

## §5. Implementation 단계 (N+48 + batch 04 N+21 선행 후)

1. **사전 합의 게이트**:
   - page → Dialog 컨테이너 전환 결정 (해결책 a 권고)
   - Step sub-component 분리 여부 (선택)
2. **branch**: `feat/hire-wizard-shell-migration`
3. **commit 1 (HireWorkerWizard 마이그레이션)**:
   - EmployeeNewClient.tsx inline → WizardShell consumer
   - validation/state 유지
4. **commit 2 (page.tsx Dialog provider — 선택)**:
   - 또는 commit 1에 포함
5. **commit 3 (Step sub-component 분리 — 선택)**:
   - Step0~Step3 별도 컴포넌트 (가독성)
6. **e2e**: `e2e/flows/hire-wizard.spec.ts` — 4-step + 이탈 + DemoLimitBanner + submit + redirect
7. **gstack 시각**: Dialog 라이트 + 모바일 reflow
8. **axe-core**: 0 violation
9. **codex Gate 1+2**: 표준
10. **PR open**: `feat/hire-wizard-shell-migration` → main

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error
- ✅ **lint**: clean
- ✅ **e2e**: 4-step 통과 + 이탈 + DemoLimitBanner + submit + redirect 시나리오
- ✅ **axe-core**: Dialog focus trap + ARIA 0 violation
- ✅ **시각 회귀**: gstack 라이트 + 모바일
- ✅ **회귀 0**: form validation + submit + redirect 동작 무변동
- ✅ **batch 04 N+21 cross-ref**: DemoLimitBanner 표시 (마지막 step)

---

**상태**: pre-flight 완료, N+48 + batch 04 N+21 선행 의존
**Stage 4 예상 PR 크기**: 2-3 commits, **-75 net lines** (코드 단순화), 2-3 file diff
