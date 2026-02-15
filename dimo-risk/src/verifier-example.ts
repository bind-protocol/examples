/**
 * Verifier Example - DIMO Risk Band
 *
 * Demonstrates how an insurer or fleet manager would verify a vehicle risk credential
 * using the policy spec to understand what was proven.
 *
 * Run with: npm run verify
 *
 * Two modes:
 *
 *   Direct mode (same org, no sharing needed):
 *     PROVE_JOB_ID=<job-id> npm run verify
 *     Uses BIND_API_KEY from .env
 *
 *   Shared proof mode (cross-org):
 *     SHARED_PROOF_ID=<id> BIND_VERIFIER_API_KEY=<key> npm run verify
 *
 * Optional env vars:
 *   BIND_API_URL - API base URL (defaults to production)
 */

import "dotenv/config";
import { BindClient } from "@bind-protocol/sdk";

// Risk band labels for display
const RISK_BANDS = ["HIGH", "MEDIUM", "LOW"];

// ── Shared helpers ──────────────────────────────────────────────

interface PolicyLike {
  id: string;
  version: string;
  metadata?: { title?: string };
  subject: { type: string };
  outputs: Array<{
    name: string;
    type: string;
    derive: { kind: string; bands?: Array<{ label: string }> };
  }>;
  disclosure?: { exposeClaims?: string[] };
  validity?: { ttl?: string };
}

function validatePolicy(policy: PolicyLike): boolean {
  console.log(`Found policy: ${policy.metadata?.title ?? policy.id}`);
  console.log();

  console.log(`Step 3: Validating policy acceptability...`);

  const validationResults: string[] = [];

  // Check version — in production, use semver range validation (e.g. semver.satisfies)
  if (policy.version.startsWith("0.")) {
    validationResults.push(`Version: ${policy.version}`);
  } else {
    console.error(`Unsupported policy version: ${policy.version}`);
    process.exit(1);
  }

  // Check subject type
  if (policy.subject?.type === "vehicle") {
    validationResults.push(`Subject type: ${policy.subject.type}`);
  } else {
    console.error(`Unexpected subject type: ${policy.subject?.type}`);
    process.exit(1);
  }

  // Check for required output - the policy has a "riskBand" enum output
  const riskOutput = policy.outputs?.find((o) => o.name === "riskBand");
  if (riskOutput) {
    validationResults.push(`Has "${riskOutput.name}" output (${riskOutput.type})`);

    // Verify it uses BAND derivation
    if (riskOutput.derive.kind === "BAND") {
      validationResults.push("Uses BAND derivation");

      // Check bands are acceptable
      const bands = riskOutput.derive.bands;
      if (bands) {
        const bandLabels = bands.map((b) => b.label).join(", ");
        validationResults.push(`Risk bands: ${bandLabels}`);
      }
    }

    // Check if the output is disclosed via the typed DisclosureSpec
    const isDisclosed =
      policy.disclosure?.exposeClaims?.includes("riskBand");
    if (isDisclosed) {
      validationResults.push("Risk band is disclosed");
    }
  } else {
    console.error("Policy missing required 'riskBand' output");
    process.exit(1);
  }

  console.log("Policy validation passed:");
  validationResults.forEach((r) => console.log(`   ${r}`));
  console.log();
  return true;
}

function checkFreshness(
  completedAt: string | null,
  fallbackDate: string,
  policy: PolicyLike | null,
  step: number,
): void {
  console.log(`Step ${step}: Checking proof freshness...`);
  const provedAt = completedAt
    ? new Date(completedAt)
    : new Date(fallbackDate);
  const ageMs = Date.now() - provedAt.getTime();
  const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));

  // Parse TTL - supports "P90D" (ISO 8601) or "90d" format
  const ttlString = policy?.validity?.ttl ?? "P90D";
  const isoMatch = ttlString.match(/^P(\d+)D$/i);
  const simpleMatch = ttlString.match(/^(\d+)d$/i);
  const ttlDays = isoMatch
    ? parseInt(isoMatch[1], 10)
    : simpleMatch
      ? parseInt(simpleMatch[1], 10)
      : 90;

  console.log(`Proof age: ${ageDays} days`);
  console.log(`Policy TTL: ${ttlDays} days${!policy ? " (default)" : ""}`);

  if (ageDays <= ttlDays) {
    console.log("Status: Fresh");
  } else {
    console.error("Status: EXPIRED - proof is too old");
    console.log();
    console.log("For insurance underwriting, request a fresh proof from the vehicle owner.");
    process.exit(1);
  }
  console.log();
}

