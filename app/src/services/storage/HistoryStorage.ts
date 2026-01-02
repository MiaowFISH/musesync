// app/src/services/storage/HistoryStorage.ts
// Playback history management (max 100 tracks, FIFO)

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Track } from '@shared/types/entities';

const HISTORY_KEY = '@musictogether:history';
const MAX_HISTORY_SIZE = 100;

export interface HistoryTrack extends Track {
  playedAt: number; // Unix timestamp
}

/**
 * History Storage Service
 * Manages playback history with FIFO queue
 */
class HistoryStorage {
  /**
   * Add track to history
   * If history exceeds 100 tracks, remove oldest
   */
  async addTrack(track: Track): Promise<void> {
    try {
      const history = await this.getHistory();
      
      // Remove duplicate if exists
      const filteredHistory = history.filter(h => h.trackId !== track.trackId);
      
      // Add new track at the beginning
      const historyTrack: HistoryTrack = {
        ...track,
        playedAt: Date.now(),
      };
      filteredHistory.unshift(historyTrack);
      
      // Trim to max size (FIFO)
      if (filteredHistory.length > MAX_HISTORY_SIZE) {
        filteredHistory.splice(MAX_HISTORY_SIZE);
      }
      
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(filteredHistory));
      console.log(`[HistoryStorage] Added track: ${track.title} (total: ${filteredHistory.length})`);
    } catch (error) {
      console.error('[HistoryStorage] Add track error:', error);
    }
  }

  /**
   * Get full history (sorted by most recent first)
   */
  async getHistory(): Promise<HistoryTrack[]> {
    try {
      const value = await AsyncStorage.getItem(HISTORY_KEY);
      return value ? JSON.parse(value) : [];
    } catch (error) {
      console.error('[HistoryStorage] Get history error:', error);
      return [];
    }
  }

  /**
   * Get recent tracks (default: last 20)
   */
  async getRecentTracks(limit: number = 20): Promise<HistoryTrack[]> {
    try {
      const history = await this.getHistory();
      return history.slice(0, limit);
    } catch (error) {
      console.error('[HistoryStorage] Get recent tracks error:', error);
      return [];
    }
  }

  /**
   * Search history by keyword
   */
  async searchHistory(keyword: string): Promise<HistoryTrack[]> {
    try {
      const history = await this.getHistory();
      const lowerKeyword = keyword.toLowerCase();
      
      return history.filter(track =>
        track.title.toLowerCase().includes(lowerKeyword) ||
        track.artist.toLowerCase().includes(lowerKeyword) ||
        track.album.toLowerCase().includes(lowerKeyword)
      );
    } catch (error) {
      console.error('[HistoryStorage] Search history error:', error);
      return [];
    }
  }

  /**
   * Remove track from history
   */
  async removeTrack(trackId: string): Promise<void> {
    try {
      const history = await this.getHistory();
      const filtered = history.filter(h => h.trackId !== trackId);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('[HistoryStorage] Remove track error:', error);
    }
  }

  /**
   * Clear all history
   */
  async clearHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(HISTORY_KEY);
      console.log('[HistoryStorage] History cleared');
    } catch (error) {
      console.error('[HistoryStorage] Clear history error:', error);
    }
  }

  /**
   * Get history stats
   */
  async getStats(): Promise<{ totalTracks: number; oldestPlayedAt?: number; newestPlayedAt?: number }> {
    try {
      const history = await this.getHistory();
      return {
        totalTracks: history.length,
        oldestPlayedAt: history.length > 0 ? history[history.length - 1].playedAt : undefined,
        newestPlayedAt: history.length > 0 ? history[0].playedAt : undefined,
      };
    } catch (error) {
      console.error('[HistoryStorage] Get stats error:', error);
      return { totalTracks: 0 };
    }
  }
}

// Singleton instance
export const historyStorage = new HistoryStorage();
