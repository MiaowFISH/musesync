// app/src/services/sync/TimeSyncService.ts
// NTP-like time synchronization service

import { socketManager } from './SocketManager';
import type { TimeSyncRequest, TimeSyncResponse } from '@shared/types/socket-events';

/**
 * Time sync sample
 */
interface TimeSyncSample {
  offset: number; // Time offset in ms
  delay: number; // Round-trip delay in ms
  timestamp: number; // Sample timestamp
}

/**
 * Time synchronization service using NTP-like algorithm
 * Performs multiple sync requests and calculates median offset
 */
export class TimeSyncService {
  private timeOffset: number = 0; // Offset from server time in ms
  private lastSyncTime: number = 0;
  private syncInterval: number = 60000; // Re-sync every 60 seconds
  private samples: TimeSyncSample[] = [];
  private maxSamples = 10;
  private isSyncing = false;

  /**
   * Perform time synchronization
   * Sends multiple sync requests and calculates median offset
   */
  async performSync(roomId?: string, userId?: string): Promise<void> {
    if (this.isSyncing) {
      console.log('[TimeSyncService] Sync already in progress');
      return;
    }

    this.isSyncing = true;
    this.samples = [];

    console.log('[TimeSyncService] Starting time sync...');

    try {
      // Perform 10 sync requests
      const promises = Array.from({ length: this.maxSamples }, () =>
        this.performSingleSync(roomId, userId)
      );

      await Promise.all(promises);

      // Calculate median offset
      if (this.samples.length > 0) {
        this.calculateMedianOffset();
        this.lastSyncTime = Date.now();
        console.log(`[TimeSyncService] Sync complete. Offset: ${this.timeOffset.toFixed(2)}ms`);
      } else {
        console.warn('[TimeSyncService] No valid samples collected');
      }
    } catch (error) {
      console.error('[TimeSyncService] Sync error:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Perform a single time sync request
   */
  private async performSingleSync(roomId?: string, userId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = socketManager.getSocket();
      if (!socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const t0 = Date.now(); // Client send time

      const request: TimeSyncRequest = {
        t0,
        roomId,
        userId,
      };

      // Set timeout for response
      const timeout = setTimeout(() => {
        reject(new Error('Time sync request timeout'));
      }, 5000);

      socket.emit('time:sync_request', request, (response: TimeSyncResponse) => {
        clearTimeout(timeout);

        if (!response.success) {
          reject(new Error('Time sync request failed'));
          return;
        }

        const t3 = Date.now(); // Client receive time

        // Calculate round-trip delay and offset
        // Round-trip delay = (t3 - t0) - (t2 - t1)
        // Time offset = ((t1 - t0) + (t2 - t3)) / 2
        const delay = (t3 - response.t0) - (response.t2 - response.t1);
        const offset = ((response.t1 - response.t0) + (response.t2 - t3)) / 2;

        // Only accept samples with reasonable delay (< 500ms)
        if (delay < 500) {
          this.samples.push({ offset, delay, timestamp: t3 });
        } else {
          console.warn(`[TimeSyncService] High delay sample rejected: ${delay.toFixed(2)}ms`);
        }

        resolve();
      });
    });
  }

  /**
   * Calculate median offset from samples
   * Uses median to filter out outliers
   */
  private calculateMedianOffset(): void {
    if (this.samples.length === 0) return;

    // Sort samples by offset
    const sorted = [...this.samples].sort((a, b) => a.offset - b.offset);

    // Calculate median
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      // Even number of samples - average of two middle values
      this.timeOffset = (sorted[mid - 1].offset + sorted[mid].offset) / 2;
    } else {
      // Odd number of samples - middle value
      this.timeOffset = sorted[mid].offset;
    }

    // Log statistics
    const offsets = this.samples.map((s) => s.offset);
    const min = Math.min(...offsets);
    const max = Math.max(...offsets);
    const avg = offsets.reduce((sum, v) => sum + v, 0) / offsets.length;

    console.log(
      `[TimeSyncService] Offset stats - Min: ${min.toFixed(2)}ms, Max: ${max.toFixed(2)}ms, Avg: ${avg.toFixed(2)}ms, Median: ${this.timeOffset.toFixed(2)}ms`
    );
  }

  /**
   * Get current server time
   */
  getServerTime(): number {
    return Date.now() + this.timeOffset;
  }

  /**
   * Get time offset
   */
  getTimeOffset(): number {
    return this.timeOffset;
  }

  /**
   * Check if sync is needed
   */
  needsSync(): boolean {
    return Date.now() - this.lastSyncTime > this.syncInterval;
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(): number {
    return this.lastSyncTime;
  }

  /**
   * Reset sync state
   */
  reset(): void {
    this.timeOffset = 0;
    this.lastSyncTime = 0;
    this.samples = [];
  }
}

// Singleton instance
export const timeSyncService = new TimeSyncService();
