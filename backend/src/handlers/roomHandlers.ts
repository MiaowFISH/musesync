// backend/src/handlers/roomHandlers.ts
// Socket.io event handlers for room operations

import type { Socket } from 'socket.io';
import type {
  RoomCreateRequest,
  RoomJoinRequest,
  RoomLeaveRequest,
} from '@shared/types/socket-events';
import { roomManager } from '../services/room/RoomManager';
import { syncEngine } from '../services/sync/SyncEngine';

/**
 * Register room-related Socket.io event handlers
 */
export function registerRoomHandlers(socket: Socket) {
  /**
   * Handle room:create event
   */
  socket.on('room:create', (request: RoomCreateRequest, callback) => {
    try {
      console.log(`[RoomHandlers] Create room request from ${request.username}`);

      const response = roomManager.createRoom(request);

      if (response.success && response.room) {
        const { roomId } = response.room;

        // Join Socket.io room
        socket.join(roomId);

        // Update user's socket ID
        roomManager.updateUserSocketId(roomId, request.userId, socket.id);

        // Start heartbeat
        syncEngine.startHeartbeat(roomId, request.userId, socket.id);

        console.log(`[RoomHandlers] Room created: ${roomId}`);
      }

      // Send response to client
      callback(response);
    } catch (error) {
      console.error('[RoomHandlers] Error in room:create:', error);
      callback({
        success: false,
        error: {
          code: 'CREATION_FAILED',
          message: 'Failed to create room',
        },
      });
    }
  });

  /**
   * Handle room:join event
   */
  socket.on('room:join', (request: RoomJoinRequest, callback) => {
    try {
      console.log(`[RoomHandlers] Join room ${request.roomId} request from ${request.username}`);

      const response = roomManager.joinRoom(request);

      if (response.success && response.room) {
        const { roomId } = response.room;

        // Join Socket.io room
        socket.join(roomId);

        // Update user's socket ID
        roomManager.updateUserSocketId(roomId, request.userId, socket.id);

        // Start heartbeat
        syncEngine.startHeartbeat(roomId, request.userId, socket.id);

        // Broadcast member joined to other members
        socket.to(roomId).emit('member:joined', {
          userId: request.userId,
          username: request.username,
          room: response.room,
        });

        console.log(`[RoomHandlers] ${request.username} joined room ${roomId}`);
      }

      // Send response to client
      callback(response);
    } catch (error) {
      console.error('[RoomHandlers] Error in room:join:', error);
      callback({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Failed to join room',
        },
      });
    }
  });

  /**
   * Handle room:leave event
   */
  socket.on('room:leave', (request: RoomLeaveRequest) => {
    try {
      console.log(`[RoomHandlers] Leave room ${request.roomId} request from ${request.userId}`);

      const result = roomManager.leaveRoom(request.roomId, request.userId);

      // Leave Socket.io room
      socket.leave(request.roomId);

      // Stop heartbeat
      syncEngine.stopHeartbeat(`${request.roomId}:${request.userId}`);

      if (result.deleted) {
        // Room deleted, cleanup
        syncEngine.cleanupRoom(request.roomId);
        console.log(`[RoomHandlers] Room ${request.roomId} deleted (no members)`);
      } else {
        // Get updated room
        const updatedRoom = roomManager.getRoom(request.roomId);
        
        // Broadcast member left to remaining members with updated room data
        socket.to(request.roomId).emit('member:left', {
          userId: request.userId,
          newHostId: result.newHostId,
          room: updatedRoom,
        });

        if (result.newHostId) {
          console.log(`[RoomHandlers] ${request.userId} left room ${request.roomId}, host transferred to ${result.newHostId}`);
        } else {
          console.log(`[RoomHandlers] ${request.userId} left room ${request.roomId}`);
        }
      }
    } catch (error) {
      console.error('[RoomHandlers] Error in room:leave:', error);
    }
  });

  /**
   * Handle disconnect event
   */
  socket.on('disconnect', () => {
    console.log(`[RoomHandlers] Socket ${socket.id} disconnected`);
    
    // Note: We don't automatically remove users on disconnect
    // They will be marked as disconnected by the heartbeat timeout
    // This allows for reconnection without losing room state
  });
}
