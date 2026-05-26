# N+17 Pre-flight — /directory surface 흡수 (EM-001 + Q1=B)

> **base SHA**: `9a940408` · **트랙**: proto + 코드베이스 · **우선**: HIGH
> **결정 (Stage 3 Q1=B)**: 코드베이스 `/directory` 를 `/employees?view=card` 로 흡수, list/card 토글 추가
> **본 pre-flight 결과 (요약)**: 사양 OK. EmployeeListClient에 토글 포팅 + /directory redirect.

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### 코드베이스 현황

| 경로 | 라인 | 핵심 발견 |
|---|---|---|
| `src/app/(dashboard)/directory/page.tsx` | ~46 | Server page. company/department/jobGrade prefetch → DirectoryClient |
| `src/app/(dashboard)/directory/DirectoryClient.tsx` | 435 | **이미 `viewMode: 'list' \| 'grid'` 토글 보유** (viewMode 6회 참조) |
| `src/app/(dashboard)/employees/page.tsx` | 24 | Server page. EmployeeListClient invoke |
| `src/app/(dashboard)/employees/EmployeeListClient.tsx` | 658 | **list view only**, 토글 없음. API: `/api/v1/employees` |
| `src/app/api/v1/directory/route.ts` | (단일 파일) | `/api/v1/directory` endpoint (DirectoryClient 전용) |
| `src/app/api/v1/employees/route.ts` | — | `/api/v1/employees` endpoint (EmployeeListClient 전용) |

### Proto 측

| 경로 | 라인 | 핵심 |
|---|---|---|
| `_design-reference/page-employees.jsx` | 328 | 풀폭 테이블 + 필터 + 인스펙터 (list만, 카드 grid 부재) |
| `_design-reference/page-directory.jsx` | (부재) | proto에 별도 surface 없음 — `data.directory` 데이터만 |

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) 흡수 접근법 비교

| 접근법 | 변경 파일 | 예상 line delta | 위험 |
|---|---|---|---|
| **A: Redirect + 단순 흡수** | `directory/page.tsx` 만 (redirect to `/employees?view=card`) | ~5 lines (delete body, add redirect) | EmployeeListClient에 카드 모드 부재 → 카드 모드 fall-back 필요 |
| **B: 토글 포팅 (DirectoryClient → EmployeeListClient)** | EmployeeListClient (~80 line 추가) + directory/page.tsx (redirect) + DirectoryClient 폐기 후보 | ~80 + 5 + (-435 추후) | EmployeeListClient 비대화 risk, API 통합 (`/api/v1/directory` 폐기 또는 `/api/v1/employees` 확장) 필요 |
| **C: 단순 redirect만 (카드 모드 후순위)** | `directory/page.tsx` redirect | ~5 lines | UX 손실 (카드 모드 부재). 사용자 Q1=B 의도와 정합도 낮음 |

**가디언 권고**: **B (토글 포팅)** — Q1=B 의도 "단일 surface + 카드 grid 토글" 정확 정합. DirectoryClient 폐기는 1주 안정화 후 별도 cleanup PR.

### (b) EmployeeListClient 토글 포팅 inventory

EmployeeListClient에 추가할 surface:
- import: `LayoutGrid`, `List` icons (lucide-react)
- state: `const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')` + URL searchParams sync
- UI: 상단 우측 토글 버튼 (~10 lines)
- conditional render: `{viewMode === 'list' ? <ListTable /> : <CardGrid />}`
- CardGrid 컴포넌트: 사진 thumbnail + 이름 + 부서 + 직급 + 상태 chip (grid-cols-2 md:cols-3 lg:cols-4)

**예상 line delta**: +80~100 lines (EmployeeListClient), +5 lines (directory/page.tsx)

### (c) 폐기 대상 (1주 안정화 후)

