import { TransactionReceipt, PublicClient } from 'viem';

/**
 * Configuration options for the Polymer plugin
 */
interface PolymerConfig {
    /** Polymer API URL */
    apiUrl?: string;
    /** Your Polymer API key (required) */
    apiKey: string;
    /** Maximum polling attempts (default: 20) */
    maxAttempts?: number;
    /** Polling interval in ms (default: 3000) */
    interval?: number;
    /** Request timeout in ms (default: 60000) */
    timeout?: number;
    /** Enable debug logging (default: false) */
    debug?: boolean;
}
/**
 * Options for generating a Polymer proof
 */
interface PolymerProofOptions {
    /** The transaction receipt object */
    receipt: TransactionReceipt;
    /** The event signature to generate a proof for */
    eventSignature?: string;
    /** The log index of the event to generate a proof for */
    logIndex?: number;
    /** Maximum polling attempts */
    maxAttempts?: number;
    /** Polling interval in ms */
    interval?: number;
    /** If true, returns the job object instead of the proof */
    returnJob?: boolean;
}
/**
 * Parameters for requesting a proof directly
 */
interface ProofRequestParams {
    /** Source chain ID */
    srcChainId: number;
    /** Source block number */
    srcBlockNumber: bigint | number;
    /** Transaction index */
    txIndex: number;
    /** Log index */
    logIndex: number;
}
/**
 * Polymer proof job response
 */
interface ProofJobResponse {
    /** Job ID */
    jobId: string;
    /** Original transaction receipt */
    receipt?: TransactionReceipt;
}
/**
 * Status of a Polymer proof job
 */
interface ProofJobStatus {
    /** Status of the job: "pending", "generating", "complete", or "error" */
    status: 'pending' | 'generating' | 'complete' | 'error';
    /** Proof data (if status is "complete") */
    proof?: string;
    /** Error message (if status is "error") */
    failureReason?: string;
    /** Any additional fields returned by the API */
    [key: string]: unknown;
}
/**
 * Polymer plugin API functions
 */
interface PolymerAPI {
    /**
     * Request a proof for a transaction
     */
    requestProof: (params: ProofRequestParams) => Promise<string>;
    /**
     * Query the status of a proof generation job
     */
    queryProofStatus: (jobId: string) => Promise<ProofJobStatus>;
    /**
     * Poll for proof completion
     */
    wait: (jobId: string, maxAttempts?: number, interval?: number) => Promise<ProofJobStatus>;
}
/**
 * Polymer-enhanced public client
 */
interface PolymerPublicClient extends PublicClient<any, any> {
    /**
     * Request and retrieve a Polymer proof for a transaction receipt
     */
    getPolymerProof: (options: PolymerProofOptions) => Promise<ProofJobStatus | ProofJobResponse>;
    /**
     * Get the status of a Polymer proof job
     */
    getPolymerProofStatus: (jobId: string) => Promise<ProofJobStatus>;
    /**
     * Wait for a Polymer proof job to complete
     */
    waitForPolymerProof: (jobId: string, maxAttempts?: number, interval?: number) => Promise<ProofJobStatus>;
    /**
     * Get detailed information about the plugin
     */
    getPolymerInfo: () => {
        version: string;
        apiUrl: string;
    };
    /**
     * Direct access to Polymer API functions
     */
    polymer: PolymerAPI;
}

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

/**
 * Creates a Viem plugin that adds Polymer proof capabilities
 * @param config - Configuration object
 * @returns A function that extends a Viem client with Polymer capabilities
 */
declare function polymer(config: PolymerConfig): (client: PublicClient<any, any>) => {
    polymerProof: (options: PolymerProofOptions) => Promise<ProofJobStatus | ProofJobResponse>;
    polymer: {
        /**
         * Request a proof for a transaction
         */
        requestProof: (params: ProofRequestParams) => Promise<string>;
        /**
         * Query the status of a proof generation job
         */
        queryProofStatus: (jobId: string) => Promise<ProofJobStatus>;
        /**
         * Poll for proof completion
         */
        wait: (jobId: string, maxAttempts?: number, interval?: number) => Promise<ProofJobStatus>;
    };
};

export { type PolymerAPI, type PolymerConfig, type PolymerProofOptions, type PolymerPublicClient, type ProofJobResponse, type ProofJobStatus, type ProofRequestParams, polymer };
