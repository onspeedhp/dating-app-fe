/**
 * Arcium Configuration - Fixed to Devnet
 * Always use devnet as requested
 */

import { PublicKey } from '@solana/web3.js';

// DEVNET CONFIGURATION - Always use devnet
export const DEVNET_CLUSTER_OFFSET = 1116522165;
export const DEVNET_RPC_URL = 'https://api.devnet.solana.com';

// Always return devnet
export function getCurrentNetwork(): string {
  return 'devnet';
}

// Always return devnet cluster offset
export function getClusterOffset(): number {
  return DEVNET_CLUSTER_OFFSET;
}

// Always return devnet RPC URL
export function getRpcUrl(): string {
  return DEVNET_RPC_URL;
}

// Development helpers
export function logNetworkInfo(): void {
  // Network configuration loaded silently in production
}
