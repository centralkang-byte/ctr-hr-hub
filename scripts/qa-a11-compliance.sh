#!/bin/bash
set -euo pipefail

BASE_URL="http://localhost:3002/api/v1"
PSQL="/opt/homebrew/Cellar/postgresql@17/17.9/bin/psql"
DB_URL="postgresql://sangwoo@localhost:5432/ctr_hr_hub"

# ── IDs ──
EA_EMP_ID="14a0ccad-14a0-44a0-a14a-14a0ccad0000"  # employee-a@ctr.co.kr 이민준
HK_EMP_ID="7d3b45b2-7d3b-4d3b-a7d3-7d3b45b20000"  # hr@ctr.co.kr 한지영
HC_EMP_ID="2a25efcf-2a25-4a25-a2a2-2a25efcf0000"  # hr@ctr-cn.com 陈美玲
SA_EMP_ID="316c2de8-316c-416c-a316-316c2de80000"  # super@ctr.co.kr 최상우

KR_COMPANY_ID="0033fa50-0033-4033-a003-0033fa500000"  # CTR-KR
CN_COMPANY_ID="0033f954-0033-4033-a003-0033f9540000"  # CTR-CN
RU_COMPANY_ID="0033fb2c-0033-4033-a003-0033fb2c0000"  # CTR-RU

# ── Auth helper ──
function login_as() {
  local alias=$1 email=$2
  local cookie_file="/tmp/qa-cookie-${alias}.txt"

  # Get CSRF token
  local csrf_resp
  csrf_resp=$(curl -s -c "$cookie_file" "${BASE_URL}/../auth/csrf" 2>/dev/null) || true
  local csrf_token=$(echo "$csrf_resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('csrfToken',''))" 2>/dev/null) || true

  if [[ -n "$csrf_token" ]]; then
    curl -s -w "\n%{http_code}" -b "$cookie_file" -c "$cookie_file" \
      -X POST "${BASE_URL}/../auth/callback/credentials" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "email=${email}&password=test1234&csrfToken=${csrf_token}" \
      -L -o /dev/null 2>/dev/null
    echo "[AUTH] $alias logged in ($email)"
  else
    echo "[AUTH] ❌ $alias CSRF failed"
    return 1
  fi
}

function api() {
  local alias=$1 method=$2 path=$3
  shift 3
  local payload_file="${1:-}"
  local cookie_file="/tmp/qa-cookie-${alias}.txt"
  local curl_args=(-s -w "\n---HTTP_CODE:%{http_code}---" -b "$cookie_file")

  if [[ "$method" == "GET" ]]; then
    curl_args+=(-X GET)
  elif [[ -n "$payload_file" && -f "$payload_file" ]]; then
    curl_args+=(-X "$method" -H "Content-Type: application/json" -d @"$payload_file")
  else
    curl_args+=(-X "$method" -H "Content-Type: application/json")
  fi

  curl "${curl_args[@]}" "${BASE_URL}${path}" 2>/dev/null
}

function extract_code() {
  echo "$1" | grep -oE 'HTTP_CODE:[0-9]+' | tail -1 | grep -oE '[0-9]+' || echo "000"
}
function extract_body() {
  echo "$1" | sed 's/---HTTP_CODE:[0-9]*---$//'
}

# ── Login all accounts ──
echo "═══ AUTH ═══"
login_as SA "super@ctr.co.kr"
login_as HK "hr@ctr.co.kr"
login_as HC "hr@ctr-cn.com"
login_as EA "employee-a@ctr.co.kr"

echo ""
echo "═══ PHASE 1: KR COMPLIANCE ═══"

# 1-1. GET work-hours
R=$(api HK GET "/compliance/kr/work-hours")
echo "[1-1] GET work-hours: $(extract_code "$R")"
echo "  body: $(extract_body "$R" | head -c 200)"

# 1-2. GET work-hours employees
R=$(api HK GET "/compliance/kr/work-hours/employees")
echo "[1-2] GET work-hours/employees: $(extract_code "$R")"

# 1-3. GET work-hours alerts
R=$(api HK GET "/compliance/kr/work-hours/alerts")
echo "[1-3] GET work-hours/alerts: $(extract_code "$R")"

# 1-4. GET mandatory-training
R=$(api HK GET "/compliance/kr/mandatory-training")
echo "[1-4] GET mandatory-training: $(extract_code "$R")"

