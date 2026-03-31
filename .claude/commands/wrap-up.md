# Session Wrap-up

Bundle command: commit → STATUS.md → deploy in one flow.
Stop and report at any step if issues occur.

## 1. Commit

1. Run `git status` to review changes
2. Show changed file list to user
3. Draft conventional commit message (feat/fix/refactor/docs)
4. `git add` + `git commit` (pre-commit hook auto-runs tsc + lint)
5. If hook fails: fix errors → retry

## 2. STATUS.md Update

Execute `/session-end` routine:
1. `git log --oneline` to review session commits
2. Update ~/Documents/Obsidian Vault/projects/hr-hub/STATUS.md
3. Create ~/Documents/Obsidian Vault/projects/hr-hub/sessions/YYYY-MM-DD.md

## 3. Vercel Deploy

1. `git push origin <current-branch>`
2. Confirm Vercel Preview deployment auto-triggers
3. Share Preview URL with user
4. If production deploy needed: confirm with user → `/deploy prod`

## Optional Steps

- Need PR: use `/ship` skill
- Skip deploy: say "skip deploy" to skip Step 3
