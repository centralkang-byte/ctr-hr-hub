# CTR HR Hub — 기능 매뉴얼

> **목적**: 시스템이 어떤 정책으로 어떻게 작동하는지 모듈별로 정리한 비즈니스 매뉴얼.
> **대상**: 인사 담당자, 임원, 신규 입사자 (개발/QA도 참고 가능 — 각 모듈 §11 부록의 기술 메모).
> **UAT 가이드와의 차이**: UAT 가이드는 "어떻게 테스트하나", 본 매뉴얼은 "시스템이 어떻게 작동하나".

---

## 모듈 인덱스

전체 작업 계획: [`docs/plans/active/2026-05-11-feature-manuals-roadmap.md`](../plans/active/2026-05-11-feature-manuals-roadmap.md)

| # | 모듈 | 매뉴얼 | 상태 |
|---|------|--------|------|
| 1 | 휴가관리 | [leave.md](leave.md) | 🟢 SSOT (CEO 리뷰 Round 3 반영) |
| 2 | 급여 | [payroll.md](payroll.md) | 🟡 Draft v1 |
| 3 | 결재/승인 | [approval.md](approval.md) | 🟡 Draft v1 |
| 4 | 휴직 (LOA) | [loa.md](loa.md) | 🟡 Draft v1 |
| 5 | 인사관리 (Employee + Org) | [employee.md](employee.md) | 🟡 Draft v1 |
| 6 | 출퇴근 | [attendance.md](attendance.md) | 🟡 Draft v1 |
| 7 | 채용 | [recruitment.md](recruitment.md) | 🟡 Draft v1 |
| 8 | 성과평가 | [performance.md](performance.md) | 🟡 Draft v1 |
| 9 | 보상 | [compensation.md](compensation.md) | 🟡 Draft v1 |
| 10 | 온보딩/오프보딩 | [onboarding.md](onboarding.md) | 🟡 Draft v1 |
| 11 | 마스터데이터/설정 | [settings.md](settings.md) | 🟡 Draft v1 |
| 12 | 인사이트/분석 | [insights.md](insights.md) | 🟡 Draft v1 |

> **템플릿 SSOT**: [leave.md](leave.md). 모든 매뉴얼은 이 형식을 따릅니다.

---

## 표준 목차

```
1. 개요 (무엇을 다루는가 + 도입 의도 + 관련 매뉴얼 매트릭스)
2. 구성 요소 (카테고리/유형 정의)
3. 핵심 정책
4. 워크플로 (State Machine)
5. 역할별 권한
   5.1 행위 주체 매트릭스
   5.2 결재 라우팅
   5.3 데이터 가시성 (옵션)
6. 화면 안내
7. 특수 상황 처리
8. 자주 묻는 질문 (FAQ)
9. 알려진 제약
10. 추후 개선
11. 부록: 기술 메모 (HR은 건너뛰기 OK)
    11.1 데이터 모델
    11.2 핵심 함수/파일
    11.3 API 라우트
    11.4 관련 ADR / 결정 문서
    11.5 알려진 위험 코드 경로
```

비즈니스 정책 95% + 기술 메모 5% 비율. HR이 본문(§1~§10)만 읽고, 개발/QA가 §11 부록에서 코드 reference를 얻습니다.

---

## 작성 원칙

- **drift 방지**: 정책 변경 시 같은 PR에서 매뉴얼도 갱신
- **markdown 우선**: 추후 Notion/docx 변환은 별도 트랙
- **평이한 한국어**: 개발자 jargon 최소화 (HR 친화)
- **시각 자료**: 필요 시 `docs/uat/screenshots-v2/` 활용 또는 모듈별 신규 캡처
- **Cross-reference 양방향 유지**: 한 모듈이 다른 모듈을 참조하면 반대 방향도 가능한 한 backlink

---

## Resume Instructions (다음 세션에서 이어갈 때)

1. 로드맵 문서 읽기: [`docs/plans/active/2026-05-11-feature-manuals-roadmap.md`](../plans/active/2026-05-11-feature-manuals-roadmap.md)
2. 위 표에서 🟡 Draft v1 상태 모듈을 CEO 리뷰 라운드 진행
3. 표준 목차 기반으로 본문 톤·구조·FAQ·권한 매트릭스 검수
4. 라운드 반영 후 상태 🟢 SSOT로 갱신
