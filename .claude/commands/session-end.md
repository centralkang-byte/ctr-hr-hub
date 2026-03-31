# 세션 종료 루틴

1. git log --oneline으로 이번 세션 커밋 내역 확인
2. ~/Documents/Obsidian Vault/projects/hr-hub/STATUS.md 업데이트 (아래 템플릿 참고)
   - 기존 내용을 읽고, 완료 항목 이동 / 진행중 업데이트 / 남은 작업 추가
3. ~/Documents/Obsidian Vault/projects/hr-hub/sessions/YYYY-MM-DD.md 생성 (아래 템플릿 참고)
4. 커밋되지 않은 변경사항 있으면 알려줘

---

## STATUS.md 템플릿

```markdown
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
```

## 세션 로그 템플릿 (sessions/YYYY-MM-DD.md)

```markdown
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

---

> For full session wrap-up (commit + STATUS + deploy): use `/wrap-up`
