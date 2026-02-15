// backend/src/services/room/RoomManager.ts
// Room management business logic

import type { Room, User, SyncState, Track } from '@shared/types/entities';
import type {
  RoomCreateRequest,
  RoomJoinRequest,
  RoomCreatedResponse,
  RoomJoinedResponse,
  RoomStateSnapshot,
} from '@shared/types/socket-events';
import { roomStore } from './RoomStore';
import { ROOM_CONFIG, VALIDATION, ERROR_CODES } from '@shared/constants';

interface ClientConnection {
  clientId: string;
  socketId: string;
  userId: string;
  roomId: string;
  connectedAt: number;
  gracePeriodTimer?: ReturnType<typeof setTimeout>;
}

/**
 * Room Manager Service
 * Handles all room-related business logic
 */
export class RoomManager {
  private clientConnections: Map<string, ClientConnection> = new Map();
  private pendingReconnections: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private emptyRoomTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private hostTransferTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private io: any = null; // Socket.IO server instance for emitting events
  private readonly GRACE_PERIOD_MS = 2500;
  private readonly BATCH_RECONNECT_WINDOW_MS = 3000;
  private readonly EMPTY_ROOM_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  private readonly HOST_TRANSFER_DELAY_MS = 30 * 1000; // 30 seconds

  /**
   * Set Socket.IO server instance (called during initialization)
   */
  setIoServer(io: any): void {
    this.io = io;
  }

