// backend/src/handlers/roomHandlers.ts
// Socket.io event handlers for room operations

import type { Socket, Server as SocketIOServer } from 'socket.io';
import type {
  RoomCreateRequest,
  RoomJoinRequest,
  RoomLeaveRequest,
  RoomRejoinRequest,
  RoomStateSnapshotRequest,
  RoomStateSnapshotResponse,
} from '@shared/types/socket-events';
import { roomManager } from '../services/room/RoomManager';
import { syncEngine } from '../services/sync/SyncEngine';

/**
 * Register room-related Socket.io event handlers
 */
export function registerRoomHandlers(socket: Socket, io: SocketIOServer) {
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

        // Register connection mapping
        roomManager.handleReconnection(request.clientId, socket.id, request.userId, roomId, io);

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

        // Cancel any pending empty room deletion or host transfer
        roomManager.cleanupRoomTimers(roomId);

        // Join Socket.io room
        socket.join(roomId);

        // Update user's socket ID
        roomManager.updateUserSocketId(roomId, request.userId, socket.id);

        // Start heartbeat
        syncEngine.startHeartbeat(roomId, request.userId, socket.id);

        // Register connection mapping
        roomManager.handleReconnection(request.clientId, socket.id, request.userId, roomId, io);

        // Send current sync state to the new member
        const room = roomManager.getRoom(roomId);
        if (room && room.syncState) {
          console.log(`[RoomHandlers] Sending current sync state to ${request.username}:`, room.syncState);
          socket.emit('sync:state', {
            userId: room.hostId, // Mark as coming from host
            state: room.syncState,
          });
        }

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
   * Handle room:verify event
   */
  socket.on('room:verify', (request: { roomId: string }, callback) => {
    try {
      console.log(`[RoomHandlers] Verify room ${request.roomId}`);
      
      const room = roomManager.getRoom(request.roomId);
      const exists = !!room;
      
      callback({ exists });
      
      console.log(`[RoomHandlers] Room ${request.roomId} exists: ${exists}`);
    } catch (error) {
      console.error('[RoomHandlers] Error in room:verify:', error);
      callback({ exists: false, error: 'Verification failed' });
    }
  });

  /**
   * Handle room:leave event
   */
  socket.on('room:leave', (request: RoomLeaveRequest) => {
    try {
      console.log(`[RoomHandlers] Leave room ${request.roomId} request from ${request.userId}`);

      // Find and remove the client connection to prevent disconnect handler from processing this user again
      const connection = roomManager.findConnectionBySocketId(socket.id);
      if (connection) {
        roomManager.removeConnection(connection.clientId);
        console.log(`[RoomHandlers] Removed client connection for ${connection.clientId}`);
      }

      const result = roomManager.leaveRoom(request.roomId, request.userId);

      // Leave Socket.io room
      socket.leave(request.roomId);

      // Stop heartbeat
      syncEngine.stopHeartbeat(`${request.roomId}:${request.userId}`);

      // Note: Room is no longer immediately deleted when empty
      // It will be deleted after EMPTY_ROOM_TIMEOUT_MS if no one rejoins
      if (!result.deleted) {
        // Get updated room
        const updatedRoom = roomManager.getRoom(request.roomId);

        // Broadcast member left to remaining members with updated room data
        socket.to(request.roomId).emit('member:left', {
          userId: request.userId,
          newHostId: result.newHostId,
          room: updatedRoom,
        });

        if (result.newHostId) {
          console.log(`[RoomHandlers] ${request.userId} left room ${request.roomId}, host transfer scheduled`);
        } else {
          console.log(`[RoomHandlers] ${request.userId} left room ${request.roomId}`);
        }
      }
    } catch (error) {
      console.error('[RoomHandlers] Error in room:leave:', error);
    }
  });

  /**
   * Handle room:rejoin event (reconnection)
   */
  socket.on('room:rejoin', (request: RoomRejoinRequest, callback: any) => {
    try {
      console.log(`[RoomHandlers] Rejoin room ${request.roomId} request from ${request.userId}`);

      // Verify room exists
      const room = roomManager.getRoom(request.roomId);
      if (!room) {
        callback({ success: false, error: 'Room not found' });
        return;
      }

      // Check if user is still a member (may have been removed by disconnect handler)
      const member = room.members.find((m: any) => m.userId === request.userId);

      if (!member) {
        // User was removed (passive disconnect) — re-join the room
        console.log(`[RoomHandlers] ${request.userId} not a member, falling back to join`);

        // Cancel any pending timers before re-joining (e.g., host transfer if original host is back)
        roomManager.cleanupRoomTimers(request.roomId);

        const joinResponse = roomManager.joinRoom(request);
        if (!joinResponse.success || !joinResponse.room) {
          callback({ success: false, error: joinResponse.error || 'Failed to rejoin room' });
          return;
        }

        socket.join(request.roomId);
        roomManager.updateUserSocketId(request.roomId, request.userId, socket.id);
        syncEngine.startHeartbeat(request.roomId, request.userId, socket.id);
        roomManager.handleReconnection(request.clientId, socket.id, request.userId, request.roomId, io);

        // Broadcast to other members that this user is back
        socket.to(request.roomId).emit('member:joined', {
          userId: request.userId,
          username: request.username,
          room: joinResponse.room,
        });

        // NOTE: Don't send room:state_snapshot here — B's RoomScreen isn't mounted yet.
        // The syncState is already included in joinResponse.room (returned via callback).
        // RoomScreen will apply sync state from initialRoom when it mounts.

        callback({ success: true, room: joinResponse.room });
        console.log(`[RoomHandlers] ${request.userId} re-joined room ${request.roomId} (was removed)`);
        return;
      }

      // User is still a member — normal rejoin path (fast reconnect)
      // Only update socket mapping and re-join the Socket.IO room.
      // Do NOT send state_snapshot (client already has correct playback state).
      // Do NOT broadcast member:joined (user never left from other members' perspective).

      // Cancel any pending timers (empty room deletion, host transfer)
      roomManager.cleanupRoomTimers(request.roomId);

      roomManager.handleReconnection(request.clientId, socket.id, request.userId, request.roomId, io);

      socket.join(request.roomId);
      syncEngine.startHeartbeat(request.roomId, request.userId, socket.id);

      callback({ success: true, room: roomManager.getRoom(request.roomId) });
      console.log(`[RoomHandlers] ${request.userId} rejoined room ${request.roomId} (socket update only)`);
    } catch (error) {
      console.error('[RoomHandlers] Error in room:rejoin:', error);
      callback({ success: false, error: 'Failed to rejoin room' });
    }
  });

  /**
   * Handle room:state_snapshot - fetch authoritative room state
   */
  socket.on('room:state_snapshot', (request: RoomStateSnapshotRequest, callback) => {
    try {
      console.log(`[RoomHandlers] State snapshot request for room ${request.roomId} from ${request.userId}`);

      const room = roomManager.getRoom(request.roomId);
      if (!room) {
        callback({
          success: false,
          serverTimestamp: Date.now(),
          error: 'Room not found',
        });
        return;
      }

      // Update member activity timestamp
      syncEngine.updateMemberActivity(request.roomId, request.userId);

      // Return full room state
      const response: RoomStateSnapshotResponse = {
        success: true,
        room,
        syncState: room.syncState,
        playlist: room.playlist,
        currentTrackIndex: room.currentTrackIndex,
        loopMode: room.loopMode,
        serverTimestamp: Date.now(),
      };

      callback(response);
      console.log(`[RoomHandlers] State snapshot sent for room ${request.roomId}`);
    } catch (error) {
      console.error('[RoomHandlers] Error in room:state_snapshot:', error);
      callback({
        success: false,
        serverTimestamp: Date.now(),
        error: 'Failed to fetch room state',
      });
    }
  });

  /**
   * Handle disconnect event — uses clientId mapping instead of scanning all rooms
   */
  socket.on('disconnect', () => {
    console.log(`[RoomHandlers] Socket ${socket.id} disconnected`);

    // Find connection by socketId
    const connection = roomManager.findConnectionBySocketId(socket.id);
    if (!connection) {
      return;
    }

    // Check if this socketId is still the CURRENT one for this clientId
    // If a newer connection already replaced it, do nothing — grace period will clean up
    if (!roomManager.isCurrentSocket(connection.clientId, socket.id)) {
      console.log(`[RoomHandlers] Stale socket ${socket.id} for clientId ${connection.clientId}, skipping removal`);
      return;
    }

    const { userId, roomId, clientId } = connection;
    console.log(`[RoomHandlers] Removing ${userId} from room ${roomId} due to disconnect`);

    const result = roomManager.leaveRoom(roomId, userId);

    // Stop heartbeat
    syncEngine.stopHeartbeat(`${roomId}:${userId}`);

    // Remove connection tracking
    roomManager.removeConnection(clientId);

    // Note: Room is no longer immediately deleted when empty
    // It will be deleted after EMPTY_ROOM_TIMEOUT_MS if no one rejoins
    if (!result.deleted) {
      const updatedRoom = roomManager.getRoom(roomId);

      socket.to(roomId).emit('member:left', {
        userId,
        newHostId: result.newHostId,
        room: updatedRoom,
      });

      if (result.newHostId) {
        console.log(`[RoomHandlers] ${userId} disconnected from room ${roomId}, host transfer scheduled`);
      } else {
        console.log(`[RoomHandlers] ${userId} disconnected from room ${roomId}`);
      }
    }
  });

  /**
   * Handle room:control_mode - toggle control mode
   */
  socket.on('room:control_mode', (request: any, callback: any) => {
    try {
      console.log(`[RoomHandlers] Control mode change request for room ${request.roomId}`);
      
      const room = roomManager.getRoom(request.roomId);
      if (!room) {
        callback({ success: false, error: 'Room not found' });
        return;
      }

      // Only host can change control mode
      if (room.hostId !== request.userId) {
        callback({ success: false, error: 'Only host can change control mode' });
        return;
      }

      // Update control mode
      room.controlMode = request.controlMode;
      roomManager.updateRoom(request.roomId, room);

      // Broadcast to all members
      socket.to(request.roomId).emit('room:control_mode_changed', {
        roomId: request.roomId,
        controlMode: request.controlMode,
        room: room,
      });

      callback({ success: true, room });
      console.log(`[RoomHandlers] Control mode changed to ${request.controlMode} for room ${request.roomId}`);
    } catch (error) {
      console.error('[RoomHandlers] Error in room:control_mode:', error);
      callback({ success: false, error: 'Failed to change control mode' });
    }
  });

  /**
   * Handle room:transfer_host - transfer host privileges
   */
  socket.on('room:transfer_host', (request: any, callback: any) => {
    try {
      console.log(`[RoomHandlers] Host transfer request for room ${request.roomId}`);
      
      const room = roomManager.getRoom(request.roomId);
      if (!room) {
        callback({ success: false, error: 'Room not found' });
        return;
      }

      // Only current host can transfer
      if (room.hostId !== request.currentHostId) {
        callback({ success: false, error: 'Only current host can transfer privileges' });
        return;
      }

      // Check if new host is a member
      const newHostMember = room.members.find(m => m.userId === request.newHostId);
      if (!newHostMember) {
        callback({ success: false, error: 'New host is not a room member' });
        return;
      }

      // Transfer host
      room.hostId = request.newHostId;
      roomManager.updateRoom(request.roomId, room);

      // Broadcast to all members
      socket.to(request.roomId).emit('room:host_transferred', {
        roomId: request.roomId,
        oldHostId: request.currentHostId,
        newHostId: request.newHostId,
        room: room,
      });

      callback({ success: true, room });
      console.log(`[RoomHandlers] Host transferred from ${request.currentHostId} to ${request.newHostId} in room ${request.roomId}`);
    } catch (error) {
      console.error('[RoomHandlers] Error in room:transfer_host:', error);
      callback({ success: false, error: 'Failed to transfer host' });
    }
  });
}
