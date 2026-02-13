// app/src/services/storage/RoomStateStorage.ts
// Room state persistence

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Room } from '@shared/types/entities';

const ROOM_STATE_KEY = '@musesync:room_state';

export interface RoomStateData {
  room: Room | null;
  isHost: boolean;
  timestamp: number;
}

class RoomStateStorage {
  /**
   * Save current room state
   */
  async saveState(state: RoomStateData): Promise<void> {
    try {
      await AsyncStorage.setItem(ROOM_STATE_KEY, JSON.stringify({
        ...state,
        timestamp: Date.now(),
      }));
      console.log('[RoomStateStorage] Room state saved');
    } catch (error) {
      console.error('[RoomStateStorage] Save state error:', error);
    }
  }

  /**
   * Get saved room state
   */
  async getState(): Promise<RoomStateData | null> {
    try {
      const data = await AsyncStorage.getItem(ROOM_STATE_KEY);
      if (!data) return null;

      const state: RoomStateData = JSON.parse(data);
      
      // Ignore state older than 24 hours
      if (Date.now() - state.timestamp > 24 * 60 * 60 * 1000) {
        await this.clearState();
        return null;
      }

      console.log('[RoomStateStorage] Room state restored:', state.room?.roomId);
      return state;
    } catch (error) {
      console.error('[RoomStateStorage] Get state error:', error);
      return null;
    }
  }

  /**
   * Clear saved state
   */
  async clearState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ROOM_STATE_KEY);
      console.log('[RoomStateStorage] Room state cleared');
    } catch (error) {
      console.error('[RoomStateStorage] Clear state error:', error);
    }
  }
}

export const roomStateStorage = new RoomStateStorage();
