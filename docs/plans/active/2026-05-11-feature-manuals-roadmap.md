# Feature Manuals Roadmap — 모듈별 매뉴얼 작성 계획

> **Date**: 2026-05-11
> **Status**: Approved (CEO 합의 완료)
> **Owner**: Sangwoo + Claude
> **Trigger**: UAT v2.0 가이드는 "어떻게 테스트하나"만 다루고 정책/의도가 빠짐 → 별도 매뉴얼 필요

---

## Goal

13개 기능 모듈에 대해 **비즈니스 정책 + 의도 + 워크플로 + 특수 상황 처리**를 문서화한 매뉴얼 세트 작성. HR 담당자/임원이 시스템을 정확히 이해하고 운영할 수 있도록 한다. 부수 효과로 개발/QA가 정책 reference로 활용 가능.

---

## Approach

### 형식 (하이브리드)

```
docs/manuals/
  ├── README.md           # 12개 모듈 인덱스
  ├── leave.md            # 휴가관리 (파일럿)
  ├── payroll.md          # 급여
  ├── approval.md         # 결재/승인
  ├── loa.md              # 휴직
  ├── employee.md         # 인사관리 (Employee + Org)
  ├── attendance.md       # 출퇴근
  ├── recruitment.md      # 채용
  ├── performance.md      # 성과평가
  ├── compensation.md     # 보상
  ├── onboarding.md       # 온보딩/오프보딩
  ├── settings.md         # 마스터데이터/설정
  └── insights.md         # 인사이트/분석
```

- **markdown 우선** — 코드와 함께 git 관리 (정책 변경 시 같은 PR에서 매뉴얼 갱신 → drift 방지)
- **모듈별 분리** — 한 번에 한 모듈씩 작성, 진행 추적 쉬움
- **추후 변환** — markdown 완성 후 Notion 마이그레이션 or docx 빌드 결정 (선택)

### 내용 깊이

- **비즈니스 정책 95%** + **기술 메모 5%** (부록으로 분리)
- HR이 본문(정책)만 읽으면 충분
- 개발/QA가 같은 문서에서 "이 정책은 어디 코드에 있나" 추적 가능

### 모듈별 표준 목차

```
1. 개요 (무엇을 다루는가 + 도입 의도)
2. 카테고리/유형 정의
3. 핵심 정책
4. 워크플로 (State Machine)
5. 역할별 권한
6. 화면 안내
7. 특수 상황 처리
8. 자주 묻는 질문 (FAQ)
9. 알려진 제약
10. 부록: 기술 메모 (HR은 건너뛰기 OK)
    - 데이터 모델
    - 핵심 함수/파일
    - 관련 ADR 링크
```

---

## Module Roadmap (우선순위 순)

| # | 모듈 | 상태 | 복잡도 | ADR 참조 |
|---|------|------|--------|---------|
| 1 | **휴가관리 (Leave)** | 🟢 **완료 (템플릿 SSOT)** | ⭐⭐⭐⭐⭐ | `2026-03-27-regulation-alignment-roadmap.md` |
| 2 | 급여 (Payroll) | ⚪ 대기 | ⭐⭐⭐⭐⭐ | TBD |
| 3 | 결재/승인 (Approval) | ⚪ 대기 | ⭐⭐⭐⭐ | `2026-03-27-A1-delegation-audit.md` |
| 4 | 휴직 (LOA) | ⚪ 대기 | ⭐⭐⭐⭐ | `2026-03-28-leave-of-absence-model.md` |
| 5 | 인사관리 (Employee + Org) | ⚪ 대기 | ⭐⭐⭐⭐ | `2026-03-27-A2-personnel-mgmt-audit.md` + `2026-03-21-entity-transfer-policy.md` + `2026-03-21-bulk-movements-design.md` |
| 6 | 출퇴근 (Attendance) | ⚪ 대기 | ⭐⭐⭐ | TBD |
| 7 | 채용 (Recruitment) | ⚪ 대기 | ⭐⭐⭐ | TBD |
| 8 | 성과평가 (Performance) | ⚪ 대기 | ⭐⭐⭐ | `2026-04-06-performance-grade-enum-fix.md` |
| 9 | 보상 (Compensation) | ⚪ 대기 | ⭐⭐⭐ | TBD |
| 10 | 온보딩/오프보딩 | ⚪ 대기 | ⭐⭐ | TBD |
| 11 | 마스터데이터/설정 (Settings) | ⚪ 대기 | ⭐⭐ | TBD |
| 12 | 인사이트/분석 (Insights) | 🟡 **Draft v1 (CEO 리뷰 전)** | ⭐⭐ | 데이터 소비 모듈 (모든 모듈 cross-ref) |

**참고**: 11개 기존 ADR + 11개 plan 문서가 `~/Documents/Obsidian Vault/projects/hr-hub/decisions/` 및 `docs/plans/active/`에 존재. 작성 시 매뉴얼별로 매핑.

---

## 1. 휴가관리 — Pilot Outline

