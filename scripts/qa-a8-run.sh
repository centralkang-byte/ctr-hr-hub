#!/bin/bash
set -eo pipefail
BASE="http://localhost:3002"
API="$BASE/api/v1"
P0=0; P1=0; P2=0
ISSUES=""

p0() { ((P0++)) || true; ISSUES+="[P0] $1"$'\n'; echo "  🔴 P0: $1"; }
p1() { ((P1++)) || true; ISSUES+="[P1] $1"$'\n'; echo "  🟡 P1: $1"; }
p2() { ((P2++)) || true; ISSUES+="[P2] $1"$'\n'; echo "  🔵 P2: $1"; }

do_login() {
  local a=$1 e=$2 jar="/tmp/qa8-${a}.txt"
  rm -f "$jar"
  curl -s -c "$jar" "$BASE/api/auth/csrf" > /dev/null
  local csrf
  csrf=$(curl -s -b "$jar" -c "$jar" "$BASE/api/auth/csrf" | python3 -c "import sys,json;print(json.load(sys.stdin)['csrfToken'])")
  curl -s -L -b "$jar" -c "$jar" -X POST "$BASE/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" -d "email=${e}&password=test1234&csrfToken=${csrf}" > /dev/null
}

api() {
  local a=$1 m=$2 p=$3; shift 3
  local jar="/tmp/qa8-${a}.txt" url="${API}${p}"
  local args=(-s -w "\nHTTP_%{http_code}" -b "$jar" --max-time 20)
  if [[ "$m" == "GET" ]]; then
    args+=(-X GET)
  elif [[ $# -gt 0 ]]; then
    args+=(-X "$m" -H "Content-Type: application/json" -d "$1")
  else
    args+=(-X "$m" -H "Content-Type: application/json" -d "{}")
  fi
  curl "${args[@]}" "$url" 2>/dev/null
}

gc() { echo "$1" | grep "^HTTP_" | sed 's/HTTP_//'; }
gb() { echo "$1" | grep -v "^HTTP_"; }
gi() { echo "$1" | grep -v "^HTTP_" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('data',{}).get('id',d.get('id','')))" 2>/dev/null; }

echo "=== AUTH ==="
do_login HK "hr@ctr.co.kr"
do_login HC "hr@ctr-cn.com"
do_login M1 "manager@ctr.co.kr"
do_login EA "employee-a@ctr.co.kr"
do_login EB "employee-b@ctr.co.kr"

# Get employee IDs from sessions
HK_EMP=$(curl -s -b /tmp/qa8-HK.txt "$BASE/api/auth/session" | python3 -c "import sys,json;print(json.load(sys.stdin).get('user',{}).get('employeeId',''))")
EA_EMP=$(curl -s -b /tmp/qa8-EA.txt "$BASE/api/auth/session" | python3 -c "import sys,json;print(json.load(sys.stdin).get('user',{}).get('employeeId',''))")
EB_EMP=$(curl -s -b /tmp/qa8-EB.txt "$BASE/api/auth/session" | python3 -c "import sys,json;print(json.load(sys.stdin).get('user',{}).get('employeeId',''))")
KR_CO=$(curl -s -b /tmp/qa8-HK.txt "$BASE/api/auth/session" | python3 -c "import sys,json;print(json.load(sys.stdin).get('user',{}).get('companyId',''))")
CN_CO=$(curl -s -b /tmp/qa8-HC.txt "$BASE/api/auth/session" | python3 -c "import sys,json;print(json.load(sys.stdin).get('user',{}).get('companyId',''))")

echo "HK=$HK_EMP EA=$EA_EMP EB=$EB_EMP KR=$KR_CO CN=$CN_CO"

echo ""
echo "=== PHASE 1: ONBOARDING TEMPLATES ==="

R=$(api HK GET "/onboarding/templates"); echo "[1-1] GET templates: $(gc "$R")"

R=$(api HK POST "/onboarding/templates" '{"name":"QA-A8 온보딩","description":"QA","targetType":"NEW_HIRE"}')
C=$(gc "$R"); TMPL=$(gi "$R"); echo "[1-2] POST template: $C ($TMPL)"

R=$(api HK GET "/onboarding/templates/$TMPL"); echo "[1-3] GET detail: $(gc "$R")"
R=$(api HK PUT "/onboarding/templates/$TMPL" '{"name":"QA-A8 v2"}'); echo "[1-4] PUT update: $(gc "$R")"

R=$(api HK POST "/onboarding/templates/$TMPL/tasks" '{"title":"사원증","assigneeType":"HR","dueDaysAfter":1,"isRequired":true,"category":"DOCUMENT"}')
T1=$(gi "$R"); echo "[1-5a] task HR: $(gc "$R") ($T1)"

R=$(api HK POST "/onboarding/templates/$TMPL/tasks" '{"title":"보안교육","assigneeType":"EMPLOYEE","dueDaysAfter":7,"isRequired":true,"category":"TRAINING"}')
T2=$(gi "$R"); echo "[1-5b] task EMP: $(gc "$R") ($T2)"

R=$(api HK POST "/onboarding/templates/$TMPL/tasks" '{"title":"팀장면담","assigneeType":"MANAGER","dueDaysAfter":3,"isRequired":true,"category":"INTRODUCTION"}')
T3=$(gi "$R"); echo "[1-5c] task MGR: $(gc "$R") ($T3)"

R=$(api HK GET "/onboarding/templates/$TMPL/tasks"); echo "[1-6] GET tasks: $(gc "$R")"
R=$(api HK PUT "/onboarding/templates/$TMPL/tasks/reorder" "{\"taskIds\":[\"$T3\",\"$T1\",\"$T2\"]}"); echo "[1-7] PUT reorder: $(gc "$R")"

R=$(api HK POST "/onboarding/templates" '{"name":"DEL","targetType":"NEW_HIRE"}'); DEL=$(gi "$R")
R=$(api HK DELETE "/onboarding/templates/$DEL"); echo "[1-8] DELETE: $(gc "$R")"

R=$(api EA POST "/onboarding/templates" '{"name":"x","targetType":"NEW_HIRE"}')
C=$(gc "$R"); echo "[1-9] RBAC EA POST: $C (expect 403)"
[[ "$C" != "403" ]] && p0 "EMPLOYEE can create template ($C)"

echo ""
echo "=== PHASE 2: ONBOARDING INSTANCES ==="
R=$(api HK GET "/onboarding/instances"); C=$(gc "$R"); echo "[2-1] GET instances: $C"
INST1=$(gb "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);its=d.get('data',d.get('items',[]));print(its[0]['id'] if its else '')" 2>/dev/null)
echo "  Instance: ${INST1:-NONE}"

if [[ -n "$INST1" ]]; then
  R=$(api HK GET "/onboarding/instances/$INST1"); echo "[2-2] GET detail: $(gc "$R")"
  R=$(api HK GET "/onboarding/instances/$INST1/sign-off-summary"); echo "[2-3] sign-off summary: $(gc "$R")"

  # Get first pending task
  FT=$(gb "$(api HK GET "/onboarding/instances/$INST1")" | python3 -c "
import sys,json
d=json.load(sys.stdin).get('data',{})
for tasks in d.get('milestoneGroups',{}).values():
    for t in tasks:
        if t.get('status')=='PENDING':
            print(t['id']); exit()
print('')
" 2>/dev/null)

  echo ""
  echo "=== PHASE 3: TASKS ==="
  if [[ -n "$FT" ]]; then
    R=$(api HK PUT "/onboarding/instances/$INST1/tasks/$FT/status" '{"status":"IN_PROGRESS"}'); echo "[3-1] status IN_PROGRESS: $(gc "$R")"
    R=$(api HK POST "/onboarding/instances/$INST1/tasks/$FT/block" '{"reason":"블록 테스트"}'); echo "[3-2] block: $(gc "$R")"
    R=$(api HK POST "/onboarding/instances/$INST1/tasks/$FT/unblock" '{}'); echo "[3-3] unblock: $(gc "$R")"
  else
    echo "  No pending tasks"
  fi
else
  echo "  No instances — task tests skipped"
fi

echo ""
echo "=== PHASE 4: CHECKINS ==="
R=$(api HK GET "/onboarding/checkins"); echo "[4-1] GET checkins: $(gc "$R")"
R=$(api EA POST "/onboarding/checkin" '{"checkinWeek":2,"mood":"GOOD","energy":4,"belonging":3}')
C=$(gc "$R"); echo "[4-2] POST checkin EA: $C"
[[ "$C" == "403" ]] && p0 "EMPLOYEE cannot submit checkin"
R=$(api HK GET "/onboarding/checkins/$EA_EMP"); echo "[4-3] GET EA checkins: $(gc "$R")"
R=$(api EA GET "/onboarding/checkins/$EA_EMP"); echo "[4-4] RBAC EA own: $(gc "$R")"

echo ""
echo "=== PHASE 5: DASHBOARD + ME ==="
R=$(api HK GET "/onboarding/dashboard"); echo "[5-1] dashboard: $(gc "$R")"
R=$(api EA GET "/onboarding/me"); C=$(gc "$R"); echo "[5-2] /me EA: $C"
[[ "$C" == "403" ]] && p0 "/onboarding/me blocked for EMPLOYEE"
R=$(api EA GET "/onboarding/dashboard"); echo "[5-3] RBAC EA dash: $(gc "$R") (403?)"
R=$(api EA GET "/onboarding/instances"); echo "[5-4] RBAC EA inst: $(gc "$R") (403?)"

echo ""
echo "=== PHASE 6: OFFBOARDING CHECKLISTS ==="
R=$(api HK GET "/offboarding/checklists"); echo "[6-1] GET: $(gc "$R")"
R=$(api HK POST "/offboarding/checklists" '{"name":"QA-A8 퇴직","targetType":"VOLUNTARY"}')
C=$(gc "$R"); CL=$(gi "$R"); echo "[6-2] POST: $C ($CL)"
R=$(api HK GET "/offboarding/checklists/$CL"); echo "[6-3] detail: $(gc "$R")"
R=$(api HK PUT "/offboarding/checklists/$CL" '{"name":"QA-A8 v2"}'); echo "[6-4] PUT: $(gc "$R")"

R=$(api HK POST "/offboarding/checklists/$CL/tasks" '{"title":"사원증반납","assigneeType":"HR","dueDaysBefore":7,"isRequired":true}')
echo "[6-5a] task HR: $(gc "$R")"
R=$(api HK POST "/offboarding/checklists/$CL/tasks" '{"title":"인수인계","assigneeType":"EMPLOYEE","dueDaysBefore":14,"isRequired":true}')
echo "[6-5b] task EMP: $(gc "$R")"
R=$(api HK GET "/offboarding/checklists/$CL/tasks"); echo "[6-6] GET tasks: $(gc "$R")"

R=$(api HK POST "/offboarding/checklists" '{"name":"DEL","targetType":"VOLUNTARY"}'); D2=$(gi "$R")
R=$(api HK DELETE "/offboarding/checklists/$D2"); echo "[6-7] DELETE: $(gc "$R")"

echo ""
echo "=== PHASE 7: OFFBOARDING INSTANCES ==="
R=$(api HK GET "/offboarding/instances"); C=$(gc "$R"); echo "[7-1] GET: $C"
OFF1=$(gb "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);its=d.get('data',[]);print(next((i['id'] for i in its if i.get('status')=='IN_PROGRESS'),''))" 2>/dev/null)
echo "  Offboarding: ${OFF1:-NONE}"
if [[ -n "$OFF1" ]]; then
  R=$(api HK GET "/offboarding/instances/$OFF1"); echo "[7-2] detail: $(gc "$R")"
fi

echo ""
echo "=== PHASE 8: EXIT INTERVIEW ==="
if [[ -n "$OFF1" ]]; then
  R=$(api HK POST "/offboarding/$OFF1/exit-interview" "{\"interviewDate\":\"2026-03-18T10:00:00Z\",\"primaryReason\":\"CAREER_GROWTH\",\"satisfactionScore\":3,\"feedbackText\":\"QA test feedback\",\"wouldRecommend\":true}")
  C=$(gc "$R"); echo "[8-1] POST interview: $C"
  R=$(api HK GET "/offboarding/$OFF1/exit-interview"); echo "[8-2] GET interview: $(gc "$R")"
  R=$(api EA GET "/offboarding/$OFF1/exit-interview"); echo "[8-5] RBAC EA: $(gc "$R") (403?)"
fi
R=$(api HK GET "/offboarding/exit-interviews/statistics"); echo "[8-4] statistics: $(gc "$R")"

echo ""
echo "=== PHASE 9: OFFBOARDING DASHBOARD + ME ==="
R=$(api HK GET "/offboarding/dashboard"); echo "[9-1] dashboard: $(gc "$R")"
R=$(api EB GET "/offboarding/me"); C=$(gc "$R"); echo "[9-2] /me EB: $C"
[[ "$C" == "403" ]] && p0 "/offboarding/me blocked for EMPLOYEE"
R=$(api EA GET "/offboarding/me"); echo "[9-3] /me EA: $(gc "$R")"
R=$(api EA GET "/offboarding/dashboard"); echo "[9-4] RBAC EA dash: $(gc "$R") (403?)"
R=$(api EA GET "/offboarding/instances"); echo "[9-5] RBAC EA inst: $(gc "$R") (403?)"

echo ""
echo "=== PHASE 10: CROSSBOARDING ==="
R=$(api HK POST "/onboarding/crossboarding" "{\"employeeId\":\"$EA_EMP\",\"fromCompanyId\":\"$KR_CO\",\"toCompanyId\":\"$CN_CO\",\"transferDate\":\"2026-07-01\"}")
C=$(gc "$R"); echo "[10-1] POST crossboard: $C"
echo "  $(gb "$R" | head -c 200)"

R=$(api EA POST "/onboarding/crossboarding" "{\"employeeId\":\"$EA_EMP\",\"fromCompanyId\":\"$KR_CO\",\"toCompanyId\":\"$CN_CO\",\"transferDate\":\"2026-07-01\"}")
C=$(gc "$R"); echo "[10-2] RBAC EA: $C (403?)"
[[ "$C" != "403" ]] && p0 "EMPLOYEE crossboarding ($C)"

R=$(api HK POST "/onboarding/crossboarding" "{\"employeeId\":\"$EA_EMP\",\"fromCompanyId\":\"$KR_CO\",\"toCompanyId\":\"$CN_CO\",\"transferDate\":\"2026-07-01\"}")
echo "[10-3] Dup: $(gc "$R") (409?)"

echo ""
echo "=========================================="
echo "SUMMARY: P0=$P0 P1=$P1 P2=$P2"
echo "$ISSUES"
echo "=========================================="