function resolveBandLabel(
  claims: Record<string, unknown>,
  policy: PolicyLike | null,
): string {
  // Try named claim first (from credential)
  const riskBandClaim = claims["riskBand"] ?? claims["outputValue"];
  const bandIndex = typeof riskBandClaim === "number"
    ? riskBandClaim
    : typeof riskBandClaim === "string"
      ? Number(riskBandClaim)
      : 0;

  // Get band label from policy or use default
  const bands = policy?.outputs?.[0]?.derive?.bands;
  if (bands && bands[bandIndex]) {
    return bands[bandIndex].label;
  }
  return RISK_BANDS[bandIndex] ?? `Band ${bandIndex}`;
}

function displayResults(
  claims: Record<string, unknown>,
  policy: PolicyLike | null,
  summary: { policyTitle: string; circuitName: string; prover: string },
): void {
  console.log("Credential verification successful!");
  console.log();

  // Display named claims from the credential
  // The server maps public inputs to named output fields from the policy spec
  console.log("Credential Claims:");
  for (const [key, value] of Object.entries(claims)) {
    if (key === "riskBand" || key === "outputValue") {
      const bandLabel = resolveBandLabel(claims, policy);
      console.log(`  ${key}: ${value} (${bandLabel})`);
    } else {
      console.log(`  ${key}: ${value}`);
    }
  }
  console.log();

  // Resolve band label for underwriting guidance
  const bandLabel = resolveBandLabel(claims, policy);

  // Insurance decision guidance
  console.log("-".repeat(60));
  console.log("Underwriting Guidance");
  console.log("-".repeat(60));

  if (bandLabel === "LOW") {
    console.log("  Recommendation: APPROVE");
    console.log("  - Vehicle shows excellent maintenance and usage patterns");
    console.log("  - Eligible for preferred rates and coverage options");
    console.log("  - Consider usage-based insurance discount");
  } else if (bandLabel === "MEDIUM") {
    console.log("  Recommendation: REVIEW");
    console.log("  - Vehicle shows moderate risk indicators");
    console.log("  - Standard rates apply");
    console.log("  - Consider requesting additional documentation");
  } else if (bandLabel === "HIGH") {
    console.log("  Recommendation: CAUTION");
    console.log("  - Vehicle shows significant risk factors");
    console.log("  - May require inspection before coverage");
    console.log("  - Higher deductible or limited coverage recommended");
  }
  console.log();

  console.log("=".repeat(60));
  console.log("Verification Complete");
  console.log("=".repeat(60));
  console.log();
  console.log("What was proven:");
  console.log(`  Policy: ${summary.policyTitle}`);
  console.log(`  Circuit: ${summary.circuitName}`);
  console.log(`  Prover: ${summary.prover}`);
  console.log(`  Risk Band: ${bandLabel}`);
  console.log();
  console.log("Privacy preserved - the insurer verified vehicle risk without seeing:");
  console.log("  - Actual mileage driven");
  console.log("  - Max speed recorded");
  console.log("  - Raw telemetry data points");
  console.log("  - Driving patterns or locations");
  console.log();
}

// ── Direct mode ─────────────────────────────────────────────────

