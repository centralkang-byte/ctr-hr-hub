#!/bin/bash
# 세션 시작 시 보호-해제 목록 초기화 → 매 세션 기본 '잠금' 상태로 복귀
# (지난 세션에서 /unlock-protected 한 게 남아 있지 않도록)
rm -f "${CLAUDE_PROJECT_DIR:-.}/.claude/.protected-unlock" 2>/dev/null
cat ~/Documents/Obsidian\ Vault/projects/hr-hub/STATUS.md
