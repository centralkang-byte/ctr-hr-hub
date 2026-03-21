# REVIEW-1: 코드 품질 + 보안 + 성능 리뷰

> **역할**: 당신은 CTR HR Hub의 시니어 코드 리뷰어 겸 보안 엔지니어입니다.
> **스택**: Next.js (App Router) + Supabase + PostgreSQL + **Prisma ORM** + Tailwind CSS
> **트랙**: [B] 트랙 (B11과 병렬 진행)
> **목적**: B1~B10 전체 코드베이스의 아키텍처 일관성, 보안 취약점, 성능 병목을 한 번에 점검합니다.

---

## ⚠️ 시작 전 필수 확인

```bash
# 1. 컨텍스트 파일 읽기
cat context/SHARED.md
cat context/TRACK_A.md
cat context/TRACK_B.md

# 2. 프로젝트 구조 + 스키마 파악
find src -type f -name "*.tsx" -o -name "*.ts" | wc -l
cat prisma/schema.prisma

# 3. 빌드 상태 확인
npx tsc --noEmit 2>&1 | tail -20
npm run build 2>&1 | tail -20

# ⚡ 리뷰 결과는 context/TRACK_B.md에 기록
# ⚡ 코드 수정은 하지 않습니다 — 발견 사항만 기록
```

---

## 리뷰 원칙

- **수정하지 않는다** — 순수 리뷰. 발견 사항만 기록.
- **심각도 분류** — 🔴 Critical (즉시) / 🟠 Major (다음 스프린트) / 🟡 Minor (개선 권장) / 💡 Suggestion
- **세션 종료 시 `REVIEW_1_REPORT.md` 생성**

---

## Part 1: Prisma 스키마 일관성

```bash
cat prisma/schema.prisma
```

- [ ] **네이밍 컨벤션**: 모델명 PascalCase, 필드명 camelCase, @@map snake_case 일관성
- [ ] **관계 정의**: 양방향 관계 누락, `@relation` 명시 필요한 곳
- [ ] **인덱스**: 자주 쿼리되는 필드에 `@@index` (companyId, employeeId, status)
- [ ] **UUID 일관성**: 모든 id가 `@id @default(uuid()) @db.Uuid` 패턴인지
- [ ] **@@map**: 모든 모델에 `@@map("snake_case_table")` 있는지
- [ ] **soft delete**: 삭제 처리 방식 일관성 (isActive vs status vs deletedAt)
- [ ] **Json 필드**: 과도한 Json 사용 → 정규화 필요한 곳

---

## Part 2: API 라우트 패턴

```bash
find src/app/api -type f -name "route.ts" | sort
```

- [ ] **경로 구조**: RESTful 패턴 일관성 (`/api/v1/모듈/리소스`)
- [ ] **에러 핸들링**: try/catch + HTTP 상태 코드 일관성
- [ ] **응답 형식**: `{ data, error, message }` 공통 구조 여부
- [ ] **입력 검증**: zod 등 검증 프레임워크 사용 여부 + 미검증 API 목록

---

## Part 3: 인증 + 인가 전수 검사

```bash
# 인증 미적용 API 전수 검사
for f in $(find src/app/api -name "route.ts"); do
  if ! grep -q "getSession\|getUser\|auth()\|createServerClient" "$f"; then
    echo "⚠️ 인증 미적용: $f"
  fi
done

# 역할 체크 패턴
grep -rn "role\|isAdmin\|isHR\|permission\|authorize" src/app/api --include="*.ts" | head -30
```

- [ ] **인증**: 모든 API에 세션 체크 존재하는지 (공개 API 제외)
- [ ] **인가 — HR Admin 전용**: `/hr/*`, `/analytics/*` API에 역할 체크
- [ ] **인가 — 경영진 전용**: B10 이직위험/번아웃 데이터 접근 제어
- [ ] **인가 — 본인 데이터**: 급여, 평가 → 본인 + HR만 조회 가능
- [ ] **다법인 격리**: companyId 필터가 API 레벨에서 강제되는지

