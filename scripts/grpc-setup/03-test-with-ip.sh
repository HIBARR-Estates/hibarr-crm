#!/usr/bin/env bash
set -euo pipefail

# ===========================================================================
# Step 3: Test gRPC server via IP (run from your LOCAL machine, not server)
#
# What this does:
#   - Tests health endpoint
#   - Lists available gRPC services
#   - Tests auth rejection (no token → UNAUTHENTICATED)
#   - Tests a real call with token + company_id
#
# Prerequisites:
#   - grpcurl installed (https://github.com/fullstorydev/grpcurl/releases)
#   - Server IP and port 9001 reachable
#
# Usage:
#   bash scripts/grpc-setup/03-test-with-ip.sh <SERVER_IP> [API_TOKEN] [COMPANY_ID]
#
# Examples:
#   bash scripts/grpc-setup/03-test-with-ip.sh 192.168.1.100
#   bash scripts/grpc-setup/03-test-with-ip.sh 192.168.1.100 my-api-token 1
# ===========================================================================

SERVER_IP="${1:?Usage: $0 <SERVER_IP> [API_TOKEN] [COMPANY_ID]}"
API_TOKEN="${2:-}"
COMPANY_ID="${3:-}"
PORT="9001"
HEALTH_PORT="2114"
ENDPOINT="${SERVER_IP}:${PORT}"

echo "============================================"
echo " Step 3: Test gRPC via IP"
echo " Endpoint: ${ENDPOINT}"
echo "============================================"

# Check if grpcurl is available
if ! command -v grpcurl &>/dev/null; then
    echo ""
    echo "  grpcurl not found. Install it:"
    echo "    - macOS:   brew install grpcurl"
    echo "    - Windows: scoop install grpcurl  OR  download from GitHub releases"
    echo "    - Linux:   go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest"
    echo "    - Release: https://github.com/fullstorydev/grpcurl/releases"
    echo ""
    echo "  Alternatively, you can use Postman's gRPC client."
    exit 1
fi

PASS=0
FAIL=0

run_test() {
    local name="$1"
    local expected="$2"
    shift 2

    echo ""
    echo "─── Test: ${name} ───"
    echo "  Command: $*"
    echo ""

    set +e
    OUTPUT=$("$@" 2>&1)
    EXIT_CODE=$?
    set -e

    echo "$OUTPUT" | sed 's/^/  /'
    echo ""

    if echo "$OUTPUT" | grep -qi "$expected"; then
        echo "  RESULT: PASS (found '${expected}')"
        ((PASS++))
    else
        echo "  RESULT: FAIL (expected '${expected}')"
        ((FAIL++))
    fi
}

# ──────────────────────────────────────────────
# Test 1: Health check (HTTP, not gRPC)
# ──────────────────────────────────────────────
echo ""
echo "─── Test 1: Health Check ───"
echo "  curl http://${SERVER_IP}:${HEALTH_PORT}/health"
echo ""

set +e
HEALTH=$(curl -sf "http://${SERVER_IP}:${HEALTH_PORT}/health" 2>&1)
HEALTH_EXIT=$?
set -e

if [ $HEALTH_EXIT -eq 0 ]; then
    echo "  ${HEALTH}"
    echo ""
    echo "  RESULT: PASS"
    ((PASS++))
else
    echo "  No response from health endpoint."
    echo "  Make sure port ${HEALTH_PORT} is open on the server."
    echo ""
    echo "  RESULT: FAIL"
    ((FAIL++))
fi

# ──────────────────────────────────────────────
# Test 2: List services (reflection)
# ──────────────────────────────────────────────
run_test "List gRPC services" "DealService\|LeadService\|PropertyService\|TaskService\|hibarr" \
    grpcurl -plaintext "${ENDPOINT}" list

# ──────────────────────────────────────────────
# Test 3: Auth rejection (no metadata → UNAUTHENTICATED)
# ──────────────────────────────────────────────
run_test "Auth rejection (no token)" "UNAUTHENTICATED\|Unauthenticated\|Missing authentication" \
    grpcurl -plaintext -d '{}' "${ENDPOINT}" hibarr.crm.deal.DealService/List

# ──────────────────────────────────────────────
# Test 4: Auth rejection (bad token)
# ──────────────────────────────────────────────
run_test "Auth rejection (bad token)" "UNAUTHENTICATED\|Invalid API token" \
    grpcurl -plaintext \
    -H "x-api-token: fake-token-123" \
    -H "x-company-id: 999" \
    -d '{}' "${ENDPOINT}" hibarr.crm.deal.DealService/List

# ──────────────────────────────────────────────
# Test 5: Authenticated call (if token provided)
# ──────────────────────────────────────────────
if [ -n "${API_TOKEN}" ] && [ -n "${COMPANY_ID}" ]; then
    run_test "Authenticated ListDeals" "deals\|total_count\|pagination\|OK" \
        grpcurl -plaintext \
        -H "x-api-token: ${API_TOKEN}" \
        -H "x-company-id: ${COMPANY_ID}" \
        -d '{"pagination": {"page": 1, "per_page": 3}}' \
        "${ENDPOINT}" hibarr.crm.deal.DealService/List
else
    echo ""
    echo "─── Test 5: Authenticated call ───"
    echo "  SKIPPED (no API_TOKEN and COMPANY_ID provided)"
    echo ""
    echo "  To test with real credentials:"
    echo "    bash $0 ${SERVER_IP} YOUR_API_TOKEN YOUR_COMPANY_ID"
fi

# ──────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────
echo ""
echo "============================================"
echo " Test Results: ${PASS} passed, ${FAIL} failed"
echo "============================================"
echo ""

if [ ${FAIL} -eq 0 ]; then
    echo " All tests passed! The gRPC server is working."
    echo ""
    echo " Next steps:"
    echo "   - Test all 4 services (Deal, Lead, Property, Task)"
    echo "   - When ready for domain + TLS: 04-setup-nginx-tls.sh"
else
    echo " Some tests failed. Check:"
    echo "   - Is port ${PORT} open on the server firewall?"
    echo "   - Is the service running? ssh server 'sudo systemctl status roadrunner-grpc'"
    echo "   - Check logs: ssh server 'journalctl -u roadrunner-grpc -n 50'"
fi
echo ""
