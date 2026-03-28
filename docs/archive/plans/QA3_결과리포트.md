# QA-3 디자인 일관성 감사 리포트

## 감사일: 2026-03-01
## 범위: R1~R9 디자인 리팩토링 완료 상태, src/ 전체 (components/ui/ 제외)

---

## 총 요약

| 지표 | 결과 | 판정 |
|------|------|------|
| 금지 blue 계열 | **0건** | ✅ |
| 금지 slate 계열 | **0건** | ✅ |
| 금지 gray 계열 | **0건** | ✅ |
| 금지 shadow-sm/md | **0건** | ✅ |
| 금지 emerald/amber/indigo | **0건** | ✅ |
| 금지 orange/purple/yellow/pink | **3건** | ⚠️ |
| shadow-lg/xl (모달/오버레이) | **15건** | ✅ 의도적 |
| 차트 내 blue 계열 (#2563EB) | **15건** | ⚠️ |
| 필수 토큰 사용 | **정상 분포** | ✅ |

**전체 판정: 🟢 양호 — 금지 패턴 잔존 거의 0, 경미한 불일치 2건**

---

## A. 금지 패턴 잔존 스캔

| 패턴 | 잔존 수 | 판정 |
|------|---------|------|
| `bg-blue-*`, `text-blue-*`, `border-blue-*` | **0** | ✅ |
| `bg-slate-*`, `text-slate-*`, `border-slate-*` | **0** | ✅ |
| `bg-gray-*`, `text-gray-*`, `border-gray-*` (ctr-gray 제외) | **0** | ✅ |
| `shadow-sm`, `shadow-md` | **0** | ✅ |
| `emerald-*`, `amber-*`, `indigo-*` | **0** | ✅ |
| `orange-*`, `purple-*`, `yellow-*`, `pink-*` | **3** | ⚠️ |

### ⚠️ 잔존 3건 상세

| 파일 | 패턴 | 비고 |
|------|------|------|
| `offboarding/[id]/OffboardingDetailClient.tsx:580` | `fill-yellow-400` | 별점 아이콘 fill (SVG) |
| `offboarding/[id]/OffboardingDetailClient.tsx:765` | `fill-yellow-400` | 별점 아이콘 fill (SVG) |
| `components/home/ExecutiveHome.tsx:128` | `border-t-yellow-500` | 카드 상단 보더 |

> 별점 아이콘의 yellow-400은 시맨틱 용도(별점=노란색)로 의도적 사용 가능.
> ExecutiveHome의 yellow-500은 hex 전환 권장 (`border-t-[#F59E0B]`).

### shadow-lg/xl 15건 (모두 의도적)

| 위치 | 용도 | 판정 |
|------|------|------|
| AuditLogClient.tsx | 모달 | ✅ |
| OrgClient.tsx | 사이드 패널 | ✅ |
| PipelineClient.tsx (2건) | 모달 | ✅ |
| EmployeeNewClient.tsx | 드롭다운 | ✅ |
| PwaInstallBanner.tsx | 배너 (화면 하단 플로팅) | ✅ |
| AttritionRadarChart.tsx | 차트 툴팁 | ✅ |
| HistoryTab.tsx | 차트 툴팁 | ✅ |
| AttritionDonutChart.tsx | 차트 툴팁 | ✅ |
| AttritionTrendChart.tsx | 차트 툴팁 | ✅ |
| HrDocumentManager.tsx (2건) | 모달 | ✅ |
| HrChatbot.tsx (3건) | 챗봇 플로팅 UI | ✅ |

> 모두 모달/드롭다운/오버레이/툴팁/플로팅 UI — CLAUDE.md 규칙에 따라 shadow 유지 대상.

---

## B. 필수 토큰 사용 현황

### B-1. 컬러 토큰

| 토큰 | 사용 수 | 용도 | 판정 |
|------|---------|------|------|
| `text-[#1A1A1A]` | 415 | 제목, 주요 텍스트 | ✅ 풍부 |
| `text-[#333]` | 235 | 강조 텍스트 | ✅ |
| `text-[#555]` | 120 | 본문 텍스트 | ✅ |
| `text-[#666]` | 607 | 보조 텍스트 | ✅ 가장 많이 사용 |
| `text-[#999]` | 485 | 약화/플레이스홀더 | ✅ |
| `border-[#E8E8E8]` | 470 | 표준 보더 | ✅ |
| `border-[#D4D4D4]` | 134 | 인풋 보더 | ✅ |
| `bg-[#FAFAFA]` | 256 | 카드/호버 배경 | ✅ |
| `bg-[#F5F5F5]` | 144 | 약간 어두운 배경 | ✅ |
| `#00C853` (전체) | 466 | 프라이머리 그린 | ✅ 풍부 |
| `bg-ctr-primary` | 55 | 프라이머리 (토큰) | ✅ |
| `bg-[#E8F5E9]` | — | 프라이머리 라이트 | ✅ |

> 모든 필수 토큰이 코드베이스 전반에 광범위하게 적용됨.

### B-2. 타이포그래피

| 항목 | 값 | 판정 |
|------|-----|------|
| Pretendard 폰트 | `globals.css`에 적용 | ✅ |
| `font-semibold` | 261건 | ✅ |
| `font-bold` | 275건 | ✅ |
| `font-medium` | 910건 | ✅ 가장 많이 사용 |

### B-3. 카드/컨테이너

| 패턴 | 사용 수 | 비고 |
|------|---------|------|
| `rounded-xl` | 221 | 카드 표준 | ✅ |
| `rounded-lg` | 502 | 버튼/인풋/뱃지 표준 | ✅ |
| `rounded-2xl` | 5 | 모달/특수 용도 | ✅ |

---

## C. 컴포넌트별 판정

| 컴포넌트 | 상태 | 비고 |
|----------|------|------|
| 사이드바 | ✅ | `ctr-primary`, `ctr-gray-*` 토큰 사용, bg-white + border-[#E8E8E8] |
| KPI 카드 | ✅ | `AnalyticsKpiCard` — hex 토큰 적용 |
| 뱃지 | ✅ | `PayrollStatusBadge` — hex 시맨틱 컬러, rounded-full |
| 테이블 | ✅ | bg-[#FAFAFA] 헤더, border-[#F5F5F5] 행 구분 |
| 모달 | ✅ | shadow-xl, rounded-2xl 유지 |
| 폼 인풋 | ✅ | `focus:ring-[#00C853]` 164건 적용 |
| 버튼 | ✅ | `bg-[#00C853]` 프라이머리, hex 기반 |
| AI 카드 | ✅ | Sparkles 아이콘 28건, AI 뱃지 컴포넌트 존재 |
| 차트 | ⚠️ | Recharts fill/stroke에 `#2563EB`(blue) 15건 잔존 |
| 평가 패턴 | ✅ | 성과 사이클 관련 hex 적용 |

---

## 🟡 경미한 불일치 (2건)

### 1. Recharts 차트 내 `#2563EB` (blue-600 hex) 15건

| 파일 | 건수 |
|------|------|
| `ManagerInsightsHub.tsx` | 3 |
| `AnalyticsOverviewClient.tsx` (via components) | 2 |
| `TeamHealthClient.tsx` | 1 |
| `WorkforceClient.tsx` | 2 |
| `PerformanceClient.tsx` | 2 |
| `RecruitmentAnalyticsClient.tsx` | 1 |
| `AttendanceAnalyticsClient.tsx` | 1 |
| `TurnoverClient.tsx` | 1 |
| `SuccessionDashboard.tsx` | 1 |
| `CompanySettingsClient.tsx` | 2 |
| `ShiftPatternsClient.tsx` | 1 |

> Recharts의 fill/stroke 속성에서 `#2563EB` (Tailwind blue-600의 hex 값) 사용.
> CSS 클래스가 아닌 JSX 속성이므로 R1~R9 sed 스크립트에서 미탐지.
> 차트 팔레트 기준 `#00C853` (primary) 또는 `#8B5CF6` (보라) 등으로 교체 권장.

### 2. `fill-yellow-400` / `border-t-yellow-500` (3건)

> 별점 아이콘은 yellow가 업계 표준이므로 유지 가능.
> ExecutiveHome 카드 보더만 hex 전환 권장.

---

## 🟢 일관성 확인 항목

| 항목 | 상세 |
|------|------|
| 금지 컬러 (blue/slate/gray 클래스) | **0건** — 완벽 제거 |
| 금지 그림자 (shadow-sm/md) | **0건** — 완벽 제거 |
| 금지 시맨틱 클래스 (emerald/amber/indigo) | **0건** — 전부 hex 전환 |
| 프라이머리 그린 적용 | **466건** — 전체 코드베이스 관통 |
| 중립색 hex 적용 | **2,000건+** — #1A1A1A~#999 분포 |
| 보더 토큰 | **604건** — #E8E8E8 + #D4D4D4 |
| 배경 토큰 | **400건** — #FAFAFA + #F5F5F5 |
| 포커스 링 그린 | **164건** — focus:ring-[#00C853] |
| Pretendard 폰트 | **적용됨** — globals.css |
| 카드 shadow 제거 | **완료** — 모달/오버레이만 유지 |

---

## 수정 권장사항

| 우선순위 | 항목 | 건수 | 난이도 |
|----------|------|------|--------|
| 🟡 N1 병행 | 차트 `#2563EB` → 디자인 팔레트 컬러 교체 | 15건 | 낮음 |
| 🟡 N1 병행 | `border-t-yellow-500` → `border-t-[#F59E0B]` | 1건 | 낮음 |
| ℹ️ 선택 | `fill-yellow-400` → `fill-[#FACC15]` | 2건 | 낮음 |

> 총 18건, 모두 경미. 빌드/기능에 영향 없음.
