// app/src/services/storage/PlaybackStateStorage.ts
// Playback state persistence

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Track } from '@shared/types/entities';

const PLAYBACK_STATE_KEY = '@musesync:playback_state';

export interface PlaybackState {
  track: Track | null;
  position: number;
  isPlaying: boolean;
  audioUrl: string | null;
  timestamp: number;
}

class PlaybackStateStorage {
  /**
   * Save current playback state
   */
  async saveState(state: PlaybackState): Promise<void> {
    try {
      await AsyncStorage.setItem(PLAYBACK_STATE_KEY, JSON.stringify({
        ...state,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('[PlaybackStateStorage] Save state error:', error);
    }
  }

  /**
   * Get saved playback state
   */
  async getState(): Promise<PlaybackState | null> {
    try {
      const data = await AsyncStorage.getItem(PLAYBACK_STATE_KEY);
      if (!data) return null;

      const state: PlaybackState = JSON.parse(data);
      
      // Ignore state older than 24 hours
      if (Date.now() - state.timestamp > 24 * 60 * 60 * 1000) {
        await this.clearState();
        return null;
      }

      return state;
    } catch (error) {
      console.error('[PlaybackStateStorage] Get state error:', error);
      return null;
    }
  }

  /**
   * Clear saved state
   */
  async clearState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(PLAYBACK_STATE_KEY);
    } catch (error) {
      console.error('[PlaybackStateStorage] Clear state error:', error);
    }
  }
}

export const playbackStateStorage = new PlaybackStateStorage();
