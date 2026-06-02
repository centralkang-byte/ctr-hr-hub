#!/bin/bash
# ═══════════════════════════════════════════════════════════
# CTR HR Hub — Pre-commit Hook
# tsc + lint 자동 실행, 실패 시 커밋 차단
# ═══════════════════════════════════════════════════════════

# 파이프(| tail) 종료코드 마스킹 방지 — 없으면 $?가 tail(항상 0)을 받아
# tsc/lint 실패에도 게이트가 항상 통과함
set -o pipefail

echo "=== Pre-commit: Type Check ==="
npx tsc --noEmit 2>&1 | tail -5
TSC_EXIT=${PIPESTATUS[0]}

echo ""
echo "=== Pre-commit: Lint ==="
npm run lint 2>&1 | tail -5
LINT_EXIT=${PIPESTATUS[0]}

echo ""
if [ $TSC_EXIT -ne 0 ] || [ $LINT_EXIT -ne 0 ]; then
  echo "❌ tsc 또는 lint 에러가 있습니다. 수정 후 커밋하세요."
  exit 1
fi

echo "✅ Pre-commit 검증 통과"
