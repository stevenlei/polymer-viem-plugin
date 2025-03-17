/**
 * Transaction Receipt Proof Example
 * ================================
 * 
 * This example demonstrates how to generate a Polymer proof for a transaction
 * using the transaction receipt.
 */

// Import modules
import { createPublicClient, http } from 'viem';
import { optimismSepolia } from 'viem/chains';
import { polymer } from '../src/index.js';
import dotenv from 'dotenv';
import { banner, printHeader, printInfo, printSuccess, printJson, printError } from './lib/cli.js';

// Load environment variables
dotenv.config();
const apiKey = process.env.POLYMER_API_KEY ?? '';

if (!apiKey) {
  printError("Please set POLYMER_API_KEY in your .env file");
  process.exit(1);
}

// Banner
console.log(banner);

// Main function
async function main() {
  printHeader("Transaction Receipt Proof Example");

  try {
    // 1. Initialize a Viem client with the Polymer plugin
    printInfo("Creating Viem client with Polymer capabilities...");
    const client = createPublicClient({
      chain: optimismSepolia,
      transport: http(),
    }).extend(polymer({
      apiKey,
      debug: true,
    }));

    // 3. Fetch a transaction receipt
    // Example transaction
    const txHash = '0x5138b0d6ffe7bfe8f1d7dca24d396dab804fa664930ef96bb9e6ebbc86426fbb';
    printInfo(`Fetching receipt for transaction: ${txHash}`);
    
    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
    printSuccess("Transaction receipt fetched!");
    printInfo(`Block: ${receipt.blockNumber}, Tx Index: ${receipt.transactionIndex}`);

    // 4. Generate a proof for the transaction
    const eventSignature = 'ValueSet(address,string,bytes,uint256,bytes32,uint256)';
    
    printInfo(`Requesting proof for event: ${eventSignature}`);
    // Use the new simplified API
    const result = await client.polymerProof({
      receipt,
      eventSignature,
      maxAttempts: 15,
      interval: 4000,
    });

    if ('jobId' in result) {
      printSuccess(`Proof requested! Job ID: ${result.jobId}`);
      printInfo("Waiting for proof generation...");
      
      const finalResult = await client.polymer.wait(result.jobId as string);
      
      if (finalResult.status === "complete" && finalResult.proof) {
        printSuccess("Proof generation complete!");
        printInfo("Proof (truncated):");
        printJson((finalResult.proof as string).substring(0, 100) + "...");
      } else {
        printError(`Proof generation failed: ${finalResult.failureReason ?? 'Unknown error'}`);
      }
    } else if (result.status === "complete" && result.proof) {
      printSuccess("Proof generation complete!");
      printInfo("Proof (truncated):");
      printJson((result.proof as string).substring(0, 100) + "...");
    } else {
      printError(`Proof generation failed: ${result.failureReason ?? 'Unknown error'}`);
    }
  } catch (error) {
    printError(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Run the example
main().catch(error => {
  printError(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
