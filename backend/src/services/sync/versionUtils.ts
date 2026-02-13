// backend/src/services/sync/versionUtils.ts
// Centralized version management for optimistic concurrency control

/**
 * Maximum version number before wrap-around.
 * Using 2^50 to stay safely within JavaScript's integer precision.
 */
export const MAX_VERSION = Math.pow(2, 50);

/**
 * Increment version number with wrap-around safety.
 * Wraps to 1 (not 0) when exceeding MAX_VERSION.
 */
export function incrementVersion(current: number): number {
  return current >= MAX_VERSION ? 1 : current + 1;
}

/**
 * Check if incoming version is newer than current version.
 * Handles wrap-around: if the absolute difference exceeds half of MAX_VERSION,
 * the smaller number is considered newer (it wrapped around).
 */
export function isVersionNewer(incoming: number, current: number): boolean {
  const diff = incoming - current;
  if (Math.abs(diff) > MAX_VERSION / 2) {
    // Wrap-around occurred — smaller number is newer
    return incoming < current;
  }
  return incoming > current;
}
