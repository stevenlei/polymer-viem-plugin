// src/index.ts
import { keccak256 as viemKeccak256 } from "viem";
var DEFAULT_CONFIG = {
  apiUrl: "https://proof.testnet.polymer.zone",
  apiKey: "",
  // Will be overridden by user config
  maxAttempts: 20,
  interval: 3e3,
  timeout: 6e4,
  debug: false
};
function polymer(config) {
  return (client) => {
    const polymerConfig = { ...DEFAULT_CONFIG, ...config };
    const logger = createLogger(polymerConfig.debug);
    if (!polymerConfig.apiKey) {
      throw new Error("Polymer API key is required");
    }
    logger.log("Initializing Polymer Viem plugin with config:", polymerConfig);
    return {
      // Extended public method for convenience
      polymerProof: async function(options) {
        const { receipt } = options;
        if (!receipt) {
          throw new Error("Transaction receipt is required");
        }
        const chainId = client.chain?.id;
        if (!chainId) {
          throw new Error("Chain ID not found in client");
        }
        const srcChainId = chainId;
        const srcBlockNumber = receipt.blockNumber;
        const txIndex = receipt.transactionIndex;
        const {
          maxAttempts = polymerConfig.maxAttempts,
          interval = polymerConfig.interval,
          returnJob = false,
          eventSignature,
          logIndex: providedLogIndex
        } = options;
        if (!eventSignature && typeof providedLogIndex !== "number") {
          throw new Error("eventSignature or logIndex is required");
        }
        if (providedLogIndex !== void 0 && providedLogIndex < 0) {
          throw new Error("logIndex must be non-negative");
        }
        let localLogIndex = providedLogIndex;
        if (typeof providedLogIndex !== "number" && eventSignature) {
          const eventTopic = viemKeccak256(toBytes(eventSignature));
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
          transactionHash: receipt.transactionHash
        });
        const jobId = await requestProof(
          polymerConfig,
          srcChainId,
          srcBlockNumber,
          txIndex,
          localLogIndex
        );
        logger.log("Proof job created with ID:", jobId);
        if (returnJob) {
          return { jobId, receipt };
        }
        return wait(polymerConfig, jobId, maxAttempts, interval);
      },
      // The core polymer API interface
      polymer: {
        /**
         * Request a proof for a transaction
         */
        requestProof: async function(params) {
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
        queryProofStatus: async function(jobId) {
          if (!jobId) {
            throw new Error("Job ID is required");
          }
          return queryProofStatus(polymerConfig, jobId);
        },
        /**
         * Poll for proof completion
         */
        wait: async function(jobId, maxAttempts, interval) {
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
async function requestProof(config, srcChainId, srcBlockNumber, txIndex, localLogIndex) {
  const method = "log_requestProof";
  const params = [
    srcChainId,
    typeof srcBlockNumber === "bigint" ? Number(srcBlockNumber) : srcBlockNumber,
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
        Accept: "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params
      })
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if ("error" in data && data.error) {
      throw new Error(`Polymer API error: ${JSON.stringify(data.error)}`);
    }
    return data.result;
  } catch (error) {
    logger.error("Error requesting proof:", error);
    throw error;
  }
}
async function queryProofStatus(config, jobId) {
  const logger = createLogger(config.debug);
  logger.log("Querying proof status for job:", jobId);
  try {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "log_queryProof",
        params: [jobId]
      })
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if ("error" in data && data.error) {
      throw new Error(`Polymer API error: ${JSON.stringify(data.error)}`);
    }
    return data.result;
  } catch (error) {
    logger.error("Error querying proof status:", error);
    throw error;
  }
}
async function wait(config, jobId, maxAttempts, interval) {
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
function createLogger(enabled = false) {
  return {
    log: (...args) => {
      if (enabled) {
        console.log("[Polymer Viem]", ...args);
      }
    },
    error: (...args) => {
      if (enabled) {
        console.error("[Polymer Viem]", ...args);
      }
    }
  };
}
function toBytes(str) {
  return new TextEncoder().encode(str);
}
export {
  polymer
};
