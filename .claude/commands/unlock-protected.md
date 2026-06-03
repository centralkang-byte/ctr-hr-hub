---
description: 동결/PROTECTED 파일을 이번 세션에 한해 편집 허용 (다음 세션 자동 재잠금)
---

`$ARGUMENTS` 경로(파일 또는 디렉터리)를 이번 세션의 보호-해제 목록에 추가하세요.

`$ARGUMENTS`가 비어 있으면 중단하고 사용법을 안내하세요: `/unlock-protected <repo-relative-path>` (예: `/unlock-protected src/components/layout`).

비어 있지 않으면 정확히 아래를 실행하세요:

```bash
mkdir -p .claude
printf '%s\n' "$ARGUMENTS" >> .claude/.protected-unlock
sort -u .claude/.protected-unlock -o .claude/.protected-unlock
echo "🔓 이번 세션 해제됨: $ARGUMENTS"
echo "--- 현재 해제 목록 ---"
cat .claude/.protected-unlock
```

그 다음 사용자에게: ① 이제 편집 가능한 보호 경로, ② 다음 세션 시작 시 자동 재잠금됨(즉시 재잠금은 `/lock-protected`)을 한국어로 간단히 알리세요.