async function verifyDirect(proveJobId: string, apiKey: string) {
  const client = new BindClient({
    apiKey,
    baseUrl: process.env.BIND_API_URL,
  });

  console.log("Direct Verification: Verifying proof from prove job");
  console.log("=".repeat(60));
  console.log();

  // Step 1: Fetch the prove job
  console.log("Step 1: Fetching prove job...");
  const job = await client.getProveJob(proveJobId);
  console.log(`  Job ID: ${job.jobId}`);
  console.log(`  Circuit: ${job.circuitId}`);
  console.log(`  Status: ${job.status}`);
  console.log(`  Verification Mode: ${job.verificationMode}`);
  console.log();

  if (job.status !== "completed") {
    console.error(`Error: Job status is "${job.status}" — only completed jobs can be verified`);
    process.exit(1);
  }

  // Step 2: Look up circuit to find policy
  console.log("Step 2: Looking up circuit and policy...");
  const circuit = await client.getCircuit(job.circuitId);
  console.log(`  Circuit: ${circuit.name} (${circuit.circuitId})`);

  let policy: PolicyLike | null = null;
  let policyValidated = false;

  if (circuit.policyId) {
    console.log(`  Policy ID: ${circuit.policyId}`);
    console.log();

    try {
      policy = await client.getPolicy(circuit.policyId);
    } catch {
      // Policy may not be fetchable
    }

    if (!policy) {
      try {
        const allPolicies = await client.listPolicies();
        policy = allPolicies.find((p) => p.id === circuit.policyId) ?? null;
      } catch {
        // Best-effort
      }
    }

    if (policy) {
      policyValidated = validatePolicy(policy);
    } else {
      console.log(`  Policy not found: ${circuit.policyId}`);
      console.log("  Skipping policy validation.");
      console.log();
    }
  } else {
    console.log("  No policy associated with this circuit.");
    console.log();
  }

  // Check proof freshness
  const freshnessStep = policyValidated ? 4 : 3;
  checkFreshness(job.completedAt, job.createdAt, policy, freshnessStep);

  // Issue a credential — the server does policy spec lookup and maps
  // public inputs to named output fields (e.g. "riskBand": 2)
  let step = freshnessStep + 1;
  console.log(`Step ${step}: Issuing proof credential...`);

  let credential;
  try {
    credential = await client.issueProofCredential(proveJobId, {
      format: "compact",
    });
    console.log(`  Credential ID: ${credential.credentialId}`);
    console.log(`  Format: ${credential.format}`);
    console.log(`  Issued At: ${credential.issuedAt}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to issue credential: ${message}`);
    process.exit(1);
  }
  console.log();

  // Verify the credential JWT — validates the issuer signature
  // and returns named claims from the policy spec
  step++;
  console.log(`Step ${step}: Verifying credential...`);

  try {
    const verifyResult = await client.verifyCredential(credential.jwt);

    if (!verifyResult.valid) {
      console.error(`Credential is invalid: ${verifyResult.error}`);
      process.exit(1);
    }

    console.log(`  Issuer: ${verifyResult.issuer}`);
    if (verifyResult.subject) {
      console.log(`  Subject: ${verifyResult.subject}`);
    }
    console.log();

    step++;
    console.log(`Step ${step}: Processing verification result...`);

    displayResults(verifyResult.claims, policy, {
      policyTitle: policy?.metadata?.title ?? circuit.policyId ?? job.circuitId,
      circuitName: circuit.name,
      prover: "(same org — direct verification)",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Credential verification error: ${message}`);
    process.exit(1);
  }
}

// ── Shared proof mode ───────────────────────────────────────────

async function verifySharedProof(sharedProofId: string, apiKey: string) {
  const client = new BindClient({
    apiKey,
    baseUrl: process.env.BIND_API_URL,
  });

  console.log("Insurance/Fleet Verification: Processing Vehicle Risk Assessment");
  console.log("=".repeat(65));
  console.log();

  // Step 1: Fetch the shared proof details
  console.log("Step 1: Fetching shared proof details...");
  const sharedProof = await client.getSharedProof(sharedProofId);
  console.log(`  Proof Job: ${sharedProof.proveJobId}`);
  console.log(`  Circuit: ${sharedProof.proveJob.circuitName}`);
  console.log(`  From Org: ${sharedProof.sharingOrgId}`);
  console.log(`  Shared At: ${sharedProof.createdAt}`);
  if (sharedProof.note) {
    console.log(`  Note: ${sharedProof.note}`);
  }
  console.log();

  // Check if proof is expired or revoked
  if (sharedProof.revokedAt) {
    console.error("Error: This shared proof has been revoked");
    process.exit(1);
  }
  if (sharedProof.expiresAt && new Date(sharedProof.expiresAt) < new Date()) {
    console.error("Error: This shared proof has expired");
    process.exit(1);
  }

  // Get policy ID from the shared proof
  const policyId = sharedProof.proveJob.policyId;
  if (!policyId) {
    console.error("Error: This proof is not associated with a policy");
    process.exit(1);
  }
  console.log(`  Policy ID: ${policyId}`);
  console.log();

  // Step 2: Get the policy specification from the shared proof response
  console.log("Step 2: Getting policy specification...");

  let policy: PolicyLike | null = sharedProof.policySpec ?? null;

  if (!policy) {
    console.log("  Policy not included in shared proof, fetching separately...");
    policy = await client.getPolicy(policyId);

    if (!policy) {
      const allPolicies = await client.listPolicies();
      policy = allPolicies.find((p) => p.id === policyId) ?? null;
    }
  }

  let policyValidated = false;

  if (!policy) {
    console.log(`  Policy not found: ${policyId}`);
    console.log("  Note: Policy spec not available (demo policy not in S3).");
    console.log("  Skipping policy validation.");
    console.log();
  } else {
    policyValidated = validatePolicy(policy);
  }

  // Check proof freshness
  const freshnessStep = policyValidated ? 4 : 3;
  checkFreshness(
    sharedProof.proveJob.completedAt,
    sharedProof.createdAt,
    policy,
    freshnessStep,
  );

  // Issue a credential from the shared prove job — the server does policy spec
  // lookup and maps public inputs to named output fields
  let step = freshnessStep + 1;
  console.log(`Step ${step}: Issuing proof credential...`);

  let credential;
  try {
    credential = await client.issueProofCredential(sharedProof.proveJobId, {
      format: "compact",
    });
    console.log(`  Credential ID: ${credential.credentialId}`);
    console.log(`  Format: ${credential.format}`);
    console.log(`  Issued At: ${credential.issuedAt}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to issue credential: ${message}`);
    process.exit(1);
  }
  console.log();

  // Verify the credential JWT
  step++;
  console.log(`Step ${step}: Verifying credential...`);

  try {
    const verifyResult = await client.verifyCredential(credential.jwt);

    if (!verifyResult.valid) {
      console.error(`Credential is invalid: ${verifyResult.error}`);
      process.exit(1);
    }

    console.log(`  Issuer: ${verifyResult.issuer}`);
    if (verifyResult.subject) {
      console.log(`  Subject: ${verifyResult.subject}`);
    }
    console.log();

    step++;
    console.log(`Step ${step}: Processing verification result...`);

    displayResults(verifyResult.claims, policy, {
      policyTitle: policy?.metadata?.title ?? policyId,
      circuitName: sharedProof.proveJob.circuitName,
      prover: sharedProof.sharingOrgId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Credential verification error: ${message}`);
    process.exit(1);
  }
}

// ── Entry point ─────────────────────────────────────────────────

async function main() {
  const proveJobId = process.env.PROVE_JOB_ID;
  const sharedProofId = process.env.SHARED_PROOF_ID;

  // Direct mode: PROVE_JOB_ID + BIND_API_KEY
  if (proveJobId) {
    const apiKey = process.env.BIND_API_KEY;
    if (!apiKey) {
      console.error("Error: BIND_API_KEY environment variable is required for direct verification");
      process.exit(1);
    }
    return verifyDirect(proveJobId, apiKey);
  }

  // Shared proof mode: SHARED_PROOF_ID + BIND_VERIFIER_API_KEY
  if (sharedProofId) {
    const apiKey = process.env.BIND_VERIFIER_API_KEY;
    if (!apiKey) {
      console.error("Error: BIND_VERIFIER_API_KEY environment variable is required for shared proof verification");
      process.exit(1);
    }
    return verifySharedProof(sharedProofId, apiKey);
  }

  // Neither mode — print usage
  console.error("Error: No proof specified. Use one of:");
  console.log();
  console.log("  Direct verification (same org, after proving):");
  console.log("    PROVE_JOB_ID=<job-id> npm run verify");
  console.log();
  console.log("  Shared proof verification (cross-org):");
  console.log("    SHARED_PROOF_ID=<id> BIND_VERIFIER_API_KEY=<key> npm run verify");
  process.exit(1);
}

main().catch(console.error);
