#!/usr/bin/env bash
#
# Reproduces the deal-creation API sequence behind HIB-1419 and checks the fix.
#
# The bug: the integration pushes a deal twice for the same lead. The first push
# creates the deal; the second push carries a DIFFERENT deal_name (and usually the
# meeting). On the second push DealCreationService recomputed the hash from the same
# contact/name/company it had already locked, tried to Cache::add that same key, read
# its own lock as "another request", and aborted:
#
#   "Cannot change deal name: another request is already processing a deal with name ..."
#
# The transaction rolled back, so the rename, the meeting and everything else in the
# post-commit block were lost - deterministically, on every retry.
#
# What this script does (4 pushes against a fresh lead):
#
#   1. create           - new deal, name A                      -> 200 accepted
#   2. exact repeat     - identical payload, immediately        -> 200 duplicate:true   (new window)
#   3. rename + meeting - name B + meeting payload              -> 200 accepted         (used to 500)
#   4. repeat of 3      - identical payload, immediately        -> 200 duplicate:true   (new window)
#
# Against the code before this branch, step 3 fails with the message above and no
# meeting is written. Against the fix, step 3 succeeds and the meeting lands.
#
# Usage:
#   BASE_URL=https://crm.example.com API_TOKEN=xxxxx ./scripts/simulate-deal-duplicate-push.sh
#
# Optional:
#   COMPANY_ID=1                 company header (default 1)
#   EMAIL=someone@example.com    reuse an existing lead instead of creating a fresh one
#   DEAL_OWNER_ID=3              deal_owner_id sent in the payload (default 3)
#   WAIT_FOR_WINDOW=1            after step 4, sleep 61s and re-send it to prove the
#                                60s window reopens rather than blocking forever
#
# Nothing is cleaned up: the script creates a real lead and deal. Run it against
# staging, or delete the lead afterwards.

set -uo pipefail

BASE_URL="${BASE_URL:-}"
API_TOKEN="${API_TOKEN:-}"
COMPANY_ID="${COMPANY_ID:-1}"
DEAL_OWNER_ID="${DEAL_OWNER_ID:-3}"
WAIT_FOR_WINDOW="${WAIT_FOR_WINDOW:-0}"

if [[ -z "$BASE_URL" || -z "$API_TOKEN" ]]; then
    echo "BASE_URL and API_TOKEN are required." >&2
    echo "e.g. BASE_URL=https://crm.example.com API_TOKEN=xxxxx $0" >&2
    exit 2
fi

BASE_URL="${BASE_URL%/}"
ENDPOINT="$BASE_URL/api/deal/create"

STAMP="$(date +%s)"
EMAIL="${EMAIL:-hib1419+${STAMP}@mailinator.com}"
LEAD_NAME="Ayomide Oluniyi"
DEAL_NAME_A="Ayomide Oluniyi ${STAMP}"
DEAL_NAME_B="Ayomide+Oluniyi HIbarr ${STAMP}"
MEETING_DATE="$(date -u -d '+2 days' '+%Y-%m-%d 11:00:00' 2>/dev/null || date -u -v+2d '+%Y-%m-%d 11:00:00')"

failures=0

# post <label> <payload> <expectation: accepted|duplicate>
post() {
    local label="$1" payload="$2" expect="$3" body status

    echo
    echo "--- $label"
    echo "    $(echo "$payload" | tr -d '\n' | cut -c1-160)"

    body="$(curl -sS -o - -w $'\n%{http_code}' \
        -X POST "$ENDPOINT" \
        -H 'Content-Type: application/json' \
        -H 'Accept: application/json' \
        -H "X-API-TOKEN: $API_TOKEN" \
        -H "X-COMPANY-ID: $COMPANY_ID" \
        --data "$payload" 2>&1)"

    status="$(printf '%s' "$body" | tail -n1)"
    body="$(printf '%s' "$body" | sed '$d')"

    echo "    HTTP $status"
    echo "    $body"

    if [[ "$status" != "200" ]]; then
        echo "    FAIL: expected HTTP 200"
        failures=$((failures + 1))
        return
    fi

    case "$expect" in
        duplicate)
            if grep -q '"duplicate":true' <<<"$body"; then
                echo "    OK: absorbed by the 60s window"
            else
                echo "    FAIL: expected duplicate:true"
                failures=$((failures + 1))
            fi
            ;;
        accepted)
            if grep -q '"duplicate":true' <<<"$body"; then
                echo "    FAIL: this push is materially different and must NOT be a duplicate"
                failures=$((failures + 1))
            elif grep -q '"status":"accepted"' <<<"$body"; then
                echo "    OK: processed"
            else
                echo "    FAIL: expected status accepted"
                failures=$((failures + 1))
            fi
            ;;
    esac
}

create_payload() {
    cat <<JSON
{"email":"$EMAIL","name":"$LEAD_NAME","deal_name":"$DEAL_NAME_A","deal_owner_id":"$DEAL_OWNER_ID","update_agent_if_exists":"1"}
JSON
}

rename_with_meeting_payload() {
    cat <<JSON
{"email":"$EMAIL","name":"$LEAD_NAME","deal_name":"$DEAL_NAME_B","deal_owner_id":"$DEAL_OWNER_ID","update_agent_if_exists":"1","meeting":{"meeting_date":"$MEETING_DATE","meeting_type":"Zoom","meeting_location":"office"}}
JSON
}

echo "Endpoint : $ENDPOINT"
echo "Company  : $COMPANY_ID"
echo "Lead     : $EMAIL"
echo "Names    : '$DEAL_NAME_A' then '$DEAL_NAME_B'"

post "1/4 create the deal"                      "$(create_payload)"               accepted
post "2/4 identical repeat (expect duplicate)"  "$(create_payload)"               duplicate
post "3/4 rename + meeting (the HIB-1419 bug)"  "$(rename_with_meeting_payload)"  accepted
post "4/4 identical repeat (expect duplicate)"  "$(rename_with_meeting_payload)"  duplicate

if [[ "$WAIT_FOR_WINDOW" == "1" ]]; then
    echo
    echo "--- waiting 61s for the duplicate window to expire"
    sleep 61
    post "5/5 same payload after the window"     "$(rename_with_meeting_payload)"  accepted
fi

echo
echo "=========================================================================="
if [[ "$failures" -eq 0 ]]; then
    echo "PASS - every push behaved as expected."
else
    echo "FAIL - $failures step(s) behaved unexpectedly."
fi
cat <<NOTES

Verify the outcome in the database:

  -- the deal should carry name B, and its hash should match that name
  SELECT d.id, d.name, d.hash, d.lead_id
  FROM deals d JOIN leads l ON l.id = d.lead_id
  WHERE l.client_email = '$EMAIL';

  -- step 3 must have written exactly one meeting
  SELECT f.id, f.deal_id, f.next_follow_up_date, f.status
  FROM lead_follow_up f JOIN deals d ON d.id = f.deal_id
  JOIN leads l ON l.id = d.lead_id
  WHERE l.client_email = '$EMAIL';

And confirm the old failure is gone from the log:

  grep -c 'New hash lock already held' storage/logs/laravel-\$(date +%F).log
NOTES

exit $(( failures == 0 ? 0 : 1 ))