# 1-5. POST mandatory-training
cat <<EOFP > /tmp/qa-payload.json
{
  "name": "직장 내 성희롱 예방교육",
  "description": "연 1회 필수 이수 교육",
  "frequency": "ANNUAL",
  "dueDate": "2026-12-31",
  "targetRoles": ["ALL"],
  "companyId": "${KR_COMPANY_ID}"
}
EOFP
R=$(api HK POST "/compliance/kr/mandatory-training" /tmp/qa-payload.json)
C=$(extract_code "$R")
B=$(extract_body "$R")
echo "[1-5] POST mandatory-training: $C"
echo "  body: $(echo "$B" | head -c 300)"
MT_ID=$(echo "$B" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id', d.get('id','')))" 2>/dev/null || echo "")
if [[ -z "$MT_ID" ]]; then
  MT_ID=$($PSQL "$DB_URL" -tAc "SELECT id FROM mandatory_training_configs ORDER BY created_at DESC LIMIT 1;" 2>/dev/null || echo "")
fi
echo "  MT_ID=$MT_ID"

# 1-6. PUT mandatory-training
if [[ -n "$MT_ID" ]]; then
  echo '{"dueDate":"2026-11-30"}' > /tmp/qa-payload.json
  R=$(api HK PUT "/compliance/kr/mandatory-training/${MT_ID}" /tmp/qa-payload.json)
  echo "[1-6] PUT mandatory-training/$MT_ID: $(extract_code "$R")"
else
  echo "[1-6] SKIP (no MT_ID)"
fi

# 1-7. GET mandatory-training/status
R=$(api HK GET "/compliance/kr/mandatory-training/status")
echo "[1-7] GET mandatory-training/status: $(extract_code "$R")"

# 1-8. GET severance-interim
R=$(api HK GET "/compliance/kr/severance-interim")
echo "[1-8] GET severance-interim: $(extract_code "$R")"

# 1-9. POST severance-interim
cat <<EOFP > /tmp/qa-payload.json
{
  "employeeId": "${EA_EMP_ID}",
  "reason": "주택 구입 자금",
  "requestAmount": 10000000,
  "requestDate": "2026-04-01"
}
EOFP
R=$(api HK POST "/compliance/kr/severance-interim" /tmp/qa-payload.json)
C=$(extract_code "$R")
B=$(extract_body "$R")
echo "[1-9] POST severance-interim: $C"
echo "  body: $(echo "$B" | head -c 300)"
SEV_ID=$(echo "$B" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id', d.get('id','')))" 2>/dev/null || echo "")
if [[ -z "$SEV_ID" ]]; then
  SEV_ID=$($PSQL "$DB_URL" -tAc "SELECT id FROM severance_interim_payments ORDER BY created_at DESC LIMIT 1;" 2>/dev/null || echo "")
fi
echo "  SEV_ID=$SEV_ID"

# 1-10. GET severance-interim/{id}
if [[ -n "$SEV_ID" ]]; then
  R=$(api HK GET "/compliance/kr/severance-interim/${SEV_ID}")
  echo "[1-10] GET severance-interim/$SEV_ID: $(extract_code "$R")"

  # 1-11. PUT severance-interim/{id}
  echo '{"status":"APPROVED","approvedAmount":8000000}' > /tmp/qa-payload.json
  R=$(api HK PUT "/compliance/kr/severance-interim/${SEV_ID}" /tmp/qa-payload.json)
  echo "[1-11] PUT severance-interim/$SEV_ID: $(extract_code "$R")"
else
  echo "[1-10] SKIP (no SEV_ID)"
  echo "[1-11] SKIP (no SEV_ID)"
fi

# 1-12. GET severance-interim/calculate
R=$(api HK GET "/compliance/kr/severance-interim/calculate?employeeId=${EA_EMP_ID}")
echo "[1-12] GET severance-interim/calculate: $(extract_code "$R")"
echo "  body: $(extract_body "$R" | head -c 200)"

# 1-13. RBAC: EA should NOT access KR compliance
R=$(api EA GET "/compliance/kr/work-hours")
echo "[1-13] RBAC: EA→work-hours: $(extract_code "$R") (expect 403)"

echo ""
echo "═══ PHASE 2: CN COMPLIANCE ═══"

# 2-1. GET social-insurance/config
R=$(api HC GET "/compliance/cn/social-insurance/config")
echo "[2-1] GET cn/social-insurance/config: $(extract_code "$R")"

# 2-2. POST social-insurance/config
cat <<EOFP > /tmp/qa-payload.json
{
  "city": "上海",
  "year": 2026,
  "pensionRate": 8.0,
  "medicalRate": 2.0,
  "unemploymentRate": 0.5,
  "housingFundRate": 7.0,
  "companyId": "${CN_COMPANY_ID}"
}
EOFP
R=$(api HC POST "/compliance/cn/social-insurance/config" /tmp/qa-payload.json)
C=$(extract_code "$R")
B=$(extract_body "$R")
echo "[2-2] POST cn/social-insurance/config: $C"
echo "  body: $(echo "$B" | head -c 300)"
SI_ID=$(echo "$B" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id', d.get('id','')))" 2>/dev/null || echo "")
echo "  SI_ID=$SI_ID"

# 2-3. PUT social-insurance/config/{id}
if [[ -n "$SI_ID" ]]; then
  echo '{"pensionRate":8.5}' > /tmp/qa-payload.json
  R=$(api HC PUT "/compliance/cn/social-insurance/config/${SI_ID}" /tmp/qa-payload.json)
  echo "[2-3] PUT cn/social-insurance/config: $(extract_code "$R")"
else
  echo "[2-3] SKIP (no SI_ID)"
fi

# 2-4. POST social-insurance/calculate
cat <<EOFP > /tmp/qa-payload.json
{
  "companyId": "${CN_COMPANY_ID}",
  "yearMonth": "2026-03"
}
EOFP
R=$(api HC POST "/compliance/cn/social-insurance/calculate" /tmp/qa-payload.json)
echo "[2-4] POST cn/social-insurance/calculate: $(extract_code "$R")"
echo "  body: $(extract_body "$R" | head -c 200)"

# 2-5. GET social-insurance/records
R=$(api HC GET "/compliance/cn/social-insurance/records?companyId=${CN_COMPANY_ID}")
echo "[2-5] GET cn/social-insurance/records: $(extract_code "$R")"

# 2-6. GET social-insurance/export
R=$(curl -s -w "\n---HTTP_CODE:%{http_code}---" -b "/tmp/qa-cookie-HC.txt" \
  -o /tmp/cn-insurance-export.xlsx \
  "${BASE_URL}/compliance/cn/social-insurance/export?companyId=${CN_COMPANY_ID}" 2>/dev/null)
echo "[2-6] GET cn/social-insurance/export: $(echo "$R" | grep -oE 'HTTP_CODE:[0-9]+' | tail -1 | grep -oE '[0-9]+' || echo 000)"

# 2-7. GET cn/employee-registry/export
R=$(curl -s -w "\n---HTTP_CODE:%{http_code}---" -b "/tmp/qa-cookie-HC.txt" \
  -o /tmp/cn-registry-export.xlsx \
  "${BASE_URL}/compliance/cn/employee-registry/export?companyId=${CN_COMPANY_ID}" 2>/dev/null)
echo "[2-7] GET cn/employee-registry/export: $(echo "$R" | grep -oE 'HTTP_CODE:[0-9]+' | tail -1 | grep -oE '[0-9]+' || echo 000)"

# 2-8. RBAC: HK should not access CN
R=$(api HK GET "/compliance/cn/social-insurance/config")
echo "[2-8] RBAC: HK→CN config: $(extract_code "$R") (note: may be 200 filtered)"

echo ""
echo "═══ PHASE 3: RU COMPLIANCE ═══"

# 3-1. GET kedo
R=$(api HK GET "/compliance/ru/kedo")
echo "[3-1] GET ru/kedo: $(extract_code "$R")"
echo "  body: $(extract_body "$R" | head -c 200)"

# 3-2. POST kedo
cat <<EOFP > /tmp/qa-payload.json
{
  "type": "EMPLOYMENT_CONTRACT",
  "title": "Трудовой договор тест",
  "employeeId": "${EA_EMP_ID}",
  "companyId": "${RU_COMPANY_ID}",
  "content": "Employment contract for test"
}
EOFP
R=$(api HK POST "/compliance/ru/kedo" /tmp/qa-payload.json)
C=$(extract_code "$R")
B=$(extract_body "$R")
echo "[3-2] POST ru/kedo: $C"
echo "  body: $(echo "$B" | head -c 300)"
KEDO_ID=$(echo "$B" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id', d.get('id','')))" 2>/dev/null || echo "")
echo "  KEDO_ID=$KEDO_ID"

if [[ -n "$KEDO_ID" ]]; then
  # 3-3. GET kedo/{id}
  R=$(api HK GET "/compliance/ru/kedo/${KEDO_ID}")
  echo "[3-3] GET ru/kedo/$KEDO_ID: $(extract_code "$R")"

  # 3-4. PUT kedo/{id}
  echo '{"status":"PENDING_SIGNATURE"}' > /tmp/qa-payload.json
  R=$(api HK PUT "/compliance/ru/kedo/${KEDO_ID}" /tmp/qa-payload.json)
  echo "[3-4] PUT ru/kedo: $(extract_code "$R")"

  # 3-5. POST kedo/{id}/sign
  R=$(api HK POST "/compliance/ru/kedo/${KEDO_ID}/sign")
  echo "[3-5] POST ru/kedo/sign: $(extract_code "$R")"
  echo "  body: $(extract_body "$R" | head -c 200)"
else
  echo "[3-3] SKIP (no KEDO_ID)"
  echo "[3-4] SKIP"
  echo "[3-5] SKIP"
fi

# 3-6. POST kedo reject (create new doc for reject)
cat <<EOFP > /tmp/qa-payload.json
{
  "type": "VACATION_ORDER",
  "title": "Rejection test doc",
  "employeeId": "${EA_EMP_ID}",
  "companyId": "${RU_COMPANY_ID}",
  "content": "Test for rejection"
}
EOFP
R=$(api HK POST "/compliance/ru/kedo" /tmp/qa-payload.json)
KEDO2_ID=$(extract_body "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id', d.get('id','')))" 2>/dev/null || echo "")
if [[ -n "$KEDO2_ID" ]]; then
  echo '{"reason":"서류 오류"}' > /tmp/qa-payload.json
  R=$(api HK POST "/compliance/ru/kedo/${KEDO2_ID}/reject" /tmp/qa-payload.json)
  echo "[3-6] POST ru/kedo/reject: $(extract_code "$R")"
else
  echo "[3-6] SKIP (no KEDO2_ID)"
fi

# 3-7. GET military
R=$(api HK GET "/compliance/ru/military")
echo "[3-7] GET ru/military: $(extract_code "$R")"

# 3-8. POST military
cat <<EOFP > /tmp/qa-payload.json
{
  "employeeId": "${EA_EMP_ID}",
  "category": "RESERVIST",
  "rank": "SOLDIER",
  "militarySpecialty": "Engineering",
  "registrationOffice": "Moscow District"
}
EOFP
R=$(api HK POST "/compliance/ru/military" /tmp/qa-payload.json)
echo "[3-8] POST ru/military: $(extract_code "$R")"
echo "  body: $(extract_body "$R" | head -c 200)"

# 3-9. GET military/{employeeId}
R=$(api HK GET "/compliance/ru/military/${EA_EMP_ID}")
echo "[3-9] GET ru/military/$EA_EMP_ID: $(extract_code "$R")"

# 3-10. PUT military/{employeeId}
echo '{"rank":"CORPORAL"}' > /tmp/qa-payload.json
R=$(api HK PUT "/compliance/ru/military/${EA_EMP_ID}" /tmp/qa-payload.json)
echo "[3-10] PUT ru/military: $(extract_code "$R")"

# 3-11. GET military/export/t2
R=$(curl -s -w "\n---HTTP_CODE:%{http_code}---" -b "/tmp/qa-cookie-HK.txt" \
  -o /tmp/ru-t2-export.xlsx \
  "${BASE_URL}/compliance/ru/military/export/t2" 2>/dev/null)
echo "[3-11] GET ru/military/export/t2: $(echo "$R" | grep -oE 'HTTP_CODE:[0-9]+' | tail -1 | grep -oE '[0-9]+' || echo 000)"

# 3-12. GET reports/57t
R=$(api HK GET "/compliance/ru/reports/57t")
echo "[3-12] GET ru/reports/57t: $(extract_code "$R")"

# 3-13. GET reports/p4
R=$(api HK GET "/compliance/ru/reports/p4")
echo "[3-13] GET ru/reports/p4: $(extract_code "$R")"

echo ""
echo "═══ PHASE 4: GDPR ═══"

# 4-1. GET consents
R=$(api SA GET "/compliance/gdpr/consents")
echo "[4-1] GET gdpr/consents: $(extract_code "$R")"

# 4-2. POST consents
cat <<EOFP > /tmp/qa-payload.json
{
  "employeeId": "${EA_EMP_ID}",
  "purpose": "EMPLOYMENT_PROCESSING",
  "consentedAt": "2026-01-01T00:00:00Z",
  "expiresAt": "2027-01-01T00:00:00Z"
}
EOFP
R=$(api SA POST "/compliance/gdpr/consents" /tmp/qa-payload.json)
C=$(extract_code "$R")
B=$(extract_body "$R")
echo "[4-2] POST gdpr/consents: $C"
echo "  body: $(echo "$B" | head -c 300)"
CONSENT_ID=$(echo "$B" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id', d.get('id','')))" 2>/dev/null || echo "")
echo "  CONSENT_ID=$CONSENT_ID"

# 4-3. POST consent revoke
if [[ -n "$CONSENT_ID" ]]; then
  R=$(api SA POST "/compliance/gdpr/consents/${CONSENT_ID}/revoke")
  echo "[4-3] POST gdpr/consent/revoke: $(extract_code "$R")"
else
  echo "[4-3] SKIP (no CONSENT_ID)"
fi

# 4-4. GET dpia
R=$(api SA GET "/compliance/gdpr/dpia")
echo "[4-4] GET gdpr/dpia: $(extract_code "$R")"

# 4-5. POST dpia
cat <<EOFP > /tmp/qa-payload.json
{
  "title": "HR Hub PII 처리 영향평가",
  "description": "직원 개인정보 처리에 대한 DPIA",
  "status": "DPIA_DRAFT",
  "riskLevel": "MEDIUM",
  "dataCategories": ["PERSONAL", "FINANCIAL", "HEALTH"],
  "processingPurpose": "HR management and payroll"
}
EOFP
R=$(api SA POST "/compliance/gdpr/dpia" /tmp/qa-payload.json)
C=$(extract_code "$R")
B=$(extract_body "$R")
echo "[4-5] POST gdpr/dpia: $C"
echo "  body: $(echo "$B" | head -c 300)"
DPIA_ID=$(echo "$B" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id', d.get('id','')))" 2>/dev/null || echo "")
echo "  DPIA_ID=$DPIA_ID"

if [[ -n "$DPIA_ID" ]]; then
  # 4-6. GET dpia/{id}
  R=$(api SA GET "/compliance/gdpr/dpia/${DPIA_ID}")
  echo "[4-6] GET gdpr/dpia/$DPIA_ID: $(extract_code "$R")"

  # 4-7. PUT dpia/{id}
  echo '{"status":"APPROVED","riskLevel":"LOW"}' > /tmp/qa-payload.json
  R=$(api SA PUT "/compliance/gdpr/dpia/${DPIA_ID}" /tmp/qa-payload.json)
  echo "[4-7] PUT gdpr/dpia: $(extract_code "$R")"
else
  echo "[4-6] SKIP"
  echo "[4-7] SKIP"
fi

# 4-8. GET pii-access
R=$(api SA GET "/compliance/gdpr/pii-access")
echo "[4-8] GET gdpr/pii-access: $(extract_code "$R")"

# 4-9. GET pii-access/dashboard
R=$(api SA GET "/compliance/gdpr/pii-access/dashboard")
echo "[4-9] GET gdpr/pii-access/dashboard: $(extract_code "$R")"

# 4-10. GET requests
R=$(api SA GET "/compliance/gdpr/requests")
echo "[4-10] GET gdpr/requests: $(extract_code "$R")"

# 4-11. POST requests
cat <<EOFP > /tmp/qa-payload.json
{
  "employeeId": "${EA_EMP_ID}",
  "type": "ACCESS",
  "description": "본인 개인정보 열람 요청",
  "deadline": "2026-04-15"
}
EOFP
R=$(api SA POST "/compliance/gdpr/requests" /tmp/qa-payload.json)
C=$(extract_code "$R")
B=$(extract_body "$R")
echo "[4-11] POST gdpr/requests: $C"
echo "  body: $(echo "$B" | head -c 300)"
REQ_ID=$(echo "$B" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id', d.get('id','')))" 2>/dev/null || echo "")
echo "  REQ_ID=$REQ_ID"

if [[ -n "$REQ_ID" ]]; then
  # 4-12. GET requests/{id}
  R=$(api SA GET "/compliance/gdpr/requests/${REQ_ID}")
  echo "[4-12] GET gdpr/requests/$REQ_ID: $(extract_code "$R")"

  # 4-13. PUT requests/{id}
  echo '{"status":"COMPLETED","response":"모든 개인정보 열람 제공 완료"}' > /tmp/qa-payload.json
  R=$(api SA PUT "/compliance/gdpr/requests/${REQ_ID}" /tmp/qa-payload.json)
  echo "[4-13] PUT gdpr/requests: $(extract_code "$R")"
else
  echo "[4-12] SKIP"
  echo "[4-13] SKIP"
fi

# 4-14. GET retention
R=$(api SA GET "/compliance/gdpr/retention")
echo "[4-14] GET gdpr/retention: $(extract_code "$R")"

# 4-15. POST retention
cat <<EOFP > /tmp/qa-payload.json
{
  "dataCategory": "EMPLOYEE_RECORDS",
  "retentionPeriodMonths": 36,
  "description": "퇴직 후 3년 보관",
  "legalBasis": "근로기준법 제42조"
}
EOFP
R=$(api SA POST "/compliance/gdpr/retention" /tmp/qa-payload.json)
C=$(extract_code "$R")
B=$(extract_body "$R")
echo "[4-15] POST gdpr/retention: $C"
echo "  body: $(echo "$B" | head -c 300)"
RET_ID=$(echo "$B" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id', d.get('id','')))" 2>/dev/null || echo "")
echo "  RET_ID=$RET_ID"

if [[ -n "$RET_ID" ]]; then
  # 4-16. PUT retention/{id}
  echo '{"retentionPeriodMonths":60}' > /tmp/qa-payload.json
  R=$(api SA PUT "/compliance/gdpr/retention/${RET_ID}" /tmp/qa-payload.json)
  echo "[4-16] PUT gdpr/retention: $(extract_code "$R")"
else
  echo "[4-16] SKIP"
fi

# 4-17. POST retention/run
R=$(api SA POST "/compliance/gdpr/retention/run")
echo "[4-17] POST gdpr/retention/run: $(extract_code "$R")"

# 4-18. GET cron/retention
R=$(api SA GET "/compliance/cron/retention")
echo "[4-18] GET cron/retention: $(extract_code "$R")"

# RBAC: EA should NOT access GDPR
R=$(api EA GET "/compliance/gdpr/consents")
echo "[4-19] RBAC: EA→consents: $(extract_code "$R") (expect 403)"
R=$(api EA GET "/compliance/gdpr/pii-access/dashboard")
echo "[4-20] RBAC: EA→PII dashboard: $(extract_code "$R") (expect 403)"

echo ""
echo "═══ PHASE 5: YEAR-END SETTLEMENT ═══"

# 5-1. GET settlements (EA self-service)
R=$(api EA GET "/year-end/settlements")
C=$(extract_code "$R")
echo "[5-1] GET year-end/settlements (EA): $C"
echo "  body: $(extract_body "$R" | head -c 200)"

# 5-2. POST settlement
cat <<EOFP > /tmp/qa-payload.json
{
  "year": 2025,
  "type": "YEAR_END"
}
EOFP
R=$(api EA POST "/year-end/settlements" /tmp/qa-payload.json)
C=$(extract_code "$R")
B=$(extract_body "$R")
echo "[5-2] POST year-end/settlements: $C"
echo "  body: $(echo "$B" | head -c 300)"
SETTLE_ID=$(echo "$B" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id', d.get('id','')))" 2>/dev/null || echo "")
if [[ -z "$SETTLE_ID" ]]; then
  SETTLE_ID=$($PSQL "$DB_URL" -tAc "SELECT id FROM year_end_settlements WHERE employee_id='$EA_EMP_ID' ORDER BY created_at DESC LIMIT 1;" 2>/dev/null | tr -d ' ' || echo "")
fi
echo "  SETTLE_ID=$SETTLE_ID"

if [[ -n "$SETTLE_ID" ]]; then
  # 5-3. GET settlement detail
  R=$(api EA GET "/year-end/settlements/${SETTLE_ID}")
  echo "[5-3] GET year-end/settlements/$SETTLE_ID: $(extract_code "$R")"

  # 5-4. PUT settlement
  echo '{"notes":"2025년 연말정산 시작"}' > /tmp/qa-payload.json
  R=$(api EA PUT "/year-end/settlements/${SETTLE_ID}" /tmp/qa-payload.json)
  echo "[5-4] PUT year-end/settlements: $(extract_code "$R")"

  # 5-5. GET deductions
  R=$(api EA GET "/year-end/settlements/${SETTLE_ID}/deductions")
  echo "[5-5] GET deductions: $(extract_code "$R")"

  # 5-6. PUT deductions
  cat <<EOFP > /tmp/qa-payload.json
{
  "nationalPension": 4320000,
  "healthInsurance": 3600000,
  "employmentInsurance": 960000,
  "housingFund": 12000000,
  "donationAmount": 500000,
  "medicalExpense": 2000000
}
EOFP
  R=$(api EA PUT "/year-end/settlements/${SETTLE_ID}/deductions" /tmp/qa-payload.json)
  echo "[5-6] PUT deductions: $(extract_code "$R")"

  # 5-7. GET dependents
  R=$(api EA GET "/year-end/settlements/${SETTLE_ID}/dependents")
  echo "[5-7] GET dependents: $(extract_code "$R")"

  # 5-8. PUT dependents
  cat <<EOFP > /tmp/qa-payload.json
{
  "dependents": [
    {"name": "이영수", "relationship": "PARENT", "residentId": "500101-1******", "disabled": false},
    {"name": "김미경", "relationship": "SPOUSE", "residentId": "880303-2******", "disabled": false}
  ]
}
EOFP
  R=$(api EA PUT "/year-end/settlements/${SETTLE_ID}/dependents" /tmp/qa-payload.json)
  echo "[5-8] PUT dependents: $(extract_code "$R")"

  # 5-9. POST documents
  cat <<EOFP > /tmp/qa-payload.json
{
  "type": "MEDICAL_RECEIPT",
  "name": "의료비 영수증",
  "url": "https://storage.example.com/docs/medical-receipt-2025.pdf"
}
EOFP
  R=$(api EA POST "/year-end/settlements/${SETTLE_ID}/documents" /tmp/qa-payload.json)
  echo "[5-9] POST documents: $(extract_code "$R")"

  # 5-10. POST calculate
  R=$(api EA POST "/year-end/settlements/${SETTLE_ID}/calculate")
  echo "[5-10] POST calculate: $(extract_code "$R")"
  echo "  body: $(extract_body "$R" | head -c 200)"

  # 5-11. POST submit
  R=$(api EA POST "/year-end/settlements/${SETTLE_ID}/submit")
  echo "[5-11] POST submit: $(extract_code "$R")"
else
  echo "[5-3] to [5-11] SKIP (no SETTLE_ID)"
fi

echo ""
echo "--- Year-End HR Side ---"

# 5-12. GET HR settlements
R=$(api HK GET "/year-end/hr/settlements")
echo "[5-12] GET year-end/hr/settlements: $(extract_code "$R")"

if [[ -n "$SETTLE_ID" ]]; then
  # 5-13. POST confirm
  R=$(api HK POST "/year-end/hr/settlements/${SETTLE_ID}/confirm")
  echo "[5-13] POST hr/confirm: $(extract_code "$R")"

  # 5-14. POST receipt
  R=$(api HK POST "/year-end/hr/settlements/${SETTLE_ID}/receipt")
  echo "[5-14] POST hr/receipt: $(extract_code "$R")"
else
  echo "[5-13] SKIP"
  echo "[5-14] SKIP"
fi

# 5-15. POST bulk confirm
cat <<EOFP > /tmp/qa-payload.json
{
  "year": 2025,
  "companyId": "${KR_COMPANY_ID}"
}
EOFP
R=$(api HK POST "/year-end/hr/bulk-confirm" /tmp/qa-payload.json)
echo "[5-15] POST hr/bulk-confirm: $(extract_code "$R")"

# RBAC
R=$(api EA GET "/year-end/hr/settlements")
echo "[5-16] RBAC: EA→HR settlements: $(extract_code "$R") (expect 403)"
R=$(api EA POST "/year-end/hr/bulk-confirm" /tmp/qa-payload.json)
echo "[5-17] RBAC: EA→bulk-confirm: $(extract_code "$R") (expect 403)"

echo ""
echo "═══ SUMMARY ═══"
echo "All phases complete. Review output above for failures."
