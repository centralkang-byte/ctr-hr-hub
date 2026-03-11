# CTR HR Hub — 통합 QA + UX 폴리싱 계획서 (Q-Session Plan v3.2)

> **작성일:** 2026-03-11
> **전제 조건:** Settings Phase H-1~H-3 완료 후 시작
> **목표:** 184페이지 전수 스캔 → 기능 검증 + 비주얼 폴리싱 + 90점 프리미엄 UX를 한 번에 완료
> **산출물:** 테스트/매뉴얼 작성에 바로 사용 가능한 완성된 프로덕트
> **v3 변경:** 90점 목표 상향 — 마이크로 인터랙션, 차트 테마, 애니메이션 추가. Q-0.5 UX 컨셉 리뷰 신설.
> **v3.1 패치:** Gemini QA 리뷰 — Z-Index 방어, 테스트 환경 애니메이션 비활성화, layout 속성 애니메이션 금지.
> **v3.2 패치:** Q-1/Q-4 Antigravity 병렬화 + 에이전트 간 격리 규칙. 총 세션 10~18으로 단축.

---

## 1. 왜 통합하는가

### 기존 계획 (분리)
```
Settings 완료 → UX 폴리싱 (P-0~P-4) → E2E 테스트 → 매뉴얼
                  9~14세션              3~5세션
                  184페이지 × 1회       184페이지 × 1회 = 368회 방문
```

### 통합 계획 (v3)
```
Settings 완료 → 통합 QA + 폴리싱 (Q-0~Q-4) → 매뉴얼
                     12~20세션 (v3 조정)
                     184페이지 × 1회 + 버그 재방문 ≈ 220회
                     + 마이크로 인터랙션 + 차트 테마 + 애니메이션 = 90점 목표
```

**절약:** 3~5세션 + 148회 불필요한 페이지 방문 제거

---

## 2. 전체 로드맵

```
Q-0    전수 스캔 + 리포트 생성
 ↓       ├─ Layer 1: HTTP Smoke Test (200/404/500)
 ↓       ├─ Layer 2: 렌더링 체크 (빈 화면/에러 화면 필터링)
 ↓       └─ Layer 3: 상세 25개 체크포인트 점검
 ↓
Q-0.5  ★ UX 컨셉 리뷰 (스크린샷 기반, Claude + 대표님 공동 검토)
 ↓
Q-1    디자인 토큰 정비 + 스타일 상수 + 유틸리티 함수 + 애니메이션 인프라
 ↓
Q-2    패턴별 일괄 수정 (테이블→폼→모달→카드→차트→배지) + 마이크로 인터랙션
 ↓
Q-3    i18n 한글화 + 빈 상태 + 에러 상태 + 로딩
 ↓
Q-4    기능 버그 + 권한 버그(UI+API) + 네비게이션 + 최종 검수
```

| Phase | 작업 | 예상 세션 | Antigravity |
|-------|------|:---:|:---:|
| Q-0 | 전수 스캔 (Playwright 자동 캡처 + 정적 분석 + 리포트) | 1~2 | ✅ 병렬 3 Agent |
| Q-0.5 | ★ UX 컨셉 리뷰 (핵심 10화면 × 4축 평가 → Q-2 방향 설정) | 대화 1회 | — |
| Q-1 | 디자인 토큰 + 스타일 상수 + 유틸리티 + ★ 애니메이션 인프라 | 1~2 | ★ 병렬 3 Agent (v3.2) |
| Q-2 | 패턴별 일괄 수정 (6개 UI 패턴) + ★ 마이크로 인터랙션 적용 | 5~8 | ✅ 병렬 가능 |
| Q-3 | i18n + 빈 상태 + 에러 상태 + 로딩 스켈레톤 | 2~3 | ✅ 병렬 가능 |
| Q-4 | 기능/권한 버그(UI+API Exploit) + 네비게이션 + 최종 검수 | 1~3 | ★ 병렬 3 Agent (v3.2) |
| **합계** | | **10~18** | |

> **v3.1→v3.2 변경:** Q-1 병렬화 (2~3 → 1~2세션), Q-4 병렬화 (2~4 → 1~3세션), 총 합계 12~20 → **10~18**.

---

## 3. Q-0: 전수 스캔 (가장 중요)

> 비유: 집 리모델링 전에 방마다 사진 찍어서 체크리스트 만드는 것.
> 이 리포트가 Q-1~Q-4 전체의 실행 명세서.

### ★ 스캔 방법론: Playwright + 정적 분석 듀얼 스캔 (v2~)

> **핵심 원칙:** Claude Code는 터미널 환경이므로 "브라우저를 직접 열어서 눈으로 확인"은 불가.
> 대신 **Playwright 자동화 스크립트 작성 → headless 실행 → 스크린샷 수집**은 완벽하게 동작.

**사전 준비 (대표님 1회만):**
```bash
cd ctr-hr-hub
npx playwright install chromium
```

**듀얼 스캔 전략:**

| 방식 | 대상 | 수집 정보 |
|------|------|----------|
| **Playwright 스크립트** | 184개 URL 순회 | HTTP 상태 코드, 스크린샷 `.png`, 페이지 타이틀, 콘솔 에러 로그 |
| **grep 정적 분석** | 894개 TS/TSX 소스 파일 | Tailwind 클래스 패턴, 영문 하드코딩 텍스트, import 패턴, 누락 컴포넌트 |

→ 두 결과를 합쳐서 `qa-report.json` + `QA_POLISH_REPORT.md` 듀얼 산출물 생성.

### ★ 3계층 스캔 순서 (v2~)

> 184페이지 중 일부는 아예 렌더링이 안 될 수 있음 (500 에러, 빈 화면).
> 25개 체크포인트를 전부 돌리기 전에 "살아있는 페이지"를 먼저 분류.

```
Layer 1: HTTP Smoke Test ────── 184페이지 전체 → 200 OK / 404 / 500 분류
                                 소요: ~1분 (Playwright fetch)
                                 결과: 500/404 페이지 → 즉시 Q-4 기능버그로 분류
           ↓
Layer 2: 렌더링 체크 ─────────── Layer 1 PASS 페이지만 → 스크린샷에서 빈 화면/에러 화면 필터
                                 소요: ~10분 (스크린샷 자동 촬영 + 파일 크기 기반 빈 화면 탐지)
                                 결과: 빈 화면 페이지 → Q-4 기능버그로 분류
           ↓
Layer 3: 상세 체크 ──────────── Layer 2 PASS 페이지만 → 25개 체크포인트 전수 점검
                                 소요: Agent 1~3 병렬
                                 결과: qa-report.json + QA_POLISH_REPORT.md
```

**효과:** "아예 안 되는 페이지"에서 25개 포인트를 체크하는 헛수고 제거. Q-2~Q-3에서 존재하지 않는 화면을 고치려는 시도 방지.

