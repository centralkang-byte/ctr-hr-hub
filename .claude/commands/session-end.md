# 세션 종료 루틴

1. git log --oneline으로 이번 세션 커밋 내역 확인
2. ~/Documents/Obsidian Vault/projects/hr-hub/STATUS.md 업데이트 (아래 템플릿) — **슬림 유지 (~수 KB)**
   - STATUS는 "현재 상태"만: 최우선 · In-flight · 블로커 · 상시 함정 · 최근 세션 포인터
   - "최근 세션"에 이번 세션 **1~2줄 포인터만** 추가 (상세는 sessions/), **5개 초과분 삭제** (전문은 `STATUS-archive.md` + sessions/에 보존)
   - ⛔ **dense 블록 prepend 금지** — 576KB 비대의 원인이었음 (S248 슬림화). 한 세션이 STATUS를 수십 줄로 불리면 안 됨.
3. ~/Documents/Obsidian Vault/projects/hr-hub/sessions/YYYY-MM-DD-sessionNNN.md 생성 (아래 템플릿) — **세션 상세는 전부 여기에**
4. 커밋되지 않은 변경사항 있으면 알려줘

---

## STATUS.md 템플릿 (슬림 — 이 골격 유지)

```markdown
# CTR HR Hub — Project Status
> SSOT = "지금 상태"만. 상세 → sessions/, 결정 → decisions/, 이전 전문 → STATUS-archive.md.
> Last updated: YYYY-MM-DD (Session NNN)

## 🎯 현재 최우선
- 지금 가장 중요한 1~2개 (+ 메모리/세션 포인터)

## 🔀 In-flight (PR / 브랜치)
- OPEN PR · 작업 브랜치 (한 줄씩)

## 🧩 핵심 블로커 · 빚
- dogfood/릴리스 차단 항목

## ⚠️ 상시 함정
- [[메모리]] 링크들

## 🗓️ 최근 세션 (상세 = sessions/) — 최근 5개만
- **SNNN** 한 줄 요약 → [[sessions/YYYY-MM-DD-sessionNNN]]
```

## 세션 로그 템플릿 (sessions/YYYY-MM-DD-sessionNNN.md)

```markdown
# Session NNN — <한 줄 제목>

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
