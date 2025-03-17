# Polymer Viem Plugin

A plugin for Viem that adds Polymer proof capabilities, allowing you to request and verify cross-chain transaction proofs.

## Overview

The Polymer Viem Plugin extends Viem with the ability to generate proofs from the Polymer Prove API for transactions. These proofs can be used to verify the existence and validity of transaction events across different blockchains, enabling secure cross-chain communication.

### What is Polymer?

Polymer makes cross-rollup interoperability fast and easy for application builders. Find out more at [Polymer Labs](https://www.polymerlabs.org).

## Installation

```bash
npm install polymer-viem viem
# or
yarn add polymer-viem viem
# or
pnpm add polymer-viem viem
```

## Usage

### Using Viem's Extension System

```typescript
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { polymer } from "polymer-viem";

// Initialize a Viem client with the Polymer plugin
const client = createPublicClient({
  chain: mainnet,
  transport: http(),
}).extend(
  polymer({
    apiKey: "YOUR_POLYMER_API_KEY",
    debug: true, // Optional
  })
);

// Generate a proof using a transaction receipt
const receipt = await client.getTransactionReceipt({
  hash: "0x123...",
});

const result = await client.polymerProof({
  receipt,
  eventSignature: "Transfer(address,address,uint256)",
});

// If the proof is processed asynchronously, you'll get a job ID
if ("jobId" in result) {
  console.log(`Proof requested! Job ID: ${result.jobId}`);
  // Wait for the proof to be generated
  const finalResult = await client.polymer.wait(result.jobId);
  console.log("Proof:", finalResult.proof);
} else {
  console.log("Proof:", result.proof);
}
```

## API Reference

### Plugin Configuration

When initializing the plugin, you can provide the following configuration options:

```typescript
polymer({
  apiKey: "YOUR_API_KEY", // Required
  apiUrl: "POLYMER_API_URL", // Optional, defaults to Polymer testnet
  maxAttempts: 20, // Optional, default: 20
  interval: 3000, // Optional, default: 3000ms
  timeout: 60000, // Optional, default: 60000ms
  debug: false, // Optional, default: false
});
```

### Configuration Options

| Option      | Description                        | Default                            |
| ----------- | ---------------------------------- | ---------------------------------- |
| apiKey      | Your Polymer API key (required)    | null                               |
| apiUrl      | URL of the Polymer API             | https://proof.testnet.polymer.zone |
| maxAttempts | Maximum number of polling attempts | 20                                 |
| interval    | Polling interval in milliseconds   | 3000                               |
| timeout     | Request timeout in milliseconds    | 60000                              |
| debug       | Enable debug logging               | false                              |

### Plugin Methods

The plugin adds the following methods to the Viem client:

| Method                          | Description                                              |
| ------------------------------- | -------------------------------------------------------- |
| client.polymerProof             | Request a proof for a transaction receipt                |
| client.polymer.requestProof     | Request a proof for specific block, transaction, and log |
| client.polymer.queryProofStatus | Check the status of a proof generation job               |
| client.polymer.wait             | Wait for a proof to be generated                         |

#### client.polymerProof(options)

Requests a proof for a transaction receipt.

**Parameters:**

- `options` (Object):
  - `receipt` (TransactionReceipt): The transaction receipt
  - `eventSignature` (string, optional): The event signature to generate a proof for
  - `logIndex` (number, optional): The log index of the event to generate a proof for
  - `maxAttempts` (number, optional): Maximum number of polling attempts
  - `interval` (number, optional): Polling interval in milliseconds

**Note:** Either `eventSignature` or `logIndex` must be provided.

**Returns:**

- `Promise<PolymerProofResult | PolymerProofJobResult>`: A promise that resolves to either the proof result or a job ID

#### client.polymer.requestProof(options)

Requests a proof for a specific block, transaction, and log.

**Parameters:**

- `options` (Object):
  - `srcChainId` (number): The source chain ID
  - `srcBlockNumber` (bigint | number): The source block number
  - `txIndex` (number): The transaction index in the block
  - `logIndex` (number): The log index in the transaction

**Returns:**

- `Promise<string>`: A promise that resolves to the job ID

#### client.polymer.queryProofStatus(jobId)

Checks the status of a proof generation job.

**Parameters:**

- `jobId` (string): The job ID from the proof request

**Returns:**

- `Promise<PolymerProofStatusResult>`: A promise that resolves to the job status

#### client.polymer.wait(jobId, options)

Waits for a proof to be generated.

**Parameters:**

- `jobId` (string): The job ID from the proof request
- `options` (Object, optional):
  - `maxAttempts` (number, optional): Maximum number of polling attempts
  - `interval` (number, optional): Polling interval in milliseconds

**Returns:**

- `Promise<PolymerProofResult>`: A promise that resolves to the proof result

## Examples

Check out the `examples` directory for complete working examples.

To run the example:

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file with your Polymer API key:

   ```bash
   cp .env.example .env
   # Edit .env and add your Polymer API key
   ```

3. Run the example:

   ```bash
   npm run receipt
   ```

## License

MIT