### Antigravity Agent 구조

```
[Layer 1~2: 단일 Agent가 Playwright 스크립트 실행 → 페이지 분류]
         ↓
[Layer 3: 정상 렌더링 페이지만 대상]

Agent 1: 정적분석 + 상세체크 (페이지 1~62)   ─┐
Agent 2: 정적분석 + 상세체크 (페이지 63~123)  ─┼→ Agent 4: 분석 + 리포트 작성
Agent 3: 정적분석 + 상세체크 (페이지 124~184) ─┘
```

- Layer 1~2: 단일 Agent가 Playwright smoke test + 스크린샷 캡처 (직렬, 빠름)
- Agent 1~3: grep 정적 분석 + 스크린샷 비교 + 항목별 체크 (병렬)
- Agent 4: 전체 결과 취합 + 패턴 분석 + 수정 우선순위 정렬

### 스캔 항목 (6카테고리, 25개 체크 포인트)

#### [A] 비주얼 일관성 (8개)

| # | 체크 항목 | PASS 기준 | 스캔 방법 |
|---|----------|----------|----------|
| A1 | Primary 색상 통일 | `#5E81F4` 단일 사용 | grep + 스크린샷 |
| A2 | 폰트 사이즈 위계 | 제목(xl/2xl) > 섹션(lg) > 라벨(sm) > 보조(xs) — 4단계 | grep `text-` 클래스 |
| A3 | 간격/여백 패턴 | gap/space/padding 일관 | grep + 스크린샷 |
| A4 | 테이블 헤더 스타일 | `bg-gray-50 text-xs text-gray-500 uppercase` 단일 | 스크린샷 비교 |
| A5 | 카드 스타일 | `white rounded-xl shadow-sm` 단일 | 스크린샷 비교 |
| A6 | 상태 배지 색상 의미 | 빨강=위험, 주황=경고, 초록=성공, 파랑=정보 — 전체 일관 | grep + 스크린샷 |
| A7 | 아이콘 라이브러리 | lucide-react 단일, 크기 통일 (16/20/24px) | grep import |
| A8 | 숫자 정렬 | 테이블 숫자 컬럼 우측 정렬, 금액 우측 + 통화기호 | 스크린샷 |

#### [B] i18n 한글화 (4개)

| # | 체크 항목 | PASS 기준 | 스캔 방법 |
|---|----------|----------|----------|
| B1 | 버튼 텍스트 | Save→저장, Cancel→취소, Edit→편집, Delete→삭제, Submit→제출, Approve→승인, Reject→반려 등 전부 한글 | grep 영문 버튼 텍스트 |
| B2 | 탭/헤더 텍스트 | Overview→개요, Dashboard→대시보드, Settings→설정 등 | grep + 스크린샷 |
| B3 | Placeholder 텍스트 | "Enter...", "Search..." → "입력하세요", "검색..." | grep placeholder |
| B4 | 에러 메시지 | Zod 에러, API 에러 전부 한글 | 의도적 에러 발생 테스트 |

#### [C] 숫자/날짜 포맷 (4개)

| # | 체크 항목 | PASS 기준 | 스캔 방법 |
|---|----------|----------|----------|
| C1 | 천단위 콤마 | 모든 숫자에 콤마 (예: 3,200,000) | grep + 스크린샷 |
| C2 | 통화 기호 | 금액에 ₩/$/¥/₫ 등 통화 기호 표시 | 스크린샷 |
| C3 | 큰 숫자 축약 | KPI 카드: ₩2.1억 또는 ₩21억 (자릿수 과다 방지) | 스크린샷 |
| C4 | 날짜 포맷 통일 | 전체 `YYYY.MM.DD` 또는 `YYYY-MM-DD` 단일 | grep + 스크린샷 |

#### [D] 레이아웃 안정성 (3개)

| # | 체크 항목 | PASS 기준 | 스캔 방법 |
|---|----------|----------|----------|
| D1 | 텍스트 오버플로우 | 긴 텍스트에 `truncate` + `max-w-` 적용, 칸 확장 없음 | 긴 데이터 입력 테스트 |
| D2 | 테이블 반응형 | 좁은 화면에서 가로 스크롤 또는 반응형 대응 | 브라우저 리사이즈 |
| D3 | 모달 오버플로우 | 내용이 길 때 모달 내 스크롤 작동 | 긴 폼 데이터 테스트 |

#### [E] 상태 피드백 (4개)

| # | 체크 항목 | PASS 기준 | 스캔 방법 |
|---|----------|----------|----------|
| E1 | 로딩 스켈레톤 | 데이터 로딩 중 스켈레톤 표시 (빈 화면 금지) | 네트워크 쓰로틀링 |
| E2 | 버튼 로딩 상태 | 저장/승인 클릭 시 spinner + disabled | 클릭 테스트 |
| E3 | 성공/실패 toast | CRUD 액션 후 toast 표시 | 실제 저장/삭제 테스트 |
| E4 | 빈 상태 (Empty State) | 데이터 0건일 때 안내 메시지 + 액션 유도 (빈 테이블 금지) | 필터 조건 축소 |

#### [F] 폼/네비게이션 (4개 — 기능 테스트 겸용)

| # | 체크 항목 | PASS 기준 | 스캔 방법 |
|---|----------|----------|----------|
| F1 | 필수 입력 표시 | 필수 필드에 `*` + 미입력 시 인라인 에러 | 빈 폼 제출 테스트 |
| F2 | 브라우저 탭 제목 | 페이지별 고유 제목: "{페이지명} - CTR HR Hub" | 브라우저 탭 확인 |
| F3 | 필터 URL 상태 | 필터/정렬/페이지 상태가 URL에 반영, 뒤로가기 시 유지 | 필터 → URL 확인 → 뒤로가기 |
| F4 | 사이드바 활성 | 현재 페이지 메뉴 항목 하이라이트 | 서브페이지 이동 확인 |

### 기능 테스트 (페이지 유형별)

> Q-0에서 비주얼 체크와 동시에 실행. 각 페이지 방문 시 유형에 맞는 기능 테스트 수행.

#### 목록(테이블) 페이지

```
✅ 데이터 표시됨
✅ 정렬 클릭 → 컬럼 정렬 변경
✅ 필터 작동 (법인/부서/기간 등)
✅ 페이지네이션 (다음/이전/특정 페이지)
✅ 검색 (키워드 입력 → 결과 필터)
✅ 빈 상태 (필터 결과 0건 시)
✅ 행 클릭 → 상세 페이지 이동
```

#### 상세/편집(폼) 페이지

```
✅ 데이터 로딩 + 필드에 값 채워짐
✅ 필드 편집 가능
✅ 저장 → 성공 toast
✅ 새로고침 후 변경 유지됨
✅ 필수 필드 미입력 → 에러 표시
✅ 취소 → 변경 사항 되돌림
```