```
1. 개요
   1.1 무엇을 다루는가 (휴가 신청/승인/잔액 관리/통계)
   1.2 도입 의도 (취업규칙/경조지침 디지털화)

2. 휴가 유형 (Leave Types)
   2.1 카테고리 6종 (연차/특별/병가/공휴/교육/기타) — UI 그룹핑 근거
   2.2 회사별 휴가 유형 (13개 법인, 219건 시드)
   2.3 한국 vs 해외 법인 차이

3. 핵심 정책
   3.1 연차 부여 방식 (Accrual)
   3.2 사용 가능 시점 (대기 기간)
   3.3 일수 계산 엔진 (반차/시간단위/주말/공휴일 처리)
   3.4 이월 규칙 (Carry-over) + 연차 갱신
   3.5 지정연차 (DesignatedLeaveDay) — Phase B3
   3.6 잔액 관리 (LeaveYearBalance 단일 SSOT)

4. 워크플로 (State Machine)
   4.1 신청 → 승인 → 사용 → 정산 흐름
   4.2 취소 시나리오 3종
   4.3 자동 알림 (D-7/D-3/D-1)

5. 역할별 권한
   5.1 직원 — 신청/조회
   5.2 팀장 — 1차 승인
   5.3 인사담당자 — 정책 관리 + 통계 대시보드
   5.4 전사관리자 — 회사별 시드 + 잔액 일괄

6. 화면 안내
   6.1 직원 — /my/leave
   6.2 팀장 — /leave/team
   6.3 인사담당자 — /leave/admin (정책/잔액/통계)
   6.4 카테고리 그룹핑 UI

7. 특수 상황 처리
   7.1 휴직 중 직원의 휴가
   7.2 퇴사 예정자의 잔여 휴가
   7.3 법인 변경자 (전입/전출)
   7.4 입사 첫 해 (Pro-rated)
   7.5 해외 법인 정책 차이

8. 자주 묻는 질문 (FAQ)
9. 알려진 제약
10. 부록: 기술 메모
```

**Source materials**:
- 코드: `src/app/(dashboard)/leave/`, `src/app/api/v1/leave/`, `src/lib/leave/`
- 시드: `prisma/seeds/` (휴가 유형 219건)
- ADR: `2026-03-27-regulation-alignment-roadmap.md`
- 시드 검증 도구: `scripts/seed-validate-phase6b.ts`

---

## Working Process (per module)

```
1. AI가 코드 + ADR + 시드 분석 → 초안 작성 (1-2시간)
2. CEO 리뷰 → 정책 의도 확인, 누락/오류 지적
3. AI 수정 → 2차 초안
4. 합의 시 main 머지 (별도 PR per module)
5. STATUS.md / roadmap 갱신
```

**산출 단위**: 1 모듈 = 1 PR. PR 제목 패턴: `docs(manual): write [모듈명] manual`.

---

## Estimated Effort

- **1개 모듈당**: AI 초안 1-2시간 + CEO 리뷰 1시간 + 수정 1시간 ≈ 3-4시간
- **전체 12개**: ~40-50시간 (다수 세션 분산)
- **마일스톤**:
  - **Phase 1 (Tier 1, 복잡도 ⭐⭐⭐⭐+)**: 휴가/급여/결재/휴직/인사관리 → 5개 모듈 ~15-20시간
  - **Phase 2 (Tier 2)**: 출퇴근/채용/성과/보상 → 4개 모듈 ~12-16시간
  - **Phase 3 (Tier 3)**: 온보딩/설정/인사이트 → 3개 모듈 ~9-12시간

---

## Decisions Pending

- [ ] 최종 산출 형식 (markdown만 vs. Notion 마이그레이션 vs. docx 빌드) — Phase 1 종료 시 결정
- [ ] 시각 자료 (스크린샷) 임베드 방식 — 기존 `docs/uat/screenshots-v2/` 활용 vs. 모듈별 신규 캡처

---

## Cross-references

- UAT 가이드: `docs/uat/UAT_가이드_v2.docx` (이 매뉴얼은 UAT 가이드와 **별개**. UAT는 "어떻게 테스트하나", 매뉴얼은 "시스템이 어떻게 작동하나")
- DESIGN.md: 디자인 시스템 (매뉴얼과 별개)
- CLAUDE.md: 코드베이스 개요 (매뉴얼은 비즈니스 정책 중심)

---

## Resume Instructions (for future sessions)

다음 세션에서 이어가려면:

1. 이 플랜 문서를 먼저 읽기 (`docs/plans/active/2026-05-11-feature-manuals-roadmap.md`)
2. **템플릿 SSOT 읽기**: [`docs/manuals/leave.md`](../../manuals/leave.md) — CEO 리뷰 Round 1-3 반영된 파일럿. 동일한 형식·톤·구조 유지
3. 위 Module Roadmap 표에서 진행 중인/대기 중인 모듈 확인
4. 각 모듈의 "Source materials" 참고하여 작성 시작
5. 매뉴얼 완료 시 표의 상태 갱신 (⚪ → 🟢 Done)
6. STATUS.md의 "Feature Manuals 진행 현황" 섹션 갱신

### leave.md에서 검증된 작성 패턴 (필수 준수)

- **본문(§1-§9) jargon 0건**: 모델명/파일경로/API경로/영문 enum/내부 작업 ID는 본문 금지
- **§10 부록에 기술 reference 일원화**: 데이터 모델 / 핵심 함수 / API 라우트 / ADR 링크 / 위험 코드 / 추후 개선
- **알려진 제약 표**: # / 항목 / 상태 + "추후 개선" 명시
- **FAQ**: 실제 발생 가능한 질문 (시스템 한계 포함)
- **Changelog**: 리뷰 라운드 기록
- **§5 권한**: 행위 주체 매트릭스(§5.1) + 결재 라우팅(§5.2) 분리
- **데이터 흐름 주의 박스**: 시드/마스터/실DB 사이 drift 가능성 명시
- **HR팀 확인 / 인사담당자** 용어 통일 (법무팀 X)
