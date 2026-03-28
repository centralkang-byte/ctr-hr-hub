#!/bin/bash
# ═══════════════════════════════════════════════════════════
# CTR HR Hub — Pre-commit Hook
# tsc + lint 자동 실행, 실패 시 커밋 차단
# ═══════════════════════════════════════════════════════════

echo "=== Pre-commit: Type Check ==="
npx tsc --noEmit 2>&1 | tail -5
TSC_EXIT=$?

echo ""
echo "=== Pre-commit: Lint ==="
npm run lint 2>&1 | tail -5
LINT_EXIT=$?

echo ""
if [ $TSC_EXIT -ne 0 ] || [ $LINT_EXIT -ne 0 ]; then
  echo "❌ tsc 또는 lint 에러가 있습니다. 수정 후 커밋하세요."
  exit 1
fi

echo "✅ Pre-commit 검증 통과"
