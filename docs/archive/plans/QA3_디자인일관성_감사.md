# QA-3: 디자인 일관성 감사 (Design Consistency Audit)
# Phase 4.5 — QA-1A/1B (기능) + QA-2 (빌드) 완료 후 실행
# Claude Code에서 바로 실행 | 코드 수정은 디자인 불일치만 허용

---

## ★ 세션 시작: context.md + CLAUDE.md + CTR_DESIGN_SYSTEM.md + CTR_UI_PATTERNS.md 먼저 읽어줘

이번 세션 목표:
**R1~R6 디자인 리팩토링이 CTR Design System에 맞게 일관 적용되었는지,
코드 수준에서 금지 패턴 잔존/필수 패턴 누락을 스캔하는 것.**

---

## Phase A: 금지 패턴 잔존 스캔

R1~R6에서 제거했어야 할 이전 디자인 패턴이 남아있는지 확인:

```bash
echo "=== 금지 컬러 (blue 기반) ==="
grep -rn "bg-blue-600\|bg-blue-500\|bg-blue-700\|text-blue-600\|border-blue" src/ --include="*.tsx" | grep -v "node_modules" | wc -l
grep -rn "bg-blue-600\|bg-blue-500\|bg-blue-700" src/ --include="*.tsx" | head -10

echo "=== 금지 그림자 ==="
grep -rn "shadow-sm\|shadow-md\|shadow-lg\|shadow-xl" src/ --include="*.tsx" | grep -v "shadow-\[" | wc -l
grep -rn "shadow-sm\|shadow-md\|shadow-lg" src/ --include="*.tsx" | head -10

echo "=== 금지 radius (뱃지에 rounded-full) ==="
# 뱃지 컨텍스트에서만 체크 — rounded-full이 아바타/아이콘에선 OK
grep -rn "rounded-full" src/ --include="*.tsx" | grep -i "badge\|status\|tag\|chip" | head -10

echo "=== 금지 slate 계열 ==="
grep -rn "bg-slate-\|text-slate-\|border-slate-" src/ --include="*.tsx" | wc -l

echo "=== 금지 gray 계열 (Tailwind 기본) ==="
grep -rn "bg-gray-\|text-gray-\|border-gray-" src/ --include="*.tsx" | wc -l

echo "=== 금지 indigo/violet (이전 다크 테마 잔여) ==="
grep -rn "bg-indigo-\|text-indigo-\|bg-violet-\|text-violet-" src/ --include="*.tsx" | wc -l
```

---

## Phase B: 필수 패턴 적용 확인

CTR_DESIGN_SYSTEM.md에서 정의된 필수 디자인 토큰:

### B-1. 핵심 컬러 토큰

```bash
echo "=== 필수 컬러 사용 현황 ==="
# 텍스트 기본: #1A1A1A
grep -rn "text-\[#1A1A1A\]" src/ --include="*.tsx" | wc -l

# 텍스트 보조: #6B7280 또는 text-[#888]
grep -rn "text-\[#6B7280\]\|text-\[#888\]" src/ --include="*.tsx" | wc -l

# 보더: #E8E8E8
grep -rn "border-\[#E8E8E8\]" src/ --include="*.tsx" | wc -l

# 배경: #F9FAFB
grep -rn "bg-\[#F9FAFB\]" src/ --include="*.tsx" | wc -l

# 주요 액션 (green): #00C853
grep -rn "#00C853\|bg-\[#00C853\]" src/ --include="*.tsx" | wc -l

# 경고 red: #F44336
grep -rn "#F44336" src/ --include="*.tsx" | wc -l

# 주의 amber: #FF9800
grep -rn "#FF9800" src/ --include="*.tsx" | wc -l
```

### B-2. 타이포그래피

```bash
echo "=== Pretendard 적용 ==="
grep -rn "Pretendard\|font-pretendard" src/ public/ --include="*.tsx" --include="*.css" --include="*.html" | head -5

echo "=== tracking (letter-spacing) ==="
grep -rn "tracking-\[-0.02em\]\|tracking-\[-0.01em\]" src/ --include="*.tsx" | wc -l

echo "=== font-semibold 헤딩 ==="
grep -rn "font-semibold" src/ --include="*.tsx" | wc -l
```

### B-3. 카드/컨테이너

