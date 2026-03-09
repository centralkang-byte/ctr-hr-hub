# QA-2: 빌드 검증 + 코드 자동 감사
# Phase 4.5 — QA-1A/1B (기능 정합성) 완료 후 실행
# Claude Code에서 바로 실행 | 코드 수정은 Critical 이슈만 허용

---

## ★ 세션 시작: context.md + QA-1A/1B 리포트 먼저 읽어줘

이번 세션 목표:
**빌드 성공 여부, 타입 안전성, 코드 품질, 데드코드, 미사용 import,
패턴 일관성을 자동 도구 기반으로 검증하는 것.**

---

## Phase A: 빌드 + 타입 검증

```bash
# 1. TypeScript 타입 체크 (0 errors 목표)
npx tsc --noEmit 2>&1 | tail -30
echo "---"
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l

# 2. 프로덕션 빌드
npm run build 2>&1 | tail -50

# 3. ESLint (있다면)
npx eslint src/ --ext .ts,.tsx --max-warnings 0 2>&1 | tail -30
```

**기준:**
- `tsc --noEmit` → **0 errors** (경고는 허용)
- `npm run build` → **성공** (exit code 0)
- ESLint → 심각한 에러 0개

---

## Phase B: 데드코드 + 미사용 import 스캔

```bash
# 1. 미사용 import 검색 (대략적)
grep -rn "^import " src/ --include="*.tsx" --include="*.ts" | \
  while IFS=: read file line content; do
    # 임포트된 심볼 추출 후 파일 내 사용 여부 체크
    symbol=$(echo "$content" | grep -oP '(?<=import\s)\w+|(?<={\s*)\w+')
    if [ -n "$symbol" ]; then
      count=$(grep -c "$symbol" "$file" 2>/dev/null)
      if [ "$count" -le 1 ]; then
        echo "UNUSED? $file:$line → $symbol"
      fi
    fi
  done 2>/dev/null | head -30

# 2. 더 정확한 방법: knip (설치되어 있다면)
npx knip --no-progress 2>&1 | head -50

# 3. 사용되지 않는 컴포넌트 파일 찾기
for f in $(find src/components -name "*.tsx" | sort); do
  basename_no_ext=$(basename "$f" .tsx)
  count=$(grep -rl "$basename_no_ext" src/ --include="*.tsx" --include="*.ts" | grep -v "$f" | wc -l)
  if [ "$count" -eq 0 ]; then
    echo "ORPHAN: $f"
  fi
done | head -20
```

---

## Phase C: API 응답 패턴 일관성

STEP 0 규칙: 모든 API는 `{ success, data, error, meta }` 형식

```bash
# API 라우트에서 응답 패턴 확인
find src/app/api -name "route.ts" | while read f; do
  # NextResponse.json 사용 시 패턴 확인
  has_standard=$(grep -c "success.*data\|success.*error" "$f" 2>/dev/null)
  has_raw=$(grep -c "NextResponse.json" "$f" 2>/dev/null)
  if [ "$has_raw" -gt 0 ] && [ "$has_standard" -eq 0 ]; then
    echo "NON-STANDARD: $f"
  fi
done | head -20

# 에러 핸들링 패턴 확인
grep -rn "catch\|try {" src/app/api/ --include="*.ts" | wc -l
grep -rn "NextResponse.json.*500\|status: 500\|catch.*error" src/app/api/ --include="*.ts" | head -10
```

---

## Phase D: RBAC/보안 감사

```bash
# 1. API 라우트에 권한 체크가 있는지
find src/app/api -name "route.ts" | while read f; do
  has_auth=$(grep -c "auth\|session\|role\|RBAC\|requireRole\|checkPermission\|getServerSession" "$f" 2>/dev/null)
  if [ "$has_auth" -eq 0 ]; then
    echo "NO AUTH CHECK: $f"
  fi
done | head -20

# 2. company_id 필터링 (다법인 격리)
find src/app/api -name "route.ts" | while read f; do
  has_company=$(grep -c "company_id\|companyId" "$f" 2>/dev/null)
  # 공통 API는 제외 (auth, health 등)
  is_common=$(echo "$f" | grep -c "auth\|health\|public")
  if [ "$has_company" -eq 0 ] && [ "$is_common" -eq 0 ]; then
    echo "NO COMPANY FILTER: $f"
  fi
done | head -20

# 3. Supabase RLS 정책 수
grep -c "CREATE POLICY\|ALTER.*ENABLE ROW LEVEL" supabase/migrations/*.sql 2>/dev/null | grep -v ":0$"
```