#### 대시보드 페이지

```
✅ KPI 카드 숫자 표시
✅ 차트 렌더링 (recharts)
✅ 필터 변경 → 차트/KPI 갱신
✅ 법인 선택 → 법인별 데이터
✅ 기간 변경 → 기간별 데이터
✅ 빈 차트 상태 (데이터 0건)
```

#### 파이프라인 페이지 (Payroll, Performance)

```
✅ 현재 상태 표시
✅ 다음 단계 전환 버튼 작동
✅ 상태 전환 후 UI 갱신
✅ 되돌리기 가능 여부 확인
✅ 관련 알림 생성 확인
```

#### 승인/반려 페이지 (Leave, Payroll)

```
✅ 대기 건 목록 표시
✅ 승인 클릭 → 상태 변경 + toast
✅ 반려 클릭 → 사유 입력 → 상태 변경
✅ 벌크 승인 작동 (해당 시)
✅ 처리 후 목록에서 해당 건 제거/상태 변경
```

### 역할별 접근 체크

> 4개 역할로 각각 로그인하여 접근 제어 확인.

| 체크 항목 | EMPLOYEE | MANAGER | HR_ADMIN | SUPER_ADMIN |
|----------|:---:|:---:|:---:|:---:|
| Settings 메뉴 | 미노출 | 미노출 | ✅ 표시 (자기 법인) | ✅ 전체 |
| Insights 메뉴 | 미노출 | 팀 건강만 | ✅ 법인 범위 | ✅ 전사 |
| 팀 관리 메뉴 | 미노출 | ✅ | ✅ | ✅ |
| 타 법인 데이터 | ❌ 차단 | ❌ 차단 | ❌ 차단 | ✅ 접근 |
| 급여 상세 조회 | 본인만 | ❌ (팀원도 불가) | ✅ 법인 | ✅ 전체 |
| 퇴직 면담 원본 | ❌ | ❌ (직속 매니저 차단) | ✅ | ✅ |
| 글로벌 설정 변경 | ❌ | ❌ | ❌ (보기만) | ✅ |

---

## 4. Q-0 출력물: 듀얼 포맷 (v2~)

> `qa-report.json` (기계용) + `QA_POLISH_REPORT.md` (사람용) 듀얼 산출물

### 4-1. qa-report.json (에이전트 간 데이터 전달용)

> 184페이지 × 25개 체크포인트 = 4,600개 데이터 포인트.
> JSON 구조화로 Q-1~Q-4 에이전트가 프로그래밍적으로 쿼리 가능.

```json
{
  "scan_date": "2026-XX-XX",
  "total_pages": 184,
  "summary": {
    "http_200": 170,
    "http_404": 8,
    "http_500": 6,
    "render_ok": 162,
    "render_blank": 8,
    "detailed_scan": 162
  },
  "pages": {
    "/leave/team": {
      "http_status": 200,
      "render_status": "OK",
      "page_type": "table",
      "checks": {
        "A1_primary_color": "PASS",
        "A4_table_header": "FAIL",
        "B1_button_text": "FAIL",
        "C1_comma": "PASS"
      },
      "fix_categories": ["table", "i18n"],
      "severity": "MAJOR",
      "notes": "Approve 버튼 영문, 테이블 헤더 bg-white (표준: bg-gray-50)"
    },
    "/payroll/runs": {
      "http_status": 500,
      "render_status": "ERROR",
      "page_type": "pipeline",
      "checks": {},
      "fix_categories": ["critical_bug"],
      "severity": "CRITICAL",
      "notes": "500 Internal Server Error — Layer 1에서 탈락"
    }
  }
}
```

**Q-2~Q-4 에이전트 활용법:**
```bash
# Q-2 Agent 1: 내가 고칠 테이블 페이지 목록 추출
jq '[.pages | to_entries[] | select(.value.fix_categories[] == "table") | .key]' qa-report.json

# Q-3 Agent 1: 영문→한글 교체 대상 페이지 목록
jq '[.pages | to_entries[] | select(.value.fix_categories[] == "i18n") | .key]' qa-report.json

# Q-4: CRITICAL 버그 목록
jq '[.pages | to_entries[] | select(.value.severity == "CRITICAL") | .key]' qa-report.json
```

### 4-2. QA_POLISH_REPORT.md (사람이 읽는 요약)

```markdown
# CTR HR Hub — QA + 폴리싱 리포트
> 스캔일: 2026-XX-XX
> 대상: 184페이지 전수 스캔

## Layer 1~2 사전 분류

| 분류 | 페이지 수 | 조치 |
|------|:---:|------|
| HTTP 200 + 렌더링 정상 | 162 | → Layer 3 상세 스캔 |
| HTTP 404 (라우트 미존재) | 8 | → Q-4 기능버그 |
| HTTP 500 (서버 에러) | 6 | → Q-4 기능버그 (Critical) |
| 렌더링 빈 화면 | 8 | → Q-4 기능버그 |

## 요약 통계 (Layer 3 대상 162페이지)

| 카테고리 | PASS | WARN | FAIL | 합계 |
|---------|:----:|:----:|:----:|:----:|
| A. 비주얼 일관성 | — | — | — | — |
| B. i18n 한글화 | — | — | — | — |
| C. 숫자/날짜 포맷 | — | — | — | — |
| D. 레이아웃 안정성 | — | — | — | — |
| E. 상태 피드백 | — | — | — | — |
| F. 폼/네비게이션 | — | — | — | — |
| G. 기능 테스트 | — | — | — | — |
| H. 권한 체크 | — | — | — | — |

## 패턴별 수정 목록 (Q-1~Q-4 실행용)

### 🔴 Critical (즉시 수정)
(500 에러, 렌더링 안 됨, 권한 구멍, 데이터 오류)

### 🟡 Major (Q-2~Q-3에서 일괄 수정)
(비주얼 불일치, 영문 텍스트, 콤마 누락, 빈 상태 없음)

### 🟢 Minor (Q-4에서 정리)
(미세 여백, 아이콘 크기, 색상 미세 차이)

## 페이지별 상세 (184건)

### /home
- 🎨 A1 색상: ✅
- 🎨 A4 테이블: N/A
- 🔤 B1 버튼: ✅
- 🔢 C1 콤마: ⚠️ 알림 건수 콤마 없음
- ⚙️ 기능: ✅ 위젯 로딩 / ✅ 빠른 액션
- 🔒 권한: ✅

### /leave/team
- 🎨 A1 색상: ✅
- 🎨 A4 테이블: ❌ bg-white (표준: bg-gray-50)
- 🔤 B1 버튼: ❌ "Approve" 영문
- 🔢 C1 콤마: ❌ 잔여일수 12.5 → 표시 OK (소수)
- ⚙️ 기능: ✅ 목록 / ✅ 필터 / ❌ 정렬 무반응
- 🔒 권한: ✅ EMPLOYEE 접근 차단

(... 184페이지 전부 ...)
```

