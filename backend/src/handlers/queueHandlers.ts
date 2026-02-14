// backend/src/handlers/queueHandlers.ts
// Socket.io event handlers for queue operations

import type { Socket, Server } from 'socket.io';
import type {
  QueueAddRequest,
  QueueRemoveRequest,
  QueueReorderRequest,
  QueueAdvanceRequest,
  QueueLoopModeRequest,
  QueueUpdatedEvent,
} from '@shared/types/socket-events';
import { queueManager } from '../services/queue/QueueManager';
import { roomManager } from '../services/room/RoomManager';

/**
 * Register queue-related Socket.io event handlers
 */
export function registerQueueHandlers(socket: Socket, io: Server) {
  /**
   * Handle queue:add event
   */
  socket.on('queue:add', (request: QueueAddRequest, callback) => {
    try {
      console.log(`[QueueHandlers] Add request in room ${request.roomId} from ${request.username}`);

      // Validate room exists
      const room = roomManager.getRoom(request.roomId);
      if (!room) {
        callback({ success: false, error: 'Room not found' });
        return;
      }

      // Validate user is member
      const isMember = room.members.some((m) => m.userId === request.userId);
      if (!isMember) {
        callback({ success: false, error: 'User not in room' });
        return;
      }

      // Add track
      const result = queueManager.addTrack(request.roomId, request.track, request.userId, request.username);

      if (result.success) {
        // Broadcast queue:updated to all room members
        const updatedEvent: QueueUpdatedEvent = {
          roomId: request.roomId,
          playlist: result.playlist!,
          currentTrackIndex: result.currentTrackIndex!,
          currentTrack: result.currentTrackIndex! >= 0 ? result.playlist![result.currentTrackIndex!] : null,
          operation: 'add',
          operatorName: request.username,
          trackTitle: request.track.title,
        };
        io.to(request.roomId).emit('queue:updated', updatedEvent);
      }

      callback(result);
    } catch (error) {
      console.error('[QueueHandlers] Error in queue:add:', error);
      callback({ success: false, error: 'Failed to add track' });
    }
  });

  /**
   * Handle queue:remove event
   */
  socket.on('queue:remove', (request: QueueRemoveRequest, callback) => {
    try {
      console.log(`[QueueHandlers] Remove request in room ${request.roomId} from ${request.userId}`);

      // Validate room exists
      const room = roomManager.getRoom(request.roomId);
      if (!room) {
        callback({ success: false, error: 'Room not found' });
        return;
      }

      // Validate user is member
      const isMember = room.members.some((m) => m.userId === request.userId);
      if (!isMember) {
        callback({ success: false, error: 'User not in room' });
        return;
      }

      // Get track title before removal for broadcast
      const track = room.playlist.find((t) => t.trackId === request.trackId);
      const trackTitle = track?.title;

      // Remove track
      const result = queueManager.removeTrack(request.roomId, request.trackId);

      if (result.success) {
        // Get username for broadcast
        const user = room.members.find((m) => m.userId === request.userId);
        const username = user?.username || 'Unknown';

        // Broadcast queue:updated to all room members
        const updatedEvent: QueueUpdatedEvent = {
          roomId: request.roomId,
          playlist: result.playlist!,
          currentTrackIndex: result.currentTrackIndex!,
          currentTrack: result.currentTrackIndex! >= 0 ? result.playlist![result.currentTrackIndex!] : null,
          operation: 'remove',
          operatorName: username,
          trackTitle,
        };
        io.to(request.roomId).emit('queue:updated', updatedEvent);
      }

      callback(result);
    } catch (error) {
      console.error('[QueueHandlers] Error in queue:remove:', error);
      callback({ success: false, error: 'Failed to remove track' });
    }
  });

  /**
   * Handle queue:reorder event
   */
  socket.on('queue:reorder', (request: QueueReorderRequest, callback) => {
    try {
      console.log(`[QueueHandlers] Reorder request in room ${request.roomId} from ${request.fromIndex} to ${request.toIndex}`);

      // Validate room exists
      const room = roomManager.getRoom(request.roomId);
      if (!room) {
        callback({ success: false, error: 'Room not found' });
        return;
      }

      // Validate user is member
      const isMember = room.members.some((m) => m.userId === request.userId);
      if (!isMember) {
        callback({ success: false, error: 'User not in room' });
        return;
      }

      // Reorder track
      const result = queueManager.reorderTrack(request.roomId, request.fromIndex, request.toIndex);

      if (result.success) {
        // Get username for broadcast
        const user = room.members.find((m) => m.userId === request.userId);
        const username = user?.username || 'Unknown';

        // Broadcast queue:updated to all room members
        const updatedEvent: QueueUpdatedEvent = {
          roomId: request.roomId,
          playlist: result.playlist!,
          currentTrackIndex: result.currentTrackIndex!,
          currentTrack: result.currentTrackIndex! >= 0 ? result.playlist![result.currentTrackIndex!] : null,
          operation: 'reorder',
          operatorName: username,
        };
        io.to(request.roomId).emit('queue:updated', updatedEvent);
      }

      callback(result);
    } catch (error) {
      console.error('[QueueHandlers] Error in queue:reorder:', error);
      callback({ success: false, error: 'Failed to reorder track' });
    }
  });

  /**
   * Handle queue:advance event
   */
  socket.on('queue:advance', (request: QueueAdvanceRequest, callback) => {
    try {
      console.log(`[QueueHandlers] Advance ${request.direction} in room ${request.roomId}`);

      // Validate room exists
      const room = roomManager.getRoom(request.roomId);
      if (!room) {
        callback({ success: false, error: 'Room not found' });
        return;
      }

      // Validate user is member
      const isMember = room.members.some((m) => m.userId === request.userId);
      if (!isMember) {
        callback({ success: false, error: 'User not in room' });
        return;
      }

      // Advance track
      const result = queueManager.advanceTrack(request.roomId, request.direction);

      if (result.success) {
        // Get username for broadcast
        const user = room.members.find((m) => m.userId === request.userId);
        const username = user?.username || 'Unknown';

        // Update sync state to reflect new track
        const newTrack = result.currentTrackIndex! >= 0 ? result.playlist![result.currentTrackIndex!] : null;
        if (newTrack) {
          const newSyncState = {
            trackId: newTrack.trackId,
            status: 'playing' as const,
            seekTime: 0,
            serverTimestamp: Date.now(),
            playbackRate: room.syncState.playbackRate,
            volume: room.syncState.volume,
            updatedBy: request.userId,
            version: room.syncState.version + 1,
          };
          roomManager.updateSyncState(request.roomId, newSyncState);

          // Broadcast sync:state to all room members
          io.to(request.roomId).emit('sync:state', {
            roomId: request.roomId,
            syncState: newSyncState,
            currentTrack: newTrack,
          });
        } else {
          // Queue finished, set to stopped
          const newSyncState = {
            trackId: null,
            status: 'stopped' as const,
            seekTime: 0,
            serverTimestamp: Date.now(),
            playbackRate: room.syncState.playbackRate,
            volume: room.syncState.volume,
            updatedBy: request.userId,
            version: room.syncState.version + 1,
          };
          roomManager.updateSyncState(request.roomId, newSyncState);

          // Broadcast sync:state to all room members
          io.to(request.roomId).emit('sync:state', {
            roomId: request.roomId,
            syncState: newSyncState,
            currentTrack: null,
          });
        }

        // Broadcast queue:updated to all room members
        const updatedEvent: QueueUpdatedEvent = {
          roomId: request.roomId,
          playlist: result.playlist!,
          currentTrackIndex: result.currentTrackIndex!,
          currentTrack: newTrack,
          operation: 'advance',
          operatorName: username,
        };
        io.to(request.roomId).emit('queue:updated', updatedEvent);
      }

      callback(result);
    } catch (error) {
      console.error('[QueueHandlers] Error in queue:advance:', error);
      callback({ success: false, error: 'Failed to advance track' });
    }
  });

  /**
   * Handle queue:loop_mode event
   */
  socket.on('queue:loop_mode', (request: QueueLoopModeRequest, callback) => {
    try {
      console.log(`[QueueHandlers] Loop mode set to ${request.loopMode} in room ${request.roomId}`);

      // Validate room exists
      const room = roomManager.getRoom(request.roomId);
      if (!room) {
        callback({ success: false, error: 'Room not found' });
        return;
      }

      // Validate user is member
      const isMember = room.members.some((m) => m.userId === request.userId);
      if (!isMember) {
        callback({ success: false, error: 'User not in room' });
        return;
      }

      // Set loop mode
      const result = queueManager.setLoopMode(request.roomId, request.loopMode);

      if (result.success) {
        // Get username for broadcast
        const user = room.members.find((m) => m.userId === request.userId);
        const username = user?.username || 'Unknown';

        // Broadcast queue:updated to all room members
        const updatedEvent: QueueUpdatedEvent = {
          roomId: request.roomId,
          playlist: result.playlist!,
          currentTrackIndex: result.currentTrackIndex!,
          currentTrack: result.currentTrackIndex! >= 0 ? result.playlist![result.currentTrackIndex!] : null,
          operation: 'loop_mode',
          operatorName: username,
          loopMode: request.loopMode,
        };
        io.to(request.roomId).emit('queue:updated', updatedEvent);
      }

      callback(result);
    } catch (error) {
      console.error('[QueueHandlers] Error in queue:loop_mode:', error);
      callback({ success: false, error: 'Failed to set loop mode' });
    }
  });
}
