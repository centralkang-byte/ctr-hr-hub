# N+39 Pre-flight — EmployeeCertification API + derived status + S3 ⭐ S3 결정

> **base SHA**: `6f4ffe84` · **트랙**: codebase · **우선**: MEDIUM
> **결정 (Stage 3 Q2=A + CR-005 + CR-007)**: RESTful CRUD + derived status + S3 upload (결정 게이트)
> **본 pre-flight 결과 (요약)**: ✅ **(a) S3 SSOT 재사용 채택** — `src/lib/s3.ts` + `/api/v1/files/presigned/` 기존 존재. 별도 batch 격상 불필요.

---

## §1. 검증 대상 파일 (read-only 확인 결과)

### ⭐ N+39 S3 결정 (CRITICAL 가드 응답)

**가디언 사전 가정**: "(선택) S3 certificate upload" (Stage 2 카드 §7 N+39)

**CC grep 검증 결과**:
```
src/lib/s3.ts                                                         ✅ SSOT 존재
src/app/api/v1/files/presigned/route.ts                              ✅ presigned URL endpoint
src/app/api/v1/settings/branding/upload/route.ts                     ✅ upload 패턴
src/app/api/v1/my/documents/[docId]/download/route.ts                ✅ download 패턴
src/app/api/v1/employees/[id]/certificate-requests/.../approve/...   ✅ certificate generation
src/app/api/v1/compensation/letters/route.ts                         ✅ 다른 도메인 활용
```

→ **(a) S3 SSOT 기존 존재 + 재사용 채택 ✅**

### S3 upload 패턴 spec (재사용)

```ts
// 권고 패턴 (기존 SSOT 활용):
// 1. Client: presigned URL 요청 (`POST /api/v1/files/presigned`)
// 2. Client: presigned URL로 직접 S3 PUT (browser → S3)
// 3. Client: certificate URL 저장 (PATCH /api/v1/employees/[id]/certifications/[recordId])
```

### N+39 결정 옵션 평가

| 옵션 | 결과 | 평가 |
|---|---|---|
| **(a) S3 SSOT 재사용** | ✅ **권고** | `src/lib/s3.ts` + presigned URL endpoint 기존 존재. scope ~30 lines (Certification model + UI 추가). 별도 batch 격상 0. |
| (b) S3 SSOT 신설 | ❌ 불필요 | 기존 SSOT 존재로 비대상 |
| (c) URL 입력 (외부 link) | △ 차선 | UX 미완, 사용자 외부 link 입력 부담 |
| (d) defer (별도 트랙) | △ | scope 단축이지만 N+39 implementation 분할 = 회귀 격리 어려움 |

→ **(a) 채택**. batch 격상 0, N+39 scope = ~80 lines (API) + ~30 lines (S3 wiring).

---

## §2. 변경 surface 인벤토리 + 예상 line delta

### (a) 신규 endpoint 4건 (N+38 패턴 정합)

```
src/app/api/v1/employees/[id]/certifications/
├── route.ts             (GET list / POST create, ~80 lines)
└── [recordId]/
    └── route.ts         (GET / PATCH / DELETE, ~80 lines)
```

### (b) Zod schema spec

```ts
export const certificationCreateSchema = z.object({
  name: z.string().min(1).max(200),
  issuer: z.string().max(150).optional(),
  credentialNo: z.string().max(100).optional(),
  acquiredAt: z.coerce.date(),
  expiresAt: z.coerce.date().nullable(),
  certificateUrl: z.string().url().optional(),  // S3 url 저장
})
```

### (c) Derived status logic (CR-005)

**위치 권고**: **service layer** (`src/lib/employees/career.ts`) — client 계산보다 server 단일 진실

```ts
// src/lib/employees/career.ts (신규)
import { differenceInDays } from 'date-fns'

export type CertificationStatus = 'active' | 'expiring' | 'expired'

const EXPIRING_THRESHOLD_DAYS = 90  // config 가능

export function computeCertificationStatus(
  expiresAt: Date | null,
  now: Date = new Date()
): CertificationStatus {
  if (!expiresAt) return 'active'  // 만료 없음
  const daysUntilExpiry = differenceInDays(expiresAt, now)
  if (daysUntilExpiry < 0) return 'expired'
  if (daysUntilExpiry <= EXPIRING_THRESHOLD_DAYS) return 'expiring'
  return 'active'
}
```