---

## 5. Q-0.5: UX 컨셉 리뷰 ★ v3 신규

> **세션이 아니라 대화 1회.** Q-0 스크린샷이 나온 직후, Claude + 대표님이 함께 검토.
> 이 리뷰의 결과가 Q-2의 수정 방향을 결정함.

### 왜 필요한가

Q-0 리포트는 "무엇이 틀렸는지" (색상, 영문, 콤마)를 잡아주지만, **"무엇이 아쉬운지"** (정보가 너무 빽빽함, 여백이 부족함, 눈의 흐름이 자연스럽지 않음)는 잡지 못함. 80점과 90점의 차이는 바로 이 "아쉬움"을 해결하는 데 있음.

### 리뷰 방식

**핵심 화면 10개 선정:**

| # | 화면 | 선정 이유 |
|---|------|----------|
| 1 | `/home` (홈 대시보드) | 첫인상 결정. 정보 밀도 판단 핵심 |
| 2 | `/employees/[id]` (직원 상세) | 가장 복잡한 정보 구조. Master-Detail 패턴 |
| 3 | `/leave/team` (팀 휴가 관리) | 테이블 + 필터 + 승인 = 가장 빈번한 유형 |
| 4 | `/payroll/runs` (급여 파이프라인) | 파이프라인 UI. 단계 진행 시각화 |
| 5 | `/performance/cycles/[id]` (성과 사이클) | 가장 복잡한 파이프라인 + 다중 탭 |
| 6 | `/recruitment/jobs` (채용 칸반) | 칸반 보드 UX. 드래그앤드롭 |
| 7 | `/analytics/overview` (인사이트 대시보드) | 차트 + KPI 카드 밀도. 데이터 시각화 |
| 8 | `/settings/organization` (설정) | 폼 중심 페이지. 입력 경험 |
| 9 | `/my/tasks` (나의 할일) | 개인 사용자의 핵심 진입점 |
| 10 | `/org-chart` (조직도) | 트리 시각화. 특수 UI |

**4축 평가 기준:**

| 축 | 평가 내용 | 90점 기준 |
|----|----------|----------|
| **정보 밀도** | 한 화면에 보여주는 정보량이 적절한가 | 핵심 정보 즉시 파악 + 부가 정보는 펼침/탭으로 숨김 |
| **시각 계층** | 제목→섹션→본문→보조의 크기/색상/간격 차이가 명확한가 | 시선이 자연스럽게 위→아래, 왼→오른쪽으로 흐름 |
| **여백** | 빈 공간이 충분한가. 요소 간 숨 쉴 공간이 있는가 | Workday 수준의 여유로운 간격. 빽빽하지 않음 |
| **인터랙션** | hover, 전환, 피드백이 자연스러운가 | 클릭하면 즉각 반응. 부드러운 전환. "비싼 느낌" |

**리뷰 산출물:**
- 10개 화면 각각에 대해 4축 점수 (1~5) + 구체적 개선 포인트
- Q-2 수정 시 반영할 **여백/간격 조정 가이드** (예: "카드 간 gap 4 → 6", "섹션 간 py-4 → py-8")
- Q-2 수정 시 반영할 **정보 숨김 패턴** (예: "직원 상세에서 하위 정보는 아코디언으로")

---

## 6. Q-1: 디자인 토큰 + 스타일 상수 + 유틸리티 + ★ 애니메이션 인프라

> Q-0 리포트에서 발견된 불일치의 **근본 원인**을 먼저 해결.
> 개별 페이지를 고치기 전에, 공통 도구를 만들어야 이후 수정이 일관됨.
> ★ v3에서 Framer Motion 기반 애니메이션 인프라 추가.

### 산출물

| 파일 | 목적 |
|------|------|
| `src/lib/format/number.ts` | `formatNumber(3200000)` → `"3,200,000"` / `formatCurrency(3200000, 'KRW')` → `"₩3,200,000"` / `formatCompact(2100000000)` → `"₩21억"` |
| `src/lib/format/date.ts` | `formatDate(date)` → `"2026.03.11"` (전체 통일 포맷) / `formatDateTime(date)` → `"2026.03.11 14:30"` |
| `src/lib/format/text.ts` | truncate 유틸리티 (max 길이 + tooltip 패턴) |
| `src/components/ui/EmptyState.tsx` | 공통 빈 상태 컴포넌트 (일러스트 + 메시지 + 액션 버튼) |
| `src/components/ui/LoadingSkeleton.tsx` | 테이블/카드/차트 스켈레톤 패턴 (이미 있으면 통합) |
| `src/components/ui/StatusBadge.tsx` | 공통 상태 배지 (색상 의미 통일: 빨강/주황/초록/파랑/회색) |
| `DESIGN_TOKENS.md` | 확정된 디자인 토큰 문서 (색상, 폰트, 간격, 컴포넌트 스타일 — 이후 수정의 단일 기준) |

### 스타일 상수 파일 (v2~)

> Tailwind 클래스를 상수로 추출 → 래퍼의 유지보수 이점 90% 확보, 교체 작업량 1/3

| 파일 | 내용 |
|------|------|
| `src/lib/styles/table.ts` | 테이블 관련 Tailwind 상수 |
| `src/lib/styles/form.ts` | 폼 관련 Tailwind 상수 |
| `src/lib/styles/card.ts` | 카드 관련 Tailwind 상수 |
| `src/lib/styles/modal.ts` | 모달 관련 Tailwind 상수 |
| `src/lib/styles/chart.ts` | 차트 색상 팔레트 + 공통 옵션 |
| `src/lib/styles/z-index.ts` | ★ Z-Index 계층 상수 (v3.1 — 애니메이션 Stacking Context 충돌 방어) |
| `src/lib/styles/index.ts` | 전체 re-export |

