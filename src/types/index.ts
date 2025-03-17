import type { PublicClient, TransactionReceipt } from 'viem';

/**
 * Configuration options for the Polymer plugin
 */
export interface PolymerConfig {
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
export interface PolymerProofOptions {
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
export interface ProofRequestParams {
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
export interface ProofJobResponse {
  /** Job ID */
  jobId: string;
  /** Original transaction receipt */
  receipt?: TransactionReceipt;
}

/**
 * Status of a Polymer proof job
 */
export interface ProofJobStatus {
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
export interface PolymerAPI {
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
export interface PolymerPublicClient extends PublicClient<any, any> {
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
