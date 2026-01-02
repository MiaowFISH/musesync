// backend/src/services/sync/TimeSyncService.ts
// NTP-like time synchronization service

/**
 * Time Sync Service
 * Handles time synchronization between server and clients
 * using NTP-like algorithm
 */
export class TimeSyncService {
  /**
   * Process time sync request and return server timestamps
   * Client sends t0 (client send time)
   * Server responds with t1 (server receive time), t2 (server send time)
   * Client calculates: t3 (client receive time)
   * 
   * Round-trip delay: (t3 - t0) - (t2 - t1)
   * Time offset: ((t1 - t0) + (t2 - t3)) / 2
   */
  handleSyncRequest(clientSendTime: number): { 
    t0: number;  // Client send time
    t1: number;  // Server receive time
    t2: number;  // Server send time
  } {
    const t1 = Date.now(); // Server receive time
    const t2 = Date.now(); // Server send time (immediately after processing)

    return {
      t0: clientSendTime,
      t1,
      t2,
    };
  }

  /**
   * Get current server timestamp
   */
  now(): number {
    return Date.now();
  }
}

// Singleton instance
export const timeSyncService = new TimeSyncService();
