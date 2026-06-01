# QA 데이터 정합성 스윕 결과 (Layer 1)

> 실행: 2026-05-17T01:24:00.255Z · 활성 법인 12개
> 위반: **HIGH 0 / MED 7 / LOW 12**

| 심각도 | 체크 | 법인 | 엔티티 | 상세 |
|---|---|---|---|---|
| MED | A-빈필수 | CTR-CN | 호칭(EmployeeTitle) | 호칭(EmployeeTitle) 0건 — 등록 비차단(자동완성 보조). 해외법인은 설계상 추후정의 |
| MED | A-빈필수 | CTR-EU | 호칭(EmployeeTitle) | 호칭(EmployeeTitle) 0건 — 등록 비차단(자동완성 보조). 해외법인은 설계상 추후정의 |
| MED | A-빈필수 | CTR-RU | 호칭(EmployeeTitle) | 호칭(EmployeeTitle) 0건 — 등록 비차단(자동완성 보조). 해외법인은 설계상 추후정의 |
| MED | A-빈필수 | CTR-US | 호칭(EmployeeTitle) | 호칭(EmployeeTitle) 0건 — 등록 비차단(자동완성 보조). 해외법인은 설계상 추후정의 |
| MED | A-빈필수 | CTR-VN | 호칭(EmployeeTitle) | 호칭(EmployeeTitle) 0건 — 등록 비차단(자동완성 보조). 해외법인은 설계상 추후정의 |
| MED | B-중복 | CTR | 직책/직위(Position) | 중복 2건 (companyId=1e59e67c-1e59-4e59-a1e5-1e59e67c0000, titleKo=대표이사) → 드롭다운에 같은 값 2개 노출 |
| MED | B-중복 | CTR | 직책/직위(Position) | 중복 2건 (companyId=1e59e67c-1e59-4e59-a1e5-1e59e67c0000, titleKo=생산기술팀원) → 드롭다운에 같은 값 2개 노출 |
| LOW | C-매핑커버리지 | CTR | GradeTitleMapping | JobGrade 있으나 매핑 0 — 직급 선택은 정상(JobGrade 직접 소스), 호칭 자동완성만 비활성 |
| LOW | C-매핑커버리지 | CTR-CN | GradeTitleMapping | JobGrade 있으나 매핑 0 — 직급 선택은 정상(JobGrade 직접 소스), 호칭 자동완성만 비활성 |
| LOW | C-매핑커버리지 | CTR-ECO | GradeTitleMapping | JobGrade 있으나 매핑 0 — 직급 선택은 정상(JobGrade 직접 소스), 호칭 자동완성만 비활성 |
| LOW | C-매핑커버리지 | CTR-ENR | GradeTitleMapping | JobGrade 있으나 매핑 0 — 직급 선택은 정상(JobGrade 직접 소스), 호칭 자동완성만 비활성 |
| LOW | C-매핑커버리지 | CTR-EU | GradeTitleMapping | JobGrade 있으나 매핑 0 — 직급 선택은 정상(JobGrade 직접 소스), 호칭 자동완성만 비활성 |
| LOW | C-매핑커버리지 | CTR-FML | GradeTitleMapping | JobGrade 있으나 매핑 0 — 직급 선택은 정상(JobGrade 직접 소스), 호칭 자동완성만 비활성 |
| LOW | C-매핑커버리지 | CTR-HOLD | GradeTitleMapping | JobGrade 있으나 매핑 0 — 직급 선택은 정상(JobGrade 직접 소스), 호칭 자동완성만 비활성 |
| LOW | C-매핑커버리지 | CTR-MOB | GradeTitleMapping | JobGrade 있으나 매핑 0 — 직급 선택은 정상(JobGrade 직접 소스), 호칭 자동완성만 비활성 |
| LOW | C-매핑커버리지 | CTR-ROB | GradeTitleMapping | JobGrade 있으나 매핑 0 — 직급 선택은 정상(JobGrade 직접 소스), 호칭 자동완성만 비활성 |
| LOW | C-매핑커버리지 | CTR-RU | GradeTitleMapping | JobGrade 있으나 매핑 0 — 직급 선택은 정상(JobGrade 직접 소스), 호칭 자동완성만 비활성 |
| LOW | C-매핑커버리지 | CTR-US | GradeTitleMapping | JobGrade 있으나 매핑 0 — 직급 선택은 정상(JobGrade 직접 소스), 호칭 자동완성만 비활성 |
| LOW | C-매핑커버리지 | CTR-VN | GradeTitleMapping | JobGrade 있으나 매핑 0 — 직급 선택은 정상(JobGrade 직접 소스), 호칭 자동완성만 비활성 |
