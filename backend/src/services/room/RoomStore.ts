// backend/src/services/room/RoomStore.ts
// In-memory storage for room state

import type { Room } from '@shared/types/entities';
import { ROOM_CONFIG } from '@shared/constants';

/**
 * In-memory room storage
 * TODO: Replace with Redis for production horizontal scaling
 */
class RoomStore {
  private rooms: Map<string, Room> = new Map();
  private roomActivityTimestamps: Map<string, number> = new Map();
  private cleanupIntervalId?: NodeJS.Timeout;

  constructor() {
    // Start periodic cleanup of inactive rooms
    this.startCleanup();
  }

  /**
   * Generate a random 6-digit room ID
   */
  generateRoomId(): string {
    let roomId: string;
    do {
      roomId = Math.floor(100000 + Math.random() * 900000).toString();
    } while (this.rooms.has(roomId));
    return roomId;
  }

  /**
   * Create and store a new room
   */
  createRoom(room: Room): void {
    this.rooms.set(room.roomId, room);
    this.roomActivityTimestamps.set(room.roomId, Date.now());
  }

  /**
   * Get a room by ID
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Check if a room exists
   */
  hasRoom(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  /**
   * Update a room
   */
  updateRoom(roomId: string, room: Room): void {
    this.rooms.set(roomId, room);
    this.roomActivityTimestamps.set(roomId, Date.now());
  }

  /**
   * Delete a room
   */
  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
    this.roomActivityTimestamps.delete(roomId);
  }

  /**
   * Get all room IDs
   */
  getAllRoomIds(): string[] {
    return Array.from(this.rooms.keys());
  }

  /**
   * Get total number of rooms
   */
  getRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * Update room activity timestamp
   */
  touchRoom(roomId: string): void {
    if (this.rooms.has(roomId)) {
      this.roomActivityTimestamps.set(roomId, Date.now());
      
      // Also update the room's lastActivityAt field
      const room = this.rooms.get(roomId);
      if (room) {
        room.lastActivityAt = Date.now();
        this.rooms.set(roomId, room);
      }
    }
  }

  /**
   * Start periodic cleanup of inactive rooms
   */
  private startCleanup(): void {
    this.cleanupIntervalId = setInterval(() => {
      const now = Date.now();
      const expiredRooms: string[] = [];

      for (const [roomId, lastActivity] of this.roomActivityTimestamps.entries()) {
        if (now - lastActivity > ROOM_CONFIG.ROOM_TIMEOUT_MS) {
          expiredRooms.push(roomId);
        }
      }

      if (expiredRooms.length > 0) {
        console.log(`[RoomStore] Cleaning up ${expiredRooms.length} inactive rooms`);
        for (const roomId of expiredRooms) {
          this.deleteRoom(roomId);
        }
      }
    }, ROOM_CONFIG.ROOM_CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop cleanup interval (for graceful shutdown)
   */
  stopCleanup(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = undefined;
    }
  }

  /**
   * Clear all rooms (for testing)
   */
  clear(): void {
    this.rooms.clear();
    this.roomActivityTimestamps.clear();
  }

  /**
   * Get statistics for monitoring
   */
  getStats(): {
    totalRooms: number;
    totalMembers: number;
    activeRooms: number; // Active in last 5 minutes
  } {
    const now = Date.now();
    let totalMembers = 0;
    let activeRooms = 0;

    for (const [roomId, room] of this.rooms.entries()) {
      totalMembers += room.members.length;
      
      const lastActivity = this.roomActivityTimestamps.get(roomId) || 0;
      if (now - lastActivity < 300000) { // 5 minutes
        activeRooms++;
      }
    }

    return {
      totalRooms: this.rooms.size,
      totalMembers,
      activeRooms,
    };
  }
}

// Singleton instance
export const roomStore = new RoomStore();