---

## Phase E: 감사 로그 점검

```bash
# audit_logs INSERT가 되는 곳 확인
grep -rn "audit_log\|insertAuditLog\|createAuditLog" src/ --include="*.ts" --include="*.tsx" | wc -l

# CRUD 작업 중 감사 로그 누락 가능성
find src/app/api -name "route.ts" | while read f; do
  has_write=$(grep -c "INSERT\|UPDATE\|DELETE\|\.insert\|\.update\|\.delete\|POST\|PUT\|PATCH" "$f" 2>/dev/null)
  has_audit=$(grep -c "audit" "$f" 2>/dev/null)
  if [ "$has_write" -gt 0 ] && [ "$has_audit" -eq 0 ]; then
    echo "NO AUDIT LOG: $f"
  fi
done | head -20
```

---

## Phase F: 코드 크기 + 복잡도 분석

```bash
# 1. 파일별 라인수 TOP 20 (리팩토링 후보)
find src/ -name "*.tsx" -o -name "*.ts" | xargs wc -l 2>/dev/null | sort -rn | head -20

# 2. 컴포넌트당 평균 라인수
total_lines=$(find src/components -name "*.tsx" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
total_files=$(find src/components -name "*.tsx" | wc -l)
echo "Components: $total_files files, $total_lines lines, avg: $((total_lines / total_files)) lines/file"

# 3. 500줄 이상 파일 (분할 검토 대상)
find src/ -name "*.tsx" -o -name "*.ts" | xargs wc -l 2>/dev/null | sort -rn | awk '$1 > 500 {print}'

# 4. 전체 코드 규모
echo "=== 전체 코드 규모 ==="
find src/ -name "*.ts" -o -name "*.tsx" | xargs wc -l 2>/dev/null | tail -1
find supabase/migrations -name "*.sql" | xargs wc -l 2>/dev/null | tail -1
```

---

## Phase G: 결과 리포트

```markdown
# QA-2 빌드·코드 품질 감사 리포트
## 감사일: {날짜}

### A. 빌드 결과
- tsc --noEmit: {N} errors
- npm run build: 성공/실패
- ESLint: {N} errors

### B. 데드코드
- 미사용 import 의심: {N}건
- 고아 컴포넌트: {N}건
- 권장 삭제 파일: [목록]

### C. API 패턴 일관성
- 표준 형식 준수: {N}/{total} ({%})
- 비표준 API: [목록]

### D. RBAC/보안
- 권한 체크 누락 API: {N}건
- company_id 필터 누락: {N}건
- RLS 정책 수: {N}개

### E. 감사 로그
- 감사 로그 적용: {N}/{total} 쓰기 API
- 누락: [목록]

### F. 코드 규모
- 전체: {N}줄 ({N} 파일)
- 500줄 이상 파일: {N}개 (분할 검토)
- 컴포넌트 평균: {N}줄

### 🔴 즉시 수정 (빌드 실패, 타입 에러)
### 🟡 권장 개선 (데드코드, 패턴 불일치)
### 🟢 정보 (코드 규모, 복잡도)
```

저장: `/tmp/qa2_build_audit.md`

---

## Phase H: Critical 이슈 즉시 수정 (선택)

빌드 실패 또는 타입 에러가 있으면, 이 세션에서 바로 수정:
- `tsc` 에러 → 타입 수정
- `build` 실패 → import 수정, 누락 파일 생성
- **기능 변경은 절대 안 함** — 타입/빌드 수정만

수정 후 다시 빌드 검증:
```bash
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
npm run build 2>&1 | tail -10
```

---

## ⚠️ 주의사항
1. Phase A~F는 읽기 전용 감사
2. Phase H (수정)은 빌드 실패 시에만 — 확인 후 진행
3. 기능 추가/변경 절대 금지
4. knip이 없으면 수동 grep 방식으로 대체
5. 결과 리포트 반드시 파일 저장 + context.md 업데이트
