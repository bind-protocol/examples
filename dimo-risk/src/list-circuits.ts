/**
 * List Circuits Example - DIMO Risk Band
 *
 * Lists available circuits and shows how to activate them.
 * Requires an API key.
 *
 * Run with: npm run circuits
 */

import "dotenv/config";
import { BindClient, ApiError, AuthenticationError } from "@bind-protocol/sdk";

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

  console.log("Listing Available Circuits");
  console.log("=".repeat(50));
  console.log();

  // List active circuits (default)
  const circuits = await client.listCircuits();

  if (circuits.length === 0) {
    console.log("No active circuits found.");
    console.log();
    console.log("Hint: Ask an admin to generate and activate a circuit,");
    console.log("or use the Dashboard to manage circuits.");
  } else {
    console.log(`Found ${circuits.length} circuit(s):\n`);

    for (const circuit of circuits) {
      console.log("-".repeat(40));
      console.log(`Circuit ID: ${circuit.circuitId}`);
      console.log(`  Name: ${circuit.name}`);
      if (circuit.description) {
        console.log(`  Description: ${circuit.description}`);
      }
      console.log(`  Version: ${circuit.version}`);
      console.log(`  Status: ${circuit.status}`);
      if (circuit.policyId) {
        console.log(`  Policy ID: ${circuit.policyId}`);
      }
      if (circuit.validationStatus) {
        console.log(`  Validation: ${circuit.validationStatus}`);
      }
      console.log(`  Scheme: ${circuit.scheme}`);
      console.log(`  Created: ${circuit.createdAt}`);
      console.log();
    }
  }

  // Also show how to get a specific circuit
  // Note: Circuit ID uses dots and underscores to match the policy's proving.circuitId
  const targetCircuitId = process.env.CIRCUIT_ID || "bind.mobility.basicriskband.v0_1_0";
  console.log(`\nChecking specific circuit: ${targetCircuitId}`);
  console.log("-".repeat(40));

  try {
    const circuit = await client.getCircuit(targetCircuitId);
    console.log(`Found circuit: ${circuit.name}`);
    console.log(`  Status: ${circuit.status}`);
    console.log(`  Validation: ${circuit.validationStatus || "N/A"}`);

    // Show activation hint if not active but validated
    if (circuit.status !== "active" && circuit.validationStatus === "validated") {
      console.log();
      console.log("This circuit is validated and can be activated.");
      console.log("To activate, you can use:");
      console.log(`  await client.activateCircuit("${circuit.circuitId}")`);
    }
  } catch {
    console.log("Circuit not found or not accessible.");
    console.log();
    console.log("This could mean:");
    console.log("  - The circuit hasn't been created yet");
    console.log("  - The circuit exists but is not active");
    console.log("  - You need admin access to see inactive circuits");
  }

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
