/**
 * DIMO Risk Band Demo - Full Flow
 *
 * Demonstrates the complete flow:
 * 1. Fetch the policy specification
 * 2. Submit a prove job with vehicle telemetry inputs
 * 3. Poll for completion
 * 4. Display the results
 *
 * Policy: bind.mobility.basicriskband v0.1.0
 *
 * Run with: npm start
 */

import "dotenv/config";
import { BindClient, TimeoutError, deriveCircuitId } from "@bind-protocol/sdk";

const POLICY_ID = "bind.mobility.basicriskband";

// Risk band labels (ordered by band index)
const RISK_BANDS = ["HIGH", "MEDIUM", "LOW"];

// Vehicle telemetry inputs — modify these to test different scenarios
const VEHICLE_INPUTS: Record<string, string> = {
  mileage_90d: "2500",   // Miles driven in 90 days (u32)
  data_points: "450",     // Ignition-on data points in 90 days (u32)
  speed_max: "72",        // Max speed observed in period, mph (u16)
};

async function main() {
  const apiKey = process.env.BIND_API_KEY;

  const client = new BindClient({
    apiKey: apiKey || "",
    baseUrl: process.env.BIND_API_URL,
  });

  console.log("DIMO Vehicle Risk Band Demo - Full Flow");
  console.log("=".repeat(65));
  console.log();

  // ─────────────────────────────────────────────────────────────
  // Step 1: Fetch the policy
  // ─────────────────────────────────────────────────────────────
  console.log("Step 1: Fetching policy specification...");
  console.log();

  const policy = await client.getPolicy(POLICY_ID);

  if (!policy) {
    console.error(`Policy not found: ${POLICY_ID}`);
    console.log();
    console.log("Make sure the policy is registered in the API.");
    process.exit(1);
  }

  console.log(`  Policy: ${policy.metadata?.title ?? policy.id}`);
  console.log(`  Version: ${policy.version}`);
  console.log(`  Subject: ${policy.subject?.type ?? "N/A"}`);
  console.log(`  Validity: ${policy.validity?.ttl ?? "N/A"}`);
  console.log();

  console.log("  Outputs:");
  for (const output of policy.outputs ?? []) {
    let info = `${output.name} (${output.type})`;
    if (output.derive.kind === "BAND" && "bands" in output.derive) {
      const bands = output.derive.bands as Array<{ label: string }>;
      info += ` - bands: ${bands.map((b) => b.label).join(", ")}`;
    }
    console.log(`    - ${info}`);
  }
  console.log();

  // Derive the circuit ID from policy ID and version
  const circuitId = process.env.CIRCUIT_ID || deriveCircuitId(policy.id, policy.version);
  console.log(`  Circuit ID: ${circuitId}`);
  console.log();

  // ─────────────────────────────────────────────────────────────
  // Step 2: Submit prove job (requires API key)
  // ─────────────────────────────────────────────────────────────
  if (!apiKey) {
    console.log("Step 2: Skipping prove job (no API key)");
    console.log();
    console.log("To submit a prove job, set BIND_API_KEY in your .env file.");
    console.log();
    return;
  }

  console.log("Step 2: Submitting prove job...");
  console.log();

  console.log("  Vehicle Telemetry (90-day period):");
  console.log(`    Mileage:     ${Number(VEHICLE_INPUTS.mileage_90d).toLocaleString()} miles`);
  console.log(`    Data Points: ${VEHICLE_INPUTS.data_points}`);
  console.log(`    Max Speed:   ${VEHICLE_INPUTS.speed_max} mph`);
  console.log();

  // Calculate expected score for display
  const mileage = Number(VEHICLE_INPUTS.mileage_90d);
  const dataPoints = Number(VEHICLE_INPUTS.data_points);
  const speedMax = Number(VEHICLE_INPUTS.speed_max);

  // Check sufficient_data rule (severity: fail)
  if (dataPoints < 100) {
    console.log("  WARNING: Insufficient data (< 100 data points)");
    console.log("  The proof will FAIL the sufficient_data rule.");
    console.log();
  }

  // Scoring: baseline 50
  let expectedScore = 50;
  if (mileage <= 3000) expectedScore += 25;   // low_mileage
  if (mileage <= 5000) expectedScore += 15;   // moderate_mileage
  if (speedMax < 100)  expectedScore += 10;   // no_extreme_speed
  expectedScore = Math.min(100, expectedScore);

  let expectedBand: string;
  if (expectedScore >= 71) expectedBand = "LOW";
  else if (expectedScore >= 41) expectedBand = "MEDIUM";
  else expectedBand = "HIGH";

  console.log(`  Expected Score: ${expectedScore}`);
  console.log(`  Expected Band: ${expectedBand}`);
  console.log();

  const startTime = Date.now();

  try {
    const { jobId } = await client.submitProveJob(circuitId, VEHICLE_INPUTS, {
      verificationMode: "self_verify",
    });
    console.log(`  Job ID: ${jobId}`);
    console.log();

    // ─────────────────────────────────────────────────────────────
    // Step 3: Poll for completion
    // ─────────────────────────────────────────────────────────────
    console.log("Step 3: Waiting for proof generation...");
    console.log();

    const job = await client.waitForProveJob(jobId, {
      intervalMs: 2000,
      timeoutMs: 5 * 60 * 1000,
      onProgress: (currentJob) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  [${elapsed}s] ${currentJob.status}`);
      },
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log();

    // ─────────────────────────────────────────────────────────────
    // Step 4: Display results
    // ─────────────────────────────────────────────────────────────
    console.log("Step 4: Results");
    console.log("-".repeat(65));
    console.log();

    console.log(`  Status: ${job.status}`);
    console.log(`  Duration: ${duration}s`);

    if (job.status === "completed") {
      console.log();
      console.log("  Proof generated successfully!");

      if (job.attestationId) {
        console.log();
        console.log(`  zkVerify Attestation: ${job.attestationId}`);
      }

      if (job.zkVerifyTxHash) {
        console.log(`  Transaction Hash: ${job.zkVerifyTxHash}`);
      }

      if (job.downloadUrls) {
        console.log();
        console.log("  Download URLs (signed, valid for 1 hour):");
        console.log(`    Proof: ${job.downloadUrls.proof}`);
        console.log(`    Verification Key: ${job.downloadUrls.vk}`);
        console.log(`    Public Inputs: ${job.downloadUrls.publicInputs}`);
      }

      // Share with verifier if configured
      const verifierOrgId = process.env.VERIFIER_ORG_ID;
      if (verifierOrgId) {
        console.log();
        console.log("-".repeat(65));
        console.log("Sharing with Insurer");
        console.log("-".repeat(65));

        const shareResult = await client.shareProof({
          proveJobId: jobId,
          verifierOrgId,
          note: "DIMO vehicle risk assessment",
        });

        console.log(`  Shared proof ID: ${shareResult.id}`);
        console.log();
        console.log("  To verify as the insurer:");
        console.log(`    SHARED_PROOF_ID=${shareResult.id} npm run verify`);
      }
    } else if (job.status === "failed") {
      console.log();
      console.log(`  Error: ${job.error}`);
    }
  } catch (error) {
    if (error instanceof TimeoutError) {
      console.error();
      console.error("  Timeout: Job did not complete in time.");
      console.error("  Check the dashboard for job status.");
    } else {
      throw error;
    }
  }

  console.log();
  console.log("=".repeat(65));
  console.log("Demo complete");
  console.log("=".repeat(65));
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
