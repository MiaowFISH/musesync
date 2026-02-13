// app/src/services/storage/RoomHistoryStorage.ts
// Room history storage service

import AsyncStorage from '@react-native-async-storage/async-storage';

const CREATED_ROOMS_KEY = '@musesync:created_rooms';
const JOINED_ROOMS_KEY = '@musesync:joined_rooms';
const MAX_HISTORY_ITEMS = 10;

export interface RoomHistoryItem {
  roomId: string;
  roomCode: string;
  timestamp: number;
  memberCount?: number;
}

class RoomHistoryStorage {
  /**
   * Get created rooms history
   */
  async getCreatedRooms(): Promise<RoomHistoryItem[]> {
    try {
      const data = await AsyncStorage.getItem(CREATED_ROOMS_KEY);
      if (data) {
        return JSON.parse(data);
      }
      return [];
    } catch (error) {
      console.error('[RoomHistoryStorage] Get created rooms error:', error);
      return [];
    }
  }

  /**
   * Add created room to history
   */
  async addCreatedRoom(room: RoomHistoryItem): Promise<void> {
    try {
      const history = await this.getCreatedRooms();
      
      // Remove if already exists
      const filtered = history.filter(item => item.roomId !== room.roomId);
      
      // Add to front
      filtered.unshift({
        ...room,
        timestamp: Date.now(),
      });
      
      // Keep only MAX_HISTORY_ITEMS
      const updated = filtered.slice(0, MAX_HISTORY_ITEMS);
      
      await AsyncStorage.setItem(CREATED_ROOMS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('[RoomHistoryStorage] Add created room error:', error);
    }
  }

  /**
   * Get joined rooms history
   */
  async getJoinedRooms(): Promise<RoomHistoryItem[]> {
    try {
      const data = await AsyncStorage.getItem(JOINED_ROOMS_KEY);
      if (data) {
        return JSON.parse(data);
      }
      return [];
    } catch (error) {
      console.error('[RoomHistoryStorage] Get joined rooms error:', error);
      return [];
    }
  }

  /**
   * Add joined room to history
   */
  async addJoinedRoom(room: RoomHistoryItem): Promise<void> {
    try {
      const history = await this.getJoinedRooms();
      
      // Remove if already exists
      const filtered = history.filter(item => item.roomId !== room.roomId);
      
      // Add to front
      filtered.unshift({
        ...room,
        timestamp: Date.now(),
      });
      
      // Keep only MAX_HISTORY_ITEMS
      const updated = filtered.slice(0, MAX_HISTORY_ITEMS);
      
      await AsyncStorage.setItem(JOINED_ROOMS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('[RoomHistoryStorage] Add joined room error:', error);
    }
  }

  /**
   * Remove a room from created history
   */
  async removeCreatedRoom(roomId: string): Promise<void> {
    try {
      const history = await this.getCreatedRooms();
      const filtered = history.filter(item => item.roomId !== roomId);
      await AsyncStorage.setItem(CREATED_ROOMS_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('[RoomHistoryStorage] Remove created room error:', error);
    }
  }

  /**
   * Remove a room from joined history
   */
  async removeJoinedRoom(roomId: string): Promise<void> {
    try {
      const history = await this.getJoinedRooms();
      const filtered = history.filter(item => item.roomId !== roomId);
      await AsyncStorage.setItem(JOINED_ROOMS_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('[RoomHistoryStorage] Remove joined room error:', error);
    }
  }

  /**
   * Clear all room history
   */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([CREATED_ROOMS_KEY, JOINED_ROOMS_KEY]);
    } catch (error) {
      console.error('[RoomHistoryStorage] Clear all error:', error);
    }
  }
}

export const roomHistoryStorage = new RoomHistoryStorage();
