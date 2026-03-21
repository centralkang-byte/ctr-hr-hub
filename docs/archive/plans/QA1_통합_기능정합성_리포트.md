# CTR HR Hub — 전체 기능 정합성 감사 리포트

## 감사일: 2026-03-01
## 범위: STEP 0~9 + R1~R9 디자인 리팩토링 완료 상태

---

## 총 요약

| 지표 | 수치 |
|------|------|
| 전체 검증 항목 | **289개** |
| ✅ 완료 | **245개 (85%)** |
| ⚠️ 부분 | **20개 (7%)** |
| ❌ 미구현 | **24개 (8%)** |

---

## STEP별 요약

| STEP | 모듈 | 항목 | ✅ | ⚠️ | ❌ | 달성률 |
|------|------|------|---|---|---|--------|
| 0 | 인증/인프라 | 8 | 8 | 0 | 0 | 100% |
| 1 | DB 스키마 | 25 | 25 | 0 | 0 | 100% |
| 2 | 코어HR+조직도 | 17 | 16 | 1 | 0 | 94% |
| 2.5 | Gap 보완 | 10 | 10 | 0 | 0 | 100% |
| 3 | 온보딩/퇴직 | 10 | 10 | 0 | 0 | 100% |
| 4 | 근태/휴가 | 14 | 12 | 2 | 0 | 86% |
| 5 | 채용/징계 | 21 | 20 | 1 | 0 | 95% |
| **6A** | **성과관리** | **33** | **9** | **8** | **16** | **27%** |
| 6B | 연봉/복리/Attrition | 25 | 22 | 3 | 0 | 88% |
| 7 | Payroll/Analytics | 21 | 19 | 2 | 0 | 90% |
| 8 | 설정/Teams/PWA | 48 | 48 | 0 | 0 | 100% |
| 9 | i18n/컴플라이언스 | 31 | 25 | 3 | 3 | 81% |
| AI | AI 기능 (14개) | 14 | 9 | 0 | 5 | 64% |
| Cron | Cron Job | 4 | 4 | 0 | 0 | 100% |
| MV | Materialized View | 8 | 8 | 0 | 0 | 100% |

---

## 🔴 Critical — 즉시 조치 필요 (21건)

### 1. STEP 6A 성과관리 대규모 미구현 (16건)

**6A가 프로젝트 최대 약점.** DB 모델은 있으나 UI/API가 없는 항목:

| 영역 | 미구현 항목 |
|------|-----------|
| 캘리브레이션 | 설정 페이지, 인터랙티브 9블록 매트릭스, AI 분석 |
| CFR 1:1 미팅 | 페이지/API 전무 (사이드바 dead link) |
| Recognition | 피드 페이지, 좋아요, 통계 (사이드바 dead link) |
| Pulse Survey | 설문 CRUD, 응답 폼, 익명, 대시보드, AI 분석 — 6건 전무 |
| 다면평가 360° | AI 추천, 배정, 폼, 요약 — 4건 전무 |
| 자기/매니저 평가 | 전용 평가 폼 UI 없음 |

### 2. AI 함수 5건 미구현

| 함수 | STEP |
|------|------|
| suggestEvalComment | 6A |
| calibrationAnalysis | 6A |
| generateOneOnOneNotes | 6A |
| pulseSurveyAnalysis | 6A |
| generatePeerReviewSummary | 6A |

> AiFeature enum에만 등록. 실제 로직/API 없음.

### 3. RLS (Row Level Security) 0건

PostgreSQL 레벨 행 보안 정책 미적용. multi-tenant company_id 격리가 앱 레이어에만 의존.

### 4. 사이드바 Dead Link 9건

| href | 상태 |
|------|------|
| `/performance/one-on-one` | 페이지 없음 |
| `/performance/recognition` | 페이지 없음 |
| `/performance/recognition/list` | 페이지 없음 |
| `/performance/results` | 페이지 없음 |
| `/performance/competency` | 페이지 없음 |
| `/benefits/enrollments` | 페이지 없음 |
| `/org/grades` | 페이지 없음 |
| `/settings/audit-log` | 경로 오타 (실제: audit-logs) |
| `/settings/roles` | 페이지 없음 |

---

## 🟡 Non-Critical — 차후 보완 (20건)

| # | 항목 | 비고 |
|---|------|------|
| 1 | Employee 상세 보상 이력 탭 | "coming soon" 플레이스홀더 |
| 2 | 초과근무 별도 신청/승인 | 자동 계산만 (워크플로 없음) |
| 3 | Terminal API 경로 차이 | `/terminals/clock` vs 스펙 `/attendance/terminal` |
| 4 | AI resume 함수명 | `analyzeResume` vs 스펙 `screenCandidate` |
| 5 | 사이클 상태머신 5단계 | 스펙 7단계와 차이 (기능적 충분) |
| 6 | Payroll 상태머신 명칭 | REVIEW vs REVIEWING, PROCESSING 없음 |
| 7 | AllowanceRecord 별도 API | payroll 내부 사용만 |
| 8 | 교육→성과 연계 UI | 모델 레벨 연결만 |
| 9 | 폴란드(pl) UI 언어 없음 | pt(포르투갈)로 대체 |
| 10 | API 에러 다국어 | 일부만 적용 |
| 11 | ERP/SAP/Douzone 연동 | 의도적 미구현 |
| 12 | pg_cron 주석 상태 | DB 배포 시 활성화 필요 |
| 13-20 | 기타 경미한 불일치 | 명칭/구조 차이 |

---

## 🟢 N1 진입 전 권장사항

1. **STEP 6A 보완 세션 필수** — CFR/Pulse/360°/캘리브레이션 → 최소 UI + API 구현
2. **사이드바 Dead Link 정리** — 미구현 페이지 링크 제거 또는 페이지 생성
3. **AI 함수 5건** — 구현 또는 스펙에서 제외 확정
4. **RLS** — 최소 employees/payroll 테이블에 company_id 기반 정책 추가

---

## 코드베이스 현황 (참고)

| 항목 | 수량 |
|------|------|
| Prisma 모델 | 123 |
| MV | 8 |
| 페이지 | 115 |
| API 라우트 | 294 |
| 컴포넌트 | 118 |
| AI 함수 (구현) | 9/14 |
| Cron API | 4 |
| i18n 키 | 2,638 × 7언어 |
| Git 커밋 | 61 |
| 디자인 리팩 | R1~R9 완료 (금지패턴 0건) |