```bash
echo "=== 표준 카드 패턴 ==="
# 표준: rounded-2xl border border-[#E8E8E8] bg-white
grep -rn "rounded-2xl" src/ --include="*.tsx" | wc -l

# 구형 패턴: rounded-lg (카드에서)
grep -rn "rounded-lg" src/ --include="*.tsx" | wc -l

echo "=== hover 효과 ==="
grep -rn "hover:shadow\|hover:bg-\[#F9FAFB\]\|hover:border" src/ --include="*.tsx" | wc -l
```

---

## Phase C: 컴포넌트별 상세 검증

### C-1. 사이드바 (R1)

```bash
echo "=== 사이드바 컬러 ==="
find src/components -name "*Sidebar*" -o -name "*sidebar*" | xargs grep -n "bg-\|text-\|border-" 2>/dev/null | head -20
# 기대: bg-white, 아이콘 #888, active #1A1A1A + green indicator
```

### C-2. DataTable (R1~R6 공통)

```bash
echo "=== 테이블 패턴 ==="
grep -rn "DataTable\|<table\|<thead\|<th" src/components/ --include="*.tsx" | head -10
# 기대: thead bg-[#F9FAFB], th text-[#6B7280] text-xs, hover:bg-[#F9FAFB]
```

### C-3. 뱃지/상태 표시 (R1~R6 공통)

```bash
echo "=== 뱃지 패턴 ==="
grep -rn "Badge\|StatusBadge\|badge" src/components/ --include="*.tsx" | head -10
# 기대: rounded-md px-2 py-0.5, bg-{color}/10 text-{color}
```

### C-4. KPI 카드 (R1)

```bash
echo "=== KPI 카드 ==="
grep -rn "KpiCard\|kpi-card\|StatCard" src/components/ --include="*.tsx" | head -10
# 기대: border-l-4 + 컬러, rounded-2xl, 아이콘+숫자+라벨
```

### C-5. 모달

```bash
echo "=== 모달 패턴 ==="
grep -rn "Modal\|Dialog\|modal" src/components/ --include="*.tsx" | head -10
# 기대: rounded-2xl, 오버레이 bg-black/40, max-w-lg
```

### C-6. 폼 인풋

```bash
echo "=== 폼 인풋 ==="
grep -rn "<input\|<Input\|<select\|<Select" src/components/ --include="*.tsx" | head -10
# 기대: border-[#E8E8E8] rounded-lg focus:ring-[#00C853]
grep -rn "focus:ring\|focus:border" src/ --include="*.tsx" | head -10
```

### C-7. 버튼

```bash
echo "=== 버튼 패턴 ==="
grep -rn "<button\|<Button" src/components/ --include="*.tsx" | head -10
# 기대: Primary → bg-[#00C853] text-white, Secondary → border-[#E8E8E8]
grep -rn "bg-\[#00C853\]" src/ --include="*.tsx" | wc -l
```

### C-8. Recharts 차트 컬러

```bash
echo "=== 차트 컬러 ==="
grep -rn "fill=\|stroke=\|color=" src/ --include="*.tsx" | grep -i "chart\|recharts\|Bar\|Line\|Pie\|Radar" | head -20
# 기대: primary #00C853, 팔레트 6색 CTR_DESIGN_SYSTEM 참조
```

### C-9. AI 인사이트 카드 (R5~R6)

```bash
echo "=== AI 카드 ==="
grep -rn "AiInsight\|AiGenerated\|ai-card\|sparkles\|Sparkles" src/ --include="*.tsx" | head -10
# 기대: bg-gradient-to-r from-[#F0FFF4] to-[#E8F5E9], Sparkles 아이콘
```

### C-10. 평가 전용 패턴 (R6)

```bash
echo "=== 평가 역량 컬러바 ==="
grep -rn "border-l-4.*\[#\|border-l-\[4px\]" src/ --include="*.tsx" | head -10
# 기대: 5점=#00C853, 4=#66BB6A, 3=#FF9800, 2=#FF5722, 1=#F44336

echo "=== EMS 9블록 컬러 ==="
grep -rn "EMS_BLOCK\|ems.*color\|block.*color\|9블록" src/ --include="*.ts" --include="*.tsx" | head -10

echo "=== 캘리브레이션 그리드 ==="
grep -rn "calibration.*grid\|3×3\|grid-cols-3.*calibration" src/ --include="*.tsx" | head -5
```

