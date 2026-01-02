// app/src/services/sync/RoomService.ts
// Room management service

import { socketManager } from './SocketManager';
import { timeSyncService } from './TimeSyncService';
import type {
  RoomCreateRequest,
  RoomJoinRequest,
  RoomLeaveRequest,
  RoomCreatedResponse,
  RoomJoinedResponse,
} from '@shared/types/socket-events';
import type { Room } from '@shared/types/entities';

/**
 * Room service for managing room creation, joining, and leaving
 */
export class RoomService {
  /**
   * Create a new room
   */
  async createRoom(params: {
    userId: string;
    username: string;
    deviceId: string;
    deviceType: 'ios' | 'android' | 'web';
  }): Promise<{ success: boolean; room?: Room; error?: string }> {
    return new Promise((resolve, reject) => {
      const socket = socketManager.getSocket();
      if (!socket?.connected) {
        resolve({ success: false, error: 'Not connected to server' });
        return;
      }

      const request: RoomCreateRequest = {
        userId: params.userId,
        username: params.username,
        deviceId: params.deviceId,
        deviceType: params.deviceType,
      };

      console.log('[RoomService] Creating room...', { username: params.username });

      // Set timeout
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Request timeout' });
      }, 10000);

      socket.emit('room:create', request, (response: RoomCreatedResponse) => {
        clearTimeout(timeout);

        if (response.success && response.room) {
          console.log(`[RoomService] Room created: ${response.room.roomId}`);
          
          // Start time sync after joining room
          timeSyncService.performSync(response.room.roomId, params.userId).catch((error) => {
            console.error('[RoomService] Time sync failed:', error);
          });

          resolve({
            success: true,
            room: response.room,
          });
        } else {
          console.error('[RoomService] Room creation failed:', response.error?.message);
          resolve({
            success: false,
            error: response.error?.message || 'Failed to create room',
          });
        }
      });
    });
  }

  /**
   * Join an existing room
   */
  async joinRoom(params: {
    roomId: string;
    userId: string;
    username: string;
    deviceId: string;
    deviceType: 'ios' | 'android' | 'web';
  }): Promise<{ success: boolean; room?: Room; error?: string }> {
    return new Promise((resolve, reject) => {
      const socket = socketManager.getSocket();
      if (!socket?.connected) {
        resolve({ success: false, error: 'Not connected to server' });
        return;
      }

      const request: RoomJoinRequest = {
        roomId: params.roomId,
        userId: params.userId,
        username: params.username,
        deviceId: params.deviceId,
        deviceType: params.deviceType,
      };

      console.log('[RoomService] Joining room...', { roomId: params.roomId, username: params.username });

      // Set timeout
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Request timeout' });
      }, 10000);

      socket.emit('room:join', request, (response: RoomJoinedResponse) => {
        clearTimeout(timeout);

        if (response.success && response.room) {
          console.log(`[RoomService] Joined room: ${response.room.roomId}`);
          
          // Start time sync after joining room
          timeSyncService.performSync(response.room.roomId, params.userId).catch((error) => {
            console.error('[RoomService] Time sync failed:', error);
          });

          resolve({
            success: true,
            room: response.room,
          });
        } else {
          console.error('[RoomService] Room join failed:', response.error?.message);
          resolve({
            success: false,
            error: response.error?.message || 'Failed to join room',
          });
        }
      });
    });
  }

  /**
   * Verify if a room exists
   */
  async verifyRoom(roomId: string): Promise<{ exists: boolean; error?: string }> {
    return new Promise((resolve) => {
      const socket = socketManager.getSocket();
      if (!socket?.connected) {
        resolve({ exists: false, error: 'Not connected to server' });
        return;
      }

      console.log('[RoomService] Verifying room...', { roomId });

      // Set timeout
      const timeout = setTimeout(() => {
        resolve({ exists: false, error: 'Request timeout' });
      }, 5000);

      socket.emit('room:verify', { roomId }, (response: { exists: boolean; error?: string }) => {
        clearTimeout(timeout);
        console.log('[RoomService] Room verification result:', response);
        resolve(response);
      });
    });
  }

  /**
   * Leave current room
   */
  leaveRoom(params: { roomId: string; userId: string }): void {
    const socket = socketManager.getSocket();
    if (!socket?.connected) {
      console.warn('[RoomService] Cannot leave room, not connected');
      return;
    }

    const request: RoomLeaveRequest = {
      roomId: params.roomId,
      userId: params.userId,
    };

    console.log('[RoomService] Leaving room...', { roomId: params.roomId });

    socket.emit('room:leave', request);

    // Reset time sync
    timeSyncService.reset();
  }
}

// Singleton instance
export const roomService = new RoomService();