**예시:**
```typescript
// src/lib/styles/table.ts
export const TABLE_STYLES = {
  wrapper: 'overflow-x-auto',
  table: 'w-full',
  header: 'bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider',
  headerCell: 'px-4 py-3 text-left',
  headerCellRight: 'px-4 py-3 text-right',  // 숫자 컬럼용
  row: 'hover:bg-gray-50 border-b border-gray-100 transition-colors',
  cell: 'px-4 py-3 text-sm text-gray-900',
  cellRight: 'px-4 py-3 text-sm text-gray-900 text-right tabular-nums',  // 숫자
  cellMuted: 'px-4 py-3 text-sm text-gray-500',
  pagination: 'flex items-center justify-between px-4 py-3 border-t border-gray-100',
} as const;

// src/lib/styles/form.ts
export const FORM_STYLES = {
  label: 'block text-sm font-medium text-gray-700 mb-1',
  required: 'text-red-500 ml-0.5',  // * 표시
  input: 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary',
  error: 'mt-1 text-xs text-red-500',
  section: 'space-y-4',
  actions: 'flex items-center justify-end gap-3 pt-4 border-t border-gray-100',
} as const;

// src/lib/styles/card.ts
export const CARD_STYLES = {
  base: 'bg-white rounded-xl shadow-sm border border-gray-100',
  padded: 'bg-white rounded-xl shadow-sm border border-gray-100 p-6',
  header: 'flex items-center justify-between mb-4',
  title: 'text-lg font-semibold text-gray-900',
  kpi: 'bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow',
} as const;

// ★ src/lib/styles/z-index.ts (v3.1 — Stacking Context 충돌 방어)
// Framer Motion의 transform/opacity 애니메이션은 새로운 Stacking Context를 생성.
// 명시적 z-index 계층이 없으면 모달 뒤로 드롭다운이 숨거나,
// 헤더 위로 테이블 스크롤이 뚫고 올라오는 "Z-Index 지옥" 발생.
export const Z_INDEX = {
  base: 0,           // 일반 콘텐츠
  dropdown: 100,     // 드롭다운 메뉴, 셀렉트 옵션
  stickyHeader: 200, // 고정 헤더, 테이블 헤더
  backdrop: 300,     // 모달 배경 오버레이
  modal: 400,        // 모달 다이얼로그
  toast: 500,        // 토스트 알림
  tooltip: 600,      // 툴팁
} as const;
```

**Q-2에서의 활용:**
```tsx
// Before (현재 — 각 페이지마다 다른 className)
<th className="px-6 py-3 bg-white text-left text-xs font-medium text-gray-400">

// After (Q-2 수정 — 상수 참조)
import { TABLE_STYLES } from '@/lib/styles';
<th className={TABLE_STYLES.headerCell}>
```

→ 나중에 디자인 바뀌면 `table.ts` 파일 하나만 수정. 60개 페이지를 다시 돌 필요 없음.

### ★ 애니메이션 인프라 (v3 신규)

> **"싸 보이는 SaaS"와 "비싸 보이는 SaaS"의 차이 = 마이크로 인터랙션.**
> Framer Motion을 설치하고, 공통 애니메이션 유틸리티를 만들어서 Q-2에서 일괄 적용.

**설치:**
```bash
npm install framer-motion
```

**산출물:**

| 파일 | 목적 |
|------|------|
| `src/lib/animations/variants.ts` | 공통 애니메이션 변형 (fadeIn, slideUp, stagger, scaleIn) |
| `src/lib/animations/transitions.ts` | 공통 트랜지션 설정 (duration, easing) |
| `src/components/ui/AnimatedNumber.tsx` | KPI 카드 숫자 카운트업 애니메이션 |
| `src/components/ui/AnimatedList.tsx` | 리스트 아이템 순차 등장 (stagger) 래퍼 |
| `src/components/ui/PageTransition.tsx` | 페이지 전환 시 fade 효과 래퍼 |
| `src/components/ui/MotionConfig.tsx` | ★ 테스트 환경 애니메이션 비활성화 래퍼 (v3.1) |

### ★ 애니메이션 방어 규칙 3가지 (v3.1 — Gemini QA 리뷰 반영)

> Framer Motion 도입 시 발생할 수 있는 3대 함정을 사전 차단.
> Q-1 프롬프트 + Q-2 프롬프트 모두에 반드시 포함할 필수 규칙.

**규칙 1: Z-Index 명시 의무화**
> `transform`, `opacity` 애니메이션이 적용된 요소는 브라우저에서 **새로운 Stacking Context**를 생성.
> 모달, 드롭다운, 토스트, 툴팁 등 겹치는 UI 요소에 반드시 `Z_INDEX` 상수를 적용해야 함.
> 위반 시: 모달 뒤로 드롭다운이 숨거나, 헤더 위로 스크롤이 뚫고 올라오는 "Z-Index 지옥" 발생.

**규칙 2: 테스트 환경 애니메이션 비활성화**
> Playwright는 요소가 "안정화(Stable)"될 때까지 기다렸다가 클릭함.
> stagger 애니메이션이나 카운트업이 도는 동안 "요소가 움직여서 클릭 불가" → 30초 타임아웃 에러.
> 해결: `MotionConfig`로 테스트 환경에서 duration=0 강제.

```tsx
// src/components/ui/MotionConfig.tsx
import { MotionConfig } from 'framer-motion';

const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true';

export function AppMotionConfig({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig transition={isTestMode ? { duration: 0 } : undefined}>
      {children}
    </MotionConfig>
  );
}
// → layout.tsx에서 <AppMotionConfig>으로 전체 앱을 감싸기
// → Playwright 실행 시 NEXT_PUBLIC_TEST_MODE=true 설정
```

**규칙 3: 애니메이션 속성 제한 (transform + opacity ONLY)**
> `width`, `height`, `margin`, `padding` 등 layout 속성을 애니메이션하면
> 매 프레임 Reflow(재계산) 발생 → 저사양 PC에서 스크롤 끊김(Jank).
> **하드웨어 가속이 지원되는 `transform`(scale, x, y)과 `opacity`만 허용.**
> 이 규칙은 Q-1~Q-4 모든 프롬프트에 DO NOT 규칙으로 포함.

```
⛔ ANIMATION RULE (모든 Q 세션 프롬프트에 포함):
DO NOT animate layout properties (width, height, margin, padding, top, left).
ONLY animate: transform (scale, x, y, rotate) and opacity.
Use Framer Motion's `layout` prop ONLY for layout animations that genuinely need it.
```

**예시:**
```typescript
// src/lib/animations/variants.ts
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const slideUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export const staggerContainer = {
  animate: {
    transition: { staggerChildren: 0.05 },
  },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
};

// src/lib/animations/transitions.ts
export const TRANSITIONS = {
  fast: { duration: 0.15, ease: 'easeOut' },
  normal: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] },
  slow: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  spring: { type: 'spring', stiffness: 300, damping: 30 },
} as const;
```

```tsx
// src/components/ui/AnimatedNumber.tsx
// KPI 카드에서 "₩0 → ₩3,200,000" 카운트업 애니메이션
// 0에서 목표 숫자까지 부드럽게 올라가는 효과
// formatCurrency와 연동하여 포맷 유지

// src/components/ui/PageTransition.tsx
// layout.tsx 또는 각 page.tsx에서 감싸면 페이지 전환 시 fade 효과
// <PageTransition><ChildContent /></PageTransition>
```

### ★ recharts 커스텀 테마 (v3 신규)

> 기본 recharts 스타일 → CTR 브랜드에 맞는 커스텀 차트 디자인.

| 파일 | 목적 |
|------|------|
| `src/lib/styles/chart.ts` | 색상 팔레트, 축 라벨 스타일, 툴팁 스타일, 범례 위치 통일 |