- API response 측에 `status` field 추가 (derived, DB 미저장)
- vitest 단위: 3 case + boundary (90일 = 마지막날 = expiring, 91일 = active)

### (d) S3 wiring

```ts
// 본 N+39 PR 안에서 추가 작업 0 (기존 SSOT 재사용)
// 단지 certification API response에 `certificateUrl: string?` 포함
// + client에서 기존 `/api/v1/files/presigned` 호출 후 PATCH로 저장
```

### (e) 예상 총 line delta

- endpoint 4건: +160 lines
- Zod schema (Certification): +40 lines (N+38 schema 파일에 추가)
- service layer `src/lib/employees/career.ts`: +50 lines
- vitest 단위 (derived status): +40 lines
- **순 총합**: **+290 lines** (API + derived status + S3 wiring)

---

## §3. i18n / DB / API 영향 평가

- **i18n**: 0 (server-side, N+42 i18n PR에서 처리)
- **DB**: 0 (N+37 schema 완료)
- **API**: 4 endpoint 신규 + presigned URL endpoint 재사용 (변경 0)
- **S3**: 별도 신설 0, 재사용

---

## §4. 위험 / 의존성 / 가드

### 위험
- **R1 (LOW)**: derived status 90일 threshold = config 가능, 변경 시 UI 영향 (3 status badge)
- **R2 (LOW)**: certificate URL = S3 path만 저장, file 자체는 S3에 격리 (delete 시 orphan file 위험)
- **R3 (MEDIUM)**: S3 orphan file 정리 트랙 별도 (본 batch 비대상, batch 10+ 운영 batch 후보)

### 의존성
- **N+37 선행 필수**
- **PR-5A 머지** 후
- **`src/lib/s3.ts` + `/api/v1/files/presigned/` 기존 SSOT 재사용** (변경 0)

### 가드
- ❌ `src/lib/s3.ts` SSOT 시그니처 변경 금지 (다른 surface 회귀)
- ❌ presigned URL endpoint 변경 금지
- ❌ derived status DB 저장 금지 (client/server 양쪽 계산 SSOT 분리)
- ✅ S3 path 저장만 (file 자체는 S3)
- ✅ orphan file 정리는 별도 batch (현재 batch 비대상)

---

## §5. Implementation 단계 (N+37 머지 후)

1. **사전 합의 게이트**: derived status threshold (90일 default OK)
2. **branch**: `feat/employee-certification-api`
3. **commit 1**: Zod schema (N+38 파일에 Certification 추가)
4. **commit 2**: service layer `src/lib/employees/career.ts` + vitest 단위 (derived status)
5. **commit 3**: `/api/v1/employees/[id]/certifications/` 4 endpoint
6. **commit 4**: API response에 `status` derived field 포함
7. **codex Gate 1+2**: 표준
8. **PR open**: `feat/employee-certification-api` → main

---

## §6. Verification (verify 계획)

- ✅ **tsc**: 0 error
- ✅ **lint**: clean
- ✅ **vitest**: derived status 3 case + 90일 boundary
- ✅ **API**: 4 method × 권한 매트릭스 + S3 url 저장 시나리오
- ✅ **S3 회귀 0**: 기존 surface (settings/branding upload / my/documents 등) 무변동

---

## §7. ⭐ S3 결정 결과 (Critical 가드 응답)

| 옵션 | 평가 | 결과 |
|---|---|---|
| **(a) S3 SSOT 재사용** | `src/lib/s3.ts` + `/api/v1/files/presigned/` 기존 존재 | ⭐ **권고 채택** |
| (b) S3 SSOT 신설 | 불필요 | ❌ |
| (c) URL 입력 | UX 미완 | ❌ |
| (d) defer | scope 분할 위험 | ❌ |

→ **batch 10+ S3 SSOT 격상 후보 신설 불필요** (기존 SSOT 정합)

---

**상태**: pre-flight 완료, S3 결정 (a) 채택
**Stage 4 예상 PR 크기**: 4 commits, +290 lines, 4-5 file diff
