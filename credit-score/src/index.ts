/**
 * Credit Score Demo - Full Flow
 *
 * Demonstrates the complete flow:
 * 1. Fetch the policy specification
 * 2. Submit a prove job with credit inputs
 * 3. Poll for completion
 * 4. Display the results
 *
 * Run with: npm start
 */

import "dotenv/config";
import { BindClient, TimeoutError, deriveCircuitId } from "@bind-protocol/sdk";

const POLICY_ID = "bind.demo.credit-score";

// Credit score inputs - modify these to test different scenarios
const CREDIT_INPUTS: Record<string, string> = {
  income: "75000",           // Annual income in USD
  debt: "25000",             // Total debt in USD
  credit_history_months: "48", // Months of credit history
};

async function main() {
  const apiKey = process.env.BIND_API_KEY;

  const client = new BindClient({
    apiKey: apiKey || "",
    baseUrl: process.env.BIND_API_URL,
  });

  console.log("Credit Score Demo - Full Flow");
  console.log("=".repeat(60));
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
  console.log();

  console.log("  Outputs:");
  for (const output of policy.outputs ?? []) {
    let info = `${output.name} (${output.type})`;
    if (output.derive.kind === "BAND" && "bands" in output.derive) {
      info += ` - bands: ${output.derive.bands.map((b) => b.label).join(", ")}`;
    }
    console.log(`    - ${info}`);
  }
  console.log();

  // Derive the circuit ID from policy ID and version
  // Can be overridden via CIRCUIT_ID env var for testing
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

  console.log("  Inputs:");
  console.log(`    income: $${Number(CREDIT_INPUTS.income).toLocaleString()}`);
  console.log(`    debt: $${Number(CREDIT_INPUTS.debt).toLocaleString()}`);
  console.log(`    credit_history_months: ${CREDIT_INPUTS.credit_history_months}`);
  console.log();

  // Show expected evaluation
  const income = Number(CREDIT_INPUTS.income);
  const debt = Number(CREDIT_INPUTS.debt);
  const debtToIncome = (debt / income) * 100;

  console.log("  Expected evaluation:");
  console.log(`    Debt-to-income: ${debtToIncome.toFixed(1)}% (max 50%)`);
  console.log(`    Credit history: ${CREDIT_INPUTS.credit_history_months} months (min 12)`);
  console.log();

  const startTime = Date.now();

  try {
    const { jobId } = await client.submitProveJob(circuitId, CREDIT_INPUTS);
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
    console.log("-".repeat(60));
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
        console.log("  Download URLs (signed, valid for 24 hours):");
        console.log(`    Proof: ${job.downloadUrls.proof}`);
        console.log(`    Verification Key: ${job.downloadUrls.vk}`);
        console.log(`    Public Inputs: ${job.downloadUrls.publicInputs}`);
        if (job.downloadUrls.proofHex) {
          console.log(`    Proof (hex): ${job.downloadUrls.proofHex}`);
        }
        if (job.downloadUrls.vkHex) {
          console.log(`    VK (hex): ${job.downloadUrls.vkHex}`);
        }
        if (job.downloadUrls.pubsHex) {
          console.log(`    Public Inputs (hex): ${job.downloadUrls.pubsHex}`);
        }
      } else if (job.outputs) {
        console.log();
        console.log("  Proof artifacts (S3 keys):");
        if (job.outputs.proofKey) console.log(`    Proof: ${job.outputs.proofKey}`);
        if (job.outputs.vkKey) console.log(`    VK: ${job.outputs.vkKey}`);
        if (job.outputs.pubsKey) console.log(`    Public inputs: ${job.outputs.pubsKey}`);
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
  console.log("=".repeat(60));
  console.log("Demo complete");
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
