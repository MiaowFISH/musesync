// app/src/services/queue/QueueService.ts
// Queue management service for room playlist operations

import { socketManager } from '../sync/SocketManager';
import type {
  QueueAddRequest,
  QueueRemoveRequest,
  QueueReorderRequest,
  QueueAdvanceRequest,
  QueueLoopModeRequest,
  QueueOperationResponse,
} from '@shared/types/socket-events';
import type { Track } from '@shared/types/entities';

/**
 * Queue service for managing room playlist
 * Follows server-confirmed pattern (no optimistic updates per user decision)
 */
export class QueueService {
  private readonly TIMEOUT_MS = 5000;

  /**
   * Add track to room queue
   * Per user decision: server-confirmed, not optimistic
   */
  async add(params: {
    roomId: string;
    userId: string;
    username: string;
    track: Track;
  }): Promise<QueueOperationResponse> {
    return new Promise((resolve) => {
      const socket = socketManager.getSocket();
      if (!socket?.connected) {
        resolve({ success: false, error: 'Not connected to server' });
        return;
      }

      const request: QueueAddRequest = {
        roomId: params.roomId,
        userId: params.userId,
        username: params.username,
        track: params.track,
      };

      console.log('[QueueService] Adding track to queue...', {
        trackId: params.track.trackId,
        title: params.track.title,
      });

      // Set timeout
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Request timeout' });
      }, this.TIMEOUT_MS);

      socket.emit('queue:add', request, (response: QueueOperationResponse) => {
        clearTimeout(timeout);

        if (response.success) {
          console.log('[QueueService] Track added successfully');
        } else {
          console.error('[QueueService] Add track failed:', response.error);
        }

        resolve(response);
      });
    });
  }

  /**
   * Remove track from queue
   */
  async remove(params: {
    roomId: string;
    userId: string;
    trackId: string;
    queueId: string;
  }): Promise<QueueOperationResponse> {
    return new Promise((resolve) => {
      const socket = socketManager.getSocket();
      if (!socket?.connected) {
        resolve({ success: false, error: 'Not connected to server' });
        return;
      }

      const request: QueueRemoveRequest = {
        roomId: params.roomId,
        userId: params.userId,
        trackId: params.trackId,
        queueId: params.queueId,
      };

      console.log('[QueueService] Removing track from queue...', {
        trackId: params.trackId,
        queueId: params.queueId,
      });

      // Set timeout
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Request timeout' });
      }, this.TIMEOUT_MS);

      socket.emit('queue:remove', request, (response: QueueOperationResponse) => {
        clearTimeout(timeout);

        if (response.success) {
          console.log('[QueueService] Track removed successfully');
        } else {
          console.error('[QueueService] Remove track failed:', response.error);
        }

        resolve(response);
      });
    });
  }

  /**
   * Reorder track in queue
   */
  async reorder(params: {
    roomId: string;
    userId: string;
    fromIndex: number;
    toIndex: number;
  }): Promise<QueueOperationResponse> {
    return new Promise((resolve) => {
      const socket = socketManager.getSocket();
      if (!socket?.connected) {
        resolve({ success: false, error: 'Not connected to server' });
        return;
      }

      const request: QueueReorderRequest = {
        roomId: params.roomId,
        userId: params.userId,
        fromIndex: params.fromIndex,
        toIndex: params.toIndex,
      };

      console.log('[QueueService] Reordering queue...', {
        fromIndex: params.fromIndex,
        toIndex: params.toIndex,
      });

      // Set timeout
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Request timeout' });
      }, this.TIMEOUT_MS);

      socket.emit('queue:reorder', request, (response: QueueOperationResponse) => {
        clearTimeout(timeout);

        if (response.success) {
          console.log('[QueueService] Queue reordered successfully');
        } else {
          console.error('[QueueService] Reorder failed:', response.error);
        }

        resolve(response);
      });
    });
  }

  /**
   * Advance to next/previous track
   */
  async advance(params: {
    roomId: string;
    userId: string;
    direction: 'next' | 'previous';
  }): Promise<QueueOperationResponse> {
    return new Promise((resolve) => {
      const socket = socketManager.getSocket();
      if (!socket?.connected) {
        resolve({ success: false, error: 'Not connected to server' });
        return;
      }

      const request: QueueAdvanceRequest = {
        roomId: params.roomId,
        userId: params.userId,
        direction: params.direction,
      };

      console.log('[QueueService] Advancing queue...', {
        direction: params.direction,
      });

      // Set timeout
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Request timeout' });
      }, this.TIMEOUT_MS);

      socket.emit('queue:advance', request, (response: QueueOperationResponse) => {
        clearTimeout(timeout);

        if (response.success) {
          console.log('[QueueService] Queue advanced successfully');
        } else {
          console.error('[QueueService] Advance failed:', response.error);
        }

        resolve(response);
      });
    });
  }

  /**
   * Toggle loop mode
   */
  async setLoopMode(params: {
    roomId: string;
    userId: string;
    loopMode: 'none' | 'queue';
  }): Promise<QueueOperationResponse> {
    return new Promise((resolve) => {
      const socket = socketManager.getSocket();
      if (!socket?.connected) {
        resolve({ success: false, error: 'Not connected to server' });
        return;
      }

      const request: QueueLoopModeRequest = {
        roomId: params.roomId,
        userId: params.userId,
        loopMode: params.loopMode,
      };

      console.log('[QueueService] Setting loop mode...', {
        loopMode: params.loopMode,
      });

      // Set timeout
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Request timeout' });
      }, this.TIMEOUT_MS);

      socket.emit('queue:loop_mode', request, (response: QueueOperationResponse) => {
        clearTimeout(timeout);

        if (response.success) {
          console.log('[QueueService] Loop mode set successfully');
        } else {
          console.error('[QueueService] Set loop mode failed:', response.error);
        }

        resolve(response);
      });
    });
  }
}

// Singleton instance
export const queueService = new QueueService();
