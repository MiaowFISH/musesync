// app/src/services/storage/LocalStorage.ts
// AsyncStorage wrapper for local preferences

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@shared/constants';
import type { LocalPreferences, EQPreset } from '@shared/types/entities';

/**
 * LocalStorage Service
 * Wrapper around AsyncStorage with type safety
 */
export class LocalStorageService {
  /**
   * Get local preferences
   */
  async getPreferences(): Promise<LocalPreferences | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LOCAL_PREFERENCES);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[LocalStorage] Failed to get preferences:', error);
      return null;
    }
  }

  /**
   * Save local preferences
   */
  async savePreferences(preferences: LocalPreferences): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_PREFERENCES, JSON.stringify(preferences));
      return true;
    } catch (error) {
      console.error('[LocalStorage] Failed to save preferences:', error);
      return false;
    }
  }

  /**
   * Get user ID
   */
  async getUserId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
    } catch (error) {
      console.error('[LocalStorage] Failed to get user ID:', error);
      return null;
    }
  }

  /**
   * Save user ID
   */
  async saveUserId(userId: string): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, userId);
      return true;
    } catch (error) {
      console.error('[LocalStorage] Failed to save user ID:', error);
      return false;
    }
  }

  /**
   * Get device ID
   */
  async getDeviceId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    } catch (error) {
      console.error('[LocalStorage] Failed to get device ID:', error);
      return null;
    }
  }

  /**
   * Save device ID
   */
  async saveDeviceId(deviceId: string): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
      return true;
    } catch (error) {
      console.error('[LocalStorage] Failed to save device ID:', error);
      return false;
    }
  }

  /**
   * Get custom EQ presets
   */
  async getCustomEQPresets(): Promise<EQPreset[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_EQ_PRESETS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[LocalStorage] Failed to get EQ presets:', error);
      return [];
    }
  }

  /**
   * Save custom EQ presets
   */
  async saveCustomEQPresets(presets: EQPreset[]): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_EQ_PRESETS, JSON.stringify(presets));
      return true;
    } catch (error) {
      console.error('[LocalStorage] Failed to save EQ presets:', error);
      return false;
    }
  }

  /**
   * Clear all storage (for logout/reset)
   */
  async clear(): Promise<boolean> {
    try {
      await AsyncStorage.clear();
      return true;
    } catch (error) {
      console.error('[LocalStorage] Failed to clear storage:', error);
      return false;
    }
  }
}

// Singleton instance
export const localStorageService = new LocalStorageService();
