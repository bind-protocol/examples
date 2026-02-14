#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

# ── Welcome ──────────────────────────────────────────────────────────
echo ""
echo "  Bind Protocol SDK — Credit Score Example"
echo "  ─────────────────────────────────────────"
echo "  This script creates a .env file with your configuration."
echo "  Existing env vars are used as defaults when detected."
echo ""

# ── Detect env vars already set ──────────────────────────────────────
detected=()
for var in BIND_API_URL BIND_API_KEY CIRCUIT_ID BIND_VERIFIER_API_KEY SHARED_PROOF_ID VERIFIER_ORG_ID; do
  if [ -n "${!var:-}" ]; then
    detected+=("$var")
  fi
done

if [ ${#detected[@]} -gt 0 ]; then
  echo "  Detected env vars: ${detected[*]}"
  echo "  These will be used as defaults — press Enter to keep them."
  echo ""
fi

# ── Check for existing .env ──────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  read -p "  A .env file already exists. Overwrite? [y/N] " overwrite
  case "$overwrite" in
    [yY]|[yY][eE][sS]) ;;
    *)
      echo "  Aborted. Existing .env left unchanged."
      exit 0
      ;;
  esac
fi

# ── Prompts ──────────────────────────────────────────────────────────
echo "  Fill in the values below. Press Enter to accept [defaults]."
echo ""

# BIND_API_URL
default_url="${BIND_API_URL:-https://api-dev.bindprotocol.xyz}"
read -p "  BIND_API_URL [$default_url]: " bind_api_url
bind_api_url="${bind_api_url:-$default_url}"

# BIND_API_KEY (required — env var satisfies the requirement)
default_key="${BIND_API_KEY:-}"
if [ -n "$default_key" ]; then
  masked="${default_key:0:4}...${default_key: -4}"
  read -p "  BIND_API_KEY [$masked]: " bind_api_key
  bind_api_key="${bind_api_key:-$default_key}"
else
  while true; do
    read -p "  BIND_API_KEY (required): " bind_api_key
    if [ -n "$bind_api_key" ]; then
      break
    fi
    echo "  ⚠  API key is required. Please enter a value."
  done
fi

# CIRCUIT_ID (optional)
default_circuit="${CIRCUIT_ID:-}"
if [ -n "$default_circuit" ]; then
  read -p "  CIRCUIT_ID [$default_circuit]: " circuit_id
  circuit_id="${circuit_id:-$default_circuit}"
else
  read -p "  CIRCUIT_ID [skip]: " circuit_id
fi

# ── Verifier section (optional) ─────────────────────────────────────
echo ""

# Auto-enter verifier section if any verifier env vars are already set
has_verifier_env=false
for var in BIND_VERIFIER_API_KEY SHARED_PROOF_ID VERIFIER_ORG_ID; do
  if [ -n "${!var:-}" ]; then
    has_verifier_env=true
    break
  fi
done

if $has_verifier_env; then
  echo "  Verifier env vars detected — entering verifier setup."
  configure_verifier="y"
else
  read -p "  Configure verifier settings? [y/N] " configure_verifier
fi

verifier_api_key=""
shared_proof_id=""
verifier_org_id=""

if [[ "$configure_verifier" =~ ^[yY]([eE][sS])?$ ]]; then
  default_vkey="${BIND_VERIFIER_API_KEY:-}"
  if [ -n "$default_vkey" ]; then
    masked_vkey="${default_vkey:0:4}...${default_vkey: -4}"
    read -p "  BIND_VERIFIER_API_KEY [$masked_vkey]: " verifier_api_key
    verifier_api_key="${verifier_api_key:-$default_vkey}"
  else
    read -p "  BIND_VERIFIER_API_KEY [skip]: " verifier_api_key
  fi

  default_proof="${SHARED_PROOF_ID:-}"
  if [ -n "$default_proof" ]; then
    read -p "  SHARED_PROOF_ID [$default_proof]: " shared_proof_id
    shared_proof_id="${shared_proof_id:-$default_proof}"
  else
    read -p "  SHARED_PROOF_ID [skip]: " shared_proof_id
  fi

  default_org="${VERIFIER_ORG_ID:-}"
  if [ -n "$default_org" ]; then
    read -p "  VERIFIER_ORG_ID [$default_org]: " verifier_org_id
    verifier_org_id="${verifier_org_id:-$default_org}"
  else
    read -p "  VERIFIER_ORG_ID [skip]: " verifier_org_id
  fi
fi

# ── Write .env ───────────────────────────────────────────────────────
{
  echo "# Bind Protocol API URL (defaults to production if not set)"
  echo "BIND_API_URL=$bind_api_url"
  echo ""
  echo "# Your Bind Protocol API key (required for prove jobs)"
  echo "BIND_API_KEY=$bind_api_key"
  echo ""

  if [ -n "$circuit_id" ]; then
    echo "# Override circuit ID"
    echo "CIRCUIT_ID=$circuit_id"
  else
    echo "# Optional: Override circuit ID"
    echo "# CIRCUIT_ID=bind.demo.credit-score.v1"
  fi

  if [ -n "$verifier_api_key" ] || [ -n "$shared_proof_id" ] || [ -n "$verifier_org_id" ]; then
    echo ""
    echo "# Verifier configuration"
    if [ -n "$verifier_api_key" ]; then
      echo "BIND_VERIFIER_API_KEY=$verifier_api_key"
    fi
    if [ -n "$shared_proof_id" ]; then
      echo "SHARED_PROOF_ID=$shared_proof_id"
    fi
    if [ -n "$verifier_org_id" ]; then
      echo "VERIFIER_ORG_ID=$verifier_org_id"
    fi
  fi
} > "$ENV_FILE"

echo ""
echo "  .env written successfully."

# ── Offer npm install ────────────────────────────────────────────────
echo ""
read -p "  Run npm install now? [Y/n] " run_install
case "$run_install" in
  [nN]|[nN][oO])
    echo "  Skipped npm install."
    ;;
  *)
    echo ""
    npm install
    ;;
esac

# ── Next steps ───────────────────────────────────────────────────────
echo ""
echo "  Next steps — available commands:"
echo "    npm run get-policy   Fetch the policy for the credit-score circuit"
echo "    npm run circuits     List available circuits"
echo "    npm run prove        Submit a prove job"
echo "    npm run verify       Run the verifier example"
echo ""
