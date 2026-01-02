// app/src/services/sync/SyncService.ts
// Playback synchronization service

import { socketManager } from './SocketManager';
import { timeSyncService } from './TimeSyncService';
import type {
  SyncPlayRequest,
  SyncPauseRequest,
  SyncSeekRequest,
} from '@shared/types/socket-events';

/**
 * Sync service for managing playback synchronization
 */
export class SyncService {
  /**
   * Emit play event
   */
  emitPlay(params: {
    roomId: string;
    userId: string;
    trackId: string;
    seekTime?: number;
    playbackRate?: number;
    volume?: number;
    version?: number;
  }): Promise<{ success: boolean; error?: string; currentState?: any }> {
    return new Promise((resolve) => {
      const socket = socketManager.getSocket();
      if (!socket?.connected) {
        resolve({ success: false, error: 'Not connected to server' });
        return;
      }

      const request: SyncPlayRequest = {
        roomId: params.roomId,
        userId: params.userId,
        trackId: params.trackId,
        seekTime: params.seekTime,
        playbackRate: params.playbackRate,
        volume: params.volume,
        version: params.version,
        clientTime: Date.now(),
      };

      console.log('[SyncService] Emitting play event...', {
        trackId: params.trackId,
        seekTime: params.seekTime,
        clientTime: request.clientTime,
      });

      // Set timeout
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Request timeout' });
      }, 5000);

      socket.emit('sync:play', request, (response: { success: boolean; error?: string }) => {
        clearTimeout(timeout);

        if (response.success) {
          console.log('[SyncService] Play event sent successfully');
        } else {
          console.error('[SyncService] Play event failed:', response.error);
        }

        resolve(response);
      });
    });
  }

  /**
   * Emit pause event
   */
  emitPause(params: {
    roomId: string;
    userId: string;
    seekTime: number;
    version?: number;
  }): Promise<{ success: boolean; error?: string; currentState?: any }> {
    return new Promise((resolve) => {
      const socket = socketManager.getSocket();
      if (!socket?.connected) {
        resolve({ success: false, error: 'Not connected to server' });
        return;
      }

      const request: SyncPauseRequest = {
        roomId: params.roomId,
        userId: params.userId,
        seekTime: params.seekTime,
        version: params.version,
      };

      console.log('[SyncService] Emitting pause event...', { seekTime: params.seekTime });

      // Set timeout
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Request timeout' });
      }, 5000);

      socket.emit('sync:pause', request, (response: { success: boolean; error?: string }) => {
        clearTimeout(timeout);

        if (response.success) {
          console.log('[SyncService] Pause event sent successfully');
        } else {
          console.error('[SyncService] Pause event failed:', response.error);
        }

        resolve(response);
      });
    });
  }

  /**
   * Emit seek event
   */
  emitSeek(params: {
    roomId: string;
    userId: string;
    seekTime: number;
    version?: number;
  }): Promise<{ success: boolean; error?: string; currentState?: any }> {
    return new Promise((resolve) => {
      const socket = socketManager.getSocket();
      if (!socket?.connected) {
        resolve({ success: false, error: 'Not connected to server' });
        return;
      }

      const request: SyncSeekRequest = {
        roomId: params.roomId,
        userId: params.userId,
        seekTime: params.seekTime,
        version: params.version,
      };

      console.log('[SyncService] Emitting seek event...', { seekTime: params.seekTime });

      // Set timeout
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Request timeout' });
      }, 5000);

      socket.emit('sync:seek', request, (response: { success: boolean; error?: string }) => {
        clearTimeout(timeout);

        if (response.success) {
          console.log('[SyncService] Seek event sent successfully');
        } else {
          console.error('[SyncService] Seek event failed:', response.error);
        }

        resolve(response);
      });
    });
  }

  /**
   * Calculate synchronized playback position
   * Takes into account time offset and network delay
   */
  calculateSyncPosition(
    seekTime: number,
    serverTimestamp: number,
    playbackRate: number = 1.0
  ): number {
    const serverTime = timeSyncService.getServerTime();
    const elapsed = (serverTime - serverTimestamp) / 1000; // Convert to seconds
    const position = seekTime + elapsed * playbackRate;

    return Math.max(0, position); // Ensure non-negative
  }

  /**
   * Emit generic event (for heartbeat, etc.)
   */
  emit(event: string, data: any): void {
    const socket = socketManager.getSocket();
    if (!socket?.connected) {
      console.warn(`[SyncService] Cannot emit ${event}: not connected`);
      return;
    }
    socket.emit(event, data);
  }
}

// Singleton instance
export const syncService = new SyncService();
