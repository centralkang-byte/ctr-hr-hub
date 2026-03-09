# CTR HR Hub — Claude Code 세션 프롬프트 템플릿

---

## 기본 세션 시작 블록 (매 세션 상단에 붙여넣기)

```
아래 파일들을 먼저 읽어:

1. CLAUDE.md               — 디자인 토큰 + 프로젝트 스펙
2. CTR_UI_PATTERNS.md      — UI/UX 인터랙션 패턴
3. context/SHARED.md       — 현재 개발 상태 + DB 스키마

## 산출물 저장 위치
- 계획서/설계서: ctr-hr-hub/docs/plans/
- 컨텍스트 파일: ctr-hr-hub/context/
- md 파일은 HR_Hub/ 루트에 저장하지 말 것
```

---

## Phase B 기능 구현 세션

```
[세션명] 기능을 구현해줘.

## 사전 준비
CLAUDE.md, CTR_UI_PATTERNS.md, context/SHARED.md 읽기

## 기술 스택
- Next.js 14 App Router
- Tailwind CSS (CLAUDE.md 토큰 기준)
- Prisma ORM (raw SQL 금지)
- Supabase (auth + storage)
- lucide-react 아이콘
- Pretendard 폰트

## 구현 범위
1. [기능 1] — [설명]
2. [기능 2] — [설명]

## 제약사항
- 시드 데이터: 6개 법인 구조 반영 (CTR-KR, CN, RU, US, VN, MX)
- 한국어 UI
- FLEX/Workday 스타일 (CLAUDE.md DO/DON'T 준수)

## 세션 종료 시
context/SHARED.md (또는 TRACK_A/B.md)에 아래 항목 업데이트:
- 생성한 DB 테이블
- 생성한 컴포넌트
- 생성한 API 라우트
- 알려진 이슈
- 다음 세션 주의사항
```

---

## 디자인 리팩토링 세션 (C1~C3)

```
[화면명] 디자인을 FLEX Green 스타일로 리팩토링해줘.

## 사전 준비
CLAUDE.md, CTR_UI_PATTERNS.md 읽기

## 리팩토링 기준
- primary: #00C853 / primary-dark: #00A844
- 카드: rounded-xl border border-[#E8E8E8] (shadow 없음)
- 테이블 헤더: text-[#999] bg-transparent
- 뱃지: 연한 배경 + 진한 텍스트 (CLAUDE.md 상태 뱃지 참조)
- 버튼: 단색 (그라데이션 금지)
- Pretendard 폰트, 한국어 제목 tracking-[-0.02em]

## 대상 파일
- [파일 경로 1]
- [파일 경로 2]

## 주의
- 기능 로직은 건드리지 말 것
- 디자인 토큰만 교체
- 기존 Tailwind 클래스 → CLAUDE.md 기준으로 교체
```

---

## QA / 검증 세션

```
[모듈명] QA를 진행해줘.

## 체크리스트
- [ ] 6개 법인 데이터 정상 표시
- [ ] 역할별 접근 제어 (EMPLOYEE/MANAGER/HR_ADMIN/SUPER_ADMIN)
- [ ] 한국어 UI 누락 없음
- [ ] 52시간 준수 로직 (CTR-KR 해당 시)
- [ ] 빌드 에러 없음 (npm run build)
- [ ] TypeScript 에러 없음
- [ ] 승인 워크플로 정상 동작

## 발견 이슈
context/SHARED.md known_issues 섹션에 기록
```

---

## 병렬 개발 세션 (Track A/B)

```
[Track A 또는 B] — [세션명] 작업을 시작해.

## 컨텍스트 파일 읽기 순서
cat context/SHARED.md
cat context/TRACK_A.md
cat context/TRACK_B.md

## 규칙
- 쓰기는 TRACK_[A 또는 B].md만
- Prisma migrate 이름: [a 또는 b]_{모듈코드}_{설명}
  예) npx prisma migrate dev --name a_b2_core_hr_ui
- schema.prisma 내 자기 트랙 영역에만 모델 추가
  // === TRACK [A/B]: [모듈명] === 주석으로 구간 표시

## 세션 종료 시
TRACK_[A/B].md 하단에 결과 추가
```

---

## 빠른 버그픽스 세션

```
[버그 설명]을 수정해줘.

## 컨텍스트
- 발생 위치: [파일 경로]
- 증상: [설명]
- 예상 원인: [설명]

## 제약
- 최소한의 수정만
- 관련 없는 리팩토링 하지 말 것
- 수정 후 해당 기능 동작 확인
```
