/**
 * Polymer Viem Plugin
 * ========================
 *
 * This plugin adds Polymer proof capabilities to Viem, allowing you to generate and verify cross-chain transaction proofs.
 *
 * Usage:
 * ```typescript
 * // Import the plugin and viem
 * import { createPublicClient, http } from 'viem';
 * import { optimismSepolia } from 'viem/chains';
 * import { polymer } from 'polymer-viem';
 *
 * // Initialize the client with the plugin
 * const client = createPublicClient({
 *   chain: optimismSepolia,
 *   transport: http(),
 * }).extend(polymer({
 *   apiKey: "YOUR_POLYMER_API_KEY",
 *   apiUrl: "https://proof.testnet.polymer.zone"
 * }));
 *
 * // Get transaction receipt
 * const receipt = await client.getTransactionReceipt({ hash: '0x...' });
 *
 * // Get Polymer proof (returns the raw proof)
 * const proof = await client.polymerProof({
 *   receipt,
 *   eventSignature: "Transfer(address,address,uint256)",
 *   logIndex: 0,
 * });
 *
 * // Advanced usage with maxAttempts and interval
 * const proof = await client.polymerProof({
 *   receipt,
 *   eventSignature: "Transfer(address,address,uint256)",
 *   logIndex: 0,
 *   maxAttempts: 20,      // Maximum polling attempts
 *   interval: 3000        // Polling interval in ms
 * });
 * ```
 */

import { type PublicClient, type Transport, type Chain, keccak256 as viemKeccak256 } from 'viem';
import type { PolymerConfig, PolymerProofOptions, ProofJobResponse, ProofJobStatus, ProofRequestParams, PolymerAPI } from './types/index.js';

/**
 * Default configuration for the Polymer plugin
 */
const DEFAULT_CONFIG: Required<PolymerConfig> = {
  apiUrl: "https://proof.testnet.polymer.zone",
  apiKey: "", // Will be overridden by user config
  maxAttempts: 20,
  interval: 3000,
  timeout: 60000,
  debug: false,
};

/**
 * Creates a Viem plugin that adds Polymer proof capabilities
 * @param config - Configuration object
 * @returns A function that extends a Viem client with Polymer capabilities
 */
export function polymer(config: PolymerConfig) {
  return (client: PublicClient<any, any>) => {
    const polymerConfig: Required<PolymerConfig> = { ...DEFAULT_CONFIG, ...config };
    const logger = createLogger(polymerConfig.debug);

    if (!polymerConfig.apiKey) {
      throw new Error("Polymer API key is required");
    }

    logger.log("Initializing Polymer Viem plugin with config:", polymerConfig);

    return {
      // Extended public method for convenience
      polymerProof: async function (options: PolymerProofOptions): Promise<ProofJobStatus | ProofJobResponse> {
        const { receipt } = options;
        
        if (!receipt) {
          throw new Error("Transaction receipt is required");
        }

        // Get chain ID from the client
        const chainId = client.chain?.id;
        if (!chainId) {
          throw new Error("Chain ID not found in client");
        }

        // Extract parameters for Polymer API
        const srcChainId = chainId;
        const srcBlockNumber = receipt.blockNumber;
        const txIndex = receipt.transactionIndex;

        // Set options with defaults from config
        const {
          maxAttempts = polymerConfig.maxAttempts,
          interval = polymerConfig.interval,
          returnJob = false,
          eventSignature,
          logIndex: providedLogIndex,
        } = options;

        if (!eventSignature && typeof providedLogIndex !== "number") {
          throw new Error("eventSignature or logIndex is required");
        }

        if (providedLogIndex !== undefined && providedLogIndex < 0) {
          throw new Error("logIndex must be non-negative");
        }

        let localLogIndex = providedLogIndex;

        if (typeof providedLogIndex !== "number" && eventSignature) {
          // Find the local log index of the target event
          const eventTopic = viemKeccak256(toBytes(eventSignature));
          
          // Find the log that matches this topic
          const foundIndex = receipt.logs.findIndex(
            (log) => log.topics[0] === eventTopic
          );

          if (foundIndex === -1) {
            throw new Error(
              `Event ${eventSignature} not found in transaction receipt`
            );
          }

          localLogIndex = foundIndex;
        }

        logger.log("Transaction receipt details:", {
          srcChainId,
          srcBlockNumber,
          txIndex,
          localLogIndex,
          transactionHash: receipt.transactionHash,
        });

        // Request the proof
        const jobId = await requestProof(
          polymerConfig,
          srcChainId,
          srcBlockNumber,
          txIndex,
          localLogIndex!
        );

        logger.log("Proof job created with ID:", jobId);

        if (returnJob) {
          return { jobId, receipt } as ProofJobResponse;
        }

        // Poll for proof completion
        return wait(polymerConfig, jobId, maxAttempts, interval);
      },
      
      // The core polymer API interface
      polymer: {
        /**
         * Request a proof for a transaction
         */
        requestProof: async function (params: ProofRequestParams): Promise<string> {
          const { srcChainId, srcBlockNumber, txIndex, logIndex } = params;
          return requestProof(
            polymerConfig,
            srcChainId,
            srcBlockNumber,
            txIndex,
            logIndex
          );
        },

        /**
         * Query the status of a proof generation job
         */
        queryProofStatus: async function (jobId: string): Promise<ProofJobStatus> {
          if (!jobId) {
            throw new Error("Job ID is required");
          }

          return queryProofStatus(polymerConfig, jobId);
        },

        /**
         * Poll for proof completion
         */
        wait: async function (jobId: string, maxAttempts?: number, interval?: number): Promise<ProofJobStatus> {
          if (!jobId) {
            throw new Error("Job ID is required");
          }

          return wait(
            polymerConfig, 
            jobId, 
            maxAttempts || polymerConfig.maxAttempts, 
            interval || polymerConfig.interval
          );
        }
      }
    };
  };
}

