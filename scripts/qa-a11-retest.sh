#!/bin/bash
set -euo pipefail

BASE_URL="http://localhost:3002/api/v1"
PSQL="/opt/homebrew/Cellar/postgresql@17/17.9/bin/psql"
DB_URL="postgresql://sangwoo@localhost:5432/ctr_hr_hub"

EA_EMP_ID="14a0ccad-14a0-44a0-a14a-14a0ccad0000"
KR_COMPANY_ID="0033fa50-0033-4033-a003-0033fa500000"
CN_COMPANY_ID="0033f954-0033-4033-a003-0033f9540000"
RU_COMPANY_ID="0033fb2c-0033-4033-a003-0033fb2c0000"
COURSE_ID="155ffd3c-155f-455f-a155-155ffd3c0000"

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

echo "═══ RE-TEST: Fixed payloads ═══"

# ── KR: Mandatory Training POST (needs courseId, trainingType, year, requiredHours) ──
cat <<EOFP > /tmp/qa-payload.json
{
  "courseId": "${COURSE_ID}",
  "trainingType": "PERSONAL_INFO_PROTECTION",
  "year": 2026,
  "dueDate": "2026-12-31T00:00:00.000Z",
  "requiredHours": 4
}
EOFP
R=$(api HK POST "/compliance/kr/mandatory-training" /tmp/qa-payload.json)
C=$(extract_code "$R")
B=$(extract_body "$R")
echo "[1-5R] POST mandatory-training: $C"
echo "  body: $(echo "$B" | head -c 300)"
MT_ID=$(echo "$B" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id', d.get('id','')))" 2>/dev/null || echo "")
echo "  MT_ID=$MT_ID"

# PUT mandatory-training
if [[ -n "$MT_ID" ]]; then
  echo '{"dueDate":"2026-11-30T00:00:00.000Z","requiredHours":6}' > /tmp/qa-payload.json
  R=$(api HK PUT "/compliance/kr/mandatory-training/${MT_ID}" /tmp/qa-payload.json)
  echo "[1-6R] PUT mandatory-training: $(extract_code "$R")"
else
  echo "[1-6R] SKIP"
fi

# GET mandatory-training/status (needs year param)
R=$(api HK GET "/compliance/kr/mandatory-training/status?year=2026")
echo "[1-7R] GET mandatory-training/status?year=2026: $(extract_code "$R")"

# ── KR: Severance Interim POST (needs enum reason) ──
cat <<EOFP > /tmp/qa-payload.json
{
  "employeeId": "${EA_EMP_ID}",
  "reason": "HOUSING_PURCHASE",
  "requestDate": "2026-04-01T00:00:00.000Z"
}
EOFP
R=$(api HK POST "/compliance/kr/severance-interim" /tmp/qa-payload.json)
C=$(extract_code "$R")
B=$(extract_body "$R")
echo "[1-9R] POST severance-interim: $C"
echo "  body: $(echo "$B" | head -c 300)"
SEV_ID=$(echo "$B" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id', d.get('id','')))" 2>/dev/null || echo "")
echo "  SEV_ID=$SEV_ID"

if [[ -n "$SEV_ID" ]]; then
  R=$(api HK GET "/compliance/kr/severance-interim/${SEV_ID}")
  echo "[1-10R] GET severance-interim/$SEV_ID: $(extract_code "$R")"

  echo '{"status":"SIP_APPROVED"}' > /tmp/qa-payload.json
  R=$(api HK PUT "/compliance/kr/severance-interim/${SEV_ID}" /tmp/qa-payload.json)
  echo "[1-11R] PUT severance-interim: $(extract_code "$R")"
fi

echo ""
echo "── CN COMPLIANCE ──"

# POST social-insurance/config (needs insuranceType, employerRate, employeeRate, baseMin, baseMax, effectiveFrom)
cat <<EOFP > /tmp/qa-payload.json
{
  "insuranceType": "PENSION",
  "city": "上海",
  "employerRate": 16.0,
  "employeeRate": 8.0,
  "baseMin": 6520,
  "baseMax": 34188,
  "effectiveFrom": "2026-01-01T00:00:00.000Z"
}
EOFP
R=$(api HC POST "/compliance/cn/social-insurance/config" /tmp/qa-payload.json)
C=$(extract_code "$R")
B=$(extract_body "$R")
echo "[2-2R] POST cn/social-insurance/config: $C"
echo "  body: $(echo "$B" | head -c 300)"
SI_ID=$(echo "$B" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id', d.get('id','')))" 2>/dev/null || echo "")
echo "  SI_ID=$SI_ID"

if [[ -n "$SI_ID" ]]; then
  echo '{"employeeRate":8.5}' > /tmp/qa-payload.json
  R=$(api HC PUT "/compliance/cn/social-insurance/config/${SI_ID}" /tmp/qa-payload.json)
  echo "[2-3R] PUT cn/social-insurance/config: $(extract_code "$R")"
fi

# POST calculate (needs year + month)
cat <<EOFP > /tmp/qa-payload.json
{
  "year": 2026,
  "month": 3
}
EOFP
R=$(api HC POST "/compliance/cn/social-insurance/calculate" /tmp/qa-payload.json)
echo "[2-4R] POST cn/calculate: $(extract_code "$R")"
echo "  body: $(extract_body "$R" | head -c 200)"

# GET records (needs year + month)
R=$(api HC GET "/compliance/cn/social-insurance/records?year=2026&month=3")
echo "[2-5R] GET cn/records: $(extract_code "$R")"

# GET export (needs year + month)
R=$(curl -s -w "\n---HTTP_CODE:%{http_code}---" -b "/tmp/qa-cookie-HC.txt" \
  -o /tmp/cn-insurance-export.xlsx \
  "${BASE_URL}/compliance/cn/social-insurance/export?year=2026&month=3" 2>/dev/null)
echo "[2-6R] GET cn/export: $(echo "$R" | grep -oE 'HTTP_CODE:[0-9]+' | tail -1 | grep -oE '[0-9]+' || echo 000)"

echo ""
echo "── RU COMPLIANCE ──"

# POST kedo (field is documentType not type)
cat <<EOFP > /tmp/qa-payload.json
{
  "employeeId": "${EA_EMP_ID}",
  "documentType": "EMPLOYMENT_CONTRACT",
  "title": "Трудовой договор тест",
  "content": "Employment contract for test",
  "signatureLevel": "PEP"
}
EOFP
R=$(api HK POST "/compliance/ru/kedo" /tmp/qa-payload.json)
C=$(extract_code "$R")
B=$(extract_body "$R")
echo "[3-2R] POST ru/kedo: $C"
echo "  body: $(echo "$B" | head -c 300)"
KEDO_ID=$(echo "$B" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id', d.get('id','')))" 2>/dev/null || echo "")
echo "  KEDO_ID=$KEDO_ID"

if [[ -n "$KEDO_ID" ]]; then
  R=$(api HK GET "/compliance/ru/kedo/${KEDO_ID}")
  echo "[3-3R] GET ru/kedo/$KEDO_ID: $(extract_code "$R")"

  echo '{"title":"Updated title"}' > /tmp/qa-payload.json
  R=$(api HK PUT "/compliance/ru/kedo/${KEDO_ID}" /tmp/qa-payload.json)
  echo "[3-4R] PUT ru/kedo: $(extract_code "$R")"

  # Sign (needs signatureLevel)
  echo '{"signatureLevel":"PEP"}' > /tmp/qa-payload.json
  R=$(api HK POST "/compliance/ru/kedo/${KEDO_ID}/sign" /tmp/qa-payload.json)
  echo "[3-5R] POST ru/kedo/sign: $(extract_code "$R")"
  echo "  body: $(extract_body "$R" | head -c 200)"
fi

# Create new for reject
cat <<EOFP > /tmp/qa-payload.json
{
  "employeeId": "${EA_EMP_ID}",
  "documentType": "VACATION_ORDER",
  "title": "Rejection test doc",
  "content": "Test for rejection"
}
EOFP
R=$(api HK POST "/compliance/ru/kedo" /tmp/qa-payload.json)
KEDO2_ID=$(extract_body "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id', d.get('id','')))" 2>/dev/null || echo "")
if [[ -n "$KEDO2_ID" ]]; then
  echo '{"rejectionReason":"서류 오류로 반려"}' > /tmp/qa-payload.json
  R=$(api HK POST "/compliance/ru/kedo/${KEDO2_ID}/reject" /tmp/qa-payload.json)
  echo "[3-6R] POST ru/kedo/reject: $(extract_code "$R")"
else
  echo "[3-6R] SKIP"
fi

# POST military (needs fitnessCategory)
cat <<EOFP > /tmp/qa-payload.json
{
  "employeeId": "${EA_EMP_ID}",
  "category": "RESERVIST",
  "rank": "Рядовой",
  "fitnessCategory": "FIT_A",
  "militaryOffice": "Moscow District"
}
EOFP
R=$(api HK POST "/compliance/ru/military" /tmp/qa-payload.json)
C=$(extract_code "$R")
echo "[3-8R] POST ru/military: $C"
echo "  body: $(extract_body "$R" | head -c 200)"

# GET military/{employeeId}
R=$(api HK GET "/compliance/ru/military/${EA_EMP_ID}")
echo "[3-9R] GET ru/military/$EA_EMP_ID: $(extract_code "$R")"

# PUT military
echo '{"rank":"Ефрейтор","fitnessCategory":"FIT_B"}' > /tmp/qa-payload.json
R=$(api HK PUT "/compliance/ru/military/${EA_EMP_ID}" /tmp/qa-payload.json)
echo "[3-10R] PUT ru/military: $(extract_code "$R")"

# GET reports/57t (needs year param)
R=$(api HK GET "/compliance/ru/reports/57t?year=2025")
echo "[3-12R] GET ru/reports/57t?year=2025: $(extract_code "$R")"

# GET reports/p4 (needs year + quarter)
R=$(api HK GET "/compliance/ru/reports/p4?year=2025&quarter=4")
echo "[3-13R] GET ru/reports/p4?year=2025&quarter=4: $(extract_code "$R")"

echo ""
echo "── GDPR FIX ──"

# POST requests (field is requestType, not type)
cat <<EOFP > /tmp/qa-payload.json
{
  "employeeId": "${EA_EMP_ID}",
  "requestType": "ACCESS",
  "description": "본인 개인정보 열람 요청"
}
EOFP
R=$(api SA POST "/compliance/gdpr/requests" /tmp/qa-payload.json)
C=$(extract_code "$R")
B=$(extract_body "$R")
echo "[4-11R] POST gdpr/requests: $C"
echo "  body: $(echo "$B" | head -c 300)"
REQ_ID=$(echo "$B" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id', d.get('id','')))" 2>/dev/null || echo "")
echo "  REQ_ID=$REQ_ID"

if [[ -n "$REQ_ID" ]]; then
  R=$(api SA GET "/compliance/gdpr/requests/${REQ_ID}")
  echo "[4-12R] GET gdpr/requests/$REQ_ID: $(extract_code "$R")"

  echo '{"status":"COMPLETED","response":"모든 개인정보 열람 제공 완료"}' > /tmp/qa-payload.json
  R=$(api SA PUT "/compliance/gdpr/requests/${REQ_ID}" /tmp/qa-payload.json)
  echo "[4-13R] PUT gdpr/requests: $(extract_code "$R")"
fi

# POST retention (field is category not dataCategory, retentionMonths not retentionPeriodMonths)
cat <<EOFP > /tmp/qa-payload.json
{
  "category": "EMPLOYMENT_RECORDS",
  "retentionMonths": 36,
  "description": "퇴직 후 3년 보관",
  "autoDelete": false,
  "anonymize": true
}
EOFP
R=$(api SA POST "/compliance/gdpr/retention" /tmp/qa-payload.json)
C=$(extract_code "$R")
B=$(extract_body "$R")
echo "[4-15R] POST gdpr/retention: $C"
echo "  body: $(echo "$B" | head -c 300)"
RET_ID=$(echo "$B" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id', d.get('id','')))" 2>/dev/null || echo "")
echo "  RET_ID=$RET_ID"

if [[ -n "$RET_ID" ]]; then
  echo '{"retentionMonths":60}' > /tmp/qa-payload.json
  R=$(api SA PUT "/compliance/gdpr/retention/${RET_ID}" /tmp/qa-payload.json)
  echo "[4-16R] PUT gdpr/retention: $(extract_code "$R")"

  # POST retention/run (needs policyId)
  echo "{\"policyId\":\"${RET_ID}\"}" > /tmp/qa-payload.json
  R=$(api SA POST "/compliance/gdpr/retention/run" /tmp/qa-payload.json)
  echo "[4-17R] POST gdpr/retention/run: $(extract_code "$R")"
  echo "  body: $(extract_body "$R" | head -c 200)"
fi

echo ""
echo "── YEAR-END FIX ──"

# Get the settlement ID for EA
SETTLE_ID=$($PSQL "$DB_URL" -tAc "SELECT id FROM year_end_settlements WHERE employee_id='$EA_EMP_ID' ORDER BY created_at DESC LIMIT 1;" 2>/dev/null | tr -d ' ')
echo "SETTLE_ID=$SETTLE_ID"

# Need to check what deduction config codes exist
echo "Deduction configs:"
$PSQL "$DB_URL" -tAc "SELECT code, category, name FROM year_end_deduction_configs LIMIT 10;" 2>/dev/null

if [[ -n "$SETTLE_ID" ]]; then
  # PUT deductions (needs deductions array with configCode, category, name, inputAmount)
  cat <<EOFP > /tmp/qa-payload.json
{
  "deductions": [
    {"configCode": "NPS", "category": "INSURANCE", "name": "국민연금", "inputAmount": 4320000},
    {"configCode": "NHI", "category": "INSURANCE", "name": "건강보험", "inputAmount": 3600000},
    {"configCode": "EI", "category": "INSURANCE", "name": "고용보험", "inputAmount": 960000}
  ]
}
EOFP
  R=$(api EA PUT "/year-end/settlements/${SETTLE_ID}/deductions" /tmp/qa-payload.json)
  echo "[5-6R] PUT deductions: $(extract_code "$R")"
  echo "  body: $(extract_body "$R" | head -c 200)"

  # POST documents (needs documentType, fileName, filePath)
  cat <<EOFP > /tmp/qa-payload.json
{
  "documentType": "MEDICAL_RECEIPT",
  "fileName": "medical-receipt-2025.pdf",
  "filePath": "/uploads/year-end/medical-receipt-2025.pdf"
}
EOFP
  R=$(api EA POST "/year-end/settlements/${SETTLE_ID}/documents" /tmp/qa-payload.json)
  echo "[5-9R] POST documents: $(extract_code "$R")"
  echo "  body: $(extract_body "$R" | head -c 200)"
fi

# POST bulk-confirm (needs settlementIds array)
# Get settlement IDs for bulk confirm
SETTLE_IDS=$($PSQL "$DB_URL" -tAc "SELECT id FROM year_end_settlements WHERE year=2025 LIMIT 3;" 2>/dev/null | tr -d ' ' | head -3)
echo "Settlement IDs for bulk: $SETTLE_IDS"

IDS_JSON=$(echo "$SETTLE_IDS" | awk 'NF{printf "%s\"%s\"", (NR>1?",":""), $0}' | sed 's/^/[/;s/$/]/')
cat <<EOFP > /tmp/qa-payload.json
{
  "settlementIds": ${IDS_JSON},
  "year": 2025
}
EOFP
echo "Bulk confirm payload:"
cat /tmp/qa-payload.json
R=$(api HK POST "/year-end/hr/bulk-confirm" /tmp/qa-payload.json)
echo "[5-15R] POST hr/bulk-confirm: $(extract_code "$R")"
echo "  body: $(extract_body "$R" | head -c 300)"

echo ""
echo "═══ RETEST COMPLETE ═══"
