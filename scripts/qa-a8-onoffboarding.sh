#!/bin/bash
# ═══════════════════════════════════════════════════════════
# QF-RUN-A8: Onboarding + Offboarding + Crossboarding QA
# ═══════════════════════════════════════════════════════════
set -euo pipefail

BASE_URL="http://localhost:3000"
API="${BASE_URL}/api/v1"

function login_as() {
  local alias=$1 email=$2
  local jar="/tmp/qa-a8-${alias}.txt"
  rm -f "$jar"
  local csrf_resp
  csrf_resp=$(curl -s -c "$jar" "${BASE_URL}/api/auth/csrf" 2>/dev/null)
  local csrf
  csrf=$(echo "$csrf_resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('csrfToken',''))" 2>/dev/null)
  curl -s -L -b "$jar" -c "$jar" \
    -X POST "${BASE_URL}/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=${email}&password=test1234&csrfToken=${csrf}" > /dev/null 2>&1
  local check
  check=$(curl -s -b "$jar" "${BASE_URL}/api/auth/session" 2>/dev/null)
  local user_email
  user_email=$(echo "$check" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user',{}).get('email',''))" 2>/dev/null)
  if [[ "$user_email" == "$email" ]]; then
    echo "[AUTH] $alias = $email OK"
  else
    echo "[AUTH] $alias = $email FAIL (got: $user_email)"
  fi
}

function api() {
  local alias=$1 method=$2 path=$3
  shift 3
  local jar="/tmp/qa-a8-${alias}.txt"
  local url="${API}${path}"
  local args=(-s -w "\n%{http_code}" -b "$jar")
  if [[ "$method" == "GET" ]]; then
    args+=(-X GET)
  elif [[ $# -gt 0 ]]; then
    args+=(-X "$method" -H "Content-Type: application/json" -d "$1")
  else
    args+=(-X "$method" -H "Content-Type: application/json")
  fi
  curl "${args[@]}" "$url" 2>/dev/null
}

function code() { echo "$1" | tail -1; }
function body() { echo "$1" | sed '$d'; }

echo "=== AUTH ==="
login_as HK "hr@ctr.co.kr"
login_as HC "hr@ctr-cn.com"
login_as M1 "manager@ctr.co.kr"
login_as EA "employee-a@ctr.co.kr"
login_as EB "employee-b@ctr.co.kr"

echo ""
echo "=== PHASE 1: ONBOARDING TEMPLATES ==="

R=$(api HK GET "/onboarding/templates")
echo "[1-1] GET templates: $(code "$R")"

R=$(api HK POST "/onboarding/templates" '{"name":"CTR-KR QA온보딩","description":"QA테스트","targetType":"NEW_HIRE"}')
C=$(code "$R"); B=$(body "$R")
echo "[1-2] POST template: $C"
TMPL_ID=$(echo "$B" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',d.get('id','')))" 2>/dev/null)
echo "  TMPL=$TMPL_ID"

R=$(api HK GET "/onboarding/templates/${TMPL_ID}")
echo "[1-3] GET detail: $(code "$R")"

R=$(api HK PUT "/onboarding/templates/${TMPL_ID}" '{"name":"CTR-KR QA온보딩 v2"}')
echo "[1-4] PUT update: $(code "$R")"

R=$(api HK POST "/onboarding/templates/${TMPL_ID}/tasks" '{"title":"사원증발급","assigneeType":"HR","dueDaysAfter":1,"isRequired":true,"category":"DOCUMENT"}')
C=$(code "$R"); B=$(body "$R")
echo "[1-5a] POST task HR: $C"
T1=$(echo "$B" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',d.get('id','')))" 2>/dev/null)

R=$(api HK POST "/onboarding/templates/${TMPL_ID}/tasks" '{"title":"보안교육","assigneeType":"EMPLOYEE","dueDaysAfter":7,"isRequired":true,"category":"TRAINING"}')
C=$(code "$R"); B=$(body "$R")
echo "[1-5b] POST task EMP: $C"
T2=$(echo "$B" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',d.get('id','')))" 2>/dev/null)

R=$(api HK POST "/onboarding/templates/${TMPL_ID}/tasks" '{"title":"팀장면담","assigneeType":"MANAGER","dueDaysAfter":3,"isRequired":true,"category":"INTRODUCTION"}')
C=$(code "$R"); B=$(body "$R")
echo "[1-5c] POST task MGR: $C"
T3=$(echo "$B" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',d.get('id','')))" 2>/dev/null)

R=$(api HK GET "/onboarding/templates/${TMPL_ID}/tasks")
echo "[1-6] GET tasks: $(code "$R")"

R=$(api HK PUT "/onboarding/templates/${TMPL_ID}/tasks/reorder" "{\"taskIds\":[\"${T3}\",\"${T1}\",\"${T2}\"]}")
echo "[1-7] PUT reorder: $(code "$R")"

R=$(api HK POST "/onboarding/templates" '{"name":"DEL","targetType":"NEW_HIRE"}')
DEL=$(echo "$(body "$R")" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',d.get('id','')))" 2>/dev/null)
R=$(api HK DELETE "/onboarding/templates/${DEL}")
echo "[1-8] DELETE: $(code "$R")"

R=$(api EA POST "/onboarding/templates" '{"name":"x","targetType":"NEW_HIRE"}')
echo "[1-9] RBAC EA POST tmpl: $(code "$R") (expect 403)"

echo ""
echo "=== PHASE 2-5: ONBOARDING INSTANCES/TASKS/CHECKINS/DASHBOARD ==="
echo "Creating instances via seed script..."
