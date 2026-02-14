/**
 * Get Policy Example
 *
 * Fetches the credit-score demo policy from the API.
 * No API key required - policies are publicly accessible.
 *
 * Run with: npm run get-policy
 */

import "dotenv/config";
import { BindClient, ApiError, AuthenticationError } from "@bind-protocol/sdk";

const POLICY_ID = "bind.demo.credit-score";

async function main() {
  const client = new BindClient({
    apiKey: "", // Not required for fetching policies
    baseUrl: process.env.BIND_API_URL,
  });

  console.log("Credit Score Policy Viewer");
  console.log("=".repeat(50));
  console.log();

  console.log(`Fetching policy: ${POLICY_ID}...`);
  console.log();

  const policy = await client.getPolicy(POLICY_ID);

  if (!policy) {
    console.error(`Policy not found: ${POLICY_ID}`);
    console.log();
    console.log("Make sure the policy is registered in the API.");
    console.log("You can list all policies with: npm run policies");
    process.exit(1);
  }

  console.log("-".repeat(50));
  console.log("Policy Details");
  console.log("-".repeat(50));
  console.log(`ID: ${policy.id}`);
  console.log(`Title: ${policy.metadata?.title ?? "N/A"}`);
  console.log(`Version: ${policy.version}`);
  console.log(`Namespace: ${policy.metadata?.namespace ?? "N/A"}`);

  if (policy.metadata?.description) {
    console.log(`Description: ${policy.metadata.description}`);
  }

  console.log(`Subject Type: ${policy.subject?.type ?? "N/A"}`);

  if (policy.validity?.ttl) {
    console.log(`Validity: ${policy.validity.ttl}`);
  }

  console.log();
  console.log("Outputs:");
  for (const output of policy.outputs ?? []) {
    let derivation = output.derive.kind;
    if (output.derive.kind === "BAND" && "bands" in output.derive) {
      derivation += ` (${output.derive.bands.map((b) => b.label).join(", ")})`;
    }
    console.log(`  - ${output.name}: ${output.type} [${derivation}]`);
  }

  if (policy.disclosure?.exposeClaims) {
    console.log();
    console.log(`Disclosed Claims: ${policy.disclosure.exposeClaims.join(", ")}`);
  }

  console.log(`Policy Hash: ${policy.integrity?.policyHash ?? "N/A"}`);
  console.log();
}

main().catch((error) => {
  if (error instanceof AuthenticationError) {
    console.error("Authentication failed — check your API key.");
  } else if (error instanceof ApiError) {
    console.error(`API error (${error.status}): ${error.message}`);
  } else {
    console.error("Error:", error.message);
  }
  process.exit(1);
});
