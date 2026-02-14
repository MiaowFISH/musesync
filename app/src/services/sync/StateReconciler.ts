// app/src/services/sync/StateReconciler.ts
// Shared state reconciliation logic for foreground-return and network-reconnection

import { socketManager } from './SocketManager';
import { validateState } from './StaleStateValidator';
import type { RoomStateSnapshotRequest, RoomStateSnapshotResponse } from '@shared/types/socket-events';
import type { Room, SyncState, Track } from '@shared/types/entities';

/**
 * Reconciliation result
 */
export interface ReconciliationResult {
  applied: boolean;
  skipped?: boolean;
  reason?: string;
  changes?: {
    trackChanged: boolean;
    positionDrift: boolean;
    playStateChanged: boolean;
    queueChanged: boolean;
  };
  newState?: {
    room: Room;
    syncState: SyncState;
    playlist: Track[];
    currentTrackIndex: number;
    loopMode: 'none' | 'queue';
  };
  toastMessage?: string;
}

/**
 * State Reconciler
 * Provides shared reconciliation logic for foreground-return and network-reconnection
 */
export class StateReconciler {
  private syncLock: boolean = false;

  /**
   * Reconcile local state with authoritative server state
   * @param params - Reconciliation parameters
   * @returns Reconciliation result with changes detected
   */
  async reconcile(params: {
    roomId: string;
    userId: string;
    source: 'foreground' | 'reconnection';
    currentState?: {
      syncState: SyncState;
      playlist: Track[];
      currentTrackIndex: number;
      loopMode: 'none' | 'queue';
    };
  }): Promise<ReconciliationResult> {
    // Prevent concurrent reconciliation (pitfall 3: race condition)
    if (this.syncLock) {
      console.log(`[StateReconciler] Sync already in progress, skipping`);
      return { applied: false, skipped: true, reason: 'sync in progress' };
    }

    this.syncLock = true;

    try {
      console.log(`[StateReconciler] Starting reconciliation from ${params.source}`);

      // Fetch authoritative room state from server
      const snapshot = await this.fetchRoomState(params.roomId, params.userId);

      if (!snapshot.success || !snapshot.room || !snapshot.syncState) {
        console.error(`[StateReconciler] Failed to fetch room state:`, snapshot.error);
        return { applied: false, reason: snapshot.error || 'Failed to fetch room state' };
      }

      // Validate state freshness (NETR-04: reject state older than 60s)
      const validation = validateState(snapshot.serverTimestamp);
      if (!validation.valid) {
        console.warn(`[StateReconciler] Stale state rejected:`, validation.reason);
        return { applied: false, reason: validation.reason };
      }

      console.log(`[StateReconciler] State age: ${validation.ageMs}ms (valid)`);

      // If no current state provided, apply server state without comparison
      if (!params.currentState) {
        console.log(`[StateReconciler] No current state, applying server state`);
        return {
          applied: true,
          newState: {
            room: snapshot.room,
            syncState: snapshot.syncState,
            playlist: snapshot.playlist || [],
            currentTrackIndex: snapshot.currentTrackIndex ?? 0,
            loopMode: snapshot.loopMode || 'none',
          },
        };
      }

      // Detect changes between local and server state
      const changes = this.detectChanges(params.currentState, {
        syncState: snapshot.syncState,
        playlist: snapshot.playlist || [],
        currentTrackIndex: snapshot.currentTrackIndex ?? 0,
        loopMode: snapshot.loopMode || 'none',
      });

      // Generate toast message based on changes
      const toastMessage = this.generateToastMessage(changes, snapshot);

      console.log(`[StateReconciler] Changes detected:`, changes);

      return {
        applied: true,
        changes,
        newState: {
          room: snapshot.room,
          syncState: snapshot.syncState,
          playlist: snapshot.playlist || [],
          currentTrackIndex: snapshot.currentTrackIndex ?? 0,
          loopMode: snapshot.loopMode || 'none',
        },
        toastMessage,
      };
    } finally {
      this.syncLock = false;
    }
  }

  /**
   * Fetch authoritative room state from server
   */
  private async fetchRoomState(roomId: string, userId: string): Promise<RoomStateSnapshotResponse> {
    return new Promise((resolve) => {
      const socket = socketManager.getSocket();
      if (!socket?.connected) {
        resolve({ success: false, serverTimestamp: Date.now(), error: 'Socket not connected' });
        return;
      }

      const timeout = setTimeout(() => {
        resolve({ success: false, serverTimestamp: Date.now(), error: 'Request timeout' });
      }, 5000);

      const request: RoomStateSnapshotRequest = { roomId, userId };

      socket.emit('room:state_snapshot', request, (response: RoomStateSnapshotResponse) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });
  }

  /**
   * Detect changes between local and server state
   */
  private detectChanges(
    localState: {
      syncState: SyncState;
      playlist: Track[];
      currentTrackIndex: number;
      loopMode: 'none' | 'queue';
    },
    serverState: {
      syncState: SyncState;
      playlist: Track[];
      currentTrackIndex: number;
      loopMode: 'none' | 'queue';
    }
  ): {
    trackChanged: boolean;
    positionDrift: boolean;
    playStateChanged: boolean;
    queueChanged: boolean;
  } {
    // Track changed: different trackId or currentTrackIndex
    const trackChanged =
      localState.syncState.trackId !== serverState.syncState.trackId ||
      localState.currentTrackIndex !== serverState.currentTrackIndex;

    // Position drift: abs(serverPosition - localPosition) > 3 seconds
    const positionDrift = Math.abs(serverState.syncState.seekTime - localState.syncState.seekTime) > 3;

    // Play state changed: playing vs paused mismatch
    const playStateChanged = localState.syncState.status !== serverState.syncState.status;

    // Queue changed: playlist length or order differs
    const queueChanged =
      localState.playlist.length !== serverState.playlist.length ||
      localState.playlist.some((track, index) => track.trackId !== serverState.playlist[index]?.trackId);

    return {
      trackChanged,
      positionDrift,
      playStateChanged,
      queueChanged,
    };
  }

  /**
   * Generate toast message based on changes
   */
  private generateToastMessage(
    changes: {
      trackChanged: boolean;
      positionDrift: boolean;
      playStateChanged: boolean;
      queueChanged: boolean;
    },
    snapshot: RoomStateSnapshotResponse
  ): string | undefined {
    // Priority: track change > play state change
    if (changes.trackChanged && snapshot.currentTrackIndex !== undefined) {
      return `房间已切到第${snapshot.currentTrackIndex + 1}首`;
    }

    if (changes.playStateChanged && snapshot.syncState) {
      const playing = snapshot.syncState.status === 'playing';
      return `房间已${playing ? '继续播放' : '暂停'}`;
    }

    return undefined;
  }
}

// Singleton instance
export const stateReconciler = new StateReconciler();