```typescript
// src/lib/styles/chart.ts
export const CHART_THEME = {
  // CTR 브랜드 색상 기반 팔레트 (6색 — 최대 6개 시리즈)
  colors: ['#5E81F4', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#6B7280'],

  // 축 (Axis) 스타일
  axis: {
    stroke: '#E5E7EB',
    tick: { fontSize: 12, fill: '#6B7280' },
    label: { fontSize: 13, fill: '#374151', fontWeight: 500 },
  },

  // 그리드
  grid: { stroke: '#F3F4F6', strokeDasharray: '3 3' },

  // 툴팁
  tooltip: {
    contentStyle: {
      backgroundColor: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
      padding: '12px 16px',
      fontSize: '13px',
    },
    labelStyle: { fontWeight: 600, marginBottom: '4px' },
  },

  // 범례
  legend: {
    wrapperStyle: { paddingTop: '16px', fontSize: '13px' },
  },

  // 반응형 컨테이너
  responsive: { width: '100%', height: 320 },
} as const;
```

### 예상 세션: 1~2 (v3.2 조정)

> **v3:** 2~3세션 → **v3.2:** 1~2세션. 3 Agent 병렬화로 단축.

### ★ Antigravity Agent 구조 (v3.2 신규)

```
Agent 1: 포맷 유틸리티 + 스타일 상수 ─────────┐
         → number.ts, date.ts, text.ts         │
         → table.ts, form.ts, card.ts,         │
           modal.ts, z-index.ts                │
         → DESIGN_TOKENS.md                    │
                                               ├→ Q-2에서 조립
Agent 2: 공통 UI 컴포넌트 ────────────────────┤
         → EmptyState.tsx                      │
         → LoadingSkeleton.tsx                 │
         → StatusBadge.tsx                     │
                                               │
Agent 3: 애니메이션 인프라 + 차트 테마 ─────────┘
         → framer-motion 설치
         → variants.ts, transitions.ts
         → AnimatedNumber.tsx, AnimatedList.tsx,
           PageTransition.tsx, MotionConfig.tsx
         → chart.ts (CHART_THEME)
```

### ⛔ Q-1 에이전트 격리 규칙 (v3.2 — Dependency Trap 방어)

> **문제:** Agent 2가 EmptyState에 Agent 3의 `fadeIn` 애니메이션을 import하거나,
> Agent 1의 `z-index.ts`를 import하면 — 병렬 실행 중 파일이 아직 없어서 빌드 에러.
>
> **규칙:** Q-1 프롬프트에 반드시 포함:

```
⛔ CRITICAL (Strict Isolation in Q-1):
Agent 1, 2, and 3 MUST NOT import files created by each other
during this session.
- Agent 2: Do NOT import animations from Agent 3's files
- Agent 2: Do NOT import z-index from Agent 1's files
- Agent 3: Do NOT import format utils from Agent 1's files
Build all components strictly isolated.
Cross-imports and wiring happen in Q-2.
```

---

## 7. Q-2: 패턴별 일괄 수정 + ★ 마이크로 인터랙션

> Q-0 리포트(`qa-report.json`)의 패턴별 수정 목록을 기반으로, **같은 유형을 한 번에** 수정.
> ★ v3에서 각 패턴 수정 시 마이크로 인터랙션도 함께 적용.

### 수정 순서 (영향 범위 큰 순)

| 순서 | 패턴 | 예상 대상 | 핵심 수정 | ★ v3 마이크로 인터랙션 |
|:---:|------|:---:|----------|----------|
| 1 | **테이블** | ~60페이지 | `TABLE_STYLES` 상수 적용, 숫자 우측 정렬 (`tabular-nums`), 정렬 아이콘, 페이지네이션 스타일, hover 행, 빈 행 | 행 hover `transition-colors duration-150`, 정렬 아이콘 회전 애니메이션 |
| 2 | **폼** | ~40페이지 | `FORM_STYLES` 상수 적용, 필수 `*` 표시, 인라인 에러, 저장 버튼 위치, 입력 필드 너비 | focus 시 `ring` 트랜지션, 에러 메시지 `slideUp` 등장, 저장 버튼 `active:scale-95` |
| 3 | **모달/다이얼로그** | ~25개 | `MODAL_STYLES` 상수 적용, 크기 통일, 닫기 버튼 위치, 확인/취소 버튼 순서, 오버플로우 스크롤 | 모달 `scaleIn` 등장 + backdrop fade, 닫힐 때 `fadeOut` |
| 4 | **카드** | ~30페이지 | `CARD_STYLES` 상수 적용, 그림자, 패딩, 모서리 반경, hover 효과 통일 | hover 시 `shadow-sm → shadow-md` 트랜지션 + 살짝 `translateY(-1px)` |
| 5 | **차트** | ~15페이지 | `CHART_THEME` 색상 팔레트 통일, 축 라벨, 범례 위치, 반응형 | recharts `animationBegin`, `animationDuration` 통일, 차트 진입 시 `fadeIn` |
| 6 | **배지/태그** | 전체 | 색상 의미 통일 (`StatusBadge` 컴포넌트로 교체) | 상태 변경 시 배지 `pulse` 1회 |

### ★ KPI 카드 + 대시보드 특별 처리 (v3 신규)

> 대시보드는 "첫인상"을 결정하는 페이지. 별도 주의 필요.

| 적용 항목 | 내용 |
|----------|------|
| `AnimatedNumber` | 모든 KPI 카드 숫자에 카운트업 효과 (0 → 실제 값) |
| `staggerContainer` | KPI 카드 4개가 왼→오 순서로 0.05초 간격 등장 |
| `CHART_THEME` | 모든 차트에 통일된 색상, 툴팁, 축 스타일 적용 |
| 여백 조정 | Q-0.5 리뷰에서 결정된 간격 가이드 반영 |

### ★ Q-0.5 리뷰 반영 (v3 신규)

> Q-0.5에서 결정된 여백/간격/정보 밀도 개선 방향을 Q-2 수정 시 함께 적용.
> 별도 세션이 아니라 Q-2 각 패턴 수정에 "여백 조정"을 병합.

예시:
- "카드 간 간격 `gap-4` → `gap-6`" → CARD_STYLES 상수에 반영 → 30페이지 자동 적용
- "섹션 구분 `py-4` → `py-8`" → 스타일 상수에 반영 → 전체 자동 적용
- "직원 상세 하위 정보 아코디언 처리" → 해당 페이지 개별 수정

### Antigravity 가능 구간

```
Agent 1: 테이블 일괄 (60페이지) + 테이블 마이크로 인터랙션
Agent 2: 폼 + 모달 일괄 (65페이지) + 폼/모달 인터랙션  ← 병렬
Agent 3: 카드 + 차트 + 배지 (45페이지) + KPI 애니메이션 + 차트 테마
```