---

## Phase D: STEP별 페이지 스크린샷 기반 리뷰 (선택)

> 이 단계는 `npm run dev`로 서버를 띄운 후,
> 각 페이지를 브라우저에서 스크린샷 찍어서 Claude에 올리는 방식.
> Claude Code 세션에서 직접 수행 불가 — 별도로 Sangwoo가 진행.

추천 스크린샷 페이지 (우선순위):

| # | 페이지 | 체크 포인트 |
|---|--------|-----------|
| 1 | /dashboard | KPI 카드 + 사이드바 + 헤더 |
| 2 | /employees | DataTable + 필터 + 뱃지 |
| 3 | /employees/:id | 프로필 카드 + 탭 |
| 4 | /attendance | 근태 테이블 + 캘린더 |
| 5 | /recruitment (파이프라인) | 칸반 보드 |
| 6 | /performance/calibration | 9블록 매트릭스 |
| 7 | /analytics | KPI + 차트 |
| 8 | /hr-chatbot | 챗봇 UI |
| 9 | /settings/customization/* | 설정 페이지들 |
| 10 | /payroll | 급여 처리 |

---

## Phase E: 불일치 자동 수정 (선택)

금지 패턴이 발견되면, 이 세션에서 바로 수정 가능:

**수정 범위:**
- blue → green 컬러 전환
- shadow-sm/md → 제거 또는 shadow-[0_1px_2px_rgba(0,0,0,0.04)]
- rounded-lg → rounded-2xl (카드에서)
- gray-/slate- → [#1A1A1A]/[#6B7280]/[#E8E8E8] 등 CTR 토큰

**수정 금지:**
- 기능 코드 변경
- 컴포넌트 구조 변경
- API/DB 변경

수정 후:
```bash
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
npm run build 2>&1 | tail -5
```

---

## Phase F: 결과 리포트

```markdown
# QA-3 디자인 일관성 감사 리포트
## 감사일: {날짜}

### A. 금지 패턴 잔존
| 패턴 | 잔존 수 | 파일 |
|------|---------|------|
| bg-blue-* | {N} | ... |
| shadow-sm/md/lg | {N} | ... |
| bg-slate-* | {N} | ... |
| bg-gray-* | {N} | ... |
| rounded-full (뱃지) | {N} | ... |

### B. 필수 토큰 사용률
| 토큰 | 사용 수 | 비고 |
|------|---------|------|
| text-[#1A1A1A] | {N} | |
| border-[#E8E8E8] | {N} | |
| bg-[#F9FAFB] | {N} | |
| #00C853 (green) | {N} | |
| tracking-[-0.02em] | {N} | |

### C. 컴포넌트별 판정
| 컴포넌트 | 상태 | 비고 |
|----------|------|------|
| 사이드바 | ✅/⚠️ | |
| DataTable | ✅/⚠️ | |
| 뱃지 | ✅/⚠️ | |
| KPI 카드 | ✅/⚠️ | |
| 모달 | ✅/⚠️ | |
| 폼 인풋 | ✅/⚠️ | |
| 버튼 | ✅/⚠️ | |
| 차트 | ✅/⚠️ | |
| AI 카드 | ✅/⚠️ | |
| 평가 패턴 | ✅/⚠️ | |

### D. 수정 사항 (Phase E에서 수정한 경우)
| 파일 | Before | After |
|------|--------|-------|

### 🔴 디자인 불일치 심각 (사용자 혼란 유발)
### 🟡 미세 불일치 (N1~N4 병행 수정)
### 🟢 일관성 확인됨
```

저장: `/tmp/qa3_design_audit.md`

---

## ⚠️ 주의사항
1. **기능 코드 변경 절대 금지** — 디자인(CSS/클래스)만 수정
2. 스크린샷 리뷰(Phase D)는 Sangwoo가 별도 진행
3. CTR_DESIGN_SYSTEM.md를 **반드시** 먼저 읽고 기준 파악
4. Recharts 차트는 컬러만 변경 — 데이터/로직 건드리지 않음
5. 수정 후 반드시 tsc + build 검증
6. 결과 리포트 파일 저장 + context.md 업데이트