---

## Part 4: 민감 데이터 보호

```bash
# API 응답에 민감 필드 포함 여부
grep -rn "salary\|payroll\|turnoverRisk\|burnout\|riskScore" src/app/api --include="*.ts" | head -20

# 시크릿 하드코딩
grep -rn "webhook.*http\|apiKey\|secret\|password" src --include="*.ts" --include="*.tsx" | head -10
```

- [ ] **급여 데이터**: 직원 목록 API에 급여 필드 포함 안 되는지
- [ ] **이직위험/번아웃**: 직원 본인 절대 비노출
- [ ] **Teams Webhook URL**: DB 저장 시 마스킹/암호화
- [ ] **환경변수**: 민감 정보 하드코딩 여부

---

## Part 5: 성능 병목

```bash
# N+1 쿼리 패턴
grep -rn "for.*await.*prisma\|forEach.*await.*prisma" src --include="*.ts" | head -20

# 페이지네이션 미적용
grep -rn "findMany" src/app/api --include="*.ts" | while read line; do
  if ! echo "$line" | grep -q "take\|skip\|cursor"; then
    echo "⚠️ 페이지네이션 없음: $line"
  fi
done | head -20

# include 깊이
grep -rn "include.*include.*include" src --include="*.ts" | head -10
```

- [ ] **N+1 쿼리 목록** (루프 안 DB 호출)
- [ ] **페이지네이션 미적용** findMany 목록
- [ ] **Prisma include 깊이**: 3단계 이상 중첩
- [ ] **B10-1 배치 계산**: 1000명+ 시 예상 소요시간
- [ ] **대시보드**: 위젯 동시 API 호출 수

---

## Part 6: 타입 안전성 + 빌드

```bash
npx tsc --noEmit 2>&1 | tail -20

# any 사용 검색
grep -rn ": any\|as any" src --include="*.ts" --include="*.tsx" | wc -l

# raw SQL (규칙 위반)
grep -rn "\$queryRaw\|\$executeRaw" src --include="*.ts" | head -10

# XSS
grep -rn "dangerouslySetInnerHTML" src --include="*.tsx" | head -10
```

- [ ] **tsc 에러 0개**
- [ ] **npm run build 성공**
- [ ] **any 사용 횟수** + 과도한 곳 목록
- [ ] **raw SQL 사용** 여부 (Prisma 규칙 위반)
- [ ] **XSS**: dangerouslySetInnerHTML 사용처
- [ ] **공통 타입/유틸 중복**: 여러 파일에 동일 타입/함수 정의

---

## 산출물

### `REVIEW_1_REPORT.md`

```markdown
# REVIEW-1: 코드 + 보안 + 성능 리뷰 보고서
> 리뷰 일자: (날짜)
> 대상: B1~B10 전체 코드베이스

## 요약
- 🔴 Critical: N건 (보안 N / 코드 N / 성능 N)
- 🟠 Major: N건
- 🟡 Minor: N건
- 💡 Suggestion: N건

## 🔴 Critical (즉시 수정)

### 보안
1. (제목) — (파일) — (설명) — (조치)

### 코드
1. ...

### 성능
1. ...

## 🟠 Major

1. ...

## 🟡 Minor + 💡 Suggestion

1. ...

## 공통화 후보
- (중복 구현 목록 + 통합 방안)

## 기술 부채 요약 (우선순위순)
1. 보안 Critical 수정
2. N+1 쿼리 해소
3. API 패턴 통일
4. 공통 컴포넌트 추출
```

### `context/TRACK_B.md` 업데이트

```markdown
## REVIEW-1 완료 (날짜)
### 발견 사항
- 🔴 Critical N건, 🟠 Major N건
- 보안: (핵심 1줄)
- 성능: (핵심 1줄)
- 코드: (핵심 1줄)
### 다음: REVIEW-2 디자인/UI
```
