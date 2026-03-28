# Phase B: 전체 분석 및 동시작업 가이드

> **작성자**: CTO (Claude Code AI)  
> **작성일**: 2026-03-02  
> **대상**: Sangwoo + 동료 개발자  
> **목적**: Phase B 18세션의 실행 전략, 의존성 정리, 동시작업 가능 범위 확정

---

## 1. Phase A 완료 상태 점검 — B 진입 전 확인 사항

Phase A에서 만든 토대가 Phase B 전체의 기초입니다. B1에 들어가기 전에 아래 항목을 반드시 검증하세요.

### A1 (사이드바 IA) 확인 체크리스트

- [ ] 7개 섹션(홈/나의공간/팀관리/인사운영/인재관리/인사이트/설정) 사이드바 동작
- [ ] 역할별 메뉴 가시성 (employee → 2개, manager → 4개, hr_admin → 6개, system_admin → 7개)
- [ ] comingSoon 셸 페이지 8~10개 정상 렌더링
- [ ] 메뉴 구조 JSON/config 파일 위치 확인

### A2 (Core HR 데이터 모델) 확인 체크리스트

- [ ] `employee_assignments` 테이블에 `effective_date` / `end_date` 컬럼 존재
- [ ] `employee_contracts`, `employee_compensations`, `organization_structures` 동일 패턴 적용
- [ ] `positions` / `jobs` 테이블 분리 완료 + 매핑 테이블 존재
- [ ] Matrix Org 지원: `assignment_type = 'PRIMARY' | 'SECONDARY'` 동작
- [ ] `company_process_settings` 기반 테이블 존재 (B1에서 6개로 분리 예정)
- [ ] 기존 직원 데이터 → Effective Dating 형식 마이그레이션 완료
- [ ] 핵심 쿼리(직원 목록, 조직도) Effective Dating 대응 완료

### ⚠️ A2에서 흔히 발생하는 문제

1. **`company_process_settings`가 단일 테이블로 남아있을 수 있음** → B1에서 6개로 분리해야 함
2. **기존 STEP 1~6B 쿼리가 깨져있을 수 있음** → 직원 목록/조직도만 A2에서 수정, 나머지는 B11
3. **Position 시드 데이터가 불충분** → B4(채용) 진입 전 Position 데이터 확인 필수

---

## 2. 의존성 맵 (실행 순서 기준)

```
Week 3-4:  B1 ─────→ B2
           │
Week 5-6:  ├──→ B3-1 → B3-2
           │
Week 7-8:  ├──→ B4 (A2 Position 의존)
           │
           ├──→ B5
           │
Week 9-10: ├──→ B6-1 → B6-2
           │
Week 11-13:├──→ B7-1a → B7-1b → B7-2
           │
           ├──→ B8-1 → B8-2 → B8-3
           │
Week 14-16:├──→ B9-1 → B9-2
           │
Week 17:   └──→ B10-1 → B10-2
           
Week 18:   B11 (전체 통합)
Week 19-20: C1 → C2 → C3
```

---

## 3. 동시작업 가능 매트릭스

### 🟢 완전 독립 — B1 완료 후 동시 진행 가능

B1이 완료되면 아래 세션들은 서로 의존성 없이 동시 작업 가능합니다.

| 작업자 A | 작업자 B | 충돌 위험 | 비고 |
|---------|---------|----------|------|
| **B3-1** (역량 프레임워크) | **B5** (온보딩/오프보딩) | 없음 | DB 테이블 완전 분리 |
| **B3-1** (역량 프레임워크) | **B6-1** (근태 고도화) | 없음 | 도메인 분리 |
| **B3-1** (역량 프레임워크) | **B9-1** (복리후생 인프라) | 없음 | 도메인 분리 |
| **B5** (온보딩) | **B6-1** (근태) | 없음 | 도메인 분리 |
| **B5** (온보딩) | **B9-1** (복리후생) | 없음 | 도메인 분리 |
| **B6-1** (근태) | **B9-1** (복리후생) | 없음 | 도메인 분리 |
| **B4** (채용 ATS) | **B5** (온보딩) | 낮음 | A2 Position만 공유 |
| **B4** (채용 ATS) | **B6-1** (근태) | 없음 | 도메인 분리 |
| **B7-1a** (국내 급여) | **B8-1** (조직도) | 없음 | 완전 다른 도메인 |

### 🟡 조건부 동시 — 파일 충돌 주의

| 작업자 A | 작업자 B | 충돌 파일 | 해결 방법 |
|---------|---------|----------|----------|
| **B2** (Core HR UI) | **B3-1** (역량) | 직원 프로필 페이지 | B2가 탭 구조 확정 후 B3-1이 평가 탭 연결 |
| **B3-1** | **B3-2** | 성과관리 라우트 | 순차 필수 |
| **B6-1** | **B6-2** | 근태 도메인 공유 | 순차 필수 |
| **B8-1** | **B8-2** | OrgChartCore 공유 | B8-1이 Core 분리 완료 후 B8-2 |
| **B9-1** | **B9-2** | benefit 테이블 공유 | 순차 필수 |

### 🔴 순차 필수 — 동시 불가

