#!/bin/bash
# ═══════════════════════════════════════════════════════════
# CTR HR Hub — Protected-file edit guard (PreToolUse: Edit|Write)
# ───────────────────────────────────────────────────────────
# 동결(frozen) IA + `// PROTECTED` 헤더 파일의 편집을 기본 차단한다.
# 목적은 "영원히 금지"가 아니라, 무관한 작업 중 곁다리/우발 수정을
# 막는 것 (과거 Sidebar 파괴 사고 가드). 의도적 수정은 그 세션 한정으로
# `/unlock-protected <path>` 하면 통과한다 (다음 세션 자동 재잠금).
#
# 정책:
#   - DENY 는 "보호 대상임이 확실"할 때만 (positive match).
#   - 그 외 모든 경우(파싱 실패·jq 부재·대상 외)는 fail-OPEN(exit 0) —
#     글리치 하나로 세션 전체 편집이 막히지 않도록.
# ═══════════════════════════════════════════════════════════
set -u

INPUT="$(cat)"

# --- stdin JSON 파싱 (실패 시 fail-open) ---
command -v jq >/dev/null 2>&1 || exit 0
FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"
CWD="$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)"
[ -z "$FILE_PATH" ] && exit 0   # 편집 대상 파일 없음 → 관여 안 함

# --- repo-relative 경로로 정규화 ---
REL="$FILE_PATH"
if [ -n "$CWD" ]; then
  case "$REL" in
    "$CWD"/*) REL="${REL#"$CWD"/}" ;;
  esac
fi
REL="${REL#./}"

# --- 생성물·의존성은 가드 대상 아님 (prisma가 재생성) ---
case "$REL" in
  src/generated/*|*/node_modules/*) exit 0 ;;
esac

# --- 보호 대상 판정 ---
PROTECTED=0
# (a) 헤더를 못 다는 동결 대상 + migrations — 명시 목록
case "$REL" in
  src/components/layout/Sidebar.tsx)      PROTECTED=1 ;;
  src/components/layout/MobileDrawer.tsx) PROTECTED=1 ;;
  src/config/navigation.ts)               PROTECTED=1 ;;
  prisma/migrations/*)                    PROTECTED=1 ;;
esac
# (b) 기존 파일 첫 15줄에 `// PROTECTED` 헤더가 있으면 보호 (SSOT)
if [ "$PROTECTED" -eq 0 ] && [ -f "$FILE_PATH" ]; then
  if head -n 15 "$FILE_PATH" 2>/dev/null | grep -q "// PROTECTED"; then
    PROTECTED=1
  fi
fi

[ "$PROTECTED" -eq 0 ] && exit 0   # 보호 대상 아님 → 통과

# --- 보호 대상: 이번 세션에 해제됐나? ---
UNLOCK_FILE="${CWD:-.}/.claude/.protected-unlock"
if [ -f "$UNLOCK_FILE" ]; then
  while IFS= read -r pattern; do
    [ -z "$pattern" ] && continue
    case "$pattern" in \#*) continue ;; esac          # 주석 줄 무시
    case "$REL" in
      "$pattern"|"$pattern"/*) exit 0 ;;              # 해제됨 → 통과
    esac
  done < "$UNLOCK_FILE"
fi

# --- 보호 대상 & 미해제 → 차단 (exit 2: stderr 가 Claude 에게 전달됨) ---
cat >&2 <<EOF
🔒 보호 파일 수정 차단: ${REL}

이 파일은 동결(frozen) 또는 // PROTECTED 대상입니다 (과거 Sidebar 파괴 사고 가드).
무관한 작업 중 곁다리 수정을 막기 위한 가드레일이며, '영원히 금지'가 아닙니다.

이 수정이 '이번 세션의 실제 과제'라면 해제 후 진행하세요:
  /unlock-protected ${REL}

해제는 이번 세션에만 유효하고, 다음 세션은 자동으로 다시 잠깁니다.
(전체 즉시 재잠금: /lock-protected)
EOF
exit 2
