# CLAUDE.md Update — New Guidelines Addition

## Pre-Session Setup

```bash
cd /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub
cat CLAUDE.md
```

Read CLAUDE.md fully before making changes.

---

## TASK: Add 3 New Guidelines to CLAUDE.md

Find the appropriate section in CLAUDE.md (likely near coding patterns or project rules) and add the following 3 guidelines. If no suitable section exists, create a new section called `## Prompt & Agent Guidelines`.

### Addition 1: Antigravity Parallel Agents

```markdown
### Antigravity Parallel Agent Architecture
When writing prompts for multi-task work:
- Identify parallelizable segments and split into Agent 1~N
- Draw dependency graph (which Agent must finish before another starts)
- Assign per-Agent: autonomy mode (Agent-driven / Review-driven / Agent-assisted) and model recommendation
- Example: Backend APIs = parallel → UI depends on both → Export depends on UI
```

### Addition 2: DO NOT TOUCH Boundary

```markdown
### DO NOT TOUCH Boundary (Mandatory in ALL prompts)
Every prompt MUST explicitly list files/modules that are OUT OF SCOPE for modification.
Format:
\`\`\`
DO NOT modify:
- Sidebar config (src/components/layout/*)
- i18n files (messages/*.json)  
- Layout components
- prisma/seed.ts (master seed file)
- Any module not explicitly listed in this prompt's scope
\`\`\`
This prevents "well-intentioned refactoring" that breaks unrelated features.
Lesson learned: Session A (GP#3 QA) modified sidebar while adding seed data → lost entire 인사이트 section.
```

### Addition 3: Gemini Cross-Review

```markdown
### Gemini Cross-Review for Complex Prompts
Before executing complex prompts (multi-agent, API+UI+Export combined), run a review pass through Gemini to catch:
- Edge cases and runtime error traps
- Tight coupling to Prisma models (need pure function extraction?)
- Next.js App Router gotchas (binary responses, server/client boundaries)
- Error state handling gaps in UI
Reference: Session C caught 3 critical traps: pure function extraction, App Router binary response, UI error state.
```

---

## Rules

1. **DO NOT modify any other section of CLAUDE.md** — only add the new guidelines
2. Place them logically near existing coding patterns or project rules
3. Preserve all existing content exactly as-is
4. After editing, verify:

```bash
# Confirm file is valid and nothing was accidentally deleted
wc -l CLAUDE.md
git diff CLAUDE.md | head -80
npx tsc --noEmit 2>&1 | tail -5
```