- `src/app/(dashboard)/directory/DirectoryClient.tsx` (435 lines)
- `src/app/api/v1/directory/route.ts` (검토 후 `/api/v1/employees` 흡수 가능성)

---

## §3. i18n / DB / API 영향 평가

### i18n
- 신규 키: `employees.viewModeList`, `employees.viewModeGrid` (2 키 × 5 locale = 10 entries)
- 폐기 후보 (1주 후): `directory.*` namespace (DirectoryClient 폐기 시) — 약 30-50 키

### DB
- **schema 변경 0** — 양 페이지 모두 동일 Employee 테이블 read, 다른 select 컬럼만

### API
- `/api/v1/employees` 응답에 `photoUrl`/`avatarPath`/`bio`/`skills` 등 카드 모드용 필드 추가 필요 — 또는 `/api/v1/directory` 의 필드 흡수
- **권고**: `/api/v1/employees?view=card` 시 컬럼 확장 (단일 endpoint, view param 분기)

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (LOW)**: DirectoryClient 폐기 시 navigation.ts에 `/directory` 링크 잔존 → redirect chain 1회 (UX 영향 작음)
- **R2 (MEDIUM)**: `/api/v1/directory` 와 `/api/v1/employees` 응답 스키마 차이 → 카드 모드 fallback 필드 명세 사전 합의 필요
- **R3 (LOW)**: searchParams `view=card` URL persist 시 SSR/CSR rehydration 정합 검증 필요

### 의존성
- **PR-5A 머지** (~2026-05-24 02:43 KST) — 코드베이스 변경 진입 가능 시점
- **N+22 상태 chip SSOT** — 카드 모드의 상태 chip은 N+22 SSOT 사용 권고 (선행 진입 권고)

### 가드
- ❌ DirectoryClient 즉시 삭제 금지 — 1주 안정화 관찰 후 별도 cleanup
- ❌ `/api/v1/directory` 즉시 폐기 금지 — DirectoryClient 폐기 후
- ✅ EmployeeListClient에 viewMode 추가 + Test (Playwright `?view=card` URL persist)

---

## §5. Implementation 단계 (PR-5A 머지 후)

1. **사전 합의 게이트**:
   - `/api/v1/employees?view=card` 응답 컬럼 확장 명세
   - 카드 모드 UI spec (사진/이름/부서/직급/상태 chip)
2. **branch**: `feat/employees-directory-absorption` off main 머지된 PR-5A tip
3. **commit 1**: API 컬럼 확장 (`/api/v1/employees` photoUrl + skills 등 추가, 무손실 후방호환)
4. **commit 2**: EmployeeListClient viewMode 토글 + CardGrid (UI 신규)
5. **commit 3**: `directory/page.tsx` redirect to `/employees?view=card`
6. **e2e**: `e2e/flows/employees-view-toggle.spec.ts` 2 시나리오 (list↔card 토글, URL persist)
7. **gstack 시각 검증**: 라이트 + 다크 + 모바일 (3축)
8. **codex Gate 1+2**: 표준
9. **PR open**: `feat/employees-directory-absorption` → main, 머지 후 1주 관찰 → DirectoryClient/directory route cleanup PR 별도

---

## §6. Verification (verify 계획)

- ✅ **tsc**: `npx tsc --noEmit` 0 error
- ✅ **lint**: `npm run lint` clean
- ✅ **e2e**: `npm run test:e2e -- employees-view-toggle.spec.ts` PASS
- ✅ **시각 회귀**: gstack 라이트(list+card) + 다크 + 모바일
- ✅ **API**: `/api/v1/employees?view=card` 응답 schema 검증 (zod)
- ✅ **URL persist**: 새로고침 후 view mode 보존
- ✅ **A11y**: axe-core 카드 grid 영역 검사

---

**상태**: pre-flight 완료 (Stage 4 진입 시 §5 그대로 사용)
**Stage 4 예상 PR 크기**: 3 commits, ~120 line delta, 7-10 file diff