/**
 * Request a Polymer proof for a transaction
 * 
 * @param config - Polymer configuration
 * @param srcChainId - Source chain ID
 * @param srcBlockNumber - Source block number
 * @param txIndex - Transaction index
 * @param localLogIndex - Local log index
 * @returns Job ID for the proof request
 */
async function requestProof(
  config: Required<PolymerConfig>,
  srcChainId: number,
  srcBlockNumber: number | bigint,
  txIndex: number,
  localLogIndex: number
): Promise<string> {
  const method = "log_requestProof";
  const params = [
    srcChainId, 
    typeof srcBlockNumber === 'bigint' ? Number(srcBlockNumber) : srcBlockNumber, 
    txIndex, 
    localLogIndex
  ];

  const logger = createLogger(config.debug);
  logger.log("Requesting proof with params:", params);

  try {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if ('error' in data && data.error) {
      throw new Error(`Polymer API error: ${JSON.stringify(data.error)}`);
    }

    return data.result;
  } catch (error) {
    logger.error("Error requesting proof:", error);
    throw error;
  }
}

/**
 * Query the status of a proof generation job
 * 
 * @param config - Polymer configuration
 * @param jobId - Job ID from the proof request
 * @returns The job status
 */
async function queryProofStatus(config: Required<PolymerConfig>, jobId: string): Promise<ProofJobStatus> {
  const logger = createLogger(config.debug);
  logger.log("Querying proof status for job:", jobId);

  try {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "log_queryProof",
        params: [jobId],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if ('error' in data && data.error) {
      throw new Error(`Polymer API error: ${JSON.stringify(data.error)}`);
    }

    return data.result as ProofJobStatus;
  } catch (error) {
    logger.error("Error querying proof status:", error);
    throw error;
  }
}

/**
 * Poll for proof completion
 * 
 * @param config - Polymer configuration
 * @param jobId - Job ID from the proof request
 * @param maxAttempts - Maximum polling attempts
 * @param interval - Polling interval in ms
 * @returns The proof result
 */
async function wait(
  config: Required<PolymerConfig>,
  jobId: string, 
  maxAttempts: number,
  interval: number
): Promise<ProofJobStatus> {
  const logger = createLogger(config.debug);
  logger.log(
    `Polling for proof completion (max ${maxAttempts} attempts, interval ${interval}ms)`
  );

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    logger.log(`Polling attempt ${attempt}/${maxAttempts}`);

    const result = await queryProofStatus(config, jobId);

    if (result.status === "complete") {
      logger.log("Proof generation complete!");
      return result;
    }

    if (result.status === "error") {
      throw new Error(
        `Proof generation failed: ${result.failureReason || "Unknown error"}`
      );
    }

    if (attempt < maxAttempts) {
      logger.log(`Waiting ${interval}ms before next attempt...`);
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  throw new Error(`Proof generation timed out after ${maxAttempts} attempts`);
}

/**
 * Logger interface
 */
interface Logger {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * Create a logger instance for debugging
 */
function createLogger(enabled = false): Logger {
  return {
    log: (...args: unknown[]) => {
      if (enabled) {
        console.log("[Polymer Viem]", ...args);
      }
    },
    error: (...args: unknown[]) => {
      if (enabled) {
        console.error("[Polymer Viem]", ...args);
      }
    },
  };
}

function toBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Re-export types
export * from './types/index.js';