### 예상 세션: 5~8 (v3 조정)

> **v2:** 5~7세션 → **v3:** 5~8세션. 마이크로 인터랙션 + 여백 조정 + KPI 애니메이션 추가분.

---

## 8. Q-3: i18n + 빈 상태 + 에러 상태 + 로딩

> 사용자가 "뭐야 이거" 하는 순간을 제거하는 단계.

### 작업 목록

| 항목 | 내용 | 예상 대상 |
|------|------|:---:|
| **영문→한글** | 버튼, 탭, 헤더, placeholder, 에러 메시지 전수 한글화 | ~80건 (Q-0에서 집계) |
| **빈 상태** | Q-1의 EmptyState 컴포넌트를 데이터 0건인 모든 테이블/목록에 적용 | ~40페이지 |
| **에러 상태** | API 실패 시 에러 UI 표시 (현재 빈 화면이거나 콘솔 에러만) | ~30페이지 |
| **로딩 스켈레톤** | Q-1의 LoadingSkeleton을 데이터 로딩이 있는 모든 페이지에 적용 | ~50페이지 |
| **toast 누락** | 저장/삭제/승인/반려 후 toast 없는 곳에 추가 | ~20건 |
| **버튼 로딩** | 클릭 후 spinner + disabled 없는 버튼에 추가 | ~30건 |

### Antigravity 가능 구간

```
Agent 1: 영문→한글 전수 (grep + 교체)
Agent 2: 빈 상태 + 에러 상태 (컴포넌트 삽입)  ← 병렬
Agent 3: 로딩 스켈레톤 + toast + 버튼 로딩
```

### 예상 세션: 2~3

---

## 9. Q-4: 기능/권한 버그 + API Exploit + 네비게이션 + 최종 검수

> Q-0에서 발견된 실제 기능 버그와 권한 구멍을 수정하는 마지막 단계.

### 작업 목록

| 항목 | 내용 |
|------|------|
| **기능 버그** | Q-0에서 ❌ 판정된 기능 항목 수정 (정렬 안 됨, 필터 안 됨, 저장 후 유지 안 됨 등) |
| **Layer 1~2 탈락 페이지** | HTTP 500, 404, 빈 화면 페이지 수정 (Q-0에서 사전 분류된 항목) |
| **UI 권한 버그** | 역할별 접근 체크에서 발견된 메뉴/버튼 노출 구멍 수정 |
| **브라우저 탭 제목** | 전체 184페이지에 `<title>{페이지명} - CTR HR Hub</title>` 설정 (Next.js metadata) |
| **필터 URL 상태** | 주요 목록 페이지의 필터/정렬/페이지 상태를 URL searchParams에 반영 |
| **사이드바 활성** | 서브페이지에서도 상위 메뉴 하이라이트 유지 |
| **최종 검수** | Q-0 리포트의 모든 ❌/⚠️ 항목 재확인 → PASS로 전환 |

### ★ API Exploit 테스트 (v2~)

> **원칙:** UI에서 메뉴가 안 보이는 것(UI 차단)과 API가 차단되는 것(서버 차단)은 별개.
> "직원 전용" 팻말을 달았다고 뒷문 잠금장치가 필요 없는 게 아님.

**테스트 방식:**
1. 4개 역할(EMPLOYEE, MANAGER, HR_ADMIN, SUPER_ADMIN) 각각의 인증 토큰 확보
2. cURL 또는 fetch 스크립트로 권한 범위를 벗어나는 API 직접 호출
3. 응답이 `403 Forbidden` 또는 빈 결과(`[]`)인지 확인

**5대 핵심 API Exploit 시나리오:**

| # | 공격 시나리오 | 기대 응답 |
|---|-------------|----------|
| 1 | EMPLOYEE 토큰 → `GET /api/v1/payroll/runs` (HR 전용) | `403 Forbidden` |
| 2 | EMPLOYEE 토큰 → `GET /api/v1/analytics/turnover` (Insights 전용) | `403 Forbidden` |
| 3 | MANAGER 토큰 → `PUT /api/v1/settings/organization` (SUPER_ADMIN 전용) | `403 Forbidden` |
| 4 | HR_ADMIN(법인A) 토큰 → `GET /api/v1/employees?companyId={법인B}` (타 법인) | 빈 결과 `[]` |
| 5 | MANAGER 토큰 → `GET /api/v1/offboarding/{id}/interview` (면담 원본) | `403 Forbidden` |

**자동화:**
```bash
# Q-4 프롬프트에서 에이전트가 실행할 스크립트
# scripts/api-exploit-test.ts
const SCENARIOS = [
  { role: 'EMPLOYEE', method: 'GET', url: '/api/v1/payroll/runs', expect: 403 },
  { role: 'EMPLOYEE', method: 'GET', url: '/api/v1/analytics/turnover', expect: 403 },
  { role: 'MANAGER', method: 'PUT', url: '/api/v1/settings/organization', expect: 403 },
  { role: 'HR_ADMIN', method: 'GET', url: '/api/v1/employees?companyId=OTHER', expect: 'empty' },
  { role: 'MANAGER', method: 'GET', url: '/api/v1/offboarding/xxx/interview', expect: 403 },
];
// → 각 시나리오별 토큰 발급 → fetch → 결과 비교 → PASS/FAIL 리포트
```

### ★ Antigravity Agent 구조 (v3.2 신규)

```
Agent 1: 기능 버그 수정 ──────────────────────┐
         → Q-0 리포트 CRITICAL 버그 목록 추출   │
         → 500 에러, 빈 화면 수정               │
         → 정렬/필터/저장 안 되는 것 수정        │
                                               ├→ 최종 검수
Agent 2: 권한 버그 + API Exploit ──────────────┤
         → UI 권한 구멍 수정                    │
         → api-exploit-test.ts 작성 + 실행      │
         → 403 안 떨어지는 API에 미들웨어 추가   │
                                               │
Agent 3: 네비게이션 + 메타데이터 ──────────────┘
         → 184페이지 <title> 설정 (grep + 일괄)
         → 필터 URL searchParams 반영
         → 사이드바 활성 상태 수정
```

### 예상 세션: 1~3 (v3.2 조정)

> **v3.1:** 2~4세션 → **v3.2:** 1~3세션. 3 Agent 병렬화로 단축.

---

## 10. 최종 산출물

Q-4 완료 후 확보되는 것:

