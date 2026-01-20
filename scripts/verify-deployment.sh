#!/bin/bash

# Verification Script for PR Summarizer AWS Deployment
# Run this script to verify that both backend and frontend are properly deployed

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_info() {
    echo -e "[INFO] $1"
}

# Check if URLs are provided
if [ -z "$1" ]; then
    echo "Usage: $0 <backend-url> [frontend-url]"
    echo ""
    echo "Examples:"
    echo "  $0 https://xxxxx.us-east-1.awsapprunner.com"
    echo "  $0 https://xxxxx.us-east-1.awsapprunner.com https://main.d123456.amplifyapp.com"
    exit 1
fi

BACKEND_URL="$1"
FRONTEND_URL="${2:-}"

echo ""
echo "=============================================="
echo "PR Summarizer - Deployment Verification"
echo "=============================================="
echo ""

# Test backend health endpoint
echo "Testing Backend Health..."
echo "-------------------------"

HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "${BACKEND_URL}/health" 2>/dev/null || echo "error")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    print_status "Backend health check passed"
    print_info "Response: $BODY"
else
    print_error "Backend health check failed (HTTP $HTTP_CODE)"
    print_info "Response: $BODY"
fi

echo ""

# Test API docs endpoint
echo "Testing Backend API Docs..."
echo "---------------------------"

DOCS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/docs" 2>/dev/null || echo "error")

if [ "$DOCS_CODE" = "200" ]; then
    print_status "API docs endpoint accessible"
    print_info "View at: ${BACKEND_URL}/docs"
else
    print_warning "API docs endpoint returned HTTP $DOCS_CODE"
fi

echo ""

# Test CORS headers
echo "Testing CORS Configuration..."
echo "-----------------------------"

CORS_RESPONSE=$(curl -s -I -X OPTIONS \
    -H "Origin: https://example.com" \
    -H "Access-Control-Request-Method: POST" \
    "${BACKEND_URL}/health" 2>/dev/null || echo "error")

if echo "$CORS_RESPONSE" | grep -qi "access-control-allow"; then
    print_status "CORS headers present"
else
    print_warning "CORS headers may not be configured correctly"
fi

echo ""

# Test frontend if URL provided
if [ -n "$FRONTEND_URL" ]; then
    echo "Testing Frontend..."
    echo "-------------------"

    FRONTEND_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${FRONTEND_URL}" 2>/dev/null || echo "error")

    if [ "$FRONTEND_CODE" = "200" ]; then
        print_status "Frontend is accessible"
        print_info "URL: ${FRONTEND_URL}"
    else
        print_error "Frontend returned HTTP $FRONTEND_CODE"
    fi

    echo ""

    # Check if frontend can reach backend (CORS test)
    echo "Testing Frontend-Backend CORS..."
    echo "--------------------------------"

    CORS_TEST=$(curl -s -I -X OPTIONS \
        -H "Origin: ${FRONTEND_URL}" \
        -H "Access-Control-Request-Method: POST" \
        "${BACKEND_URL}/api/v1/repos/test/test/pulls" 2>/dev/null || echo "error")

    if echo "$CORS_TEST" | grep -qi "access-control-allow-origin"; then
        ALLOWED_ORIGIN=$(echo "$CORS_TEST" | grep -i "access-control-allow-origin" | head -1)
        print_status "CORS configured for frontend"
        print_info "$ALLOWED_ORIGIN"
    else
        print_warning "CORS may not be configured for frontend origin"
        print_info "Update ALLOWED_ORIGINS in App Runner to include: ${FRONTEND_URL}"
    fi

    echo ""
fi

# Summary
echo "=============================================="
echo "Verification Summary"
echo "=============================================="
echo "Backend URL:  ${BACKEND_URL}"
if [ -n "$FRONTEND_URL" ]; then
    echo "Frontend URL: ${FRONTEND_URL}"
fi
echo ""
echo "Next steps if issues found:"
echo "1. Check App Runner logs in CloudWatch"
echo "2. Verify environment variables are set correctly"
echo "3. Ensure ALLOWED_ORIGINS includes your frontend URL"
echo "=============================================="
