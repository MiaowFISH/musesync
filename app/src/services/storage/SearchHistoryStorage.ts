// app/src/services/storage/SearchHistoryStorage.ts
// Search history storage service

import AsyncStorage from '@react-native-async-storage/async-storage';

const SEARCH_HISTORY_KEY = '@musictogether:search_history';
const MAX_HISTORY_ITEMS = 20;

export interface SearchHistoryItem {
  keyword: string;
  timestamp: number;
}

class SearchHistoryStorage {
  /**
   * Get search history
   */
  async getHistory(): Promise<SearchHistoryItem[]> {
    try {
      const data = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      if (data) {
        return JSON.parse(data);
      }
      return [];
    } catch (error) {
      console.error('[SearchHistoryStorage] Get history error:', error);
      return [];
    }
  }

  /**
   * Add search keyword to history
   */
  async addKeyword(keyword: string): Promise<void> {
    try {
      const trimmedKeyword = keyword.trim();
      if (!trimmedKeyword) return;

      const history = await this.getHistory();
      
      // Remove if already exists
      const filtered = history.filter(item => item.keyword !== trimmedKeyword);
      
      // Add to front
      filtered.unshift({
        keyword: trimmedKeyword,
        timestamp: Date.now(),
      });
      
      // Keep only MAX_HISTORY_ITEMS
      const updated = filtered.slice(0, MAX_HISTORY_ITEMS);
      
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('[SearchHistoryStorage] Add keyword error:', error);
    }
  }

  /**
   * Remove a keyword from history
   */
  async removeKeyword(keyword: string): Promise<void> {
    try {
      const history = await this.getHistory();
      const filtered = history.filter(item => item.keyword !== keyword);
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('[SearchHistoryStorage] Remove keyword error:', error);
    }
  }

  /**
   * Clear all search history
   */
  async clearHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (error) {
      console.error('[SearchHistoryStorage] Clear history error:', error);
    }
  }
}

export const searchHistoryStorage = new SearchHistoryStorage();
