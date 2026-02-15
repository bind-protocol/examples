/**
 * Submit Prove Job Example - DIMO Risk Band
 *
 * Submits a prove job with vehicle telemetry inputs and polls for completion.
 * Requires an API key with credits.
 *
 * Policy: bind.mobility.basicriskband v0.1.0
 *
 * Run with: npm run prove
 */

import "dotenv/config";
import { BindClient, TimeoutError, deriveCircuitId } from "@bind-protocol/sdk";

const POLICY_ID = "bind.mobility.basicriskband";
const POLICY_VERSION = "0.1.0";

// Circuit ID - derived from policy or overridden via env
const CIRCUIT_ID = process.env.CIRCUIT_ID || deriveCircuitId(POLICY_ID, POLICY_VERSION);

/**
 * Sample vehicle telemetry inputs (90-day period)
 *
 * Scenario: Well-maintained vehicle with low mileage and safe driving
 * Expected score: 50 (baseline) + 25 (low mileage) + 15 (moderate mileage) + 10 (no extreme speed) = 100
 * Expected band: LOW (score >= 71)
 */
const SAMPLE_INPUTS: Record<string, string> = {
  // Miles driven in last 90 days (u32)
  mileage_90d: "2500",
  // Ignition-on data points in 90 days (u32) — must be >= 100 for sufficient_data
  data_points: "450",
  // Max speed observed in period, mph (u16)
  speed_max: "72",
};

/**
 * Alternative test scenarios - uncomment to test
 */

// Medium risk vehicle (high mileage, safe speed)
// const SAMPLE_INPUTS: Record<string, string> = {
//   mileage_90d: "4500",
//   data_points: "300",
//   speed_max: "85",
// };

// High risk vehicle (very high mileage, extreme speed)
// const SAMPLE_INPUTS: Record<string, string> = {
//   mileage_90d: "7000",
//   data_points: "500",
//   speed_max: "110",
// };

// Insufficient data (will fail sufficient_data rule)
// const SAMPLE_INPUTS: Record<string, string> = {
//   mileage_90d: "500",
//   data_points: "50",
//   speed_max: "60",
// };

async function main() {
  const apiKey = process.env.BIND_API_KEY;
  if (!apiKey) {
    console.error("Error: BIND_API_KEY environment variable is required");
    console.log();
    console.log("Create a .env file with:");
    console.log("  BIND_API_KEY=your-api-key-here");
    process.exit(1);
  }

  const client = new BindClient({
    apiKey,
    baseUrl: process.env.BIND_API_URL,
  });

  console.log("DIMO Vehicle Risk Prove Job");
  console.log("=".repeat(60));
  console.log();

  console.log(`Circuit: ${CIRCUIT_ID}`);
  console.log();
  console.log("Vehicle Telemetry Inputs (90-day period):");
  console.log(`  Mileage:     ${Number(SAMPLE_INPUTS.mileage_90d).toLocaleString()} miles`);
  console.log(`  Data Points: ${SAMPLE_INPUTS.data_points}`);
  console.log(`  Max Speed:   ${SAMPLE_INPUTS.speed_max} mph`);
  console.log();

  // Calculate expected score for display
  const mileage = Number(SAMPLE_INPUTS.mileage_90d);
  const dataPoints = Number(SAMPLE_INPUTS.data_points);
  const speedMax = Number(SAMPLE_INPUTS.speed_max);

  let expectedScore = 50; // baseline
  const scoreBreakdown: string[] = ["Baseline: 50"];

  if (mileage <= 3000) {
    expectedScore += 25;
    scoreBreakdown.push("Low mileage (≤3,000): +25");
  }
  if (mileage <= 5000) {
    expectedScore += 15;
    scoreBreakdown.push("Moderate mileage (≤5,000): +15");
  }
  if (speedMax < 100) {
    expectedScore += 10;
    scoreBreakdown.push("No extreme speed (<100 mph): +10");
  }

  expectedScore = Math.min(100, expectedScore);

  console.log("Expected Evaluation:");
  for (const line of scoreBreakdown) {
    console.log(`  ${line}`);
  }
  console.log(`  ─────────────────────`);
  console.log(`  Total Score: ${expectedScore}`);
  console.log();

  // Determine expected band
  let expectedBand: string;
  if (expectedScore >= 71) {
    expectedBand = "LOW";
  } else if (expectedScore >= 41) {
    expectedBand = "MEDIUM";
  } else {
    expectedBand = "HIGH";
  }
  console.log(`Expected Risk Band: ${expectedBand}`);

  if (dataPoints < 100) {
    console.log();
    console.log("WARNING: Insufficient data (< 100 data points)");
    console.log("The proof will FAIL the sufficient_data rule.");
  }
  console.log();

  // Submit the prove job
  console.log("Submitting prove job...");
  const startTime = Date.now();

  try {
    const submitResult = await client.submitProveJob(CIRCUIT_ID, SAMPLE_INPUTS, {
      verificationMode: "self_verify",
    });

    const jobId = submitResult.jobId;
    console.log(`Job submitted: ${jobId}`);
    console.log();

    // Poll for completion
    console.log("Polling for completion...");
    const job = await client.waitForProveJob(jobId, {
      intervalMs: 2000,
      timeoutMs: 5 * 60 * 1000,
      onProgress: (currentJob) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  [${elapsed}s] Status: ${currentJob.status}`);
      },
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log();
    console.log("-".repeat(60));
    console.log("Result");
    console.log("-".repeat(60));
    console.log(`Status: ${job.status}`);
    console.log(`Duration: ${duration}s`);

    if (job.status === "completed") {
      console.log();
      console.log("Proof generated successfully!");
      console.log(`Verification Mode: ${job.verificationMode}`);

      if (job.downloadUrls) {
        console.log();
        console.log("Download URLs (valid for 1 hour):");
        console.log(`  Proof: ${job.downloadUrls.proof}`);
        console.log(`  Verification Key: ${job.downloadUrls.vk}`);
        console.log(`  Public Inputs: ${job.downloadUrls.publicInputs}`);
      }

      // Share with verifier if configured
      const verifierOrgId = process.env.VERIFIER_ORG_ID;
      if (verifierOrgId) {
        console.log();
        console.log("-".repeat(60));
        console.log("Sharing Proof with Insurer/Fleet Manager");
        console.log("-".repeat(60));
        console.log(`Sharing with org: ${verifierOrgId}`);

        const shareResult = await client.shareProof({
          proveJobId: jobId,
          verifierOrgId,
          note: "DIMO vehicle risk assessment for underwriting",
        });

        console.log(`Shared proof ID: ${shareResult.id}`);
        console.log();
        console.log("To verify this proof as the insurer, run:");
        console.log(`  SHARED_PROOF_ID=${shareResult.id} npm run verify`);
      } else {
        console.log();
        console.log("Tip: Set VERIFIER_ORG_ID to share this proof with an insurer.");
      }
    } else if (job.status === "failed") {
      console.log();
      console.log(`Error: ${job.error}`);
    }
  } catch (error) {
    if (error instanceof TimeoutError) {
      console.error();
      console.error("Job timed out waiting for completion.");
      console.error("The job may still complete - check the dashboard.");
    } else {
      throw error;
    }
  }

  console.log();
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