| 산출물 | 용도 |
|--------|------|
| `qa-report.json` | 184페이지 전수 스캔 구조화 데이터 (프로그래밍적 쿼리 가능) |
| `QA_POLISH_REPORT.md` | 184페이지 전수 스캔 결과 (사람이 읽는 요약, before/after 비교 가능) |
| `DESIGN_TOKENS.md` | 확정된 디자인 토큰 (매뉴얼 + 향후 개발 기준) |
| 포맷 유틸리티 3종 | `number.ts`, `date.ts`, `text.ts` — 전체 코드베이스에서 재활용 |
| 스타일 상수 6종 | `table.ts`, `form.ts`, `card.ts`, `modal.ts`, `chart.ts`, ★`z-index.ts` — 디자인 변경 시 단일 수정점 |
| 공통 UI 컴포넌트 3종 | `EmptyState`, `LoadingSkeleton`, `StatusBadge` |
| ★ 애니메이션 유틸리티 | `variants.ts`, `transitions.ts` — Framer Motion 공통 변형 |
| ★ 애니메이션 컴포넌트 4종 | `AnimatedNumber`, `AnimatedList`, `PageTransition`, ★`AppMotionConfig` |
| ★ recharts 커스텀 테마 | `CHART_THEME` — 전체 차트 통일 스타일 |
| **기능 검증 완료** | 184페이지 × 유형별 체크리스트 PASS |
| **권한 검증 완료 (UI+API)** | 4역할 × 주요 화면 접근 제어 PASS + 5대 API Exploit 테스트 PASS |
| **90점 프리미엄 UX** | 마이크로 인터랙션 + 애니메이션 + 커스텀 차트 + 최적 여백 |

→ 이 상태에서 **사용자 매뉴얼** 작성에 바로 진입 가능.

---

## 11. 예상 일정 요약

| Phase | 세션 (v3.2) | 누적 | v3.1 대비 변경 |
|-------|:---:|:---:|:---:|
| Q-0 전수 스캔 | 1~2 | 1~2 | — |
| Q-0.5 UX 컨셉 리뷰 | 대화 1회 | — | — |
| Q-1 토큰 + 상수 + 유틸리티 + 애니메이션 | 1~2 | 2~4 | ★ 2~3 → 1~2 (병렬화) |
| Q-2 패턴별 수정 + 마이크로 인터랙션 | 5~8 | 7~12 | — |
| Q-3 i18n + 상태 | 2~3 | 9~15 | — |
| Q-4 버그 + API Exploit + 최종 | 1~3 | **10~18** | ★ 2~4 → 1~3 (병렬화) |

---

## 부록 A: Q-0 페이지 그룹 (Agent 분배)

### Agent 1 (62페이지): 홈 + 나의공간 + 팀관리 + 인사관리

```
/home
/my/tasks, /my/profile, /my/attendance, /my/leave, /my/payroll
/my/goals, /my/evaluation, /my/benefits, /my/year-end
/team/*, /leave/team, /leave/admin
/employees/*, /directory, /org-chart
/onboarding/*, /offboarding/*
```

### Agent 2 (62페이지): 채용 + 성과/보상 + 급여

```
/recruitment/* (15페이지)
/performance/* (19페이지)
/payroll/* (12페이지)
/compensation/*
/benefits/*
/year-end/*
```

### Agent 3 (60페이지): 인사이트 + 컴플라이언스 + 설정

```
/analytics/* (9페이지)
/compliance/*
/training/*
/succession/*
/settings/* (39페이지 — Hub + 6카테고리)
```

---

## 부록 B: 변경 이력

### v1 → v2

| # | 변경 항목 | 출처 | 변경 내용 |
|---|----------|------|----------|
| 1 | Q-0 스캔 방법론 | Gemini + Claude | "에이전트가 직접 브라우저 열기" → "Playwright 스크립트 작성 → headless 실행" |
| 2 | Q-0 3계층 스캔 | Claude | Layer 1(HTTP) → Layer 2(렌더링) → Layer 3(상세) 순서 도입 |
| 3 | Q-0 출력물 | Claude | MD 단독 → JSON + MD 듀얼 포맷 (에이전트 간 데이터 전달 효율화) |
| 4 | Q-1 스타일 상수 | Gemini(절충) | 래퍼 컴포넌트 강제 대신 Tailwind 상수 파일로 추상화 |
| 5 | Q-4 API Exploit | Gemini | UI 접근 제어 + API 레벨 접근 제어 검증 추가 (5대 핵심 시나리오) |
| 6 | 세션 수 조정 | Claude | Q-2: 3~5 → 5~7, Q-4: 2~3 → 2~4, 총합: 9~15 → 11~18 |

### v2 → v3

| # | 변경 항목 | 출처 | 변경 내용 |
|---|----------|------|----------|
| 7 | 목표 상향 | 대표님 + Claude | 80점 → **90점 목표**. 마이크로 인터랙션 + 프리미엄 UX 추가 |
| 8 | Q-0.5 신설 | Claude | 스크린샷 기반 UX 컨셉 리뷰 (4축: 정보 밀도/시각 계층/여백/인터랙션) |
| 9 | Q-1 애니메이션 인프라 | Claude | Framer Motion 설치 + variants/transitions + AnimatedNumber/List/PageTransition |
| 10 | Q-1 recharts 테마 | Claude | CHART_THEME 커스텀 테마 (색상 팔레트, 툴팁, 축, 범례 통일) |
| 11 | Q-2 마이크로 인터랙션 | Claude | 패턴별 hover/transition/animation 효과 추가 + KPI 카운트업 |
| 12 | 세션 수 조정 | Claude | Q-1: 1~2 → 2~3, Q-2: 5~7 → 5~8, 총합: 11~18 → **12~20** |

### v3 → v3.1 (패치)

| # | 변경 항목 | 출처 | 변경 내용 |
|---|----------|------|----------|
| 13 | Z-Index 상수 | Gemini QA | `z-index.ts` 추가 — 애니메이션 Stacking Context 충돌 방어 |
| 14 | 테스트 환경 애니메이션 비활성화 | Gemini QA | `MotionConfig.tsx` — Playwright 타임아웃 방지 (duration=0) |
| 15 | 애니메이션 속성 제한 규칙 | Gemini QA | transform + opacity만 허용, layout 속성(width/margin 등) 금지 |

### v3.1 → v3.2 (패치)

| # | 변경 항목 | 출처 | 변경 내용 |
|---|----------|------|----------|
| 16 | Q-1 Antigravity 병렬화 | Claude | 3 Agent 병렬 (포맷+상수 / UI컴포넌트 / 애니메이션). 2~3 → 1~2세션 |
| 17 | Q-4 Antigravity 병렬화 | Claude | 3 Agent 병렬 (기능버그 / 권한+Exploit / 네비+메타). 2~4 → 1~3세션 |
| 18 | Q-1 에이전트 격리 규칙 | Gemini QA | 병렬 Agent 간 cross-import 금지. 조립은 Q-2에서. |
| 19 | 총 세션 수 단축 | — | 12~20 → **10~18세션** |

---

> **다음 단계:** Settings H-2a~H-3 완료 → Q-0 프롬프트 작성 → 실행
