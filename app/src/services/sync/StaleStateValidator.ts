// app/src/services/sync/StaleStateValidator.ts
// Validates state freshness using TimeSyncService clock offset

import { timeSyncService } from './TimeSyncService';

/**
 * Stale state threshold: 60 seconds (NETR-04)
 * State older than this is rejected to prevent applying outdated room state
 */
const STALE_THRESHOLD_MS = 60 * 1000;

/**
 * Check if state is stale based on server timestamp
 * @param serverTimestamp - Server timestamp from room state
 * @returns true if state is older than STALE_THRESHOLD_MS
 */
export function isStateStale(serverTimestamp: number): boolean {
  const currentServerTime = timeSyncService.getServerTime();
  const ageMs = currentServerTime - serverTimestamp;
  return ageMs > STALE_THRESHOLD_MS;
}

/**
 * Validate state freshness with detailed result
 * @param serverTimestamp - Server timestamp from room state
 * @returns Validation result with age info and reason if invalid
 */
export function validateState(serverTimestamp: number): {
  valid: boolean;
  ageMs: number;
  reason?: string;
} {
  const currentServerTime = timeSyncService.getServerTime();
  const ageMs = currentServerTime - serverTimestamp;
  const valid = ageMs <= STALE_THRESHOLD_MS;

  return {
    valid,
    ageMs,
    reason: valid ? undefined : `State is ${(ageMs / 1000).toFixed(1)}s old (threshold: ${STALE_THRESHOLD_MS / 1000}s)`,
  };
}
