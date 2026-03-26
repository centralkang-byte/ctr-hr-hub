# 옵시디언 연동 강화 — 슬래시 커맨드 방식

## Context
Gemini가 제안한 옵시디언 문서화 규칙(템플릿 포함)을 프로젝트에 적용하되, CLAUDE.md가 길어지지 않도록 하고 싶음. 현재 CLAUDE.md에는 이미 옵시디언 경로/트리거 규칙이 있고, `.claude/commands/session-end.md` 슬래시 커맨드도 존재함.

## 방침
- **CLAUDE.md는 수정하지 않음** — 이미 충분한 규칙이 있음
- 템플릿은 **슬래시 커맨드 파일** 안에 넣어서, 호출 시에만 컨텍스트에 로드

## 변경 사항

### 1. `.claude/commands/session-end.md` 강화
현재 4줄짜리를 STATUS.md/세션 로그 템플릿 포함으로 확장:

```markdown
# 세션 종료 루틴

1. git log --oneline으로 이번 세션 커밋 내역 확인
2. ~/Documents/Obsidian Vault/projects/hr-hub/STATUS.md 업데이트 (아래 템플릿 참고)
3. ~/Documents/Obsidian Vault/projects/hr-hub/sessions/YYYY-MM-DD.md 생성 (아래 템플릿 참고)
4. 커밋되지 않은 변경사항 있으면 알려줘

## STATUS.md 템플릿

# CTR HR Hub — Project Status
- **마지막 업데이트:** YYYY-MM-DD HH:MM
- **현재 단계:** (예: Phase 3 — QA & 안정화)

## 완료 (Done)
- [x] 항목

## 진행 중 (In Progress)
- 현재 작업 1~2줄 요약

## 블로커 / 이슈
- 해결 안 된 문제

## 다음 할 일 (Next)
- 다음 세션에서 바로 시작할 작업

## 세션 로그 템플릿 (sessions/YYYY-MM-DD.md)

# Session: YYYY-MM-DD

## 작업 내용
- 완료한 주요 커밋/기능 요약

## 결정사항
- 이번 세션에서 내린 기술적 결정

## 블로커
- 미해결 이슈

## 다음 세션 TODO
- 이어서 할 작업
```

### 2. `.claude/commands/write-decision.md` 신규 생성
ADR(Architecture Decision Record) 작성용 슬래시 커맨드:

```markdown
# 아키텍처 결정 기록 (ADR) 작성

사용자가 언급한 기술적/아키텍처 결정사항을 아래 템플릿으로 작성하여
~/Documents/Obsidian Vault/projects/hr-hub/decisions/YYYY-MM-DD-<키워드>.md 에 저장한다.

## 템플릿

# [결정사항 제목]
- **날짜:** YYYY-MM-DD
- **상태:** 채택됨

## 배경 (Context)
- 이 결정이 필요했던 이유

## 대안 (Options)
- A: (장단점)
- B: (장단점)

## 결정 (Decision)
- 최종 선택과 이유

## 파급 효과 (Consequences)
- 긍정적 효과
- 부정적 효과 / 기술 부채
```

## 검증
- `/session-end` 실행 시 STATUS.md와 세션 로그가 템플릿대로 생성되는지 확인
- `/write-decision` 실행 시 ADR 파일이 decisions/ 폴더에 생성되는지 확인
