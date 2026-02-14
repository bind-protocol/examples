# Credit Score Demo

A demonstration of the Bind Protocol SDK using a credit score verification policy.

## Overview

This example shows how to:
1. Fetch a policy specification from the Bind API
2. Submit a prove job with credit score inputs
3. Poll for proof completion
4. Share a proof with a verifier
5. Verify a credential as a lender (verifier perspective)

## Policy: `bind.demo.credit-score`

The demo policy evaluates creditworthiness based on:

**Inputs:**
- `income` - Annual income in USD
- `debt` - Total debt in USD
- `credit_history_months` - Length of credit history

**Rules:**
- Debt-to-income ratio must be ≤ 50%
- At least 12 months of credit history

> **Why `debt * 10000 <= income * 5000` instead of `debt / income <= 0.5`?**
> ZK circuits operate on integers — there is no floating-point division. The policy
> cross-multiplies to express the same constraint: `debt * 10000 <= income * 5000`
> is equivalent to `debt / income <= 0.5`, but avoids division entirely.

**Output:**
- `approved` - Boolean (PASS_FAIL): `true` if all rules pass, `false` otherwise

## Setup

The quickest way to get started is the interactive setup script:

```bash
npm run setup
```

This walks you through creating a `.env` file and installs dependencies.

Or set up manually:

```bash
npm install
cp .env.example .env
# Edit .env with your API key
```

## Usage

### View the Policy

Fetch and display the policy specification (no API key required):

```bash
npm run get-policy
```

### List Available Circuits

List circuits available to your organization and check if your target circuit is ready:

```bash
npm run circuits
```

This shows active circuits and checks whether your circuit (e.g., `bind.demo.credit_score.v0_1_0`) exists and is ready for proving.

### Submit a Prove Job

Submit credit score inputs and generate a proof (requires API key):

```bash
npm run prove
```

Default inputs:
- Income: $75,000
- Debt: $25,000
- Credit history: 48 months

Edit `src/submit-prove-job.ts` to change the inputs.

### Full Flow

Run the complete demo flow:

```bash
npm start
```

### Verifier Example

See how a lender would verify a credit credential:

```bash
npm run verify
```

## End-to-End Walkthrough

This walks through the full prover → share → verifier flow using two organizations.

### 1. Prover: Generate a proof

Set up the prover's `.env`:

```bash
BIND_API_URL=https://api-dev.bindprotocol.xyz
BIND_API_KEY=<prover-api-key>
VERIFIER_ORG_ID=<verifier-org-id>
```

Run the prove job:

```bash
npm run prove
```

This submits the credit score inputs, generates a ZK proof, and shares it with the verifier organization. Note the `SHARED_PROOF_ID` printed at the end.

### 2. Verifier: Verify the shared proof

Set up the verifier's `.env` (or pass as env vars):

```bash
BIND_API_URL=https://api-dev.bindprotocol.xyz
BIND_VERIFIER_API_KEY=<verifier-api-key>
SHARED_PROOF_ID=<shared-proof-id-from-step-1>
```

Run the verifier:

```bash
npm run verify
```

The verifier will:
1. Fetch the shared proof details and the embedded policy spec
2. Validate that the policy is acceptable for lending decisions
3. Check proof freshness against the policy TTL
4. Cryptographically verify the proof
5. Read the disclosed `approved` output from the public inputs

The verifier never sees the actual income, debt, or credit history values — only whether the applicant passed or failed the policy rules.

## Test Scenarios

Modify inputs in the source files to test different outcomes:

| Scenario | Income | Debt | History (months) | Expected Result |
|----------|--------|------|-------------------|-----------------|
| Approved | 75,000 | 25,000 | 48 | approved (DTI 33%, history OK) |
| Approved (borderline) | 100,000 | 50,000 | 12 | approved (DTI 50%, history OK) |
| Rejected (high DTI) | 50,000 | 30,000 | 48 | rejected (DTI 60% > 50%) |
| Rejected (short history) | 100,000 | 20,000 | 6 | rejected (history 6 < 12) |
| Rejected (both) | 50,000 | 30,000 | 6 | rejected (DTI 60%, history 6) |

## Project Structure

```
examples/credit-score/
├── README.md
├── package.json
├── policy.json
├── tsconfig.json
├── setup.sh               # Interactive setup script
├── .env.example            # Example environment config
└── src/
    ├── index.ts              # Full flow demo
    ├── get-policy.ts         # Fetch policy spec
    ├── list-circuits.ts      # List available circuits
    ├── submit-prove-job.ts   # Submit prove job
    └── verifier-example.ts   # Lender verification
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BIND_API_KEY` | For prove jobs | Your Bind Protocol API key |
| `BIND_VERIFIER_API_KEY` | For verification | Verifier organization's API key |
| `BIND_API_URL` | No | API URL (default: production) |
| `CIRCUIT_ID` | No | Circuit ID (default: `bind.demo.credit_score.v0_1_0`) |
| `VERIFIER_ORG_ID` | No | Org ID to share proofs with |
| `SHARED_PROOF_ID` | For verification | Shared proof ID from prover |
