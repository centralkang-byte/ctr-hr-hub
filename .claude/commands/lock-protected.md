---
description: 모든 보호 파일을 즉시 다시 잠금 (이번 세션 해제 목록 비우기)
---

이번 세션의 보호-해제 목록을 비워, 동결/PROTECTED 파일을 즉시 다시 잠그세요.

정확히 아래를 실행하세요:

```bash
rm -f .claude/.protected-unlock && echo "🔒 모든 보호 파일이 다시 잠겼습니다."
```
