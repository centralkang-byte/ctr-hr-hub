#!/bin/bash
# scripts/qa/run-all.sh
# Q-0 Screenshot Capture — 순서대로 실행
#
# 사전 조건:
#   1. npm run dev 실행 중 (localhost:3000)
#   2. npx playwright install chromium 완료
#   3. node_modules 권한 정상 (sudo chown -R $(id -u):$(id -g) ~/.npm)
#
# 실행: bash scripts/qa/run-all.sh

set -e

CWD="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$CWD"

echo "====================================================="
echo "  Q-0 Screenshot Capture"
echo "  CWD: $CWD"
echo "====================================================="
echo ""

# Step 1: 역할별 테스트 이메일 조회 (선택 — DB 권한 있을 때)
echo "🔍 Step 1: Querying test emails..."
if npx tsx scripts/qa/get-test-emails.ts 2>/dev/null; then
  echo "  ✅ test-emails.json 생성 완료"
else
  echo "  ⚠️  DB 조회 실패 — 기본 이메일 사용 (capture script 내 하드코딩값)"
fi

echo ""

# Step 2: 동적 라우트 ID 조회
echo "🔗 Step 2: Building dynamic URLs..."
if npx tsx scripts/qa/build-dynamic-urls.ts 2>/dev/null; then
  echo "  ✅ dynamic-urls.json 생성 완료"
else
  echo "  ⚠️  dynamic-urls.json 생성 실패 — 정적 URL만 사용"
fi

echo ""

# Step 3: 스크린샷 캡처
echo "📸 Step 3: Starting screenshot capture..."
echo "  (dev server must be running on localhost:3000)"
echo ""
npx tsx scripts/qa/capture-screenshots.ts

echo ""
echo "====================================================="
echo "✅ 완료! 결과:"
echo "   스크린샷: scripts/qa/screenshots/"
echo "   결과 JSON: scripts/qa/layer1-2-results.json"
echo "====================================================="

# 검증
SCREENSHOT_COUNT=$(ls scripts/qa/screenshots/*.png 2>/dev/null | wc -l | tr -d ' ')
echo "   캡처된 PNG: ${SCREENSHOT_COUNT}개"