| 선행 | 후행 | 이유 |
|------|------|------|
| B1 | B2, B3, B5, B6, B7, B9 | 법인별 설정 테이블 + approval_flows |
| B3-1 | B3-2 | 역량 DB가 Talent Review의 기반 |
| B7-1a | B7-1b | 급여 계산 엔진이 연말정산의 기반 |
| B7-1a+1b | B7-2 | 국내 데이터가 글로벌 통합의 기반 |
| B8-1 | B8-2 | OrgChartCore 분리가 선행 |
| B8-2 | B8-3 | People Directory가 스킬 검색 UI 제공 |
| B1~B10 전체 | B11 | 통합 세션 |

---

## 4. 추천 실행 계획 (2인 기준)

### 최적 동시작업 시나리오

```
Week 3:   [A] B1 (법인 엔진)          [B] 대기 (or A2 검증/보완)
Week 4:   [A] B2 (Core HR UI)        [B] B4 (채용 ATS) ← A2 Position만 의존
Week 5:   [A] B3-1 (역량)            [B] B5 (온보딩/오프보딩)
Week 6:   [A] B3-2 (Talent Review)   [B] B6-1 (근태)
Week 7:   [A] B6-2 (휴가)            [B] B9-1 (복리후생 인프라)
Week 8:   [A] B7-1a (국내 급여)       [B] B8-1 (조직도)
Week 9:   [A] B7-1b (연말정산)        [B] B8-2 (People Directory)
Week 10:  [A] B7-2 (해외 급여)        [B] B8-3 (스킬)
Week 11:  [A] B9-2 (복리후생 신청)    [B] B10-1 (애널리틱스)
Week 12:  [A] B10-2 (CFR/배지/KPI)   [B] B11 전반부 (설정 패치)
Week 13:  [A+B] B11 후반부 (알림/i18n/검증)
```

이 계획이면 **13주(약 3개월)**로 단축 가능합니다 (솔로 18주 → 2인 13주).

---

## 5. Phase A에서 잘못됐을 수 있는 부분 — 사전 검토

### 가능성 높은 이슈들

1. **`company_process_settings` 구조 불일치**
   - A2에서 단일 JSONB 테이블로 만들었을 수 있음
   - B1에서는 6개 분리 테이블이 필요 → B1 첫 Task에서 마이그레이션

2. **Effective Dating 쿼리 미적용**
   - 직원 목록이 여전히 `WHERE department_id = ?` 방식일 수 있음
   - `employee_assignments` 조인이 필요한데 기존 쿼리가 안 바뀌었을 수 있음
   - B2에서 확인 후 수정, 나머지는 B11

3. **Position/Job 시드 데이터 부족**
   - A2에서 테이블은 만들었지만 CTR 실제 직무 시드가 비어있을 수 있음
   - B4(채용) 전에 Position 시드 확인 필수

4. **사이드바 comingSoon 셸이 라우트와 불일치**
   - A1에서 만든 셸의 경로와 B 세션에서 실제 만들 라우트가 다를 수 있음
   - 각 B 세션 시작 시 해당 셸 경로 확인 → 불일치 시 수정

5. **approval_flows 테이블 미존재**
   - A2 스코프에 포함되지 않았을 수 있음
   - B1에서 반드시 생성해야 함 (B4, B6, B9 공통 의존)

---

## 6. context.md 업데이트 규칙

모든 세션에서 아래 패턴으로 context.md를 관리합니다.

```markdown
# context.md 업데이트 규칙

## 세션 시작 시
1. context.md 읽기
2. 이전 세션 산출물 확인
3. 현재 세션 목표 기록

## 세션 종료 시 필수 업데이트 항목
- completed_sessions: 완료된 세션 추가
- db_tables_created: 이번 세션에서 생성/수정한 테이블
- components_created: 이번 세션에서 생성한 컴포넌트
- api_routes_created: 이번 세션에서 생성한 API 라우트
- known_issues: 발견된 미해결 이슈
- next_session_notes: 다음 세션 주의사항
- reusable_components: 다른 세션에서 재사용할 컴포넌트 목록

## 동시작업 시 추가 규칙
- 작업자 태그: [A] 또는 [B]로 누가 작업했는지 표시
- 공유 파일 목록: 양쪽이 수정하는 파일 명시
- 머지 순서: 어떤 브랜치를 먼저 머지할지 합의
```

---

## 7. 프롬프트 파일 네이밍 규칙

```
B1_PROMPT.md    — 법인별 커스터마이징 엔진
B2_PROMPT.md    — Core HR 고도화 UI
B3-1_PROMPT.md  — 역량 프레임워크
B3-2_PROMPT.md  — Talent Review + AI
B4_PROMPT.md    — 채용 ATS 고도화
B5_PROMPT.md    — 온보딩/오프보딩
B6-1_PROMPT.md  — 근태 고도화
B6-2_PROMPT.md  — 휴가 고도화
B7-1a_PROMPT.md — 국내 월급여
B7-1b_PROMPT.md — 연말정산
B7-2_PROMPT.md  — 해외 급여 통합
B8-1_PROMPT.md  — 조직도 고도화
B8-2_PROMPT.md  — People Directory
B8-3_PROMPT.md  — 스킬 시스템
B9-1_PROMPT.md  — 복리후생 인프라
B9-2_PROMPT.md  — 복리후생 신청/승인
B10-1_PROMPT.md — HR 애널리틱스
B10-2_PROMPT.md — CFR/배지/KPI
B11_PROMPT.md   — 통합 연동
```

각 프롬프트는 Claude Code 한 세션에 붙여넣어 즉시 실행할 수 있는 수준으로 작성됩니다.
