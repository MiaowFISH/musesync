// backend/src/services/sync/SyncEngine.ts
// Sync state broadcast and conflict resolution

import type { Server as SocketIOServer } from 'socket.io';
import type { SyncState } from '@shared/types/entities';
import { roomManager } from '../room/RoomManager';
import { incrementVersion, isVersionNewer } from './versionUtils';

/**
 * Sync Engine
 * Handles sync state broadcasting and conflict resolution
 */
export class SyncEngine {
  private io: SocketIOServer | null = null;
  private heartbeatTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private trackChangeTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private readonly HEARTBEAT_INTERVAL = 300000; // 5 minutes (increased to avoid false positives)
  private readonly MEMBER_TIMEOUT = 600000; // 10 minutes
  private readonly TRACK_CHANGE_DEBOUNCE = 300; // 300ms leading-edge debounce

  /**
   * Initialize with Socket.IO server
   */
  initialize(io: SocketIOServer) {
    this.io = io;
    console.log('[SyncEngine] Initialized');
  }

  /**
   * Broadcast sync state to all members in a room
   */
  broadcastSyncState(roomId: string, syncState: SyncState, excludeSocketId?: string) {
    if (!this.io) {
      console.error('[SyncEngine] Socket.IO not initialized');
      return;
    }

    const room = roomManager.getRoom(roomId);
    if (!room) {
      console.warn(`[SyncEngine] Room ${roomId} not found`);
      return;
    }

    // Broadcast to room except the sender - use SyncStateEvent format
    const eventData = {
      roomId: roomId,
      syncState: syncState,
      currentTrack: null, // TODO: Add track info if needed
    };

    if (excludeSocketId) {
      console.log(`[SyncEngine] Broadcasting sync state to room ${roomId} (except ${excludeSocketId}):`, syncState.status, syncState.trackId);
      this.io.to(roomId).except(excludeSocketId).emit('sync:state', eventData);
    } else {
      console.log(`[SyncEngine] Broadcasting sync state to room ${roomId}:`, syncState.status, syncState.trackId);
      this.io.to(roomId).emit('sync:state', eventData);
    }

    console.log(`[SyncEngine] Broadcast sync state to room ${roomId}: ${syncState.status}`);
  }

  /**
   * Handle sync state update with Last-Write-Wins conflict resolution
   */
  handleSyncUpdate(
    roomId: string,
    newSyncState: SyncState,
    userId: string,
    socketId: string
  ): { success: boolean; currentState?: SyncState; error?: string } {
    const room = roomManager.getRoom(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    // Check if user can control playback
    if (!roomManager.canControl(roomId, userId)) {
      return { success: false, error: 'User does not have control permission' };
    }

    const currentState = room.syncState;

    // Track change debounce: leading-edge, 300ms window
    const isTrackChange = newSyncState.trackId !== null && newSyncState.trackId !== currentState.trackId;
    if (isTrackChange) {
      if (this.trackChangeTimers.has(roomId)) {
        // Within debounce window — reject subsequent track changes
        console.warn(`[SyncEngine] Debounced track change from ${userId} in room ${roomId}`);
        return { success: false, error: 'Debounced' };
      }
      // First track change goes through — set debounce timer
      const timer = setTimeout(() => {
        this.trackChangeTimers.delete(roomId);
      }, this.TRACK_CHANGE_DEBOUNCE);
      this.trackChangeTimers.set(roomId, timer);
    }

    // Stale update check with wrap-around-safe comparison
    if (newSyncState.version !== undefined && !isVersionNewer(newSyncState.version, currentState.version) && newSyncState.version !== currentState.version) {
      console.warn(
        `[SyncEngine] Rejected stale update from ${userId}: version ${newSyncState.version} < ${currentState.version}`
      );
      return { success: false, currentState, error: 'Stale update rejected' };
    }

    // Update sync state — always increment version, never reset
    const updatedState: SyncState = {
      ...newSyncState,
      serverTimestamp: Date.now(),
      updatedBy: userId,
      version: incrementVersion(currentState.version),
    };

    const success = roomManager.updateSyncState(roomId, updatedState);
    if (!success) {
      return { success: false, error: 'Failed to update sync state' };
    }

    // Broadcast to other members
    this.broadcastSyncState(roomId, updatedState, socketId);

    return { success: true, currentState: updatedState };
  }

  /**
   * Start heartbeat for a user in a room
   */
  startHeartbeat(roomId: string, userId: string, socketId: string) {
    const key = `${roomId}:${userId}`;

    // Clear existing timer
    this.stopHeartbeat(key);

    // Start new timer
    const timer = setInterval(() => {
      this.checkMemberTimeout(roomId, userId);
    }, this.HEARTBEAT_INTERVAL);

    this.heartbeatTimers.set(key, timer);
    console.log(`[SyncEngine] Started heartbeat for ${userId} in room ${roomId}`);
  }

  /**
   * Stop heartbeat for a user
   */
  stopHeartbeat(key: string) {
    const timer = this.heartbeatTimers.get(key);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(key);
    }
  }

  /**
   * Check if member has timed out
   */
  private checkMemberTimeout(roomId: string, userId: string) {
    const room = roomManager.getRoom(roomId);
    if (!room) {
      this.stopHeartbeat(`${roomId}:${userId}`);
      return;
    }

    const member = room.members.find((m) => m.userId === userId);
    if (!member) {
      this.stopHeartbeat(`${roomId}:${userId}`);
      return;
    }

    const now = Date.now();
    const timeSinceLastSeen = now - member.lastSeenAt;

    if (timeSinceLastSeen > this.MEMBER_TIMEOUT) {
      console.warn(`[SyncEngine] Member ${userId} timed out in room ${roomId}`);
      
      // Mark as disconnected
      member.connectionState = 'disconnected';
      
      // Emit timeout event to room
      if (this.io) {
        this.io.to(roomId).emit('member:timeout', {
          userId,
          roomId,
        });
      }

      // Stop heartbeat
      this.stopHeartbeat(`${roomId}:${userId}`);
    }
  }

  /**
   * Update member's last seen time
   */
  updateMemberActivity(roomId: string, userId: string) {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    const member = room.members.find((m) => m.userId === userId);
    if (member) {
      member.lastSeenAt = Date.now();
      member.connectionState = 'connected';
    }
  }

  /**
   * Cleanup all heartbeats for a room
   */
  cleanupRoom(roomId: string) {
    const keysToDelete: string[] = [];
    
    for (const [key, timer] of this.heartbeatTimers.entries()) {
      if (key.startsWith(`${roomId}:`)) {
        clearInterval(timer);
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.heartbeatTimers.delete(key));

    // Clean up track change debounce timer
    const trackTimer = this.trackChangeTimers.get(roomId);
    if (trackTimer) {
      clearTimeout(trackTimer);
      this.trackChangeTimers.delete(roomId);
    }

    console.log(`[SyncEngine] Cleaned up ${keysToDelete.length} heartbeats for room ${roomId}`);
  }
}

// Singleton instance
export const syncEngine = new SyncEngine();
