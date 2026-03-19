#!/bin/bash
PROJECT_ROOT="${1:-.}"
OUT="crud-inventory.md"
echo "# CTR HR Hub — CRUD Inventory" > "$OUT"
echo "Generated: $(date '+%Y-%m-%d %H:%M')" >> "$OUT"
echo "" >> "$OUT"
echo "## 1. API Routes" >> "$OUT"
echo '| Route | GET | POST | PUT | PATCH | DELETE | Module |' >> "$OUT"
echo '|-------|-----|------|-----|-------|--------|--------|' >> "$OUT"
find "$PROJECT_ROOT/src/app/api" -name "route.ts" | sort | while read f; do
    REL=$(echo "$f" | sed "s|$PROJECT_ROOT/src/app/||" | sed 's|/route.ts||')
    MODULE=$(echo "$REL" | sed 's|api/v1/||' | cut -d'/' -f1)
    G=$(grep -qE 'export.*(async )?function GET|export.*GET' "$f" && echo "✅" || echo "-")
    P=$(grep -qE 'export.*(async )?function POST|export.*POST' "$f" && echo "✅" || echo "-")
    U=$(grep -qE 'export.*(async )?function PUT|export.*PUT' "$f" && echo "✅" || echo "-")
    PA=$(grep -qE 'export.*(async )?function PATCH|export.*PATCH' "$f" && echo "✅" || echo "-")
    D=$(grep -qE 'export.*(async )?function DELETE|export.*DELETE' "$f" && echo "✅" || echo "-")
    echo "| \`$REL\` | $G | $P | $U | $PA | $D | $MODULE |" >> "$OUT"
done
echo "" >> "$OUT"
echo "## 2. Module Summary" >> "$OUT"
echo '| Module | Routes | GET | POST | PUT/PATCH | DELETE |' >> "$OUT"
echo '|--------|--------|-----|------|-----------|--------|' >> "$OUT"
find "$PROJECT_ROOT/src/app/api/v1" -maxdepth 1 -type d | sort | while read d; do
    MOD=$(basename "$d")
    [ "$MOD" = "v1" ] && continue
    TOTAL=$(find "$d" -name "route.ts" | wc -l | tr -d ' ')
    GETS=$(find "$d" -name "route.ts" -exec grep -lE 'export.*(async )?function GET|export.*GET' {} \; | wc -l | tr -d ' ')
    POSTS=$(find "$d" -name "route.ts" -exec grep -lE 'export.*(async )?function POST|export.*POST' {} \; | wc -l | tr -d ' ')
    PUTS=$(find "$d" -name "route.ts" -exec grep -lE 'export.*(async )?function (PUT|PATCH)|export.*(PUT|PATCH)' {} \; | wc -l | tr -d ' ')
    DELS=$(find "$d" -name "route.ts" -exec grep -lE 'export.*(async )?function DELETE|export.*DELETE' {} \; | wc -l | tr -d ' ')
    echo "| $MOD | $TOTAL | $GETS | $POSTS | $PUTS | $DELS |" >> "$OUT"
done
echo "" >> "$OUT"
echo "## 3. UI Pages" >> "$OUT"
find "$PROJECT_ROOT/src/app/(dashboard)" -name "page.tsx" 2>/dev/null | sort | while read f; do
    REL=$(echo "$f" | sed "s|$PROJECT_ROOT/src/app/(dashboard)/||" | sed 's|/page.tsx||')
    echo "- \`/$REL\`" >> "$OUT"
done
echo "" >> "$OUT"
echo "## 4. Settings Tabs" >> "$OUT"
find "$PROJECT_ROOT/src/app/(dashboard)/settings" -name "page.tsx" 2>/dev/null | sort | while read f; do
    REL=$(echo "$f" | sed "s|$PROJECT_ROOT/src/app/(dashboard)/||" | sed 's|/page.tsx||')
    echo "- \`/$REL\`" >> "$OUT"
done
echo "" >> "$OUT"
echo "## 5. Totals" >> "$OUT"
TOTAL_API=$(find "$PROJECT_ROOT/src/app/api" -name "route.ts" | wc -l | tr -d ' ')
TOTAL_PAGES=$(find "$PROJECT_ROOT/src/app/(dashboard)" -name "page.tsx" 2>/dev/null | wc -l | tr -d ' ')
echo "- API Routes: $TOTAL_API" >> "$OUT"
echo "- UI Pages: $TOTAL_PAGES" >> "$OUT"
echo "✅ Done → $OUT (API: $TOTAL_API, Pages: $TOTAL_PAGES)"
