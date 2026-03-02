#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"
IDENTIFIER="${IDENTIFIER:-}"
PASSWORD="${PASSWORD:-}"
TENANT_ID="${TENANT_ID:-}"
OTP_CODE="${OTP_CODE:-}"
MAGIC_TOKEN="${MAGIC_TOKEN:-}"
SOCIAL_PROVIDER="${SOCIAL_PROVIDER:-}"
SOCIAL_TOKEN="${SOCIAL_TOKEN:-}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required. Install jq and re-run."
  exit 1
fi

if [ -z "$IDENTIFIER" ]; then
  echo "Set IDENTIFIER before running. Example:"
  echo "IDENTIFIER=user@example.com PASSWORD=SecurePass123! bash packages/nest-auth/examples/identifier-first-auth-flow.sh"
  exit 1
fi

echo "== 1) Login Lookup =="
lookup_payload=$(jq -n \
  --arg identifier "$IDENTIFIER" \
  --arg tenantId "$TENANT_ID" \
  '
  { identifier: $identifier }
  + (if $tenantId != "" then { tenantId: $tenantId } else {} end)
  ')
lookup_response=$(
  curl -sS -X POST "$API_URL/auth/login/lookup" \
    -H "Content-Type: application/json" \
    -d "$lookup_payload"
)
echo "$lookup_response" | jq .

lookup_token=$(echo "$lookup_response" | jq -r '.lookupToken // empty')
requires_tenant_selection=$(echo "$lookup_response" | jq -r '.requiresTenantSelection // false')
resolved_tenant_id=$(echo "$lookup_response" | jq -r '.resolvedTenantId // empty')

if [ -z "$lookup_token" ]; then
  echo "Lookup failed: no lookupToken returned."
  exit 1
fi

if [ "$requires_tenant_selection" = "true" ] && [ -z "$TENANT_ID" ]; then
  TENANT_ID=$(echo "$lookup_response" | jq -r '.tenants[0].id // empty')
  if [ -z "$TENANT_ID" ]; then
    echo "Tenant selection is required. Re-run with TENANT_ID=<tenant-id>."
    exit 1
  fi
  echo "Tenant selection required. Using first returned tenant for demo: $TENANT_ID"
fi

if [ -z "$TENANT_ID" ] && [ -n "$resolved_tenant_id" ]; then
  TENANT_ID="$resolved_tenant_id"
fi

if [ -n "$PASSWORD" ]; then
  echo "== 2) Password Login =="
  password_payload=$(jq -n \
    --arg lookupToken "$lookup_token" \
    --arg tenantId "$TENANT_ID" \
    --arg password "$PASSWORD" \
    '
    { lookupToken: $lookupToken, password: $password }
    + (if $tenantId != "" then { tenantId: $tenantId } else {} end)
    ')
  password_response=$(
    curl -sS -X POST "$API_URL/auth/login/password" \
      -H "Content-Type: application/json" \
      -d "$password_payload"
  )
  echo "$password_response" | jq .
else
  echo "Skipping password login (PASSWORD not set)."
fi

echo "== 3) OTP Challenge =="
otp_challenge_payload=$(jq -n \
  --arg lookupToken "$lookup_token" \
  --arg tenantId "$TENANT_ID" \
  '
  { lookupToken: $lookupToken }
  + (if $tenantId != "" then { tenantId: $tenantId } else {} end)
  ')
otp_challenge_response=$(
  curl -sS -X POST "$API_URL/auth/login/otp/challenge" \
    -H "Content-Type: application/json" \
    -d "$otp_challenge_payload"
)
echo "$otp_challenge_response" | jq .

if [ -n "$OTP_CODE" ]; then
  echo "== 4) OTP Verify =="
  otp_verify_payload=$(jq -n \
    --arg lookupToken "$lookup_token" \
    --arg tenantId "$TENANT_ID" \
    --arg otp "$OTP_CODE" \
    '
    { lookupToken: $lookupToken, otp: $otp }
    + (if $tenantId != "" then { tenantId: $tenantId } else {} end)
    ')
  otp_verify_response=$(
    curl -sS -X POST "$API_URL/auth/login/otp/verify" \
      -H "Content-Type: application/json" \
      -d "$otp_verify_payload"
  )
  echo "$otp_verify_response" | jq .
else
  echo "Skipping OTP verify (OTP_CODE not set)."
fi

echo "== 5) Magic Link Challenge =="
magic_challenge_payload=$(jq -n \
  --arg lookupToken "$lookup_token" \
  --arg tenantId "$TENANT_ID" \
  '
  { lookupToken: $lookupToken }
  + (if $tenantId != "" then { tenantId: $tenantId } else {} end)
  ')
magic_challenge_response=$(
  curl -sS -X POST "$API_URL/auth/login/magic-link/challenge" \
    -H "Content-Type: application/json" \
    -d "$magic_challenge_payload"
)
echo "$magic_challenge_response" | jq .

challenge_magic_token=$(echo "$magic_challenge_response" | jq -r '.token // empty')
if [ -z "$MAGIC_TOKEN" ] && [ -n "$challenge_magic_token" ]; then
  MAGIC_TOKEN="$challenge_magic_token"
fi

if [ -n "$MAGIC_TOKEN" ]; then
  echo "== 6) Magic Link Verify =="
  magic_verify_payload=$(jq -n --arg token "$MAGIC_TOKEN" '{ token: $token }')
  magic_verify_response=$(
    curl -sS -X POST "$API_URL/auth/login/magic-link/verify" \
      -H "Content-Type: application/json" \
      -d "$magic_verify_payload"
  )
  echo "$magic_verify_response" | jq .
else
  echo "Skipping magic-link verify (MAGIC_TOKEN not set and no debug token returned)."
fi

if [ -n "$SOCIAL_PROVIDER" ] && [ -n "$SOCIAL_TOKEN" ]; then
  echo "== 7) Social Login =="
  social_payload=$(jq -n \
    --arg providerName "$SOCIAL_PROVIDER" \
    --arg token "$SOCIAL_TOKEN" \
    --arg lookupToken "$lookup_token" \
    --arg tenantId "$TENANT_ID" \
    '
    {
      providerName: $providerName,
      credentials: { token: $token, type: "idToken" }
    }
    + (if $lookupToken != "" then { lookupToken: $lookupToken } else {} end)
    + (if $tenantId != "" then { tenantId: $tenantId } else {} end)
    ')
  social_response=$(
    curl -sS -X POST "$API_URL/auth/login/social" \
      -H "Content-Type: application/json" \
      -d "$social_payload"
  )
  echo "$social_response" | jq .
else
  echo "Skipping social login (set SOCIAL_PROVIDER and SOCIAL_TOKEN to test)."
fi

echo "Done."
