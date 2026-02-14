/**
 * Submit Prove Job Example - Credit Score
 *
 * Submits a prove job with credit score inputs and polls for completion.
 * Requires an API key with credits.
 *
 * Run with: npm run prove
 */

import "dotenv/config";
import { BindClient, TimeoutError } from "@bind-protocol/sdk";

// Circuit ID must match exactly what's in the database
// Note: This uses underscores (credit_score) to match the policy's proving.circuitId
const DEFAULT_CIRCUIT_ID = "bind.demo.credit_score.v0_1_0";

// Allow override via env var
const CIRCUIT_ID = process.env.CIRCUIT_ID || DEFAULT_CIRCUIT_ID;

// Example credit score inputs — a passing scenario
// All values must be strings (circuit inputs are stringified)
const SAMPLE_INPUTS: Record<string, string> = {
  // Annual income in USD
  income: "75000",
  // Total debt in USD
  debt: "25000",
  // Months of credit history
  credit_history_months: "48",
};

// To test a failing scenario, try these inputs instead:
//   income: "50000", debt: "30000", credit_history_months: "6"
// This fails both the DTI check (60% > 50%) and the credit history check (6 < 12).

async function main() {
  const apiKey = process.env.BIND_API_KEY;
  if (!apiKey) {
    console.error("Error: BIND_API_KEY environment variable is required");
    console.log();
    console.log("Create a .env file with:");
    console.log('  BIND_API_KEY=your-api-key-here');
    process.exit(1);
  }

  const client = new BindClient({
    apiKey,
    baseUrl: process.env.BIND_API_URL,
  });

  console.log("Credit Score Prove Job Example");
  console.log("=".repeat(50));
  console.log();

  console.log(`Circuit: ${CIRCUIT_ID}`);
  console.log();
  console.log("Inputs:");
  console.log(`  income: $${Number(SAMPLE_INPUTS.income).toLocaleString()}`);
  console.log(`  debt: $${Number(SAMPLE_INPUTS.debt).toLocaleString()}`);
  console.log(`  credit_history_months: ${SAMPLE_INPUTS.credit_history_months} months`);
  console.log();

  // Calculate expected results for display
  const income = Number(SAMPLE_INPUTS.income);
  const debt = Number(SAMPLE_INPUTS.debt);
  const historyMonths = Number(SAMPLE_INPUTS.credit_history_months);
  const debtToIncome = debt / income;

  console.log("Expected Evaluation:");
  console.log(`  Debt-to-Income Ratio: ${(debtToIncome * 100).toFixed(1)}% (threshold: 50%)`);
  console.log(`  Credit History: ${historyMonths} months (minimum: 12)`);
  console.log();

  // Submit the prove job
  console.log("Submitting prove job...");
  const startTime = Date.now();

  try {
    const submitResult = await client.submitProveJob(CIRCUIT_ID, SAMPLE_INPUTS, {
      // Use self_verify mode - proof is stored in S3 and client verifies locally
      // Alternative: 'zkverify' to submit proof to zkVerify blockchain
      verificationMode: 'self_verify',
    });

    const jobId = submitResult.jobId;
    console.log(`Job submitted: ${jobId}`);
    console.log();

    // Poll for completion
    console.log("Polling for completion...");
    const job = await client.waitForProveJob(jobId, {
      intervalMs: 2000,
      timeoutMs: 5 * 60 * 1000, // 5 minutes
      onProgress: (currentJob) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  [${elapsed}s] Status: ${currentJob.status}`);
      },
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log();
    console.log("-".repeat(50));
    console.log("Result");
    console.log("-".repeat(50));
    console.log(`Status: ${job.status}`);
    console.log(`Duration: ${duration}s`);

    if (job.status === "completed") {
      console.log();
      console.log("Proof generated successfully!");
      console.log(`Verification Mode: ${job.verificationMode}`);
      console.log();

      if (job.outputs) {
        console.log("Proof Artifacts (S3 Keys):");
        if (job.outputs.proofKey) {
          console.log(`  Proof: ${job.outputs.proofKey}`);
        }
        if (job.outputs.vkKey) {
          console.log(`  Verification Key: ${job.outputs.vkKey}`);
        }
        if (job.outputs.pubsKey) {
          console.log(`  Public Inputs: ${job.outputs.pubsKey}`);
        }
      }

      // self_verify mode: show download URLs for local verification
      if (job.verificationMode === 'self_verify' && job.downloadUrls) {
        console.log();
        console.log("Download URLs (valid for 1 hour):");
        console.log(`  Proof: ${job.downloadUrls.proof}`);
        console.log(`  Verification Key: ${job.downloadUrls.vk}`);
        console.log(`  Public Inputs: ${job.downloadUrls.publicInputs}`);
        console.log();
        console.log("To verify locally with Barretenberg CLI:");
        console.log("  1. Download the proof and vk files from the URLs above");
        console.log("  2. Run: bb verify -s ultra_honk -k vk.bin -p proof.bin");
        console.log("  3. Exit code 0 = valid proof");
      }

      // zkverify mode: show attestation info
      if (job.verificationMode === 'zkverify') {
        if (job.attestationId) {
          console.log();
          console.log(`zkVerify Attestation ID: ${job.attestationId}`);
        }

        if (job.zkVerifyTxHash) {
          console.log(`zkVerify Transaction: ${job.zkVerifyTxHash}`);
        }
      }

      // Optional: Share the proof with a verifier organization
      const verifierOrgId = process.env.VERIFIER_ORG_ID;
      if (verifierOrgId) {
        console.log();
        console.log("-".repeat(50));
        console.log("Sharing Proof");
        console.log("-".repeat(50));
        console.log(`Sharing with verifier org: ${verifierOrgId}`);

        const shareResult = await client.shareProof({
          proveJobId: jobId,
          verifierOrgId,
          note: "Credit score proof for loan application",
        });

        console.log(`Shared proof ID: ${shareResult.id}`);
        console.log();
        console.log("To verify this proof, run the verifier example with:");
        console.log(`  SHARED_PROOF_ID=${shareResult.id} npm run verify`);
      } else {
        console.log();
        console.log("Tip: Set VERIFIER_ORG_ID to automatically share this proof with a verifier.");
      }

      // Always show direct verification hint
      console.log();
      console.log("To verify this proof directly:");
      console.log(`  PROVE_JOB_ID=${jobId} npm run verify`);
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
