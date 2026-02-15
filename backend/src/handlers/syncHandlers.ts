// backend/src/handlers/syncHandlers.ts
// Socket.io event handlers for sync operations

import type { Socket } from 'socket.io';
import type {
  SyncPlayRequest,
  SyncPauseRequest,
  SyncSeekRequest,
  TimeSyncRequest,
  SyncHeartbeatEvent,
} from '@shared/types/socket-events';
import { roomManager } from '../services/room/RoomManager';
import { syncEngine } from '../services/sync/SyncEngine';
import { timeSyncService } from '../services/sync/TimeSyncService';

/**
 * Register sync-related Socket.io event handlers
 */
export function registerSyncHandlers(socket: Socket) {
  /**
   * Handle sync:heartbeat event - broadcast to other room members
   */
  socket.on('sync:heartbeat', (data: SyncHeartbeatEvent) => {
    try {
      const room = roomManager.getRoom(data.roomId);
      if (!room) {
        console.warn(`[SyncHandlers] Heartbeat: Room ${data.roomId} not found`);
        return;
      }

      // Verify sender is a room member
      const isMember = room.members.some((m) => m.userId === data.fromUserId);
      if (!isMember) {
        console.warn(`[SyncHandlers] Heartbeat from non-member ${data.fromUserId} rejected`);
        return;
      }

      // Update member activity and reset heartbeat timer for ALL members
      syncEngine.updateMemberActivity(data.roomId, data.fromUserId);
      syncEngine.resetHeartbeat(data.roomId, data.fromUserId);

      // Only broadcast host heartbeats (they contain sync state)
      if (data.fromUserId === room.hostId && data.syncState) {
        socket.to(data.roomId).emit('sync:heartbeat', data);
      }
    } catch (error) {
      console.error('[SyncHandlers] Error in sync:heartbeat:', error);
    }
  });

  /**
   * Handle sync:play event
   */
  socket.on('sync:play', (request: SyncPlayRequest, callback) => {
    try {
      console.log(`[SyncHandlers] Play request in room ${request.roomId} from ${request.userId}`);

      const room = roomManager.getRoom(request.roomId);
      if (!room) {
        callback({ success: false, error: 'Room not found' });
        return;
      }

      const newSyncState = {
        trackId: request.trackId,
        status: 'playing' as const,
        seekTime: request.seekTime || 0,
        serverTimestamp: Date.now(),
        playbackRate: request.playbackRate || 1.0,
        volume: request.volume !== undefined ? request.volume : 1.0,
        updatedBy: request.userId,
        version: request.version !== undefined ? request.version : room.syncState.version,
      };

      const result = syncEngine.handleSyncUpdate(
        request.roomId,
        newSyncState,
        request.userId,
        socket.id
      );

      callback(result);
    } catch (error) {
      console.error('[SyncHandlers] Error in sync:play:', error);
      callback({
        success: false,
        error: 'Failed to process play request',
      });
    }
  });

  /**
   * Handle sync:pause event
   */
  socket.on('sync:pause', (request: SyncPauseRequest, callback) => {
    try {
      console.log(`[SyncHandlers] Pause request in room ${request.roomId} from ${request.userId}`);

      const room = roomManager.getRoom(request.roomId);
      if (!room) {
        callback({ success: false, error: 'Room not found' });
        return;
      }

      const newSyncState = {
        ...room.syncState,
        status: 'paused' as const,
        seekTime: request.seekTime !== undefined ? request.seekTime : room.syncState.seekTime,
        serverTimestamp: Date.now(),
        updatedBy: request.userId,
        // Keep trackId from current state
        trackId: room.syncState.trackId,
        // Use client version if provided, otherwise keep current
        version: request.version !== undefined ? request.version : room.syncState.version,
      };

      const result = syncEngine.handleSyncUpdate(
        request.roomId,
        newSyncState,
        request.userId,
        socket.id
      );

      callback(result);
    } catch (error) {
      console.error('[SyncHandlers] Error in sync:pause:', error);
      callback({
        success: false,
        error: 'Failed to process pause request',
      });
    }
  });

  /**
   * Handle sync:seek event
   */
  socket.on('sync:seek', (request: SyncSeekRequest, callback) => {
    try {
      console.log(`[SyncHandlers] Seek request in room ${request.roomId} to ${request.seekTime}s`);

      const room = roomManager.getRoom(request.roomId);
      if (!room) {
        callback({ success: false, error: 'Room not found' });
        return;
      }

      const newSyncState = {
        ...room.syncState,
        seekTime: request.seekTime,
        serverTimestamp: Date.now(),
        updatedBy: request.userId,
        // Keep trackId from current state
        trackId: room.syncState.trackId,
        // Use client version if provided, otherwise keep current
        version: request.version !== undefined ? request.version : room.syncState.version,
      };

      const result = syncEngine.handleSyncUpdate(
        request.roomId,
        newSyncState,
        request.userId,
        socket.id
      );

      callback(result);
    } catch (error) {
      console.error('[SyncHandlers] Error in sync:seek:', error);
      callback({
        success: false,
        error: 'Failed to process seek request',
      });
    }
  });

  /**
   * Handle time:sync_request event
   */
  socket.on('time:sync_request', (request: TimeSyncRequest, callback) => {
    try {
      const response = timeSyncService.handleSyncRequest(request.t0);

      // Update member activity
      if (request.roomId && request.userId) {
        syncEngine.updateMemberActivity(request.roomId, request.userId);
      }

      callback({
        success: true,
        ...response,
      });
    } catch (error) {
      console.error('[SyncHandlers] Error in time:sync_request:', error);
      callback({
        success: false,
        t0: request.t0,
        t1: Date.now(),
        t2: Date.now(),
      });
    }
  });
}