  /**
   * Create a new room
   */
  createRoom(request: RoomCreateRequest): RoomCreatedResponse {
    try {
      // Validate username
      if (!VALIDATION.USERNAME_MIN_LENGTH || request.username.length > VALIDATION.USERNAME_MAX_LENGTH) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.INVALID_REQUEST,
            message: `Username must be 1-20 characters`,
          },
        };
      }

      // Generate room ID
      const roomId = roomStore.generateRoomId();

      // Create initial user
      const hostUser: User = {
        userId: request.userId,
        clientId: request.clientId,
        username: request.username,
        deviceId: request.deviceId,
        deviceType: request.deviceType,
        socketId: '', // Will be set by Socket.io handler
        connectionState: 'connected',
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
        latency: 0,
        timeOffset: 0,
      };

      // Create initial sync state (stopped)
      const initialSyncState: SyncState = {
        trackId: null,
        status: 'stopped',
        seekTime: 0,
        serverTimestamp: Date.now(),
        playbackRate: 1.0,
        volume: 1.0,
        updatedBy: request.userId,
        version: 1,
      };

      // Create room
      const room: Room = {
        roomId,
        hostId: request.userId,
        members: [hostUser],
        playlist: [],
        currentTrack: null,
        currentTrackIndex: -1,
        syncState: initialSyncState,
        controlMode: 'host-only', // Default to host-only for better sync control
        loopMode: 'none', // Default to no loop
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
      };

      // Store room
      roomStore.createRoom(room);

      console.log(`[RoomManager] Room created: ${roomId} by ${request.username}`);

      return {
        success: true,
        room,
      };
    } catch (error) {
      console.error('[RoomManager] Error creating room:', error);
      return {
        success: false,
        error: {
          code: ERROR_CODES.CREATION_FAILED,
          message: 'Failed to create room',
        },
      };
    }
  }

  /**
   * Join an existing room
   */
  joinRoom(request: RoomJoinRequest): RoomJoinedResponse {
    try {
      // Validate room ID
      if (!VALIDATION.ROOM_ID_PATTERN.test(request.roomId)) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.INVALID_ROOM_CODE,
            message: 'Room code must be 6 digits',
          },
        };
      }

      // Check if room exists
      const room = roomStore.getRoom(request.roomId);
      if (!room) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.ROOM_NOT_FOUND,
            message: `Room ${request.roomId} not found`,
          },
        };
      }

      // Check if room is full
      if (room.members.length >= ROOM_CONFIG.MAX_MEMBERS) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.ROOM_FULL,
            message: `Room is full (max ${ROOM_CONFIG.MAX_MEMBERS} members)`,
          },
        };
      }

      // Check if user already in room
      const existingMember = room.members.find((m) => m.userId === request.userId);
      if (existingMember) {
        // User reconnecting, update their info
        existingMember.clientId = request.clientId;
        existingMember.socketId = ''; // Will be updated by Socket.io handler
        existingMember.connectionState = 'connected';
        existingMember.lastSeenAt = Date.now();
        existingMember.deviceId = request.deviceId;
        existingMember.deviceType = request.deviceType;
      } else {
        // New member joining
        const newUser: User = {
          userId: request.userId,
          clientId: request.clientId,
          username: request.username,
          deviceId: request.deviceId,
          deviceType: request.deviceType,
          socketId: '', // Will be set by Socket.io handler
          connectionState: 'connected',
          joinedAt: Date.now(),
          lastSeenAt: Date.now(),
          latency: 0,
          timeOffset: 0,
        };
        room.members.push(newUser);
      }

      // Update room
      room.lastActivityAt = Date.now();
      roomStore.updateRoom(request.roomId, room);

      console.log(`[RoomManager] ${request.username} joined room ${request.roomId}`);

      return {
        success: true,
        room,
      };
    } catch (error) {
      console.error('[RoomManager] Error joining room:', error);
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_REQUEST,
          message: 'Failed to join room',
        },
      };
    }
  }

  /**
   * Remove a user from a room
   * Returns the new host ID if the host left, or null if room was deleted
   */
  leaveRoom(roomId: string, userId: string): { newHostId?: string; deleted: boolean } {
    const room = roomStore.getRoom(roomId);
    if (!room) {
      return { deleted: true };
    }

    // Remove user from members
    room.members = room.members.filter((m) => m.userId !== userId);

    // If no members left, schedule room deletion after grace period
    if (room.members.length === 0) {
      console.log(`[RoomManager] Room ${roomId} is now empty, scheduling deletion in ${this.EMPTY_ROOM_TIMEOUT_MS / 1000}s`);

      // Clear any existing timer
      const existingTimer = this.emptyRoomTimers.get(roomId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Schedule deletion
      const timer = setTimeout(() => {
        const currentRoom = roomStore.getRoom(roomId);
        if (currentRoom && currentRoom.members.length === 0) {
          roomStore.deleteRoom(roomId);
          console.log(`[RoomManager] Room ${roomId} deleted after grace period (no members)`);
        }
        this.emptyRoomTimers.delete(roomId);
      }, this.EMPTY_ROOM_TIMEOUT_MS);

      this.emptyRoomTimers.set(roomId, timer);

      room.lastActivityAt = Date.now();
      roomStore.updateRoom(roomId, room);
      return { deleted: false }; // Not deleted yet, grace period active
    }

    // Cancel empty room timer if someone rejoined
    const emptyTimer = this.emptyRoomTimers.get(roomId);
    if (emptyTimer) {
      clearTimeout(emptyTimer);
      this.emptyRoomTimers.delete(roomId);
      console.log(`[RoomManager] Cancelled empty room timer for ${roomId} (members rejoined)`);
    }

    // If host left, schedule host transfer after delay
    let newHostId: string | undefined;
    if (room.hostId === userId) {
      console.log(`[RoomManager] Host ${userId} left room ${roomId}, scheduling transfer in ${this.HOST_TRANSFER_DELAY_MS / 1000}s`);

      // Clear any existing host transfer timer
      const existingTimer = this.hostTransferTimers.get(roomId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Schedule host transfer
      const timer = setTimeout(() => {
        const currentRoom = roomStore.getRoom(roomId);
        if (currentRoom && currentRoom.hostId === userId && currentRoom.members.length > 0) {
          const oldHostId = userId;
          newHostId = currentRoom.members[0].userId;
          currentRoom.hostId = newHostId;
          console.log(`[RoomManager] Host transferred to ${newHostId} in room ${roomId} after delay`);
          roomStore.updateRoom(roomId, currentRoom);

          // Emit host transfer event to room members
          // Store io reference for timer callback
          if (this.io) {
            this.io.to(roomId).emit('room:host_transferred', {
              roomId,
              oldHostId,
              newHostId,
              room: currentRoom,
            });
          }
        }
        this.hostTransferTimers.delete(roomId);
      }, this.HOST_TRANSFER_DELAY_MS);

      this.hostTransferTimers.set(roomId, timer);
    }

    room.lastActivityAt = Date.now();
    roomStore.updateRoom(roomId, room);

    return { newHostId, deleted: false };
  }

  /**
   * Cancel host transfer timer (called when original host rejoins)
   */
  cancelHostTransfer(roomId: string): void {
    const timer = this.hostTransferTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.hostTransferTimers.delete(roomId);
      console.log(`[RoomManager] Cancelled host transfer timer for ${roomId}`);
    }
  }

  /**
   * Cleanup timers for a room
   */
  cleanupRoomTimers(roomId: string): void {
    const emptyTimer = this.emptyRoomTimers.get(roomId);
    if (emptyTimer) {
      clearTimeout(emptyTimer);
      this.emptyRoomTimers.delete(roomId);
    }

    const hostTimer = this.hostTransferTimers.get(roomId);
    if (hostTimer) {
      clearTimeout(hostTimer);
      this.hostTransferTimers.delete(roomId);
    }
  }

  /**
   * Get room by ID
   */
  getRoom(roomId: string): Room | undefined {
    return roomStore.getRoom(roomId);
  }

  /**
   * Update sync state
   */
  updateSyncState(roomId: string, syncState: SyncState): boolean {
    const room = roomStore.getRoom(roomId);
    if (!room) {
      return false;
    }

    room.syncState = syncState;
    room.lastActivityAt = Date.now();
    roomStore.updateRoom(roomId, room);
    roomStore.touchRoom(roomId);

    return true;
  }

  /**
   * Update playlist
   */
  updatePlaylist(roomId: string, playlist: Track[], currentTrackIndex: number): boolean {
    const room = roomStore.getRoom(roomId);
    if (!room) {
      return false;
    }

    room.playlist = playlist;
    room.currentTrackIndex = currentTrackIndex;
    room.currentTrack = currentTrackIndex >= 0 ? playlist[currentTrackIndex] : null;
    room.lastActivityAt = Date.now();
    roomStore.updateRoom(roomId, room);
    roomStore.touchRoom(roomId);

    return true;
  }

  /**
   * Check if user is host
   */
  isHost(roomId: string, userId: string): boolean {
    const room = roomStore.getRoom(roomId);
    return room?.hostId === userId;
  }

  /**
   * Check if user can control playback
   */
  canControl(roomId: string, userId: string): boolean {
    const room = roomStore.getRoom(roomId);
    if (!room) {
      return false;
    }

    // Open mode: everyone can control
    if (room.controlMode === 'open') {
      return true;
    }

    // Host-only mode: only host can control
    return room.hostId === userId;
  }

  /**
   * Update user's socket ID
   */
  updateUserSocketId(roomId: string, userId: string, socketId: string): void {
    const room = roomStore.getRoom(roomId);
    if (!room) {
      return;
    }

    const user = room.members.find((m) => m.userId === userId);
    if (user) {
      user.socketId = socketId;
      user.lastSeenAt = Date.now();
      roomStore.updateRoom(roomId, room);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return roomStore.getStats();
  }

  /**
   * Get all rooms (used for disconnect handling)
   */
  getAllRooms() {
    return roomStore.getAllRooms();
  }

  /**
   * Update room data (public method for external use)
   */
  updateRoom(roomId: string, room: Room): void {
    roomStore.updateRoom(roomId, room);
    roomStore.touchRoom(roomId);
  }

  /**
   * Handle client reconnection with grace period for old socket
   */
  handleReconnection(clientId: string, newSocketId: string, userId: string, roomId: string, io: any): void {
    const existing = this.clientConnections.get(clientId);

    if (existing) {
      // Clear any existing grace period timer
      if (existing.gracePeriodTimer) {
        clearTimeout(existing.gracePeriodTimer);
      }

      const oldSocketId = existing.socketId;

      // Set grace period timer to disconnect old socket
      const gracePeriodTimer = setTimeout(() => {
        const oldSocket = io.sockets?.sockets?.get(oldSocketId);
        if (oldSocket) {
          oldSocket.disconnect(true);
        }
      }, this.GRACE_PERIOD_MS);

      // Update mapping to new socketId immediately
      existing.socketId = newSocketId;
      existing.gracePeriodTimer = gracePeriodTimer;
    } else {
      // New connection
      this.clientConnections.set(clientId, {
        clientId,
        socketId: newSocketId,
        userId,
        roomId,
        connectedAt: Date.now(),
      });
    }

    // Update the User's socketId and clientId in the room's member list
    const room = roomStore.getRoom(roomId);
    if (room) {
      const member = room.members.find((m) => m.userId === userId);
      if (member) {
        member.socketId = newSocketId;
        member.clientId = clientId;
        member.connectionState = 'connected';
        member.lastSeenAt = Date.now();
        roomStore.updateRoom(roomId, room);
      }
    }

    // Schedule batch broadcast to prevent broadcast storms
    if (!this.pendingReconnections.has(roomId)) {
      const timer = setTimeout(() => {
        this.pendingReconnections.delete(roomId);
        // Broadcast updated room state to all members
        const currentRoom = roomStore.getRoom(roomId);
        if (currentRoom) {
          io.to(roomId).emit('room:updated', { room: currentRoom });
        }
      }, this.BATCH_RECONNECT_WINDOW_MS);
      this.pendingReconnections.set(roomId, timer);
    }
  }

  /**
   * Get full state snapshot for reconnection
   */
  getFullStateSnapshot(roomId: string): RoomStateSnapshot | null {
    const room = roomStore.getRoom(roomId);
    if (!room) return null;

    return {
      room,
      syncState: room.syncState,
      currentTrack: room.currentTrack,
      serverTimestamp: Date.now(),
    };
  }

  /**
   * Find connection by socket ID (used by disconnect handler)
   */
  findConnectionBySocketId(socketId: string): ClientConnection | undefined {
    for (const connection of this.clientConnections.values()) {
      if (connection.socketId === socketId) {
        return connection;
      }
    }
    return undefined;
  }

  /**
   * Check if socketId is the current connection for a clientId
   */
  isCurrentSocket(clientId: string, socketId: string): boolean {
    const connection = this.clientConnections.get(clientId);
    return connection?.socketId === socketId;
  }

  /**
   * Remove a client connection and clean up timers
   */
  removeConnection(clientId: string): void {
    const connection = this.clientConnections.get(clientId);
    if (connection) {
      if (connection.gracePeriodTimer) {
        clearTimeout(connection.gracePeriodTimer);
      }
      this.clientConnections.delete(clientId);
    }
  }
}

// Singleton instance
export const roomManager = new RoomManager();
