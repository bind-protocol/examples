# DIMO Vehicle Risk Band Demo

A demonstration of the Bind Protocol SDK using a DIMO vehicle risk assessment policy.

## Overview

This example shows how to:
1. Fetch the DIMO risk band policy specification
2. Submit a prove job with vehicle telemetry inputs
3. Poll for proof completion
4. Verify a risk band credential as an insurer or fleet manager

## Policy: `bind.mobility.basicriskband`

The policy evaluates vehicle risk based on mileage, data sufficiency, and driving behavior over a 90-day period.

**Inputs:**
- `mileage_90d` — Sum of `powertrainTransmissionTravelledDistance` (miles, u32)
- `data_points` — Count of `isIgnitionOn` events (u32)
- `speed_max` — Max observed `speed` (mph, u16)

**Rules & Scoring:**
| Rule | Condition | Effect |
|------|-----------|--------|
| Sufficient data | ≥ 100 data points | *required* (fail) |
| Low mileage | ≤ 3,000 miles | +25 points |
| Moderate mileage | ≤ 5,000 miles | +15 points |
| No extreme speed | < 100 mph max | +10 points |

Baseline score: **50**

**Output:**
- `riskBand` — Risk classification: `LOW`, `MEDIUM`, or `HIGH`
  - Score 0–40: HIGH risk
  - Score 41–70: MEDIUM risk
  - Score 71–100: LOW risk

## Setup

```bash
# Install dependencies
npm install

# Create .env file
cat > .env << EOF
BIND_API_URL=https://api-dev.bindprotocol.xyz
BIND_API_KEY=your-api-key-here
EOF
```

## Usage

### View the Policy

Fetch and display the policy specification (no API key required):

```bash
npm run get-policy
```

### List Available Circuits

List circuits and check if the DIMO risk circuit is ready:

```bash
npm run circuits
```

### Submit a Prove Job

Submit vehicle telemetry inputs and generate a proof (requires API key):

```bash
npm run prove
```

Default inputs simulate a well-maintained vehicle:
- Mileage: 2,500 miles (90 days)
- Data points: 450
- Max speed: 72 mph

Edit `src/submit-prove-job.ts` to test different scenarios.

### Full Flow

Run the complete demo flow:

```bash
npm start
```

### Verifier Example (Insurance/Fleet)

See how an insurer or fleet manager would verify a vehicle risk credential:

```bash
# First, run prove with VERIFIER_ORG_ID set to share the proof
VERIFIER_ORG_ID=<insurer-org-id> npm run prove

# Then verify as the insurer
SHARED_PROOF_ID=<from-prove-output> BIND_VERIFIER_API_KEY=<key> npm run verify
```

## Test Scenarios

Modify inputs in `src/submit-prove-job.ts` to test different risk outcomes:

| Scenario | Mileage | Data Points | Max Speed | Expected Band |
|----------|---------|-------------|-----------|---------------|
| Well-maintained | 2,500 | 450 | 72 mph | LOW |
| Moderate use | 4,500 | 300 | 85 mph | MEDIUM |
| High risk | 7,000 | 500 | 110 mph | HIGH |
| Insufficient data | 500 | 50 | 60 mph | FAIL (< 100 points) |

## Project Structure

```
examples/dimo-risk/
├── README.md
├── package.json
├── tsconfig.json
├── .env.example
└── src/
    ├── index.ts              # Full flow demo
    ├── get-policy.ts         # Fetch policy spec
    ├── list-circuits.ts      # List available circuits
    ├── submit-prove-job.ts   # Submit prove job
    └── verifier-example.ts   # Insurance verification
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BIND_API_KEY` | For prove jobs | Your Bind Protocol API key |
| `BIND_API_URL` | No | API URL (default: production) |
| `CIRCUIT_ID` | No | Override circuit ID |
| `VERIFIER_ORG_ID` | No | Share proof with this org |
| `BIND_VERIFIER_API_KEY` | For verify | Verifier's API key |
| `SHARED_PROOF_ID` | For verify | Proof ID to verify |

## Using the DIMO Adapter

The SDK includes a built-in DIMO adapter (`@bind-protocol/sdk/adapters/dimo`) that fetches vehicle telemetry directly from the DIMO network and transforms it into circuit inputs. Instead of manually specifying `mileage_90d`, `data_points`, and `speed_max`, you can let the adapter pull and aggregate the data for you:

```typescript
import { BindClient, deriveCircuitId } from "@bind-protocol/sdk";
import { createDimoAdapter } from "@bind-protocol/sdk/adapters/dimo";

// Create the adapter with your DIMO SDK client
const dimo = createDimoAdapter({ dimoClient });

// Fetch telemetry for a vehicle over a 90-day window
const telemetry = await dimo.fetchData({
  vehicleTokenId: "12345",
  from: "2025-11-01T00:00:00Z",
  to: "2026-01-30T00:00:00Z",
});

// Transform raw telemetry into circuit inputs
const circuitId = deriveCircuitId("bind.mobility.basicriskband", "0.1.0");
const inputs = dimo.toCircuitInputs(telemetry, circuitId);

// Submit the prove job with the derived inputs
const client = new BindClient({ apiKey, baseUrl });
const { jobId } = await client.submitProveJob(circuitId, inputs);
```

The adapter handles the GraphQL queries and hourly aggregation (SUM for mileage, COUNT for data points, MAX for speed) so you don't have to compute the inputs yourself.

## Use Cases

### Insurance Underwriting
Insurers can request vehicle risk proofs to:
- Offer usage-based insurance pricing
- Verify vehicle condition without accessing raw telemetry
- Automate underwriting decisions based on risk bands

### Fleet Management
Fleet operators can:
- Monitor vehicle health across their fleet
- Identify high-risk vehicles for maintenance
- Share compliance proofs with regulators

### Vehicle Financing
Lenders can:
- Assess collateral condition for auto loans
- Monitor financed vehicles without privacy concerns
- Automate risk-based interest rates
